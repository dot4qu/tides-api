import fetch from "node-fetch";

enum SurflineForecastType {
    WAVE = "wave",
    TIDES = "tides",
    OVERVIEW = "overview"
}

export const SPOT_IDS_BY_NAME: {
   [key: string]: string,
  } = {
    "PACIFICA": "5842041f4e65fad6a7708976",
    "OCEAN_BEACH": "5842041f4e65fad6a77087f8",
    "WEDGE": "5842041f4e65fad6a770882b",
};

const SURFLINE_BASE_URL = "https://services.surfline.com/kbyg/spots/forecasts/"
const PACIFICA_SPOT_ID = "5842041f4e65fad6a7708976"

function getSurflineApiUrl(forecastType: SurflineForecastType, spotId: string, days: number = 3): string {
    let queryParams = `?spotId=${spotId}`;
    switch (forecastType) {
        case SurflineForecastType.WAVE:
            queryParams += `&days=${days}&intervalHours=6&maxHeights=false`;
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

    return SURFLINE_BASE_URL + forecastType + queryParams;
}

export async function getTides(spotId: string = PACIFICA_SPOT_ID, days: number = 3): Promise<SurflineTidesResponse[]> {
    const url = getSurflineApiUrl(SurflineForecastType.TIDES, spotId, days);
    const unparsedRes = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data.tides!;
}

export async function getWaves(spotId: string = PACIFICA_SPOT_ID, days: number = 3): Promise<SurflineWaveResponse[]> {
    const url = getSurflineApiUrl(SurflineForecastType.WAVE, spotId, days);
    const unparsedRes = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data.wave!!;
}
