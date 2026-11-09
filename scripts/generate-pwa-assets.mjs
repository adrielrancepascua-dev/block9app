import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const bg = "#1d4f91";
const fg = "#f7f4ef";
const font = "file:///usr/share/fonts/truetype/macos/Inter-Bold.ttf";

const devices = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [420, 912, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [375, 667, 2],
  [1024, 1366, 2],
  [834, 1210, 2],
  [834, 1194, 2],
  [820, 1180, 2],
  [768, 1024, 2],
  [744, 1133, 2],
];

function svg(width, height, fontSize) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: "Block9Inter";
        src: url("${font}");
        font-weight: 700;
      }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Block9Inter, Inter, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">9</text>
</svg>`);
}

async function render(width, height, fontSize) {
  return sharp(svg(width, height, fontSize)).resize(width, height).png({ compressionLevel: 9 }).toBuffer();
}

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const publicDir = path.join(root, "public");
const splashDir = path.join(publicDir, "splash");
mkdirSync(splashDir, { recursive: true });

const icon512 = await render(512, 512, 440);
await sharp(icon512).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "icon-192.png"));
await sharp(icon512).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "icon-512.png"));
await sharp(icon512).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "icon-maskable-192.png"));
await sharp(icon512).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "icon-maskable-512.png"));
await sharp(icon512).resize(180, 180).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "apple-touch-icon.png"));
const favicon = await sharp(icon512).resize(32, 32).png().toBuffer();
writeFileSync(path.join(publicDir, "favicon.ico"), pngToIco(favicon));

const startup = [];
for (const [cssWidth, cssHeight, ratio] of devices) {
  for (const orientation of ["portrait", "landscape"]) {
    const pointWidth = orientation === "portrait" ? cssWidth : cssHeight;
    const pointHeight = orientation === "portrait" ? cssHeight : cssWidth;
    const width = pointWidth * ratio;
    const height = pointHeight * ratio;
    const file = `${width}x${height}.png`;
    const fontSize = Math.round(Math.min(width, height) * 0.78);
    const image = await render(width, height, fontSize);
    writeFileSync(path.join(splashDir, file), image);
    startup.push({
      url: `/splash/${file}`,
      media: `screen and (device-width: ${pointWidth}px) and (device-height: ${pointHeight}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
    });
  }
}

writeFileSync(path.join(root, "src/lib/pwa-splash.json"), `${JSON.stringify(startup, null, 2)}\n`);
console.log(`wrote ${startup.length} splash images`);
