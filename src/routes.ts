import express from "express";
import {Router} from "express";
import fs from 'fs';
import fetch from "node-fetch";

import {
    buildSwellString,
    buildTideString,
    degreesToDirStr,
    epochSecondsToDate,
    getCurrentTideHeight,
    getTideExtremes,
    getWeather,
    MONTHS,
    roundToMaxSingleDecimal,
    SpotCheckRevision
} from "./helpers";
import * as render   from "./render";
import * as surfline from "./surfline";

const fsPromises      = fs.promises;
const versionFilePath = "./fw_versions";

export default function(): express.Router {
    const router = Router();

    router.get("/health",
               (req: express.Request, res: express.Response) => { return res.send("surviving not thriving"); });

    router.get("/tides", async (req: express.Request, res: express.Response) => {
        const days = req.query.days as unknown as number;

        let rawTides: SurflineTidesResponse[] = [];
        if (req.query.spot_id) {
            const spotId = req.query.spot_id as unknown as string;
            rawTides     = await                            surfline.getTidesBySpotId(spotId, days);
        } else if (req.query.spot_name) {
            const spotName = req.query.spot_name as unknown as string;
            rawTides       = await                                surfline.getTidesBySpotName(spotName, days);
        }

        const tideExtremes: {[key: number]: SurflineTidesResponse[]} = getTideExtremes(rawTides);
        const tideStrings                                            = Object.keys(tideExtremes)
                                .map((x: string) => buildTideString(tideExtremes[Number(x)], SpotCheckRevision.Rev2));
        let responseObj: TidesResponse = {errorMessage : undefined, data : tideStrings};

        return res.json(responseObj);
    });

    router.get("/swell", async (req: express.Request, res: express.Response) => {
        const days = req.query.days as unknown as number;

        let rawSwell: SurflineWaveResponse[] = [];
        if (req.query.spot_id) {
            const spotId = req.query.spot_id as unknown as string;
            rawSwell     = await                            surfline.getWavesBySpotId(spotId, days);
        } else if (req.query.spot_name) {
            const spotName = req.query.spot_name as unknown as string;
            rawSwell       = await                                surfline.getWavesBySpotName(spotName, days);
        }

        const parsedSwell: {[key: number]: SurflineWaveResponse[]} =
            rawSwell.sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
                .reduce((aggregate: {[key: number]: SurflineWaveResponse[]}, element: SurflineWaveResponse) => {
                    // We don't care about anything between 9:01pm and 2:59am
                    // This only drops the midnight entry for 6-hour intervals
                    // but can be more effective on smaller interval ranges
                    const date = epochSecondsToDate(element.timestamp as number);
                    if (date.getHours() < 3 || date.getHours() > 21) {
                        return aggregate;
                    }

                    // Overwrite epoch timestamp with parsed date
                    element.timestamp = date;
                    const day         = date.getDate() as number;
                    if (aggregate[day]) {
                        aggregate[day].push(element);
                    } else {
                        aggregate[day] = [ element ];
                    }
                    return aggregate;
                }, {});

        const swellStrings = Object.keys(parsedSwell)
                                 .map((x: string) => buildSwellString(parsedSwell[Number(x)], SpotCheckRevision.Rev2));
        const responseObj: TidesResponse = {errorMessage : undefined, data : swellStrings};

        return res.json(responseObj);
    });

    router.get("/conditions", async (req: express.Request, res: express.Response) => {
        const latitude: number  = req.query.lat as unknown   as number;
        const longitude: number = req.query.lon as unknown  as number;
        const spotId: string    = req.query.spot_id as unknown as string;

        if (!latitude || !longitude) {
            console.log(`Received weather request with missing lat or lon (${req.query.lat} - ${req.query.lon})`);
            res.status(400).send();
            return;
        }

        if (!spotId || spotId === "") {
            return -99;
        }

        const tidesRes = await                       surfline.getTidesBySpotId(spotId, 1);
        let                                          currentTideObj: CurrentTide = getCurrentTideHeight(tidesRes);
        const weatherResponse: TidesResponse = await getWeather(latitude, longitude);
        if (weatherResponse.errorMessage) {
            return res.status(500).json(weatherResponse);
        }

        const windDirStr: string = degreesToDirStr(weatherResponse.data.wind.deg);

        // We don't want A) our embedded code to have to deal with floating point
        // and B) to show the user fractional degrees/mph, so round temp and
        // wind_speed and cast tide as string
        const responseObj: TidesResponse = {
            errorMessage : undefined,
            data : {
                temp : Math.round(weatherResponse.data.temp),
                wind_speed : Math.round(weatherResponse.data.wind.speed),
                wind_dir : windDirStr,
                tide_height : currentTideObj.height
            }
        };

        return res.json(responseObj);
    });

    router.post("/ota/version_info", async (req: express.Request, res: express.Response) => {
        if (!req.body || !req.body.current_version) {
            // Unproccessable Entity
            console.error(
                "Received POST for version info with either no body or no 'current_version' key sending 422. Body:");
            console.error(req.body);
            return res.status(422).send();
        }

        const reqBody: VersionRequest = req.body as VersionRequest;
        let                                      versionFile;
        try {
            versionFile = await fsPromises.readFile(`${versionFilePath}/current_version.txt`);
        } catch (e) {
            console.error("Error opening current_version text file: ");
            console.error(e);
            return res.status(503);
        }

        const versionStr: string = versionFile.toString().trim();
        if (reqBody.current_version > versionStr) {
            console.log(
                `Received version check POST with FW current version > version stored in server version.txt. received: ${
                    reqBody.current_version}, server: ${versionStr}`)
        }
        const retVal: VersionResponse = {
            server_version : versionStr,
            needs_update : reqBody.current_version != undefined && reqBody.current_version < versionStr,
        };

        return res.json(retVal);
    });

    router.get("/ota/get_binary", async (req: express.Request, res: express.Response) => {
        let binaryPath = undefined;
        if (req.query.version) {
            const queryStr: string = req.query.version as string;
            // TODO :: regex validate this (or check from known available versions)

            const requestedVersionNumberStrs: string[] = queryStr.split(".");
            const requestedBinaryPath = `${versionFilePath}/spot-check-embedded-${requestedVersionNumberStrs[0]}-${
                requestedVersionNumberStrs[1]}-${requestedVersionNumberStrs[2]}.bin`;

            try {
                await fsPromises.access(requestedBinaryPath);
                binaryPath = requestedBinaryPath;
            } catch (e) {
                console.error(`Received request for binary version ${queryStr} but don't have matching filepath ${
                    requestedBinaryPath}, falling back to current version`);
                binaryPath = undefined;
            }
        }

        // If they didn'trequest a specific version or if we didn't have the binary they requested
        if (!binaryPath) {
            // Get most current version first
            let versionFile;
            try {
                versionFile = await fsPromises.readFile(`${versionFilePath}/current_version.txt`);
            } catch (e) {
                console.error("Error opening current_version text file: ");
                console.error(e);
                return res.status(503).send();
            }

            const currentVersionNumberStrs: string[] = versionFile.toString().trim().split(".");
            const currentBinaryPath = `${versionFilePath}/spot-check-embedded-${currentVersionNumberStrs[0]}-${
                currentVersionNumberStrs[1]}-${currentVersionNumberStrs[2]}.bin`;

            try {
                // if this fails, somethings messed up on the server side and we're missing a binary
                await fsPromises.access(currentBinaryPath);
                binaryPath = currentBinaryPath;
            } catch (e) {
                // TODO :: try to find the most recent good binary we have access to here
                console.error(`Received ota binary request but don't have matching binary filepath ${
                    currentBinaryPath} in current_version file, unrecoverable.`);
                return res.status(503).send();
            }
        }

        res.sendFile(binaryPath, {root : `${__dirname}/..`});
    });

    router.get("/test_image", async (req: express.Request, res: express.Response) => {
        // const renderFilename: string = render.renderSmolImage();
        // const renderFilename: string = render.renderScreenFromData(text);
        const renderFilename = "render.raw";
        res.download(`${__dirname}/../${render.rendersDir}/${renderFilename}`, "default_name_img.jpeg");
    });

    router.get("/screen_update", async (req: express.Request, res: express.Response) => {
        const latitude: number  = req.query.lat as unknown   as number;
        const longitude: number = req.query.lon as unknown  as number;
        const spotId: string    = req.query.spot_id as unknown as string;
        const days              = req.query.days as unknown              as number;

        if (!latitude || !longitude || !spotId) {
            console.log(`Received full screen update req with missing lat, lon, or spot id (${req.query.lat} - ${
                req.query.lon} - ${spotId})`);
            res.status(400).send("Missing request data");
            return;
        }

        // Current tide height from surfline
        const rawTides                                     = await surfline.getTidesBySpotId(spotId, days);
        let                    currentTideObj: CurrentTide = getCurrentTideHeight(rawTides);

        // Air temp, wind dir, windspeed from weather api
        const weatherResponse: TidesResponse = await getWeather(latitude, longitude);
        if (weatherResponse.errorMessage) {
            return res.status(500).json(weatherResponse);
        }
        const windDirStr: string = degreesToDirStr(weatherResponse.data.wind.deg);

        // Swell info from surfline
        let rawSwell: SurflineWaveResponse[] = [];
        if (req.query.spot_id) {
            const spotId = req.query.spot_id as unknown as string;
            rawSwell     = await                            surfline.getWavesBySpotId(spotId, days);
        } else if (req.query.spot_name) {
            const spotName = req.query.spot_name as unknown as string;
            rawSwell       = await                                surfline.getWavesBySpotName(spotName, days);
        }

        const parsedSwell: {[key: number]: SurflineWaveResponse[]} = surfline.parseSwell(rawSwell);

        // Render all info into screen
        const renderFilename: string = await render.renderScreenFromData(weatherResponse.data.temperature,
                                                                         weatherResponse.data.wind.speed,
                                                                         windDirStr,
                                                                         currentTideObj.height,
                                                                         currentTideObj.rising,
                                                                         rawTides,
                                                                         Object.values(parsedSwell)[0]);

        res.download(`${__dirname}/../${render.rendersDir}/${renderFilename}`, "default_name_img.jpeg");
    });

    /*
     * For testing screen layout render when dev machine has no internet connection. Separate route to keep main handler
     * logic clean.
     */
    router.get("/screen_update_offline", async (req: express.Request, res: express.Response) => {
        const renderFilename = await render.renderScreenFromDataOffline();
        return res.download(`${__dirname}/../${render.rendersDir}/${renderFilename}`, "default_name_offline_img.jpeg");
    });

    /*
     * For testing only for right now, would be useful in the future for partial screen updates
     */
    router.get("/tides_graph", async (req: express.Request, res: express.Response) => {
        let latitude: number  = req.query.lat as unknown as number;
        let longitude: number = req.query.lon as unknown as number;
        let spotId: string    = req.query.spot_id as unknown as string;
        if (!latitude) {
            latitude = 37.7500186826;
        }
        if (!longitude) {
            longitude = -122.5116348267;
        }
        if (!spotId) {
            spotId = "58bdda3582d034001252e3d0";
        }

        // Current tide height from surfline
        const rawTides = await surfline.getTidesBySpotId(spotId, 1);
        let                    tideChartFilename: string;
        try {
            tideChartFilename = await render.renderTideChart(rawTides);
        } catch (e) {
            return res.status(500).send("Failed to generate tide chart");
        }

        return res.download(`${__dirname}/../${render.rendersDir}/${tideChartFilename}`, "tide_chart.jpeg")
    });

    return router;
}
