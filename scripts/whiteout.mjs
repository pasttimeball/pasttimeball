#!/usr/bin/env node
// Paints white rectangles over stray marks in a print-only variant.
// Only for boosted/cleaned variants where the paper is already near-white;
// on natural scans use a median patch instead (a white rect shows a seam).
// Usage: node scripts/whiteout.mjs <input> <output> "x,y,w,h" ["x,y,w,h" ...]

import sharp from 'sharp';

const [input, output, ...rects] = process.argv.slice(2);
if (!input || !output || rects.length === 0) {
  console.error('Usage: node scripts/whiteout.mjs <input> <output> "x,y,w,h" [...]');
  process.exit(1);
}

const layers = rects.map((r) => {
  const [x, y, w, h] = r.split(',').map(Number);
  return {
    input: { create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } },
    left: x,
    top: y,
  };
});
await sharp(input).composite(layers).toFile(output);
console.log(`${output}: whited ${rects.length} rect(s)`);
