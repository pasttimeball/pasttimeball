#!/usr/bin/env node
// Crop helper for the cut-and-queue workflow.
//
// Overview (1000px wide, for finding items on a page):
//   node scripts/crop.mjs archive/page.jpg --overview out.jpg
// Region overview (zoom into a box, scaled to 1000px wide):
//   node scripts/crop.mjs archive/page.jpg --box 100,200,3000,2500 --overview out.jpg
// Final crop (full resolution, jpeg q92):
//   node scripts/crop.mjs archive/page.jpg --box 100,200,3000,2500 out.jpg
//
// --box is left,top,width,height in source pixels.

import sharp from 'sharp';

const args = process.argv.slice(2);
const input = args.shift();
let box = null;
let overview = false;
let width = null;
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--box') box = args[++i].split(',').map(Number);
  else if (args[i] === '--overview') overview = true;
  else if (args[i] === '--width') width = Number(args[++i]);
  else rest.push(args[i]);
}
const output = rest[0];
if (!input || !output) {
  console.error('Usage: node scripts/crop.mjs <input> [--box l,t,w,h] [--overview] <output>');
  process.exit(1);
}

let img = sharp(input);
const meta = await img.metadata();
if (box) {
  const [left, top, width, height] = box.map(Math.round);
  img = img.extract({
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: Math.min(width, meta.width - Math.max(0, left)),
    height: Math.min(height, meta.height - Math.max(0, top)),
  });
}
if (overview) img = img.resize({ width: 1000 });
else if (width) img = img.resize({ width });
await img.jpeg({ quality: 92 }).toFile(output);
const out = await sharp(output).metadata();
console.log(`${output}: ${out.width}x${out.height} (source ${meta.width}x${meta.height})`);
