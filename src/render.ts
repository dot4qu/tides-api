import {createCanvas, loadImage} from "canvas";
import fs from "fs";
import moment from "moment";
const plotly = require("plotly")("second.string", "ECFumSwhQNCSasct0Owv");

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

export async function renderScreenFromData(temperature: number,
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

    // Large time
    screenContext.font      = "60px Impact";
    screenContext.textAlign = "left";
    screenContext.fillStyle = "black"
    screenContext.fillText(timeString, screenLeftPadPx + 40, screenTopPadPx + 100);

    // Medium date
    screenContext.font = "25px Impact";
    screenContext.fillText(dateString, screenLeftPadPx + 40, screenTopPadPx + 100 + 40);

    const temperatureString = `☀️ ${temperature}º`;
    const tideString        = `🌊 ${tideHeight.toString()} ft ${(tideIncreasing ? 'rising' : 'falling')}`;
    const windString = `💨 ${windSpeed} kt. ${windDir}`;
    // const temperatureMetrics: TextMetrics = screenContext.measureText(temperatureString);
    // const tideMetrics: TextMetrics        = screenContext.measureText(tideString);
    // const windMetrics: TextMetrics        = screenContext.measureText(windString);
    screenContext.font      = "25px Impact";
    screenContext.textAlign = "right";
    screenContext.fillText(temperatureString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80);
    screenContext.fillText(tideString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 35);
    screenContext.fillText(windString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 70);

    // Bottom row forecast
    const swellString       = buildSwellString(swellData, SpotCheckRevision.Rev3);
    screenContext.textAlign = "center";
    screenContext.fillText(`Swell info: ${swellString}`,
                           screenWidthPx / 2,
                           screenHeightPx - screenBottomPadPx - 40 - 20 / 2);

    // Bottom row tides
    const tideChartFilename: string = await renderTideChart(tideData);
    const tideChartImage            = await            loadImage(`${__dirname}/../${rendersDir}/${tideChartFilename}`);
    screenContext.drawImage(tideChartImage,
                            screenWidthPx / 2 - tideChartImage.width / 2,
                            screenHeightPx - screenBottomPadPx - tideChartImage.height);
    // const tideExtremes              = getTideExtremes(tideData);
    // const tideString                = buildTideString(Object.values(tideExtremes)[0], SpotCheckRevision.Rev3);
    // screenContext.textAlign         = "center";
    // screenContext.fillText(`Tide info: ${tideString}`, screenWidthPx / 2, screenHeightPx - screenBottomPadPx - 20 /
    // 2);

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

export async function renderScreenFromDataOffline(): Promise<string> {
    const screenCanvas  = createCanvas(screenWidthPx, screenHeightPx)
    const screenContext = screenCanvas.getContext("2d");

    screenContext.fillStyle = "#ffffff";
    screenContext.fillRect(0, 0, screenWidthPx, screenHeightPx);

    const now        = moment();
    const timeString = now.format("h:mm a");
    const dateString = now.format("dddd, MMMM Do YYYY");

    // Large time
    screenContext.font      = "60px Impact";
    screenContext.textAlign = "left";
    screenContext.fillStyle = "black"
    screenContext.fillText(timeString, screenLeftPadPx + 40, screenTopPadPx + 100);

    // Medium date
    screenContext.font = "25px Impact";
    screenContext.fillText(dateString, screenLeftPadPx + 40, screenTopPadPx + 100 + 40);

    // Conditions
    const temperature       = 76;
    const tideHeight        = 1.7;
    const windSpeed         = 5.4;
    const windDir           = "NW";
    const tideIncreasing    = true;
    const temperatureString = `☀️ ${temperature}º`;
    const tideString        = `🌊 ${tideHeight.toString()} ft ${(tideIncreasing ? 'rising' : 'falling')}`;
    const windString = `💨 ${windSpeed} kt. ${windDir}`;
    const temperatureMetrics: TextMetrics = screenContext.measureText(temperatureString);
    const tideMetrics: TextMetrics        = screenContext.measureText(tideString);
    // const windMetrics: TextMetrics        = screenContext.measureText(windString);
    screenContext.font      = "25px Impact";
    screenContext.textAlign = "right";
    screenContext.fillText(temperatureString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80);
    screenContext.fillText(tideString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 35);
    screenContext.fillText(windString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 70);

    const tideChartFilename: string = "test_tide_chart.jpeg";
    try {
        const tideChartImage = await loadImage(`${__dirname}/../${rendersDir}/${tideChartFilename}`);
        screenContext.drawImage(tideChartImage,
                                screenWidthPx / 2 - tideChartImage.width / 2,
                                screenHeightPx - screenBottomPadPx - tideChartImage.height);
    } catch {
        screenContext.font      = "20px Impact";
        screenContext.textAlign = "center";
        screenContext.fillText("No tide chart currently generated",
                               screenWidthPx / 2,
                               screenHeightPx - screenBottomPadPx - 200);
    }

    const jpegBuffer = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});

    fs.writeFileSync(rendersDir + "/offline_render.jpeg", jpegBuffer);
    return "offline_render.jpeg";
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

export function renderTideChart(rawTides: SurflineTidesResponse[]): Promise<string> {
    // Switch timestamps received from server to moment objects
    rawTides.forEach(x => x.timestamp = moment((x.timestamp as number) * 1000))

    const todaysDate = moment().dayOfYear();
    const todaysTides =
        rawTides.sort(x => x.timestamp.valueOf()).filter(x => (x.timestamp as moment.Moment).dayOfYear() == todaysDate);
    let tideTrace = {
        x : todaysTides.map(x => (x.timestamp as moment.Moment).hour() + (x.timestamp as moment.Moment).minute() / 60),
        y : todaysTides.map(x => x.height),
        mode : 'lines',
        name : 'Tides',
        line : {
            shape : 'spline',
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
        },
        type : 'scatter',
        labels : {y : "Tide height (ft.)"},
    };

    const figure = {
        data : [ tideTrace ],
        layout : {
            xaxis : {
                autotick : false,
                ticks : "outside",
                tick0 : moment((todaysTides[0].timestamp as number) * 1000).hour(),
                dtick : 1.0,
            },
        }
    };

    const imgOptions = {
        format : "jpeg",
        width : 700,
        height : 200,
    };

    const plotlyPromise = new Promise<string>((resolve, reject) => {
        plotly.getImage(figure, imgOptions, (err: Error, imageStream: NodeJS.ReadableStream) => {
            if (err) {
                console.error(err);
                return reject(err);
            }

            const filename        = "test_tide_chart.jpeg";
            const chartFileStream = fs.createWriteStream(`${__dirname}/../${rendersDir}/${filename}`);
            imageStream.pipe(chartFileStream);
            return resolve(filename);
        });
    });

    return plotlyPromise;
}
