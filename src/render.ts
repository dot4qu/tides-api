import {createCanvas} from "canvas";
import fs from "fs";

const screenWidthPx: number  = 800;
const screenHeightPx: number = 600;

export const rendersDir: string = "temp_renders";

/*
 * Weights them all (almost) equally which isn't how the eye perceives them but this is fine
 */
function convert24BitTo8Bit(r: number, b: number, g: number): number {
    return (r * 7 / 255) << 5 + (b * 7 / 255) << 3 + (g * 7 / 255);
}

export function renderScreenFromData(text: string): string {
    const screenCanvas  = createCanvas(screenWidthPx, screenHeightPx)
    const screenContext = screenCanvas.getContext('2d');

    screenContext.fillStyle = '#ffffff';
    screenContext.fillRect(0, 0, screenWidthPx, screenHeightPx);

    screenContext.font      = '60px Impact';
    screenContext.textAlign = 'center';
    screenContext.fillStyle = 'black'
    screenContext.fillText('Spot Check', screenWidthPx / 2, screenHeightPx / 2 - 30);

    screenContext.font = '30px Impact';
    screenContext.fillText('rev. 3.1', screenWidthPx / 2, screenHeightPx / 2 + 30);
    screenContext.font = '30px Impact';
    screenContext.fillText('Rendered remotely', screenWidthPx / 2, screenHeightPx / 2 + 60);

    screenContext.font = '15px Impact';
    screenContext.fillText('Second String Studios', screenWidthPx / 2, screenHeightPx - 30);

    const jpegBuffer = screenCanvas.toBuffer('image/jpeg', {quality : 1.0});
    const rawBuffer  = screenCanvas.toBuffer('raw');
    fs.writeFileSync(rendersDir + '/render.jpeg', jpegBuffer);
    fs.writeFileSync(rendersDir + '/render.raw', rawBuffer);
    return 'render.jpeg';
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
