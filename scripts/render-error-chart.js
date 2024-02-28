const defaultRendersDir  = require("../dist/helpers.js").defaultRendersDir;
const render = require("../dist/render.js");

// Github commit with changes for swell/tide error chart generation:
// https://github.com/second-string/spot-check-api/commit/2dd3e1f7531939ffb7be440dbb803352360febd9


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
    const xValues = Array(24)
    for (let i = 0; i < 24; i++) {
        xValues[i] = i;
    }

    await renderWindErrorChart("default_owm_wind_error_chart.svg", xValues, Array(24).fill(1), 700, 200);
}

main()
