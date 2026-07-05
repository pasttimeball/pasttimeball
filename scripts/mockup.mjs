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
  await sharp(svg).jpeg({ quality: 90 }).toFile(path.join(outDir, '04-mockup-size-guide.jpg'));
  console.log(path.join(outDir, '04-mockup-size-guide.jpg'));
}

// Cascade of the five sheets plus a contents list.
async function whatYouGet() {
  const sheetW = isLandscape ? 760 : Math.round(820 * (printMeta.width / printMeta.height));
  const sheet = await sharp(file)
    .resize({ width: sheetW, kernel: 'lanczos3' })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#d6d3cb' })
    .toBuffer();
  const sheetMeta = await sharp(sheet).metadata();
  const sw = sheetMeta.width;
  const sh = sheetMeta.height;

  const SPAD = 60;
  const shadowSvg = Buffer.from(`<svg width="${sw + SPAD * 2}" height="${sh + SPAD * 2}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${SPAD}" y="${SPAD}" width="${sw}" height="${sh}" fill="#14120e" fill-opacity="0.30"/>
  </svg>`);
  const shadow = await sharp(shadowSvg).blur(16).png().toBuffer();

  const STEP = 44;
  const stackW = sw + STEP * 4;
  const stackH = sh + STEP * 4;
  const stackLeft = Math.round((1240 - stackW) / 2) + 100;
  const stackTop = Math.round((CANVAS_H + 240 - stackH) / 2);

  const composites = [];
  for (let i = 0; i < 5; i++) {
    const left = stackLeft + STEP * i;
    const top = stackTop + STEP * i;
    composites.push({ input: shadow, top: top - SPAD + 14, left: left - SPAD + 6 });
    composites.push({ input: sheet, top, left });
  }

  const tx = 1500;
  const item = (y, title, lines) => `
    <circle cx="${tx}" cy="${y - 12}" r="7" fill="#2d5a3d"/>
    <text x="${tx + 34}" y="${y}" font-family="Georgia, serif" font-size="40" letter-spacing="5" fill="#3d3c38">${title}</text>
    ${lines.map((l, i) => `<text x="${tx + 34}" y="${y + 56 + i * 48}" font-family="Georgia, serif" font-size="31" fill="#8b887e">${l}</text>`).join('\n')}`;

  const textSvg = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${CANVAS_W / 2}" y="130" text-anchor="middle" font-family="Georgia, serif" font-size="52" letter-spacing="12" fill="#3d3c38">WHAT YOU RECEIVE</text>
    <text x="${CANVAS_W / 2}" y="195" text-anchor="middle" font-family="Georgia, serif" font-size="32" letter-spacing="6" fill="#8b887e">ONE INSTANT DOWNLOAD · EVERYTHING BELOW</text>
    ${item(480, 'FIVE PRINT-READY FILES', ['5x7 in · A5 · 8x10 in · A4 · 11x14 in', '300 DPI, crisp black and white'])}
    ${item(780, 'INK-ONLY TRANSPARENT PNG', ['the paper knocked out, for toned', 'paper and craft projects'])}
    ${item(1080, 'THE CLIPPING&#8217;S STORY', ['a note on what it is, when it ran', 'and where the original page lives'])}
    <text x="${CANVAS_W / 2}" y="1690" text-anchor="middle" font-family="Georgia, serif" font-size="30" letter-spacing="6" fill="#8b887e">NO PHYSICAL ITEM SHIPPED · PRINT AT HOME OR ANY PHOTO LAB</text>
  </svg>`);

  await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: '#faf8f2' } })
    .composite([...composites, { input: textSvg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, '05-mockup-what-you-get.jpg'));
  console.log(path.join(outDir, '05-mockup-what-you-get.jpg'));
}

// Close-up crop from the largest sheet, shown above print size.
async function detailShot() {
  const dir = path.dirname(file);
  const bigName = fs.readdirSync(dir).find((f) => f.includes('11x14') && f.endsWith('.png'));
  const big = bigName ? path.join(dir, bigName) : file;
  const meta = await sharp(big).metadata();
  const left = Math.round((meta.width - CANVAS_W) / 2);
  const top = Math.round((meta.height - CANVAS_H) / 2);

  const caption = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="1652" width="${CANVAS_W}" height="148" fill="#faf8f2" fill-opacity="0.94"/>
    <text x="${CANVAS_W / 2}" y="1740" text-anchor="middle" font-family="Georgia, serif" font-size="33" letter-spacing="6" fill="#3d3c38">SHOWN LARGER THAN PRINT SIZE · CLEANED FROM THE ORIGINAL SCAN</text>
  </svg>`);

  await sharp(big)
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: Math.min(CANVAS_W, meta.width), height: Math.min(CANVAS_H, meta.height) })
    .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' })
    .composite([{ input: caption, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, '02-mockup-detail.jpg'));
  console.log(path.join(outDir, '02-mockup-detail.jpg'));
}

// Three-step instant download explainer.
async function howItWorks() {
  const colX = [500, 1200, 1900];
  const iconY = 680;
  const icons = [
    // ticket
    `<g stroke="#3d3c38" stroke-width="5" fill="none">
      <rect x="${colX[0] - 110}" y="${iconY - 70}" width="220" height="140" rx="14"/>
      <line x1="${colX[0] + 40}" y1="${iconY - 70}" x2="${colX[0] + 40}" y2="${iconY + 70}" stroke-dasharray="12 12"/>
      <circle cx="${colX[0] - 35}" cy="${iconY}" r="26"/>
    </g>`,
    // download arrow into tray
    `<g stroke="#3d3c38" stroke-width="5" fill="none" stroke-linecap="round">
      <line x1="${colX[1]}" y1="${iconY - 80}" x2="${colX[1]}" y2="${iconY + 30}"/>
      <polyline points="${colX[1] - 42},${iconY - 12} ${colX[1]},${iconY + 34} ${colX[1] + 42},${iconY - 12}"/>
      <polyline points="${colX[1] - 100},${iconY + 40} ${colX[1] - 100},${iconY + 85} ${colX[1] + 100},${iconY + 85} ${colX[1] + 100},${iconY + 40}"/>
    </g>`,
    // frame
    `<g stroke="#3d3c38" stroke-width="5" fill="none">
      <rect x="${colX[2] - 90}" y="${iconY - 85}" width="180" height="170"/>
      <rect x="${colX[2] - 62}" y="${iconY - 57}" width="124" height="114"/>
    </g>`,
  ];
  const steps = [
    ['1', 'BUY THE LISTING', ['Your files are ready the', 'moment payment clears.']],
    ['2', 'DOWNLOAD', ['Etsy keeps them under You,', 'then Purchases and Reviews.']],
    ['3', 'PRINT AND FRAME', ['At home or any photo lab.', 'Matte paper suits old ink best.']],
  ];
  const cols = steps
    .map(([n, title, lines], i) => `
      <circle cx="${colX[i]}" cy="420" r="46" fill="none" stroke="#2d5a3d" stroke-width="4"/>
      <text x="${colX[i]}" y="440" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="#2d5a3d">${n}</text>
      ${icons[i]}
      <text x="${colX[i]}" y="920" text-anchor="middle" font-family="Georgia, serif" font-size="42" letter-spacing="7" fill="#3d3c38">${title}</text>
      ${lines.map((l, j) => `<text x="${colX[i]}" y="${990 + j * 50}" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#8b887e">${l}</text>`).join('\n')}`)
    .join('\n');

  const svg = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#faf8f2"/>
    <text x="${CANVAS_W / 2}" y="170" text-anchor="middle" font-family="Georgia, serif" font-size="56" letter-spacing="12" fill="#3d3c38">INSTANT DIGITAL DOWNLOAD</text>
    <text x="${CANVAS_W / 2}" y="240" text-anchor="middle" font-family="Georgia, serif" font-size="32" letter-spacing="6" fill="#8b887e">NO WAITING, NO SHIPPING</text>
    ${cols}
    <line x1="700" y1="1420" x2="1700" y2="1420" stroke="#d6d3cb" stroke-width="2"/>
    <text x="${CANVAS_W / 2}" y="1540" text-anchor="middle" font-family="Georgia, serif" font-size="31" letter-spacing="5" fill="#8b887e">THE FILES ARE YOURS TO KEEP · REPRINT FOR YOUR OWN WALLS ANY TIME</text>
  </svg>`);
  await sharp(svg).jpeg({ quality: 90 }).toFile(path.join(outDir, '06-mockup-how-it-works.jpg'));
  console.log(path.join(outDir, '06-mockup-how-it-works.jpg'));
}

// The ink-only transparent PNG shown on kraft paper.
async function kraftShot() {
  const dir = path.dirname(file);
  const inkName = fs.readdirSync(dir).find((f) => f.endsWith('ink-only-transparent.png'));
  if (!inkName) return;
  const ink = path.join(dir, inkName);

  // The sheet PNG has wide transparent margins; trim so the ink fills the
  // shot, then size by the trimmed ink's own shape.
  const trimmed = await sharp(ink).trim({ threshold: 10 }).toBuffer();
  const inkImg = await sharp(trimmed).resize({ width: 1500, height: 1150, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const inkMeta = await sharp(inkImg).metadata();

  const bg = Buffer.from(`<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="kraft" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#c8ad8c"/>
        <stop offset="0.5" stop-color="#bda283"/>
        <stop offset="1" stop-color="#ad9273"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.75">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#kraft)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <text x="${CANVAS_W / 2}" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="50" letter-spacing="11" fill="#3a2f22">INK-ONLY TRANSPARENT PNG</text>
    <text x="${CANVAS_W / 2}" y="216" text-anchor="middle" font-family="Georgia, serif" font-size="31" letter-spacing="6" fill="#5f4f3c">THE PAPER KNOCKED OUT · SHOWN HERE ON KRAFT, PRINTS ON ANY TONED STOCK</text>
  </svg>`);

  await sharp(bg)
    .composite([{ input: inkImg, top: Math.round((CANVAS_H + 160 - inkMeta.height) / 2), left: Math.round((CANVAS_W - inkMeta.width) / 2) }])
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, '07-mockup-kraft.jpg'));
  console.log(path.join(outDir, '07-mockup-kraft.jpg'));
}

await wallMockup('01-mockup-black-frame.jpg', '#e7e4dd', { face: '#181613', lip: '#2b2823' });
await wallMockup('03-mockup-oak-frame.jpg', '#efece6', { face: '#b08a5e', lip: '#c9a97e' });
await sizeGuide();
await whatYouGet();
await detailShot();
await howItWorks();
await kraftShot();
