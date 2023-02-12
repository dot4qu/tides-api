import {createCanvas, loadImage} from "canvas";
import fs from "fs";
import moment from "moment";
import path from "path";

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

    const output = 0.299 * r + 0.587 * g + 0.114 * b;
    // console.log(`Converted ${r},${g},${b} to ${output}`);
    return output;
}

// Convert a buffer of 8-bit rgb values (see convert24BitTo8Bit) to a two-pixels-per-byte buffer of only 0x00 and 0xFF
// pixels
function toPackedBlackAndWhite(rawBuffer: Buffer): Buffer {
    let r: number          = 0;
    let b: number          = 0;
    let g: number          = 0;
    let packedByte: number = 0;
    let raw8BitBuffer: Buffer =
        Buffer.alloc(rawBuffer.length / 8);  // divide by 4 for the rgba -> grayscale and another 2 for the pack
    let val;
    for (let i = 0, idx8Bit = 0; i < rawBuffer.length; i += 8, idx8Bit++) {
        // Take one 4-byte pixel, convert to 1 byte, and save in LOWER nibble of raw 8bit index. Little endian alignment
        // of nibbles within each byte
        r   = rawBuffer[i];
        b   = rawBuffer[i + 1];
        g   = rawBuffer[i + 2];
        val = convert24BitTo8Bit(r, g, b);

        raw8BitBuffer[idx8Bit] = (val & 0xF0) >> 4;

        // Convert the next 4-byte pixel to 1 byte, and OR the least significant 4 bits it into the upper nibble of the
        // same raw 8bit index
        r   = rawBuffer[i + 4];
        b   = rawBuffer[i + 5];
        g   = rawBuffer[i + 6];
        val = convert24BitTo8Bit(r, g, b);
        // if (val > 0x80) {
        //     val = 0xFF;
        // } else {
        //     val = 0x00;
        // }
        raw8BitBuffer[idx8Bit] |= (val & 0xF0);
    }

    return raw8BitBuffer;
}

/*
 * Create canvas and burn plotly-gen'd jpeg to it in order to convert it to raw RGB bytes, then pack and B&W the bytes
 * for delivery to device
 */
async function convertJpegToRawPacked(jpegFilePath: string): Promise<string> {
    const chartCanvas    = createCanvas(700, 200);
    const chartContext   = chartCanvas.getContext("2d");
    const tideChartImage = await loadImage(jpegFilePath);
    chartContext.drawImage(tideChartImage, 0, 0);
    const rawBuffer    = chartCanvas.toBuffer('raw');
    const packedBuffer = toPackedBlackAndWhite(rawBuffer);

    const baseChartFilename = path.parse(jpegFilePath).name;
    const rawChartFilepath  = path.join(path.dirname(jpegFilePath), baseChartFilename + ".raw");
    await fs.promises.writeFile(rawChartFilepath, Buffer.from(packedBuffer));

    return rawChartFilepath;
}

/*
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

    const temperatureString = `${temperature}º`;
    const tideString        = `${tideHeight.toString()} ft ${(tideIncreasing ? 'rising' : 'falling')}`;
    const windString = `${windSpeed} kt. ${windDir}`;
    // const temperatureMetrics: TextMetrics = screenContext.measureText(temperatureString);
    // const tideMetrics: TextMetrics        = screenContext.measureText(tideString);
    // const windMetrics: TextMetrics        = screenContext.measureText(windString);
    screenContext.font      = "25px Impact";
    screenContext.textAlign = "right";
    screenContext.fillText(temperatureString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80);
    screenContext.fillText(tideString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 35);
    screenContext.fillText(windString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 70);

    // Bottom row forecast
    let swellChartFilename: string = "";
    try {
        swellChartFilename = await renderSwellChart(swellData, 700, 200);
    } catch (e) {
        console.error(`Error rendering swell chart: ${e}`);
    }

    if (swellChartFilename) {
        console.log(`Attempting to burn rendered swell chart at ${swellChartFilename} into screen jpeg`);
        try {
            const swellChartImage = await loadImage(`${__dirname}/../${rendersDir}/${swellChartFilename}`);
            screenContext.drawImage(swellChartImage,
                                    screenWidthPx / 2 - swellChartImage.width / 2,
                                    screenHeightPx - screenBottomPadPx - 200 - swellChartImage.height);
        } catch (e) {
            console.error(`Error generating swell chart: ${e}`);

            screenContext.font      = "20px Impact";
            screenContext.textAlign = "center";
            screenContext.fillText("No swell chart currently generated",
                                   screenWidthPx / 2,
                                   screenHeightPx - screenBottomPadPx - 400);
        }
    }

    // Bottom row tides
    let tideChartFilepath: string = "";
    try {
        tideChartFilepath = await renderTideChart(tideData, 700, 200);
    } catch (e) {
        console.error(`Error rendering tide chart: ${e}`);
    }

    if (tideChartFilepath) {
        console.log(`Attempting to burn rendered tide chart at ${tideChartFilepath} into screen jpeg`);
        try {
            const tideChartImage = await loadImage(tideChartFilepath);
            screenContext.drawImage(tideChartImage,
                                    screenWidthPx / 2 - tideChartImage.width / 2,
                                    screenHeightPx - screenBottomPadPx - tideChartImage.height);
        } catch (e) {
            console.error(`Error generating tide chart: ${e}`);

            screenContext.font      = "20px Impact";
            screenContext.textAlign = "center";
            screenContext.fillText("No tide chart currently generated",
                                   screenWidthPx / 2,
                                   screenHeightPx - screenBottomPadPx - 200);
        }
    }

    // TODO :: Remove or flag out jpeg generation for debugging
    const jpegBuffer = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});
    fs.writeFileSync(rendersDir + "/render.jpeg", jpegBuffer);

    const rawBuffer    = screenCanvas.toBuffer("raw");
    const packedBuffer = toPackedBlackAndWhite(rawBuffer);
    fs.writeFileSync(rendersDir + "/render.raw", Buffer.from(packedBuffer));
    return "render.raw";
}
*/

// export async function renderScreenFromDataOffline(): Promise<string> {
//     const screenCanvas  = createCanvas(screenWidthPx, screenHeightPx)
//     const screenContext = screenCanvas.getContext("2d");

//     screenContext.fillStyle = "#ffffff";
//     screenContext.fillRect(0, 0, screenWidthPx, screenHeightPx);

//     const now        = moment();
//     const timeString = now.format("h:mm a");
//     const dateString = now.format("dddd, MMMM Do YYYY");

//     // Large time
//     screenContext.font      = "60px Impact";
//     screenContext.textAlign = "left";
//     screenContext.fillStyle = "black"
//     screenContext.fillText(timeString, screenLeftPadPx + 40, screenTopPadPx + 100);

//     // Medium date
//     screenContext.font = "25px Impact";
//     screenContext.fillText(dateString, screenLeftPadPx + 40, screenTopPadPx + 100 + 40);

//     // Conditions
//     const temperature                     = 76;
//     const tideHeight                      = 1.7;
//     const windSpeed                       = 5.4;
//     const windDir                         = "NW";
//     const tideIncreasing                  = true;
//     const temperatureString               = `${temperature}º`;
//     const tideString                      = `${tideHeight.toString()} ft ${(tideIncreasing ? 'rising' : 'falling')}`;
//     const windString = `${windSpeed} kt. ${windDir}`;
//     const temperatureMetrics: TextMetrics = screenContext.measureText(temperatureString);
//     const tideMetrics: TextMetrics        = screenContext.measureText(tideString);
//     // const windMetrics: TextMetrics        = screenContext.measureText(windString);
//     screenContext.font      = "25px Impact";
//     screenContext.textAlign = "right";
//     screenContext.fillText(temperatureString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80);
//     screenContext.fillText(tideString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 35);
//     screenContext.fillText(windString, screenWidthPx - screenRightPadPx - 40, screenTopPadPx + 80 + 70);

//     const tideChartFilename: string = "test_tide_chart.jpeg";
//     try {
//         const tideChartImage = await loadImage(`${__dirname}/../${rendersDir}/${tideChartFilename}`);
//         screenContext.drawImage(tideChartImage,
//                                 screenWidthPx / 2 - tideChartImage.width / 2,
//                                 screenHeightPx - screenBottomPadPx - tideChartImage.height);
//     } catch (e) {
//         console.error(`Error generating tide chart: ${e}`);

//         screenContext.font      = "20px Impact";
//         screenContext.textAlign = "center";
//         screenContext.fillText("No tide chart currently generated",
//                                screenWidthPx / 2,
//                                screenHeightPx - screenBottomPadPx - 200);
//     }

//     const jpegBuffer = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});

//     fs.writeFileSync(rendersDir + "/offline_render.jpeg", jpegBuffer);
//     return "offline_render.jpeg";
// }

export async function renderTideChart(rawTides: SurflineTidesResponse[], width: number, height: number):
    Promise<string> {
    // Switch timestamps received from server to moment objects. Epoch is timezone/offset-agnostic, so instantiate as
    // UTC. Use utcOffset func to shift date to user's utc offset to correctly interpret day of year so we know which
    // raw tide objects to filter before burning into chart.
    const tidesWithResponseOffset =
        rawTides.map(x => ({...x, timestamp : moment.utc(((x.timestamp as number) * 1000)).utcOffset(x.utcOffset)}));
    const responseDayOfYear: number = tidesWithResponseOffset[0].timestamp.dayOfYear();
    const tidesSingleDay            = tidesWithResponseOffset.filter(x => x.timestamp.dayOfYear() == responseDayOfYear);

    let tideTrace = {
        x : tidesSingleDay.map(x => x.timestamp.hour() + x.timestamp.minute() / 60),
        y : tidesSingleDay.map(x => x.height),
        mode : "lines",
        name : "Tides",
        line : {
            shape : "spline",
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
            type : "solid",
            width : 4,        // default is 2
            color : "black",  // default is blue
        },
        type : "scatter",
    };

    const figure = {
        data : [ tideTrace ],
        layout : {
            title : {
                text : "Tide Chart",
                font : {
                    size : 20,
                    color : "black",
                },
            },
            xaxis : {
                autotick : false,
                ticks : "inside",
                tick0 : tidesSingleDay[0].timestamp.hour(),
                dtick : 4.0,
                showgrid : false,
                color : "black",
                tickfont : {
                    size : 15,
                    color : "black",
                },
                title : {
                    text : tidesSingleDay[0].timestamp.format("dddd MM/DD"),  // Friday 12/22, non-localized but eh
                    font : {
                        size : 15,
                        color : "black",
                    },
                },
            },
            yaxis : {
                showgrid : false,
                color : "black",
                tickfont : {
                    size : 15,
                    color : "black",
                },
                title : {
                    text : "Height (m)",
                    font : {
                        size : 15,
                        color : "black",
                    },
                },
            },
            // Removes all of the padding while keeping the axis labels if around their default distance
            margin : {
                l : 50,
                t : 40,
                r : 30,
                b : 40,
            },
        }
    };

    const imgOptions = {
        format : "jpeg",
        width,
        height,
    };

    const plotlyPromise = new Promise<string>((resolve, reject) => {
        plotly.getImage(figure, imgOptions, (err: Error, imageStream: NodeJS.ReadableStream) => {
            if (err) {
                console.error(`Error in plotly.getImage: ${err}`);
                return reject(err);
            }

            // Kick off stream of image piped to file but don't resolve promise until full stream written
            const filepath        = `${__dirname}/../${rendersDir}/test_tide_chart.jpeg`;
            const chartFileStream = fs.createWriteStream(filepath);
            const pipeStream      = imageStream.pipe(chartFileStream);
            pipeStream.on("finish", () => resolve(filepath));
        });
    });

    const chartFilepath = await plotlyPromise;
    return await                convertJpegToRawPacked(chartFilepath);
}

export async function renderSwellChart(xValues: string[],
                                       yValuesMax: number[],
                                       yValuesMin: number[],
                                       width: number,
                                       height: number): Promise<string> {
    let swellMaxTrace = {
        x : xValues,
        y : yValuesMax,
        name : "Max height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.6)",
        },
    };

    let swellMinTrace = {
        x : xValues,
        y : yValuesMin,
        name : "Min height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 1.0)",
        },
    };

    const figure = {
        data : [
            swellMaxTrace,
            swellMinTrace,
        ],
        layout : {
            barmode : "overlay",
            title : {
                text : "Swell Chart",
                font : {
                    size : 20,
                    color : "black",
                },
            },
            xaxis : {
                ticks : "none",
                showgrid : false,
                color : "black",
                tickfont : {
                    size : 15,
                    color : "black",
                },
            },
            yaxis : {
                showgrid : false,
                color : "black",
                tickfont : {
                    size : 15,
                    color : "black",
                },
                title : {
                    text : "Height (m)",
                    font : {
                        size : 15,
                        color : "black",
                    },
                },
            },
            // Removes all of the padding while keeping the axis labels if around their default distance
            margin : {
                l : 50,
                t : 40,
                r : 30,
                b : 40,
            },
        }
    };

    const imgOptions = {
        format : "jpeg",
        width,
        height,
    };

    const plotlyPromise = new Promise<string>((resolve, reject) => {
        plotly.getImage(figure, imgOptions, (err: Error, imageStream: NodeJS.ReadableStream) => {
            if (err) {
                console.error(`Error in plotly.getImage: ${err}`);
                return reject(err);
            }

            // Kick off stream of image piped to file but don't resolve promise until full stream written
            const filename        = `${__dirname}/../${rendersDir}/test_swell_chart.jpeg`;
            const chartFileStream = fs.createWriteStream(filename);
            const pipeStream      = imageStream.pipe(chartFileStream);
            pipeStream.on("finish", () => resolve(filename));
        });
    });

    const chartFilepath = await plotlyPromise;
    return await                convertJpegToRawPacked(chartFilepath);
}
