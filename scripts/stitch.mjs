#!/usr/bin/env node
// Stitch two or more crops vertically with a paper-gray gap, centering
// narrower pieces, the same treatment as the two-column L-shaped stories.
// Usage: node scripts/stitch.mjs out.jpg piece1.jpg piece2.jpg [...]

import sharp from 'sharp';

const GAP = 20;
const PAPER = { r: 178, g: 176, b: 170 };

const [output, ...inputs] = process.argv.slice(2);
if (!output || inputs.length < 2) {
  console.error('Usage: node scripts/stitch.mjs <output> <piece1> <piece2> [...]');
  process.exit(1);
}

const metas = await Promise.all(inputs.map((f) => sharp(f).metadata()));
const width = Math.max(...metas.map((m) => m.width));
const height = metas.reduce((sum, m) => sum + m.height, 0) + GAP * (inputs.length - 1);

let top = 0;
const layers = [];
for (let i = 0; i < inputs.length; i++) {
  layers.push({
    input: await sharp(inputs[i]).toBuffer(),
    left: Math.round((width - metas[i].width) / 2),
    top,
  });
  top += metas[i].height + GAP;
}

await sharp({ create: { width, height, channels: 3, background: PAPER } })
  .composite(layers)
  .jpeg({ quality: 92 })
  .toFile(output);
console.log(`${output}: ${width}x${height}`);
