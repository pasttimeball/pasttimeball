#!/usr/bin/env node
// Downloads the full-resolution JPEG of a newspaper page from loc.gov,
// pulled from the same IIIF image server behind the site's zoom viewer.
//
// Usage:
//   npm run grab -- "https://www.loc.gov/resource/sn82016014/1908-05-14/ed-1/?sp=2"
//   npm run grab -- "<page url>" --width 3000
//   npm run grab -- "<page url>" --out salt-packers.jpg

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--width') args.width = Number(argv[++i]);
    else if (arg === '--out') args.out = argv[++i];
    else if (!args.url) args.url = arg;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url || !/^https?:\/\/(www\.)?loc\.gov\/resource\//.test(args.url)) {
  console.error('Usage: npm run grab -- "https://www.loc.gov/resource/<lccn>/<date>/ed-1/?sp=N" [--width 3000] [--out name.jpg]');
  process.exit(1);
}

const pageUrl = new URL(args.url);
pageUrl.searchParams.set('fo', 'json');
console.error('Asking loc.gov about that page...');

async function fetchJsonWithRetry(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`server answered ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === tries) throw error;
      console.error(`  Metadata request failed (${error.message ?? error}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
  }
}

const data = await fetchJsonWithRetry(pageUrl);
const files = data.page ?? [];
const master = files.find((f) => f.info) ?? files.find((f) => f.mimetype === 'image/jp2');
if (!master) {
  console.error('No image service found for that URL. Make sure it is a newspaper page URL with ?sp= in it.');
  process.exit(1);
}

const service = master.info.replace(/\/info\.json$/, '');
const size = args.width ? `full/${args.width},` : 'full/full';
const imageUrl = `${service}/${size}/0/default.jpg`;

const lccn = pageUrl.pathname.split('/')[2] ?? 'page';
const date = pageUrl.pathname.split('/')[3] ?? '';
const sp = pageUrl.searchParams.get('sp') ?? '1';
const fileName = args.out ?? `${lccn}-${date}-p${sp}.jpg`;
const outDir = path.join(process.cwd(), 'archive');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, fileName);

const attempts = args.width
  ? [`full/${args.width},`]
  : ['full/full', 'full/full', 'full/4000,', 'full/3000,'];

let saved = false;
for (const [i, attemptSize] of attempts.entries()) {
  const attemptUrl = `${service}/${attemptSize}/0/default.jpg`;
  const label = attemptSize === 'full/full'
    ? `full resolution (${master.width}x${master.height})`
    : attemptSize.replace('full/', '').replace(',', 'px wide');
  console.error(`Downloading ${label}${i > 0 ? ' (retry)' : ''}...`);
  try {
    const response = await fetch(attemptUrl);
    if (!response.ok) throw new Error(`server answered ${response.status}`);
    fs.writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
    const expected = attemptSize === 'full/full' ? master.width : Number(attemptSize.match(/\d+/)[0]);
    const meta = await sharp(outPath).metadata();
    if (Math.abs(meta.width - expected) > Math.max(10, expected * 0.01)) {
      throw new Error(`server sent a bad image (${meta.width}px wide, expected ${expected})`);
    }
    saved = true;
    break;
  } catch (error) {
    console.error(`  That attempt failed (${error.message ?? error}).`);
  }
}
if (!saved) {
  console.error('Could not download the image. The loc.gov image server may be busy. Try again in a minute or add --width 2000.');
  process.exit(1);
}

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`Saved ${path.relative(process.cwd(), outPath)} (${mb} MB)`);
console.log('Crop your clipping from it and save the crop into public/images/clippings/.');
