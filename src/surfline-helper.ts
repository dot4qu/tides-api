import moment from "moment-timezone";
import fetch from "node-fetch";

import {MONTHS, SpotCheckRevision} from "./helpers";

enum SurflineForecastType {
    WAVE     = "wave",
    TIDES    = "tides",
    OVERVIEW = "overview"
}

export const SPOT_IDS_BY_NAME: {
    [key: string]: string,
} = {
    "PACIFICA" : "5842041f4e65fad6a7708976",
    "OCEAN_BEACH" : "5842041f4e65fad6a77087f8",
    "WEDGE" : "5842041f4e65fad6a770882b",
};

const SURFLINE_BASE_URL = "https://services.surfline.com/kbyg/spots/forecasts/"
const PACIFICA_SPOT_ID  = "5842041f4e65fad6a7708976"

function getSurflineApiUrl(forecastType: SurflineForecastType, spotId: string, days: number, intervalHours: number):
    string {
    let queryParams = `?spotId=${spotId}`;
    switch (forecastType) {
        case SurflineForecastType.WAVE:
            queryParams += `&days=${days}&intervalHours=${intervalHours}&maxHeights=false`;
            break;
        case SurflineForecastType.TIDES:
            queryParams += `&days=${days}`;
            break;
        case SurflineForecastType.OVERVIEW:
            queryParams += "subregionId=5cc73566c30e4c0001096989&meterRemaining=undefined";
            break;
        default:
            break;
    }

    // console.log(SURFLINE_BASE_URL + forecastType + queryParams);
    return SURFLINE_BASE_URL + forecastType + queryParams;
}

export async function getTidesBySpotName(spotName: string = PACIFICA_SPOT_ID,
                                         days: number     = 3): Promise<SurflineTidesResponse[]> {
    const spotNameUppercase: string = spotName.toUpperCase();
    let   spotId: string            = PACIFICA_SPOT_ID;
    if (SPOT_IDS_BY_NAME.hasOwnProperty(spotNameUppercase)) {
        spotId = SPOT_IDS_BY_NAME[spotNameUppercase];
    }

    return await getTidesBySpotId(spotId, days);
}

export async function getTidesBySpotId(spotId: string, days: number = 3): Promise<SurflineTidesResponse[]> {
    const url                               = getSurflineApiUrl(SurflineForecastType.TIDES, spotId, days, 0);
    const unparsedRes                       = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data.tides!;
}

export async function getWavesBySpotName(spotName: string      = PACIFICA_SPOT_ID,
                                         days: number          = 3,
                                         intervalHours: number = 4): Promise<SurflineWaveResponse[]> {
    const spotNameUppercase: string = spotName.toUpperCase();
    let   spotId: string            = PACIFICA_SPOT_ID;
    if (SPOT_IDS_BY_NAME.hasOwnProperty(spotNameUppercase)) {
        spotId = SPOT_IDS_BY_NAME[spotNameUppercase];
    }

    return await getWavesBySpotId(spotId, days, intervalHours);
}

export async function getWavesBySpotId(spotId: string, days: number = 3, intervalHours: number = 4):
    Promise<SurflineWaveResponse[]> {
    const url                               = getSurflineApiUrl(SurflineForecastType.WAVE, spotId, days, intervalHours);
    const unparsedRes                       = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data.wave!!;
}

export function parseSwell(rawSwell: SurflineWaveResponse[]): {[key: number]: SurflineWaveResponse[]} {
    const parsedSwell: {[key: number]: SurflineWaveResponse[]} =
        rawSwell.sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
            .reduce((aggregate: {[key: number]: SurflineWaveResponse[]}, element: SurflineWaveResponse) => {
                // We don't care about anything between 9:01pm and 2:59am
                // This only drops the midnight entry for 6-hour intervals
                // but can be more effective on smaller interval ranges
                const date = moment((element.timestamp as number) * 1000);
                if (date.hour() < 3 || date.hour() > 21) {
                    return aggregate;
                }

                // Overwrite epoch timestamp with parsed date
                element.timestamp = date;
                const day         = date.date() as number;
                if (aggregate[day]) {
                    aggregate[day].push(element);
                } else {
                    aggregate[day] = [ element ];
                }
                return aggregate;
            }, {});

    return parsedSwell;
}
