import moment from "moment-timezone";
import path from "path";

export const MONTHS = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
export const rendersDir: string        = "temp_renders";
export const defaultRendersDir: string = "default_renders";
export const versionFilePath           = "./fw_versions";
export const defaultWorldTidesTideErrorChartFilepath =
    path.join(defaultRendersDir, "default_worldtides_tide_error_chart.raw");
export const defaultSurflineSwellErrorChartFilepath =
    path.join(defaultRendersDir, "default_surfline_swell_error_chart.raw");
export const defaultOWMWindErrorChartFilepath    = path.join(defaultRendersDir, "default_owm_wind_error_chart.raw");
export const defaultPlotlyErrorTideChartFilepath = path.join(defaultRendersDir, "default_plotly_error_tide_chart.raw");
export const defaultPlotlyErrorSwellChartFilepath =
    path.join(defaultRendersDir, "default_plotly_error_swell_chart.raw");
export const defaultPlotlyErrorWindChartFilepath = path.join(defaultRendersDir, "default_plotly_error_wind_chart.raw");

export enum SpotCheckRevision {
    Rev2,
    Rev3,
}

/*
 * Zero pad the front of a number if it is only 1 digit.
 * Will throw if number > two digits. Used for correctly
 * displaying times
 */
export function twoDigits(num: number) {
    if (num > 99 || num < 0) {
        throw new Error(`Attempted to use ${twoDigits.name} with a number outside the bounds: ${
                    num
                }
                `);
    }

    return ("0" + num).slice(-2)
}

// Rounds anything longer than 1 decimal to one decimal. Leaves numbers w/o decimals untouched. Note use of "+" on front
// to coerce back to number
export function roundToMaxSingleDecimal(num: number) {
    const numStr: string   = num.toString() + "e+1";
    const numFloat: number = parseFloat(numStr);
    return +(Math.round(numFloat) + "e-1");
}

export function degreesToDirStr(deg: number) {
    if ((deg > 338 && deg <= 359) || (deg >= 0 && deg <= 23)) {
        return "N";
    } else if (deg > 23 && deg <= 68) {
        return "NW";
    } else if (deg > 68 && deg <= 113) {
        return "E";
    } else if (deg > 113 && deg <= 158) {
        return "SE";
    } else if (deg > 158 && deg <= 203) {
        return "S";
    } else if (deg > 203 && deg <= 248) {
        return "SW";
    } else if (deg > 248 && deg <= 293) {
        return "W";
    } else if (deg > 293 && deg <= 338) {
        return "NW";
    } else {
        console.error(`Received degrees not from 0 to 360 (value ${deg}), returning empty string`);
        return "";
    }
}

export function getCurrentTideHeight(tidesResponse: WorldTidesHeight[]): CurrentTide {
    // Zero out now min/sec/ms so we match a tide time exactly. unix() instead of valueOf() gives epoch seconds,
    // which is the epoch format world tides serves them in.
    // Rounds down for hours for now but can be tweaked to go up or down based on minute
    const nowDate = moment();
    nowDate.set({"minute" : 0, "second" : 0, "millisecond" : 0});
    const now = nowDate.unix();

    let tideHeight: number  = 0;
    let tideRising: boolean = false;
    if (tidesResponse.length > 0) {
        try {
            const matchingTimes = tidesResponse.filter(x => x.dt === now);
            if (matchingTimes.length > 0) {
                tideHeight = roundToMaxSingleDecimal(matchingTimes[0].height);

                // Make sure to multiply epoch seconds by 1000, moment() epoch constructor takes ms
                const nextHour    = moment((matchingTimes[0].dt as number) * 1000).add(1, "hour");
                const nextTideObj = tidesResponse.filter(x => x && x.dt === nextHour.unix());
                if (nextTideObj.length > 0) {
                    tideRising = nextTideObj[0].height > matchingTimes[0].height;
                } else {
                    console.warn(
                        `Could not find next tide object to determine if tide rising/falling. Current tide time: ${
                            nowDate.toString()}, next hour: ${nextHour.toString()}`);
                    tideRising = false;
                }
            } else {
                console.error(
                    `Had list of tides but rounded now epoch didn't match any when checking with epoch ${now}`);
                tideHeight = -99;
                tideRising = false;
            }
        } catch (e) {
            console.error(e);
            console.error(`Didn't find a matching tide time when getting conditions when checking with epoch ${now}`);
            tideHeight = -99;
            tideRising = false;
        }
    } else {
        tideHeight = -99;
        tideRising = false;
    }

    return {height : tideHeight, rising : tideRising};
}

/*
 * Group tides by day sorted in time-order within each day
 * Should come sorted from server but do it anyway
 */
export function getTideExtremes(rawTides: SurflineTidesResponse[]): {[key: number]: SurflineTidesResponse[]} {
    const tideExtremes =
        rawTides.filter(x => x.type == "HIGH" || x.type == "LOW")
            .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
            .reduce((aggregate: {[key: number]: SurflineTidesResponse[]}, element: SurflineTidesResponse) => {
                const date = moment(element.timestamp as number * 1000);

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

    return tideExtremes;
}
