import express from "express";
import {Router} from "express";
import fs from 'fs';
import moment from "moment-timezone";
import fetch from "node-fetch";
import path from "path";

import {
    defaultCustomScreenTestImage,
    defaultOWMWindErrorChartFilepath,
    defaultPlotlyErrorSwellChartFilepath,
    defaultPlotlyErrorTideChartFilepath,
    // TODO :: remove
    defaultRendersDir,
    defaultSurflineSwellErrorChartFilepath,
    defaultWorldTidesTideErrorChartFilepath,
    degreesToDirStr,
    getCurrentTideHeight,
    getTideExtremes,
    MONTHS,
    rendersDir,
    roundToMaxSingleDecimal,
    SpotCheckRevision,
} from "./helpers";
import * as owmHelper        from "./open-weather-map-helper";
import * as render           from "./render";
import * as surflineHelper   from "./surfline-helper";
import * as worldTidesHelper from "./world-tides-helper";

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

        let tidesRes = null;
        try {
            // TODO :: get correct date depending on user's utc offset, or maybe just the spot's utc offset
            tidesRes = await worldTidesHelper.getTides(latitude, longitude);
        } catch (err) {
            // World Tides request failed for some reason (straight request, no parsing done), return placeholder
            // image
            const errCast = err as Error;
            console.error(`Request to World Tides API failed, sending conditions object with fake data - ${
                errCast.name}: ${errCast.message}`);
        }

        let currentTideObj: CurrentTide = {height : -99, rising : false};
        if (!tidesRes || !tidesRes.heights || tidesRes.heights.length == 0) {
            console.error(
                `Request to world tides API succeeded but response has no 'heights' propery or a length of zero, returning succes code w/ error condition vals. CHECK WORLDTIDES API CREDIT COUNT!`);
        } else {
            currentTideObj = getCurrentTideHeight(tidesRes!.heights);
        }

        let weatherResponse: Weather = {temperature : 0, wind : {speed : 0, deg : 0}};
        try {
            weatherResponse = await owmHelper.getCurrentWeather(latitude, longitude);
        } catch (err) {
            const errCast = err as Error;
            console.error(`Request to OWM failed, sending conditions object with fake data - ${errCast.name}: ${
                errCast.message}`);
        }

        // We don't want to show the user fractional temp degrees/mph, so cast tide as string and round temp and
        // wind_speed
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
        let tidesRes: WorldTidesResponse;
        try {
            tidesRes = await worldTidesHelper.getTides(latitude, longitude);
        } catch (err) {
            const errCast = err as Error;
            // World Tides API request failed for some reason (straight request, no parsing done), return
            // placeholder image
            console.error(`Request to world tides API failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultWorldTidesTideErrorChartFilepath, "world_tides_tide_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default world tides tide err chart: ${downloadErr}`);
                }
            });
        }

        // Make sure we actually got back correct data (this will catch the case of API credits running out for
        // worldtides api)
        if (!tidesRes || !tidesRes.heights || tidesRes.heights.length == 0) {
            console.error(
                `Request to world tides API succeeded but response has no 'heights' propery or a length of zero, returning succes code w/ error text placeholder chart. CHECK WORLDTIDES API CREDIT COUNT!`);
            return res.download(defaultWorldTidesTideErrorChartFilepath, "world_tides_tide_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default world tides tide err chart: ${downloadErr}`);
                }
            });
        }

        // Switch timestamps received from server to moment objects. Use the nice ISO date string for each height
        // instead of the epoch time field. When using the 'date=today' query param, the API returns 1 day worth of
        // tides starting at midnight local time but the actual time values are UTC.
        const tidesWithResponseOffset =
            tidesRes.heights.map(x => ({...x, timestamp : moment.utc(x.date).tz(tidesRes.timezone)}));

        const xValues: number[] = tidesWithResponseOffset.map(x => x.timestamp.hour() + x.timestamp.minute() / 60);

        // Hack the final value (which is midnight starting the next day) to 24, since it normally would be zero and
        // overlapping with the already-existing 0 at the 0th index for midnight of this day
        if (xValues.length == 25 && xValues[24] == 0) {
            xValues[24] = 24;
        }

        const yValues: number[] = tidesWithResponseOffset.map(x => x.height);
        const xAxisTitle: string =
            tidesWithResponseOffset[0].timestamp.format("dddd MM/DD");  // Friday 12/22, non-localized but eh

        const tideChartFilename = `tide_chart_${deviceId}.svg`;
        let   generatedRawFilepath: string;
        try {
            generatedRawFilepath =
                await render.renderTideChart(tideChartFilename, xValues, yValues, xAxisTitle, width, height);
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
                    console.error(`Error erasing image ${tideChartFilename} after sending, non-fatal`);
                }
            });

            // Delete the RAW image that was returned to the client with the full filpath + filename returned by the
            // render function
            fs.unlink(generatedRawFilepath, (err) => {
                if (err) {
                    console.error(`Error erasing image ${tideChartFilename} after sending, non-fatal`);
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
            rawSwell = await surflineHelper.getWavesBySpotId(spotId, 5, 1);
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

    /*
     * Render a 2 pixels-per-byte, black and white raw array of data and return it to caller
     * Test curl (lat/lon only things used for wind forecast, spot_id doesn't matter):
     */
    // clang-format off
    // curl -k -X GET "https://localhost:9443/wind_chart?lat=33.5930302087&lon=-117.8819918632&spot_id=SPOT_ID&width=WW&h=HH&device_id=ff-ff-ff-ff-ff-ff" > /dev/null
    // clang-format on
    router.get("/wind_chart", async (req: express.Request, res: express.Response) => {
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

        let rawForecast: OpenWeatherMapOneCallResponse;
        try {
            rawForecast = await owmHelper.getWeatherForecast(latitude, longitude);
        } catch (err) {
            const errCast = err as Error;
            // OpenWeatherMap request failed for some reason (straight request, no parsing done), return placeholder
            // image
            console.error(`Request to openweathermap failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultOWMWindErrorChartFilepath, "open_weather_map_wind_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(
                        `Error in response download for default open weather map wind err chart: ${downloadErr}`);
                }
            });
        }

        // Strip out the first element of the hourly array since it will be for the current hour which we already
        // have the most up-to-date data in the 'current' object of the response
        const forecastWithoutNow                      = rawForecast.hourly.slice(1);
        const rawWind: OpenWeatherMapForecastObject[] = [ rawForecast.current ].concat(forecastWithoutNow);

        // Switch timestamps received from server to moment objects. Epoch is timezone/offset-agnostic, so
        // instantiate as UTC. Use utcOffset func to shift date to user's utc offset (returned in overall forecast
        // response) to correctly interpret day of year so we know which raw wind objects to filter before burning
        // into chart. Response offset is in seconds, multiply up to hours for moment function
        const windWithResponseOffset = rawWind.map(
            x => ({
                ...x,
                timestamp : moment.utc(((x.dt as number) * 1000)).utcOffset(rawForecast.timezone_offset * 60 * 60),
            }));

        // TODO :: filter these to just 24 hours (I think the api does that but we should do it anyway)
        // Convert to local first using the utc offset returned from OWM for the requested longitude
        const nowLocal          = windWithResponseOffset[0].timestamp.local();
        const tomorrowLocal     = nowLocal.add(24, "hours");
        const xValues: number[] = windWithResponseOffset.map(x => x.timestamp.local())
                                      .filter(x => x < tomorrowLocal)
                                      .map(x => x.hour() + x.minute() / 60);
        const yValues = windWithResponseOffset.map(x => x.wind_speed);

        const windChartFilename = `wind_chart_${deviceId}.svg`;
        let   generatedRawFilepath: string;
        try {
            generatedRawFilepath = await render.renderWindChart(windChartFilename, xValues, yValues, width, height);
        } catch (err) {
            const errCast = err as Error;
            // Plotly render func failed for some reason, return placeholder image
            console.error(`Request to plotly failed, returning succes code w/ error text placeholder chart - ${
                errCast.name}: ${errCast.message}`);
            return res.download(defaultOWMWindErrorChartFilepath, "chart_render_wind_err.raw", (downloadErr) => {
                if (downloadErr) {
                    console.error(`Error in response download for default plotly wind err chart: ${downloadErr}`);
                }
            });
        }

        return res.download(generatedRawFilepath, windChartFilename, (err) => {
            if (err) {
                console.error(`Error in response download for wind chart: ${err}`);
            }

            // Delete human-viewable svg by joining original svg filename with the known path to the renders dir
            fs.unlink(path.join(rendersDir, windChartFilename), (err) => {
                if (err) {
                    console.error(`Error erasing image ${windChartFilename} after sending, non-fatal`)
                }
            });

            // Delete the RAW image that was returned to the client with the full filpath + filename returned by the
            // render function
            fs.unlink(generatedRawFilepath, (err) => {
                if (err) {
                    console.error(`Error erasing image ${windChartFilename} after sending, non-fatal`)
                }
            });
        });
    });

    router.get("/custom_screen_test_image",
               async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                   // TODO :: remove
                   const rawPath = await render.convertImageToRawPacked(
                       defaultRendersDir + "/default_custom_screen_test_image.jpeg",
                       800,
                       600);
                   return res.download(defaultCustomScreenTestImage, "custom_screen_test_image.raw", (downloadErr) => {
                       if (downloadErr) {
                           console.error(`Error in response download for custom screen test image: ${downloadErr}`);
                       }
                   });
               });

    router.get("/test_error",
               async (req: express.Request,
                      res: express.Response,
                      next: express.NextFunction) => { throw new Error("test_error endpoint"); });

    return router;
}
