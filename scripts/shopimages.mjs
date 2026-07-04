#!/usr/bin/env node
// Shop-level images for the Etsy storefront, built from existing 5x7 sheets:
// a gallery-wall photo for the About section (2400x1800) and the wide shop
// banner (3360x840, Etsy's big banner size). Same wall, frames and shadows
// as the listing mockups so the storefront reads as one set.
//
// Usage: npm run shopimages
// Output: prints/shop/about-gallery-wall.jpg, prints/shop/shop-banner.jpg

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const P = (slug, file) => path.join('prints', slug, file);
const SHEETS = {
  allman: P('allman-greatest-game-cartoon', 'allman-greatest-game-cartoon-5x7.png'),
  oregon: P('oregon-will-celebrate-july-4', 'oregon-will-celebrate-july-4-5x7-landscape.png'),
  sporting: P('sporting-news-base-ball-paper', 'sporting-news-base-ball-paper-5x7-landscape.png'),
  yellville: P('yellville-boy-in-tree', 'yellville-boy-in-tree-5x7.png'),
  playball: P('play-ball-spaulding-hale', 'play-ball-spaulding-hale-5x7-keyline.png'),
};

const BLACK = { face: '#181613', lip: '#2b2823' };
const OAK = { face: '#b08a5e', lip: '#c9a97e' };

const outDir = path.join('prints', 'shop');
fs.mkdirSync(outDir, { recursive: true });

async function framed(file, dispW, frameW, color) {
  const img = await sharp(file).resize({ width: dispW, kernel: 'lanczos3' }).toBuffer();
  const dispH = (await sharp(img).metadata()).height;
  const outerW = dispW + frameW * 2;
  const outerH = dispH + frameW * 2;
  const lip = Math.max(4, frameW - 6);
  const frameSvg = Buffer.from(`<svg width="${outerW}" height="${outerH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${outerW}" height="${outerH}" fill="${color.face}"/>
    <rect x="${lip}" y="${lip}" width="${outerW - lip * 2}" height="${outerH - lip * 2}" fill="${color.lip}"/>
  </svg>`);
  const buf = await sharp(frameSvg)
    .composite([{ input: img, top: frameW, left: frameW }])
    .png()
    .toBuffer();
  return { buf, w: outerW, h: outerH };
}

async function scene(name, W, H, items) {
  const wallSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
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

  const PAD = 80;
  const layers = [{ input: wallSvg, top: 0, left: 0 }];
  for (const it of items) {
    const f = await framed(SHEETS[it.key], it.dispW, it.frameW, it.color);
    const y = Math.round(it.cy - f.h / 2);
    const shadowSvg = Buffer.from(`<svg width="${f.w + PAD * 2}" height="${f.h + PAD * 2}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${PAD}" y="${PAD}" width="${f.w}" height="${f.h}" fill="#14120e" fill-opacity="0.45"/>
    </svg>`);
    const shadow = await sharp(shadowSvg).blur(22).png().toBuffer();
    layers.push({ input: shadow, top: y - PAD + 24, left: it.x - PAD + 6 });
    layers.push({ input: f.buf, top: y, left: it.x });
  }

  const outPath = path.join(outDir, name);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#e8e5de' } })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toFile(outPath);
  console.log(outPath);
}

// About featured photo: a small salon wall. Two portraits, two landscapes
// stacked, mixed frames, hung the way a person would actually hang them.
await scene('about-gallery-wall.jpg', 2400, 1800, [
  { key: 'yellville', dispW: 400, frameW: 30, color: OAK, x: 240, cy: 880 },
  { key: 'allman', dispW: 540, frameW: 30, color: BLACK, x: 770, cy: 880 },
  { key: 'oregon', dispW: 660, frameW: 30, color: OAK, x: 1440, cy: 590 },
  { key: 'sporting', dispW: 660, frameW: 30, color: BLACK, x: 1440, cy: 1170 },
]);

// Shop banner: a level row of five, centers aligned, symmetric frame colors.
await scene('shop-banner.jpg', 3360, 840, [
  { key: 'playball', dispW: 357, frameW: 22, color: BLACK, x: 354, cy: 420 },
  { key: 'sporting', dispW: 560, frameW: 22, color: OAK, x: 815, cy: 420 },
  { key: 'allman', dispW: 357, frameW: 22, color: BLACK, x: 1479, cy: 420 },
  { key: 'oregon', dispW: 560, frameW: 22, color: OAK, x: 1940, cy: 420 },
  { key: 'yellville', dispW: 357, frameW: 22, color: BLACK, x: 2604, cy: 420 },
]);
