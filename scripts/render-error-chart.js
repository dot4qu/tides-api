const defaultRendersDir  = require("../dist/helpers.js").defaultRendersDir;
const render = require("../dist/render.js");

async function renderTideErrorChart(filename,
                                      xValues,
                                      yValues,
                                      xAxisTitle,
                                      width,
                                      height) {
    let tideTrace = {
        x : xValues,
        y : yValues,
        mode : "lines",
        name : "Tides",
        line : {
            shape : "spline",
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
            width : 4,        // default is 2
            color : "white",  // default is blue
        },
        type : "scatter",
    };

    const data            = [ tideTrace ];
    const layout = {
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
                     text : "Error fetching tide data from external service",
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
    };

    const imgOptions = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${defaultRendersDir}/${filename}`;
    console.log(`Image filepath: ${filepath}`);
    await render.generateChartFromData(data, layout, imgOptions, filepath);

    console.log("Converting generated image to raw packed bytes...");
    return await render.convertImageToRawPacked(filepath, 700, 200);
}

async function renderTidePlotlyErrorChart(filename,
                                      xValues,
                                      yValues,
                                      xAxisTitle,
                                      width,
                                      height) {
    let tideTrace = {
        x : xValues,
        y : yValues,
        mode : "lines",
        name : "Tides",
        line : {
            shape : "spline",
            smoothing : 1.3,  // apparently 1.3 is highest value...? Defaults to smoothest if ommitted as well
            width : 4,        // default is 2
            color : "white",  // default is blue
        },
        type : "scatter",
    };

    const data            = [ tideTrace ];
    const layout = {
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
    };

    const imgOptions = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${defaultRendersDir}/${filename}`;
    console.log(`Image filepath: ${filepath}`);
    await render.generateChartFromData(data, layout, imgOptions, filepath);

    console.log("Converting generated image to raw packed bytes...");
    return await render.convertImageToRawPacked(filepath, 700, 200);
}

async function renderSwellErrorChart(filename,
                                       xValues,
                                       // yValuesMax,
                                       yValuesMin,
                                       width,
                                       height) {
    // let swellMaxTrace: Plotly.Data = {
    //     x : xValues,
    //     y : yValuesMax,
    //     name : "Max height",
    //     type : "bar",
    //     marker : {
    //         color : "rgba(0, 0, 0, 0.6)",
    //     },
    // };

    let swellMinTrace = {
        x : xValues,
        y : yValuesMin,
        name : "Min height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.0)",
        },
    };

    const data = [
        // swellMaxTrace,
        swellMinTrace,
    ];

    const layout = {
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
            tick0: 0,
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
    };

    const imgOptions = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${defaultRendersDir}/${filename}`;
    console.log(`Image filepath: ${filepath}`);
    await render.generateChartFromData(data, layout, imgOptions, filepath);

    console.log("Converting generated image to raw packed bytes...");
    return await render.convertImageToRawPacked(filepath, 700, 200);
}

async function renderSwellPlotlyErrorChart(filename,
                                       xValues,
                                       yValuesMin,
                                       width,
                                       height) {
    // let swellMaxTrace: Plotly.Data = {
    //     x : xValues,
    //     y : yValuesMax,
    //     name : "Max height",
    //     type : "bar",
    //     marker : {
    //         color : "rgba(0, 0, 0, 0.6)",
    //     },
    // };

    let swellMinTrace = {
        x : xValues,
        y : yValuesMin,
        name : "Min height",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.0)",
        },
    };

    const data = [
        // swellMaxTrace,
        swellMinTrace,
    ];

    const layout = {
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
            tick0: 0,
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
            annotations : [
                 {
                     text : "Error rendering swell data for chart",
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
    };

    const imgOptions = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${defaultRendersDir}/${filename}`;
    console.log(`Image filepath: ${filepath}`);
    await render.generateChartFromData(data, layout, imgOptions, filepath);

    console.log("Converting generated image to raw packed bytes...");
    return await render.convertImageToRawPacked(filepath, 700, 200);
}


async function renderWindErrorChart(filename,
                                      xValues,
                                      yValues,
                                      width,
                                      height) {
    let windTrace = {
        x : xValues,
        y : yValues,
        name : "Windspeed",
        type : "bar",
        marker : {
            color : "rgba(0, 0, 0, 0.0)",
        },
    };

    const data            = [ windTrace ];
    const layout = {
        bargap : 0.1,
        title : {
            text : "<b>Wind Chart</b>",
            font : {size : 20, color : "black"},
        },
        xaxis : {
            tickprefix : "<b>",
            ticksuffix : "</b>",
            showline: true,
            dtick : 4.0,
            color : "black",
            tickfont : {
                size : 18,
                color : "black",
            },
            type : "category",  // Necessary to prevent plotly from reording x axis order to start with lowest int
            // title : {
            //     text : `<b>Windspeed (mph)</b>`,
            //     font : {
            //         size : 18,
            //         color : "black",
            //     },
            // },
        },
        yaxis : {
            color : "black",
            showline: true,
            zeroline: false,
showgrid : false,
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
          annotations : [
                 {
                     text : "Error fetching wind data from external service",
                     font : {
                         size : 16,
                         color : "black",
                     },
                     x : 10,
                     y : 0.6,
                     textangle : 0,
                     showarrow : false,
                 },
                 {
                     text : "Device retries every hour, reboot device to force retry",
                     font : {
                         size : 14,
                         color : "black",
                     },
                     x : 10,
                     y : 0.4,
                     textangle : 0,
                     showarrow : false,
                 },
             ],
    };

    const imgOptions = {
        format : "svg",
        width,
        height,
    };

    const filepath = `${__dirname}/../${defaultRendersDir}/${filename}`;
    console.log(`Image filepath: ${filepath}`);
    await render.generateChartFromData(data, layout, imgOptions, filepath);

    console.log("Converting generated image to raw packed bytes...");
    return await render.convertImageToRawPacked(filepath, 700, 200);
}

async function main() {
    /*
     * Uncomment for wind error chart
     */
    // const xValues = Array(24)
    // for (let i = 0; i < 24; i++) {
    //     xValues[i] = i;
    // }
    // await renderWindErrorChart("default_owm_wind_error_chart.svg", xValues, Array(24).fill(1), 700, 200);

    /*
     * Uncomment for tide error chart(s)
     */
    // const xValues = Array(24)
    // for (let i = 0; i < 24; i++) {
    //     xValues[i] = i;
    // }
    // const yValues = Array(24)
    // yValues[0] = -1
    // yValues[23] = 1
    // const xAxisTitle = "";
    // // await renderTideErrorChart("default_worldtides_tide_error_chart.svg", xValues, yValues, "", 700, 200);
    // await renderTidePlotlyErrorChart("default_plotly_error_tide_chart.svg", xValues, yValues, "", 700, 200);

    /*
     * Uncomment for swell error chart(s)
     */
    const xValues = Array(5)
    for (let i = 0; i < 5; i++) {
        xValues[i] = i;
    }
    const yValues = Array(5)
    yValues[0] = 1;
    yValues[4] = 1;
    await renderSwellErrorChart("default_surfline_swell_error_chart.svg", xValues, yValues, 700, 200);
    await renderSwellPlotlyErrorChart("default_plotly_error_swell_chart.svg", xValues, yValues, 700, 200);
}


main()
