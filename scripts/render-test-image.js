const canvas = require("canvas");
const fs = require("fs");

const width = 700;
const height = 500;

const temp_canvas = canvas.createCanvas(width, height);

const context = temp_canvas.getContext("2d");
context.fillStyle = "#FFFFFF";
context.fillRect(0, 0, width, height);

context.fillStyle = "#000000";
for (let i = 25; i < 800; i += 100) {
    for (let j = 25; j < 600; j += 100) {
        context.fillRect(i, j, 50, 50);
    }
}

// context.fillText("shalom", 250, 350);

const buffer = temp_canvas.toBuffer("image/jpeg");
fs.writeFileSync("./default_renders/temp_default_custom_screen_image.jpeg", buffer);
