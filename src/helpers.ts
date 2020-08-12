export const MONTHS = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

export function epochSecondsToDate(seconds: number): Date {
    return new Date(seconds * 1000);
}

export function buildTideString(tides: SurflineTidesResponse[]): string {
    const date = tides[0].timestamp as Date;
    let tidesStr: string = `${MONTHS[date.getMonth()]} ${date.getDate()}: `;
    let dailyTides: string[] = [];
    for (let tideObj of tides) {
        const tideDate = tideObj.timestamp as Date;
        dailyTides.push(`${tideObj.type} at ${tideDate.getHours()}:${twoDigits(tideDate.getMinutes())}`);
    }

    tidesStr += dailyTides.join(", ");
    return tidesStr;
}

export function buildSwellString(swellObjs: SurflineWaveResponse[]): string {
    const date = swellObjs[0].timestamp as Date;
    console.log(swellObjs[0].surf);
    let swellStr: string = `${MONTHS[date.getMonth()]} ${date.getDate()}: `;
    let dailySwell: string[] = [];
    for (let swellObj of swellObjs) {
        const swellDate = swellObj.timestamp as Date;
        dailySwell.push(`${swellObj.surf.min!!.toFixed(1)}-${swellObj.surf.max!!.toFixed(1)} AT ${swellDate.getHours()}:${twoDigits(swellDate.getMinutes())}`);
    }

    swellStr += dailySwell.join(", ");
    return swellStr;
}

// Zero pad the front of a number if it is only 1 digit.
// Will throw if number > two digits. Used for correctly
// displaying times
export function twoDigits(num: number) {
    if (num > 99 || num < 0) {
        throw new Error(`Attempted to use ${twoDigits.name} with a number outside the bounds: ${num}`);
    }

    return ("0" + num).slice(-2)
}
