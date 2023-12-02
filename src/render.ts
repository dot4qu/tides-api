import {createCanvas, loadImage} from "canvas";
import fs from "fs";
import moment from "moment";
import path from "path";

import {rendersDir} from "./helpers";

const plotly = require("plotly")("second.string", "ECFumSwhQNCSasct0Owv");

import {buildSwellString, buildTideString, getTideExtremes, SpotCheckRevision} from "./helpers";

const screenWidthPx: number     = 800;
const screenHeightPx: number    = 600;
const screenLeftPadPx: number   = 10;
const screenTopPadPx: number    = 15;
const screenRightPadPx: number  = 10;
const screenBottomPadPx: number = 15;

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

export async function renderTideChart(filename: string,
                                      xValues: number[],
                                      yValues: number[],
                                      tick0: number,
                                      xAxisTitle: string,
                                      width: number,
                                      height: number): Promise<string> {
    let tideTrace = {
        x : xValues,
        y : yValues,
        mode : "lines",
        name : "Tides",
        line : {
            shape : "spline",
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
            type : "solid",
            width : 4,        // default is 2
            color : "white",  // default is blue
        },
        type : "scatter",
    };

    const figure = {
        data : [ tideTrace ],
        layout : {
            title : {
                text : "<b>Tide Chart</b>",
                font : {size : 20, color : "black"},
            },
            xaxis : {
                autotick : false,
                tick0 : tick0,
                tickprefix : "<b>",
                ticksuffix : "</b>",
                dtick : 4.0,
                showgrid : true,
                showline : true,
                zeroline : false,
                color : "black",
                tickfont : {
                    size : 18,
                    color : "black",
                },
                title : {
                    text : `<b>${xAxisTitle}</b>`,
                    font : {
                        size : 18,
                        color : "black",
                    },
                },
            },
            yaxis : {
                showgrid : false,
                color : "black",
                showline : true,
                zeroline : false,
                tickprefix : "<b>",
                ticksuffix : "</b>",
                tickfont : {
                    size : 18,
                    color : "black",
                },
                title : {
                    text : "<b>Height (m)</b>",
                    font : {
                        size : 18,
                        color : "black",
                    },
                },
            },
            // Removes all of the padding while keeping the axis labels if around their default distance
            margin : {
                l : 55,
                t : 40,
                r : 30,
                b : 50,
            },
            annotations : [
                {
                    text : "Error rendering tide data for chart",
                    font : {
                        size : 16,
                        color : "black",
                    },
                    x : 12,
                    y : 0.25,
                    textangle : 0,
                    showarrow : false,
                },
                {
                    text : "Device retries daily, reboot device to force retry",
                    font : {
                        size : 14,
                        color : "black",
                    },
                    x : 12,
                    y : -0.25,
                    textangle : 0,
                    showarrow : false,
                },
            ],
        },
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
            const filepath        = `${__dirname}/../${rendersDir}/${filename}`;
            const chartFileStream = fs.createWriteStream(filepath);
            const pipeStream      = imageStream.pipe(chartFileStream);
            pipeStream.on("finish", () => resolve(filepath));
        });
    });

    const chartFilepath = await plotlyPromise;
    return await                convertJpegToRawPacked(chartFilepath);
}

export async function renderSwellChart(filename: string,
                                       xValues: string[],
                                       yValuesMax: number[],
                                       yValuesMin: number[],
                                       width: number,
                                       height: number): Promise<string> {
    let swellMinTrace = {
        x : xValues,
        y : yValuesMin,
        name : "Min height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.0)",
        },
    };

    const figure = {
        data : [
            swellMinTrace,
        ],
        layout : {
            showlegend : false,
            // barmode : "overlay",
            title : {
                text : "<b>Swell Chart</b>",
                font : {
                    size : 20,
                    color : "black",
                },
            },
            xaxis : {
                ticks : "none",
                tickprefix : "<b>",
                ticksuffix : "</b>",
                showgrid : false,
                showline : true,
                color : "black",
                tickfont : {
                    size : 18,
                    color : "white",
                },
            },
            yaxis : {
                showgrid : false,
                zeroline : false,
                tick0 : 0,
                showline : true,
                color : "black",
                tickprefix : "<b>",
                ticksuffix : "</b>",
                tickfont : {
                    size : 18,
                    color : "black",
                },
                title : {
                    text : "<b>Height (m)</b>",
                    font : {
                        size : 18,
                        color : "black",
                    },
                },
            },
            // Removes all of the padding while keeping the axis labels if around their default distance
            margin : {
                l : 55,
                t : 40,
                r : 30,
                b : 30,
            },
            annotations : [
                {
                    text : "Error fetching swell data from external service",
                    font : {
                        size : 16,
                        color : "black",
                    },
                    x : 2,
                    y : 0.6,
                    textangle : 0,
                    showarrow : false,
                },
                {
                    text : "Device retries every 5 hours, reboot device to force retry",
                    font : {
                        size : 14,
                        color : "black",
                    },
                    x : 2,
                    y : 0.4,
                    textangle : 0,
                    showarrow : false,
                },
            ],
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
            const filepath        = `${__dirname}/../${rendersDir}/${filename}`;
            const chartFileStream = fs.createWriteStream(filepath);
            const pipeStream      = imageStream.pipe(chartFileStream);
            pipeStream.on("finish", () => resolve(filepath));
        });
    });

    const chartFilepath = await plotlyPromise;
    return await                convertJpegToRawPacked(chartFilepath);
}
