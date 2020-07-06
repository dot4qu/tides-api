import fetch from "node-fetch";

enum SurflineForecastType {
    WAVE = "wave",
    TIDES = "tides",
    OVERVIEW = "overview"
}

const SURFLINE_BASE_URL = "https://services.surfline.com/kbyg/spots/forecasts/"
const PACIFICA_SPOT_ID = "5842041f4e65fad6a7708976"

function getSurflineApiUrl(forecastType: SurflineForecastType, spotId: string): string {
    let queryParams = `?spotId=${spotId}`;
    switch (forecastType) {
        case SurflineForecastType.WAVE:
            queryParams += "&days=17&intervalHours=6&maxHeights=true";
        break;
        case SurflineForecastType.TIDES:
            queryParams += "&days=6";
        break;
        case SurflineForecastType.OVERVIEW:
            queryParams += "subregionId=5cc73566c30e4c0001096989&meterRemaining=undefined";
        break;
        default:
        break;
    }

    return SURFLINE_BASE_URL + forecastType + queryParams;
}

export async function getTides(spotId: string = PACIFICA_SPOT_ID): Promise<any> {
    const url = getSurflineApiUrl(SurflineForecastType.TIDES, spotId);
    const unparsedRes = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data;
}

export async function getWaves(spotId: string = PACIFICA_SPOT_ID): Promise<any> {
    const url = getSurflineApiUrl(SurflineForecastType.WAVE, spotId);
    const unparsedRes = await fetch(url);
    const response: SurflineBaseApiResponse = await unparsedRes.json();
    return response.data;
}
