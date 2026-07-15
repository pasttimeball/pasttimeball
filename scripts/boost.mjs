#!/usr/bin/env node
// Tone boost for print-only variants: applies a single linear curve.
// Usage: node scripts/boost.mjs <input> <output> <a> <b>
//   gentle (dark impressions): a=1.37 b=-68
//   strong (pale Herald scans): a=3 b=-380
// Passes are materialized, so chain runs of this script for double curves.

import sharp from 'sharp';

const [input, output, a, b] = process.argv.slice(2);
if (!input || !output || !a || !b) {
  console.error('Usage: node scripts/boost.mjs <input> <output> <a> <b>');
  process.exit(1);
}
await sharp(input).linear(Number(a), Number(b)).toFile(output);
const meta = await sharp(output).metadata();
console.log(`${output}: ${meta.width}x${meta.height} linear(${a},${b})`);
