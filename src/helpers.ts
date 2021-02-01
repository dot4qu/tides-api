export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec"
];

export function epochSecondsToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function buildTideString(tides: SurflineTidesResponse[]): string {
  const date = tides[0].timestamp as Date;
  let tidesStr: string = `${MONTHS[date.getMonth()]} ${date.getDate()}: `;
  let dailyTides: string[] = [];
  for (let tideObj of tides) {
    const tideDate = tideObj.timestamp as Date;
    dailyTides.push(`${tideObj.type} at ${tideDate.getHours()}:${
        twoDigits(tideDate.getMinutes())}`);
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
    dailySwell.push(`${swellObj.surf.min!!.toFixed(1)}-${
        swellObj.surf.max!!.toFixed(1)} AT ${swellDate.getHours()}:${
        twoDigits(swellDate.getMinutes())}`);
  }

  swellStr += dailySwell.join(", ");
  return swellStr;
}

// Zero pad the front of a number if it is only 1 digit.
// Will throw if number > two digits. Used for correctly
// displaying times
export function twoDigits(num: number) {
  if (num > 99 || num < 0) {
    throw new Error(`Attempted to use ${
        twoDigits.name} with a number outside the bounds: ${num}`);
  }

  return ("0" + num).slice(-2)
}

export function degreesToDirStr(deg: number) {
  if (deg > 338 && deg <= 23) {
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
