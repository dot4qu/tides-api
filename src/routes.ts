import express from "express";
import {Router} from "express";
import fs from 'fs';
import fetch from "node-fetch";

import {buildSwellString, buildTideString, degreesToDirStr, epochSecondsToDate, MONTHS} from "./helpers";
import * as surfline from "./surfline";

const fsPromises      = fs.promises;
const versionFilePath = "./fw_versions";

export default function(): express.Router {
    const router = Router();

    router.get("/health", (req: express.Request, res: express.Response) => {
        return res.send("surviving not thriving");
    });

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

        // Group tides by day sorted in time-order within each day
        // Should come sorted from server but do it anyway
        const tideExtremes: {[key: number]: SurflineTidesResponse[]} =
            rawTides.filter(x => x.type == "HIGH" || x.type == "LOW")
                .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
                .reduce((aggregate: {[key: number]: SurflineTidesResponse[]}, element: SurflineTidesResponse) => {
                    const date = epochSecondsToDate(element.timestamp as number);

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

        const tideStrings = Object.keys(tideExtremes).map((x: string) => buildTideString(tideExtremes[Number(x)]));
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

        // const rawSwell: SurflineWaveResponse[] = await surfline.getWaves(spotId,
        // days);
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

        const swellStrings = Object.keys(parsedSwell).map((x: string) => buildSwellString(parsedSwell[Number(x)]));
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

        const weatherReq = fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${
            longitude}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`)
        let tidesResPromise: Promise<SurflineTidesResponse[]>;
        if (spotId && spotId !== "") {
            tidesResPromise = surfline.getTidesBySpotId(spotId, 1);
        } else {
            tidesResPromise = Promise.resolve([]);
        }

        const results = await                                 Promise.all([ weatherReq, tidesResPromise ]);
        const weatherResponse: OpenWeatherMapResponse = await results[0].json();
        if (weatherResponse.cod as number >= 400) {
            console.log(`Recieved ${weatherResponse.cod} from external weather api`);
            const errorJson: TidesResponse = {errorMessage : weatherResponse.message, data : undefined};

            return res.status(weatherResponse.cod as number).json(errorJson);
        }

        // Zero out now so we match a tide time exactly. Divide by 1000 to switch to seconds
        // which is the epoch format surfline serves them in.
        // Rounds down for hours for now but can be tweaked to go up or down based on minute
        const nowDate = new Date();
        nowDate.setMinutes(0, 0, 0);
        const now = nowDate.getTime() / 1000;

        let tideHeight;
        if (results[1].length > 0) {
            try {
                const matchingTimes = results[1].filter(x => x && x.timestamp === now);
                if (matchingTimes.length > 0) {
                    tideHeight = matchingTimes[0].height.toString();
                } else {
                    console.error(
                        `Had list of tides but rounded now epoch didn't match any. Checking with epoch ${now}`);
                    tideHeight = "-99";
                }
            } catch (e) {
                console.error(e);
                console.error(`Didn't find a matching tide time when getting conditions. Checking with epoch ${now}`);
                tideHeight = "-99";
            }
        } else {
            tideHeight = "-99";
        }

        let windDirStr: string = degreesToDirStr(weatherResponse.wind.deg);

        // We don't want A) our embedded code to have to deal with floating point
        // and B) to show the user fractional degrees/mph, so round temp and
        // wind_speed and cast tide as string
        const responseObj: TidesResponse = {
            errorMessage : undefined,
            data : {
                temp : Math.round(weatherResponse.main.temp),
                wind_speed : Math.round(weatherResponse.wind.speed),
                wind_dir : windDirStr,
                tide_height : tideHeight
            }
        };

        return res.json(responseObj);
    });

    router.post("/version_info", async (req: express.Request, res: express.Response) => {
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

    return router;
}
