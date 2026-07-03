#!/usr/bin/env node
// Turns a clipping into print-ready sheets: cleaned scan mounted on a
// near-white sheet with a citation line, at 300 DPI in three frame sizes.
//
// Usage:
//   npm run print -- base-ball-sunday-tulsa-producers
//   npm run print -- <slug> --photo            (gentler cleanup for halftone photos)
//   npm run print -- <slug> --trim 5,50,75,10  (shave left,top,right,bottom pixels first)
//
// Output: prints/<slug>/<slug>-5x7.png, -8x10.png, -11x14.png

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';

const SIZES = [
  { name: '5x7', width: 1500, height: 2100 },
  { name: '8x10', width: 2400, height: 3000 },
  { name: '11x14', width: 3300, height: 4200 },
];

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function parseArgs(argv) {
  const args = { photo: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--photo') args.photo = true;
    else if (arg === '--trim') args.trim = argv[++i].split(',').map(Number);
    else if (!args.slug) args.slug = arg.replace(/\.md$/, '').split(/[\\/]/).pop();
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.slug) {
  console.error('Usage: npm run print -- <clipping-slug> [--photo] [--trim l,t,r,b]');
  process.exit(1);
}

const mdPath = path.join('src', 'content', 'clippings', `${args.slug}.md`);
if (!fs.existsSync(mdPath)) {
  console.error(`No clipping found at ${mdPath}`);
  process.exit(1);
}
const { data } = matter(fs.readFileSync(mdPath, 'utf8'));
const imagePath = path.join('public', data.image.replace(/^\//, ''));
if (!fs.existsSync(imagePath)) {
  console.error(`Clipping image not found at ${imagePath}`);
  process.exit(1);
}

// Citation: full date from the loc.gov source URL when available, else year.
let dateText = String(data.year);
const dateMatch = String(data.source).match(/(\d{4})-(\d{2})-(\d{2})/);
if (dateMatch) {
  dateText = `${MONTHS[Number(dateMatch[2]) - 1]} ${Number(dateMatch[3])}, ${dateMatch[1]}`;
}
const citation = `${data.newspaper.toUpperCase()} · ${dateText}`;

// Cleanup pass. Text clippings get strong levels; halftone photos gentler.
let clip = sharp(imagePath).greyscale();
const meta0 = await clip.metadata();
if (args.trim) {
  const [l, t, r, b] = args.trim;
  clip = clip.extract({ left: l, top: t, width: meta0.width - l - r, height: meta0.height - t - b });
}
clip = args.photo ? clip.linear(1.4, -38) : clip.median(3).linear(2.0, -105);
const cleaned = await clip.toBuffer();
const cleanedMeta = await sharp(cleaned).metadata();

const outDir = path.join('prints', args.slug);
fs.mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const f = size.width / 2400;
  const maxW = Math.round(size.width * 0.8125);
  const maxH = Math.round(size.height * 0.5);
  const scale = Math.min(maxW / cleanedMeta.width, maxH / cleanedMeta.height);
  const clipW = Math.round(cleanedMeta.width * scale);
  const clipH = Math.round(cleanedMeta.height * scale);
  const resized = await sharp(cleaned).resize({ width: clipW, kernel: 'lanczos3' }).toBuffer();

  const clipTop = Math.round(size.height * 0.2333);
  const citeY = clipTop + clipH + Math.round(160 * f);
  const svg = Buffer.from(`<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${size.width / 2}" y="${citeY}" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(44 * f)}" letter-spacing="${Math.round(10 * f)}" fill="#4a4a45">${citation}</text>
    <line x1="${size.width / 2 - 150 * f}" y1="${citeY + Math.round(55 * f)}" x2="${size.width / 2 + 150 * f}" y2="${citeY + Math.round(55 * f)}" stroke="#b5b2a8" stroke-width="2"/>
  </svg>`);

  const outPath = path.join(outDir, `${args.slug}-${size.name}.png`);
  await sharp({ create: { width: size.width, height: size.height, channels: 3, background: '#fdfdfb' } })
    .composite([
      { input: resized, top: clipTop, left: Math.round((size.width - clipW) / 2) },
      { input: svg, top: 0, left: 0 },
    ])
    .withMetadata({ density: 300 })
    .png()
    .toFile(outPath);
  console.log(`${outPath}  (${size.width}x${size.height} @ 300dpi, clipping ${clipW}x${clipH})`);
}

console.log(`\nCitation: ${citation}`);
console.log('Order a physical proof before listing. Screens flatter contrast.');
