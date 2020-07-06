export const MONTHS = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

export function epochSecondsToDate(seconds: number): Date {
    return new Date(seconds * 1000);
}

export function buildTideString(tides: SurflineTidesResponse[]): string {
    const date = tides[0].timestamp as Date;
    let tidesStr: string = `${MONTHS[date.getMonth()]} ${date.getDate()}: `;
    let temps: string[] = [];
    for (let tideObj of tides) {
        const tideDate = tideObj.timestamp as Date;
        temps.push(`${tideObj.type} at ${tideDate.getHours()}:${tideDate.getMinutes()}`);
    }

    tidesStr += temps.join(", ");
    return tidesStr;
}
