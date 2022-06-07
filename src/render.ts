import {createCanvas} from "canvas";
import fs from "fs";
import moment from "moment";

import {buildSwellString, buildTideString, getTideExtremes, SpotCheckRevision} from "./helpers";

const screenWidthPx: number     = 800;
const screenHeightPx: number    = 600;
const screenLeftPadPx: number   = 10;
const screenTopPadPx: number    = 15;
const screenRightPadPx: number  = 10;
const screenBottomPadPx: number = 15;

export const rendersDir: string = "temp_renders";

/*
 * Weights them all (almost) equally which isn't how the eye perceives them but this is fine
 */
function convert24BitTo8Bit(r: number, b: number, g: number): number {
    if (r > 255) {
        r = 255;
    }
    if (g > 255) {
        g = 255;
    }
    if (b > 255) {
        b = 255;
    }

    const output = (((r * 7 / 255) & 0x7) << 5) + (((b * 7 / 255) & 0x7) << 2) + ((g * 7 / 255) & 0x3);
    // console.log(`Converted ${r},${g},${b} to ${output}`);
    return output;
}

export function renderScreenFromData(temperature: number,
                                     windSpeed: number,
                                     windDir: string,
                                     tideHeight: number,
                                     tideIncreasing: boolean,
                                     tideData: SurflineTidesResponse[],
                                     swellData: SurflineWaveResponse[]) {
    const screenCanvas  = createCanvas(screenWidthPx, screenHeightPx)
    const screenContext = screenCanvas.getContext("2d");

    screenContext.fillStyle = "#ffffff";
    screenContext.fillRect(0, 0, screenWidthPx, screenHeightPx);

    const now        = moment();
    const timeString = now.format("h:mm a");
    const dateString = now.format("dddd, MMMM Do YYYY");

    // Large center time
    screenContext.font      = "60px Impact";
    screenContext.textAlign = "center";
    screenContext.fillStyle = "black"
    screenContext.fillText(timeString, screenWidthPx / 2, screenHeightPx / 2 - 20);

    // Medium center date
    screenContext.font = "30px Impact";
    screenContext.fillText(dateString, screenWidthPx / 2, screenHeightPx / 2 + 20);

    // Top row conditions
    screenContext.font      = "20px Impact";
    screenContext.textAlign = "left";
    screenContext.fillText(`${temperature}º`, screenLeftPadPx, screenTopPadPx + 20 / 2);
    screenContext.textAlign = "center";
    screenContext.fillText(`${tideHeight.toString()} ft ${(tideIncreasing ? 'rising' : 'falling')}`,
                           screenWidthPx / 2,
                           screenTopPadPx + 20 / 2);
    screenContext.textAlign = "right";
    screenContext.fillText(`${windSpeed} kt. ${windDir}`, screenWidthPx - screenRightPadPx, screenTopPadPx + 20 / 2);

    // Bottom row forecast
    const swellString       = buildSwellString(swellData, SpotCheckRevision.Rev3);
    screenContext.textAlign = "center";
    screenContext.fillText(`Swell info: ${swellString}`,
                           screenWidthPx / 2,
                           screenHeightPx - screenBottomPadPx - 40 - 20 / 2);

    // Bottom row tides
    const tideExtremes      = getTideExtremes(tideData);
    const tideString        = buildTideString(Object.values(tideExtremes)[0], SpotCheckRevision.Rev3);
    screenContext.textAlign = "center";
    screenContext.fillText(`Tide info: ${tideString}`, screenWidthPx / 2, screenHeightPx - screenBottomPadPx - 20 / 2);

    const rawBuffer             = screenCanvas.toBuffer("raw");
    let raw8BitBuffer: number[] = [];
    for (let i = 0, idx8Bit = 0; i < rawBuffer.length; i += 4, idx8Bit++) {
        raw8BitBuffer[idx8Bit] = convert24BitTo8Bit(rawBuffer[i], rawBuffer[i + 1], rawBuffer[i + 2]);
    }

    // TODO :: Remove or flag out jpeg generation for debugging
    const jpegBuffer = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});
    fs.writeFileSync(rendersDir + "/render.jpeg", jpegBuffer);

    fs.writeFileSync(rendersDir + "/render.raw", Buffer.from(raw8BitBuffer));
    return "render.raw";
}

export function renderSmolImage(): string {
    const screenCanvas  = createCanvas(100, 50)
    const screenContext = screenCanvas.getContext('2d');

    screenContext.fillStyle = '#ffffff';
    screenContext.fillRect(0, 0, screenWidthPx, screenHeightPx);

    screenContext.font      = '30px Impact';
    screenContext.textAlign = 'center';
    screenContext.fillStyle = 'black'
    screenContext.fillText('doink', 100 / 2, 50 / 2);

    const jpegBuffer            = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});
    const rawBuffer             = screenCanvas.toBuffer('raw');
    let raw8BitBuffer: number[] = [];
    for (let i = 0, idx8Bit = 0; i < rawBuffer.length; i += 4, idx8Bit++) {
        raw8BitBuffer[idx8Bit] = convert24BitTo8Bit(rawBuffer[i], rawBuffer[i + 1], rawBuffer[i + 2]);
    }

    fs.writeFileSync(rendersDir + '/smol_render.jpeg', jpegBuffer);
    fs.writeFileSync(rendersDir + '/smol_render.raw', Buffer.from(raw8BitBuffer));
    return 'smol_render.jpeg';
}
