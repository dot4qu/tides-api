import {createCanvas, loadImage} from "canvas";
import fs from "fs";
import moment from "moment-timezone";
import path from "path";

import {rendersDir} from "./helpers";
import * as plotlyHelper from "./plotly-helper";

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
 * Create canvas and burn plotly-gen'd image (tested both jpeg and svg) to it in order to convert it to raw RGB bytes,
 * then pack and B&W the bytes for delivery to device
 */
async function convertImageToRawPacked(imageFilePath: string): Promise<string> {
    const chartCanvas    = createCanvas(700, 200);
    const chartContext   = chartCanvas.getContext("2d");
    const tideChartImage = await loadImage(imageFilePath);
    chartContext.drawImage(tideChartImage, 0, 0);
    const rawBuffer    = chartCanvas.toBuffer('raw');
    const packedBuffer = toPackedBlackAndWhite(rawBuffer);

    const baseChartFilename = path.parse(imageFilePath).name;
    const rawChartFilepath  = path.join(path.dirname(imageFilePath), baseChartFilename + ".raw");
    await fs.promises.writeFile(rawChartFilepath, Buffer.from(packedBuffer));

    return rawChartFilepath;
}

/*
 * Bundles data and calls into the created plotly instance to generate an SVG chart
 */
async function generateChartFromData(data: Plotly.Data[],
                                     layout: Partial<Plotly.Layout>,
                                     imgOptions: Plotly.ToImgopts,
                                     filename: string) {
    let svgData = null;
    try {
        const plotly = await plotlyHelper.loadPlotly();
        svgData      = await      plotly.toImage({data, layout}, imgOptions);
    } catch (e) {
        console.log(e);
        debugger;
    }

    if (!svgData) {
        throw new Error("No SVG data returned from plotly generation!");
    }

    // plotly returns it fully encoded and with a "data:img/svg_xml," prefix
    const rawSvgData     = decodeURIComponent(svgData);
    const trimmedSvgData = rawSvgData.substring(rawSvgData.indexOf(",") + 1);
    await fs.promises.writeFile(filename, trimmedSvgData);
}

export async function renderTideChart(filename: string,
                                      xValues: number[],
                                      yValues: number[],
                                      xAxisTitle: string,
                                      width: number,
                                      height: number): Promise<string> {
    let tideTrace: Plotly.Data = {
        x : xValues,
        y : yValues,
        mode : "lines",
        name : "Tides",
        line : {
            shape : "spline",
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
            width : 4,        // default is 2
            color : "black",  // default is blue
        },
        type : "scatter",
    };

    const data: Plotly.Data[]            = [ tideTrace ];
    const layout: Partial<Plotly.Layout> = {
        title : {
            text : "<b>Tide Chart</b>",
            font : {size : 20, color : "black"},
        },
        xaxis : {
            tickprefix : "<b>",
            ticksuffix : "</b>",
            dtick : 4.0,
            showgrid : true,
            showline : true,
            zeroline : true,
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
            zeroline : true,
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
    };

    const imgOptions: Plotly.ToImgopts = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${rendersDir}/${filename}`;
    await generateChartFromData(data, layout, imgOptions, filepath);

    return await convertImageToRawPacked(filepath);
}

export async function renderSwellChart(filename: string,
                                       xValues: string[],
                                       yValuesMax: number[],
                                       yValuesMin: number[],
                                       width: number,
                                       height: number): Promise<string> {
    let swellMaxTrace: Plotly.Data = {
        x : xValues,
        y : yValuesMax,
        name : "Max height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.6)",
        },
    };

    let swellMinTrace: Plotly.Data = {
        x : xValues,
        y : yValuesMin,
        name : "Min height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 1.0)",
        },
    };

    const data: Plotly.Data[] = [
        swellMaxTrace,
        swellMinTrace,
    ];

    const layout: Partial<Plotly.Layout> = {
        showlegend : false,
        barmode : "overlay",
        title : {
            text : "<b>Swell Chart</b>",
            font : {
                size : 20,
                color : "black",
            },
        },
        xaxis : {
            ticks : "",
            tickprefix : "<b>",
            ticksuffix : "</b>",
            showgrid : false,
            showline : true,
            color : "black",
            tickfont : {
                size : 18,
                color : "black",
            },
        },
        yaxis : {
            showgrid : false,
            zeroline : false,
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
    };

    const imgOptions: Plotly.ToImgopts = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${rendersDir}/${filename}`;
    await generateChartFromData(data, layout, imgOptions, filepath);

    return await convertImageToRawPacked(filepath);
}

export async function renderWindChart(filename: string,
                                      xValues: number[],
                                      yValues: number[],
                                      // tick0: number,
                                      // xAxisTitle: string,
                                      width: number,
                                      height: number): Promise<string> {
    let windTrace: Plotly.Data = {
        x : xValues,
        y : yValues,
        name : "Windspeed",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 1.0)",
        },
    };

    const data: Plotly.Data[]            = [ windTrace ];
    const layout: Partial<Plotly.Layout> = {
        bargap : 0.1,
        title : {
            text : "<b>Wind Chart</b>",
            font : {size : 20, color : "black"},
        },
        xaxis : {
            tickprefix : "<b>",
            ticksuffix : "</b>",
            dtick : 4.0,
            color : "black",
            tickfont : {
                size : 18,
                color : "black",
            },
            type : "category",  // Necessary to prevent plotly from reording x axis order to start with lowest int
            title : {
                text : `<b>Windspeed (mph)</b>`,
                font : {
                    size : 18,
                    color : "black",
                },
            },
        },
        yaxis : {
            color : "black",
            tickprefix : "<b>",
            ticksuffix : "</b>",
            tickfont : {
                size : 18,
                color : "black",
            },
        },
        // Removes all of the padding while keeping the axis labels if around their default distance
        margin : {
            l : 55,
            t : 40,
            r : 30,
            b : 50,
        },
    };

    const imgOptions: Plotly.ToImgopts = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${rendersDir}/${filename}`;
    await generateChartFromData(data, layout, imgOptions, filepath);

    return await convertImageToRawPacked(filepath);
}
