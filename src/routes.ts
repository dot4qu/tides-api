import express from "express";
import {Router} from "express";
import fs from 'fs';
import moment from "moment";
import fetch from "node-fetch";
import path from "path";

import {
    buildSwellString,
    buildTideString,
    defaultPlotlyErrorSwellChartFilepath,
    defaultPlotlyErrorTideChartFilepath,
    defaultSurflineSwellErrorChartFilepath,
    defaultSurflineTideErrorChartFilepath,
    degreesToDirStr,
    getCurrentTideHeight,
    getTideExtremes,
    getWeather,
    MONTHS,
    rendersDir,
    roundToMaxSingleDecimal,
    SpotCheckRevision,
    versionFilePath,
} from "./helpers";
import * as render   from "./render";
import * as surfline from "./surfline";

const fsPromises = fs.promises;

export default function(): express.Router {
    const router = Router();

    router.get("/health",
               (req: express.Request, res: express.Response) => { return res.send("surviving not thriving"); });

    router.get("/conditions", async (req: express.Request, res: express.Response) => {
        const latitude: number  = req.query.lat as unknown as number;
        const longitude: number = req.query.lon as unknown as number;
        const spotId: string    = req.query.spot_id as unknown as string;

        if (!latitude || !longitude || !spotId || spotId === "") {
            console.log(`Received conditions request with missing lat or lon or spotId (${req.query.lat} - ${
                req.query.lon} - ${req.query.spot_id})`);
            return res.status(400).send();
        }

        let currentTideObj: CurrentTide;
        try {
            const tidesRes = await surfline.getTidesBySpotId(spotId, 1);
            currentTideObj = getCurrentTideHeight(tidesRes);
        } catch (err) {
            // Surfline request failed for some reason (straight request, no parsing done), return placeholder image
            const errCast = err as Error;
            console.error(`Request to surfline failed, sending tides object with fake data - ${errCast.name}: ${
                errCast.message}`);

            currentTideObj = {height : 0, rising : false};
        }

        let weatherResponse: Weather;
        try {
            weatherResponse = await getWeather(latitude, longitude);
        } catch (err) {
            const errCast = err as Error;
            console.error(
                `Request to weather failed, sending tides object with fake data - ${errCast.name}: ${errCast.message}`);

            weatherResponse = {temperature : 0, wind : {speed : 0, deg : 0}};
        }

        // We don't want to show the user fractional temp degrees/mph, so cast tide as string and round temp and
        // wind_speed and
        weatherResponse.temperature = Math.round(weatherResponse.temperature);
        weatherResponse.wind.speed  = Math.round(weatherResponse.wind.speed);
        const windDirStr: string    = degreesToDirStr(weatherResponse.wind.deg);

        // We don't want our embedded code to have to deal with floating point in the case of tide height
        const responseObj: SpotCheckApiResponse = {
            errorMessage : undefined,
            data : {
                temp : weatherResponse.temperature,
                wind_speed : weatherResponse.wind.speed,
                wind_dir : windDirStr,
                tide_height : currentTideObj.height.toString(),
            }
        };

        return res.json(responseObj);
    });

    router.post("/ota/version_info", async (req: express.Request, res: express.Response) => {
        if (!req.body || !req.body.current_version) {
            console.error(
                "Received POST for version info with either no body or no 'current_version' key sending 422. Body:");
            console.error(req.body);

            // Unproccessable Entity
            return res.status(422).send();
        }

        const reqBody: VersionRequest                       = req.body as VersionRequest;
        let                                      versionStr = "";
        try {
            const versionFile = await fsPromises.readFile(`${versionFilePath}/current_version.txt`);
            versionStr        = versionFile.toString().trim();
        } catch (e) {
            console.error(
                "Error opening current_version text file! Blindly returning no update needed so we don't kick device into offline mode: ");
            console.error(e);

            // If we couldn't parse the verison file, just act like the version they sent us is the current version
            versionStr = reqBody.current_version
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
            const requestedBinaryPath = `${versionFilePath}/spot-check-firmware-${requestedVersionNumberStrs[0]}-${
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

        if (!binaryPath) {
            const reqBody: VersionRequest                       = req.body as VersionRequest;
            let                                      versionStr = "";
            try {
                const versionFile = await fsPromises.readFile(`${versionFilePath}/current_version.txt`);
                versionStr        = versionFile.toString().trim();
            } catch (e) {
                console.error(
                    "Error opening current_version text file! Blindly returning no update needed so we don't kick device into offline mode: ");
                console.error(e);

                // If we couldn't parse the verison file, just act like the version they sent us is the current version
                versionStr = reqBody.current_version;
            }

            const currentVersionNumberStrs: string[] = versionStr.split(".");
            const currentBinaryPath = `${versionFilePath}/spot-check-firmware-${currentVersionNumberStrs[0]}-${
                currentVersionNumberStrs[1]}-${currentVersionNumberStrs[2]}.bin`;

            try {
                // if this fails, somethings messed up on the server side and we're missing a binary
                await fsPromises.access(currentBinaryPath);
                binaryPath = currentBinaryPath;
            } catch (e) {
                // TODO :: try to find the most recent good binary we have access to here
                console.error(`Received ota binary request but don't have matching binary filepath ${
                    currentBinaryPath} in current_version file, unrecoverable.`);

                // we can send an error code because the on-device OTA logic doesn't go through the same auto-handling
                // of online/offline mode transitions, so the ota process will just abort
                return res.status(404).send();
            }
        }

        return res.sendFile(binaryPath, {root : `${__dirname}/..`});
    });

    /*
     * Render a 2 pixels-per-byte, black and white raw array of data and return it to caller
     * Test curl (spot_id only thing used for spot, lat/lon don't matter):
     */
    // clang-format off
    // curl -k -X GET "https://localhost:9443/tides_chart?lat=XX&lon=YY&spot_id=5842041f4e65fad6a770882b&width=WW&h=HH&device_id=ff-ff-ff-ff-ff-ff" > /dev/null
    // clang-format on
    router.get("/tides_chart", async (req: express.Request, res: express.Response) => {
        let deviceId: string = req.query.device_id as unknown as string;
        if (!deviceId) {
            console.log(`Received tides_chart req with no device id, denying`);
            res.status(422).send("Missing device_id")
            return;
        }

        let latitude: number  = req.query.lat as unknown as number;
        let longitude: number = req.query.lon as unknown as number;
        let spotId: string    = req.query.spot_id as unknown as string;
        let width: number     = req.query.width as unknown as number;
        let height: number    = req.query.height as unknown as number;
        if (!latitude || !longitude || !spotId) {
            console.log(`Received tides_chart req with missing lat, lon, or spot id (${req.query.lat} - ${
                req.query.lon} - ${spotId})`);
            res.status(422).send("Missing request data");
            return;
        }

        if (!width) {
            width = 700;
        }

        if (!height) {
            height = 200;
        }

        // Current tide height from surfline
        let rawTides: SurflineTidesResponse[]|null = null;
        try {
            rawTides = await surfline.getTidesBySpotId(spotId, 1);
        } catch (err) {
            const errCast = err as Error;
            // Surfline request failed for some reason (straight request, no parsing done), return placeholder image
            console.error(`Request to surfline failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultSurflineTideErrorChartFilepath, "surfline_tide_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default surfline tide err chart: ${downloadErr}`);
                }
            });
        }

        // Switch timestamps received from server to moment objects. Epoch is timezone/offset-agnostic, so
        // instantiate as UTC. Use utcOffset func to shift date to user's utc offset to correctly interpret day of
        // year so we know which raw tide objects to filter before burning into chart.
        const tidesWithResponseOffset = rawTides.map(
            x => ({...x, timestamp : moment.utc(((x.timestamp as number) * 1000)).utcOffset(x.utcOffset)}));
        const responseDayOfYear: number = tidesWithResponseOffset[0].timestamp.dayOfYear();
        const tidesSingleDay = tidesWithResponseOffset.filter(x => x.timestamp.dayOfYear() == responseDayOfYear);

        const xValues: number[] = tidesSingleDay.map(x => x.timestamp.hour() + x.timestamp.minute() / 60);
        const yValues: number[] = tidesSingleDay.map(x => x.height);
        const tick0: number     = tidesSingleDay[0].timestamp.hour();
        const xAxisTitle: string =
            tidesSingleDay[0].timestamp.format("dddd MM/DD");  // Friday 12/22, non-localized but eh

        const tideChartFilename = `tide_chart_${deviceId}.svg`;
        let   generatedRawFilepath: string;
        try {
            generatedRawFilepath =
                await render.renderTideChart(tideChartFilename, xValues, yValues, tick0, xAxisTitle, width, height);
        } catch (err) {
            const errCast = err as Error;
            // Plotly render func failed for some reason, return placeholder image
            console.error(`Request to plotly failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultPlotlyErrorSwellChartFilepath, "chart_render_swell_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default plotly swell err chart: ${downloadErr}`);
                }
            });
        }

        return res.download(generatedRawFilepath, tideChartFilename, (err) => {
            if (err) {
                console.error(`Error in response download for swellchart: ${err}`);
            }

            // Delete human-viewable svg by joining original svg filename with the known path to the renders dir
            fs.unlink(path.join(rendersDir, tideChartFilename), (err) => {
                if (err) {
                    console.error(`Error erasing image ${tideChartFilename} after sending, non-fatal`)
                }
            });

            // Delete the RAW image that was returned to the client with the full filpath + filename returned by the
            // render function
            fs.unlink(generatedRawFilepath, (err) => {
                if (err) {
                    console.error(`Error erasing image ${tideChartFilename} after sending, non-fatal`)
                }
            });
        });
    });

    /*
     * Render a 2 pixels-per-byte, black and white raw array of data and return it to caller
     * Test curl (spot_id only thing used for spot, lat/lon don't matter):
     */
    // clang-format off
    // curl -k -X GET "https://localhost:9443/swell_chart?lat=XX&lon=YY&spot_id=5842041f4e65fad6a770882b&width=WW&h=HH&device_id=ff-ff-ff-ff-ff-ff" > /dev/null
    // clang-format on
    router.get("/swell_chart", async (req: express.Request, res: express.Response) => {
        let deviceId: string = req.query.device_id as unknown as string;
        if (!deviceId) {
            console.log(`Received tides_chart req with no device id, denying`);
            res.status(422).send("Missing device_id")
            return;
        }

        let latitude: number  = req.query.lat as unknown as number;
        let longitude: number = req.query.lon as unknown as number;
        let spotId: string    = req.query.spot_id as unknown as string;
        let width: number     = req.query.width as unknown as number;
        let height: number    = req.query.height as unknown as number;
        if (!latitude || !longitude || !spotId) {
            console.log(`Received swell_chart req with missing lat, lon, or spot id (${req.query.lat} - ${
                req.query.lon} - ${spotId})`);
            res.status(422).send("Missing request data");
            return;
        }

        if (!width) {
            width = 700;
        }

        if (!height) {
            height = 200;
        }

        // Surfline updated API to finally enforce premium limits with permissions, which means max days requestable
        // without an premium `accessToken` query param is 5
        let rawSwell: SurflineWaveResponse[] = [];
        try {
            rawSwell = await surfline.getWavesBySpotId(spotId, 5, 1);
        } catch (err) {
            const errCast = err as Error;
            // Surfline request failed for some reason (straight request, no parsing done), return placeholder image
            console.error(`Request to surfline failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultSurflineSwellErrorChartFilepath, "surfline_swell_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default surfline tide err chart: ${downloadErr}`);
                }
            });
        }

        // Switch timestamps received from server to moment objects. Epoch is timezone/offset-agnostic, so
        // instantiate as UTC. Use utcOffset func to shift date to user's utc offset (returned in response,
        // `x.utcOffset`) to correctly interpret day of year so we know which raw tide objects to filter before
        // burning into chart.
        const swellsWithResponseOffset = rawSwell.map(
            x => ({...x, timestamp : moment.utc(((x.timestamp as number) * 1000)).utcOffset(x.utcOffset)}));

        // Returns object with keys for every day of year receieved from api starting with today. Value is a
        // DailySwellValues object with pretty str and the overall max/min for the day
        const dailySwellMaxMins = swellsWithResponseOffset.reduce(
            (aggregate: {[key: number]: DailySwellValues}, element: SurflineWaveResponse) => {
                const currentDayMoment                                      = element.timestamp as moment.Moment;
                const                                      currentDayOfYear = currentDayMoment.dayOfYear();
                const                                      currentMax       = element.surf.max!;
                const                                      currentMin       = element.surf.min!;

                // If day of week isn't in aggregate yet, add it with max and mins. Otherwise only update max and
                // min if currentelement is greater/less than existing for day
                if (aggregate[currentDayOfYear]) {
                    const dayMax                    = aggregate[currentDayOfYear].max;
                    const dayMin                    = aggregate[currentDayOfYear].min;
                    aggregate[currentDayOfYear].max = (currentMax! > dayMax) ? currentMax : dayMax;
                    aggregate[currentDayOfYear].min = (currentMin! > dayMin) ? currentMin : dayMin;
                } else {
                    aggregate[currentDayOfYear] = {
                        dayString : currentDayMoment.format("ddd DD"),
                        max : element.surf.max!,
                        min : element.surf.min!,
                    };
                }

                return aggregate;
            },
            {});

        const xValues    = Object.values(dailySwellMaxMins).map(x => x.dayString);
        const yValuesMax = Object.values(dailySwellMaxMins).map(x => x.max);
        const yValuesMin = Object.values(dailySwellMaxMins).map(x => x.min);

        const swellChartFilename = `swell_chart_${deviceId}.svg`;
        let   generatedRawFilepath: string;
        try {
            generatedRawFilepath =
                await render.renderSwellChart(swellChartFilename, xValues, yValuesMax, yValuesMin, width, height);
        } catch (err) {
            const errCast = err as Error;
            // Plotly render func failed for some reason, return placeholder image
            console.error(`Request to plotly failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultPlotlyErrorSwellChartFilepath, "chart_render_swell_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default plotly swell err chart: ${downloadErr}`);
                }
            });
        }

        return res.download(generatedRawFilepath, swellChartFilename, (err) => {
            if (err) {
                console.error(`Error in response download for swellchart: ${err}`);
            }

            // Delete human-viewable svg by joining original svg filename with the known path to the renders dir
            fs.unlink(path.join(rendersDir, swellChartFilename), (err) => {
                if (err) {
                    console.error(`Error erasing image ${swellChartFilename} after sending, non-fatal`)
                }
            });

            // Delete the RAW image that was returned to the client with the full filpath + filename returned by the
            // render function
            fs.unlink(generatedRawFilepath, (err) => {
                if (err) {
                    console.error(`Error erasing image ${swellChartFilename} after sending, non-fatal`)
                }
            });
        });
    });

    router.get("/test_error",
               async (req: express.Request,
                      res: express.Response,
                      next: express.NextFunction) => { throw new Error("test_error endpoint"); });

    return router;
}
