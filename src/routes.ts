import express from "express";
import { Router } from "express";
import fetch from "node-fetch";

import * as surfline from "./surfline";
import { epochSecondsToDate, MONTHS, buildTideString, buildSwellString } from "./helpers";

export default function(): express.Router {
    const router = Router();

    router.get("/tides", async (req: express.Request, res: express.Response) => {
        const days = req.query.days as unknown as number;

        let rawTides: SurflineTidesResponse[] = []
        if (req.query.spot_id) {
            const spotId = req.query.spot_id as unknown as string;
            rawTides = await surfline.getTidesBySpotId(spotId, days);

        } else if (req.query.spot_name) {
            const spotName = req.query.spot_name as unknown as string;
            rawTides = await surfline.getTidesBySpotName(spotName, days);
        }

        // Group tides by day sorted in time-order within each day
        // Should come sorted from server but do it anyway
        const tideExtremes: { [key: number]: SurflineTidesResponse[] } = rawTides
            .filter(x => x.type == "HIGH" || x.type == "LOW")
            .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
            .reduce((aggregate: { [key: number]: SurflineTidesResponse[] }, element: SurflineTidesResponse) => {
                const date = epochSecondsToDate(element.timestamp as number);

                // Overwrite epoch timestamp with parsed date
                element.timestamp = date;
                const day = date.getDate() as number;
                if (aggregate[day]) {
                    aggregate[day].push(element);
                } else {
                    aggregate[day] = [element];
                }

                return aggregate;
            }, {});

        const tideStrings = Object.keys(tideExtremes).map((x: string) => buildTideString(tideExtremes[Number(x)]));
        let responseObj: TidesResponse = {
            errorMessage: undefined,
            data: tideStrings
        };

        return res.json(responseObj);
    });

    router.get("/swell", async (req: express.Request, res: express.Response) => {
        const days = req.query.days as unknown as number;
        // let spotId: string | undefined = undefined;
        // if (req.query.spot_name) {
        //     const spotNameUppercase: string = (req.query.spot_name as string).toUpperCase();
        //     if (surfline.SPOT_IDS_BY_NAME.hasOwnProperty(spotNameUppercase)) {
        //         spotId = surfline.SPOT_IDS_BY_NAME[spotNameUppercase];
        //     }
        // }

        let rawSwell: SurflineWaveResponse[] = []
        if (req.query.spot_id) {
            const spotId = req.query.spot_id as unknown as string;
            rawSwell = await surfline.getWavesBySpotId(spotId, days);

        } else if (req.query.spot_name) {
            const spotName = req.query.spot_name as unknown as string;
            rawSwell = await surfline.getWavesBySpotName(spotName, days);
        }

        // const rawSwell: SurflineWaveResponse[] = await surfline.getWaves(spotId, days);
        const parsedSwell: { [key: number]: SurflineWaveResponse[] } = rawSwell
            .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
            .reduce((aggregate: { [key: number]: SurflineWaveResponse[] }, element: SurflineWaveResponse) => {
                // We don't care about anything between 9:01pm and 2:59am
                // This only drops the midnight entry for 6-hour intervals
                // but can be more effective on smaller interval ranges
                const date = epochSecondsToDate(element.timestamp as number);
                if (date.getHours() < 3 || date.getHours() > 21) {
                    return aggregate;
                }

                // Overwrite epoch timestamp with parsed date
                element.timestamp = date;
                const day = date.getDate() as number;
                if (aggregate[day]) {
                    aggregate[day].push(element);
                } else {
                    aggregate[day] = [element];
                }
                return aggregate;
            }, {});

        const swellStrings = Object.keys(parsedSwell).map((x: string) => buildSwellString(parsedSwell[Number(x)]));
        const responseObj: TidesResponse = {
            errorMessage: undefined,
            data: swellStrings
        };

        return res.json(responseObj);
    });

    router.get("/weather", async (req: express.Request, res: express.Response) => {
        const latitude: number = req.query.lat as unknown as number;
        const longitude: number = req.query.lon as unknown as number;

        if (!latitude || !longitude) {
            console.log(`Received weather request with missing lat or lon (${req.query.lat} - ${req.query.lon})`);
            res.status(400).send();
            return;
        }

        const unparsedRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=90588fb9a78661c1b8828a5e2cff675d&units=imperial`)
        const weatherResponse: OpenWeatherMapResponse = await unparsedRes.json();
        if (weatherResponse.cod as number >= 400) {
            console.log(`Recieved ${weatherResponse.cod} from external weather api`);
            const errorJson: TidesResponse = {
                errorMessage: weatherResponse.message,
                data: undefined
            };

            return res.status(weatherResponse.cod as number).json(errorJson);
        }

        const responseObj: TidesResponse = {
            errorMessage: undefined,
            data: {
                // We don't want A) our embedded code to have to deal with floating point and B) to show the user fractional degrees
                temp: Math.round(weatherResponse.main.temp)
            }
        };

        return res.json(responseObj);
    });

    return router;
}
