#!/usr/bin/env node
// Makes Etsy listing mockups for a print: framed-on-wall shots in two
// frame colors plus a size guide graphic. 2400x1800 (Etsy 4:3).
//
// Usage: npm run mockup -- prints/<slug>/<file>.png

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: npm run mockup -- prints/<slug>/<print-file>.png');
  process.exit(1);
}

const outDir = path.join(path.dirname(file), 'mockups');
fs.mkdirSync(outDir, { recursive: true });

const CANVAS_W = 2400;
const CANVAS_H = 1800;

const printMeta = await sharp(file).metadata();
const isLandscape = printMeta.width > printMeta.height;

// Print display size on the wall.
const dispW = isLandscape ? 1360 : Math.round(1130 * (printMeta.width / printMeta.height));
const printImg = await sharp(file).resize({ width: dispW, kernel: 'lanczos3' }).toBuffer();
const dispH = (await sharp(printImg).metadata()).height;

const FRAME_W = 34;
const outerW = dispW + FRAME_W * 2;
const outerH = dispH + FRAME_W * 2;
const frameLeft = Math.round((CANVAS_W - outerW) / 2);
const frameTop = Math.round((CANVAS_H - outerH) / 2) - 20;

async function wallMockup(name, wallColor, frameColor) {
  // Soft light from above plus corner vignette.
  const wallSvg = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="light" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
      </linearGradient>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.9">
        <stop offset="0.6" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.14"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#light)"/>
    <rect width="100%" height="100%" fill="url(#vig)"/>
  </svg>`);

  // Cast shadow: same footprint as the frame, dropped down and softened,
  // rendered on a transparent pad so the blur can breathe.
  const PAD = 90;
  const shadowSvg = Buffer.from(`<svg width="${outerW + PAD * 2}" height="${outerH + PAD * 2}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PAD}" y="${PAD}" width="${outerW}" height="${outerH}" fill="#14120e" fill-opacity="0.45"/>
  </svg>`);
  const shadow = await sharp(shadowSvg).blur(26).png().toBuffer();

  // Frame with a subtle inner lip.
  const frameSvg = Buffer.from(`<svg width="${outerW}" height="${outerH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${outerW}" height="${outerH}" fill="${frameColor.face}"/>
    <rect x="${FRAME_W - 6}" y="${FRAME_W - 6}" width="${outerW - (FRAME_W - 6) * 2}" height="${outerH - (FRAME_W - 6) * 2}" fill="${frameColor.lip}"/>
  </svg>`);
  const frame = await sharp(frameSvg).png().toBuffer();

  await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: wallColor } })
    .composite([
      { input: wallSvg, top: 0, left: 0 },
      { input: shadow, top: frameTop - PAD + 30, left: frameLeft - PAD + 8 },
      { input: frame, top: frameTop, left: frameLeft },
      { input: printImg, top: frameTop + FRAME_W, left: frameLeft + FRAME_W },
    ])
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, name));
  console.log(path.join(outDir, name));
}

async function sizeGuide() {
  const sizes = [
    ['11x14 in', 14, 11],
    ['A4', 11.7, 8.3],
    ['8x10 in', 10, 8],
    ['A5', 8.3, 5.8],
    ['5x7 in', 7, 5],
  ].map(([label, a, b]) => (isLandscape ? [label, a, b] : [label, b, a]));

  const scale = isLandscape ? 108 : 88;
  const baseX = Math.round((CANVAS_W - sizes[0][1] * scale) / 2);
  const baseY = 1580;
  const rects = sizes
    .map(([label, w, h], i) => {
      const rw = w * scale;
      const rh = h * scale;
      const shade = 74 + i * 28;
      return `<rect x="${baseX}" y="${baseY - rh}" width="${rw}" height="${rh}" fill="none" stroke="rgb(${shade},${shade},${shade - 4})" stroke-width="3"/>
        <text x="${baseX + rw - 18}" y="${baseY - rh + 46}" text-anchor="end" font-family="Georgia, serif" font-size="34" letter-spacing="3" fill="rgb(${shade},${shade},${shade - 4})">${label.toUpperCase()}</text>`;
    })
    .join('\n');

  const svg = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#faf8f2"/>
    <text x="${CANVAS_W / 2}" y="130" text-anchor="middle" font-family="Georgia, serif" font-size="52" letter-spacing="12" fill="#3d3c38">FIVE PRINT SIZES INCLUDED</text>
    <text x="${CANVAS_W / 2}" y="195" text-anchor="middle" font-family="Georgia, serif" font-size="32" letter-spacing="6" fill="#8b887e">300 DPI · INSTANT DOWNLOAD · PRINT AT HOME OR ANY PHOTO LAB</text>
    ${rects}
  </svg>`);
  await sharp(svg).jpeg({ quality: 90 }).toFile(path.join(outDir, 'mockup-size-guide.jpg'));
  console.log(path.join(outDir, 'mockup-size-guide.jpg'));
}

await wallMockup('mockup-black-frame.jpg', '#e7e4dd', { face: '#181613', lip: '#2b2823' });
await wallMockup('mockup-oak-frame.jpg', '#efece6', { face: '#b08a5e', lip: '#c9a97e' });
await sizeGuide();
