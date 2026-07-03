#!/usr/bin/env node
// Prepares a clipping for Instagram: 4:5 panels (1080x1350) plus caption.txt.
// Tall columns are sliced into carousel panels, cutting at blank rows between
// text lines. Output lands in ig/<slug>/, ready to upload from a phone.
// Usage: npm run ig -- src/content/clippings/some-clipping.md [more.md ...]
//        npm run ig -- --live     (every clipping already live on the site)

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const MARGIN = 40;
const CONTENT_W = CANVAS_W - MARGIN * 2;
const CONTENT_H = CANVAS_H - MARGIN * 2;
const SEAM_WINDOW = 80; // rows to search either side of a target cut
const PAPER = { r: 178, g: 176, b: 170 };

const HASHTAGS_BY_TAG = {
  'great-names': '#greatteamnames',
  'town-teams': '#townball',
  'womens-teams': '#womensbaseball',
  'minor-leagues': '#minorleaguebaseball',
  softball: '#softballhistory',
  ads: '#vintageads',
  stories: '#oldnews',
};
const FALLBACK_HASHTAGS = ['#baseballhistory', '#vintagebaseball', '#oldnewspapers'];

function buildCaption(data) {
  const tagHashtags = (data.tags ?? []).map((t) => HASHTAGS_BY_TAG[t]).filter(Boolean);
  const hashtags = [...new Set([...tagHashtags, ...FALLBACK_HASHTAGS])].slice(0, 3);
  const sourceCredit = /^https?:\/\//.test(data.source)
    ? `Source: ${data.newspaper}, ${data.year}, via ${new URL(data.source).hostname}`
    : `Source: ${data.source}`;
  return [
    data.title,
    '',
    data.team ? `The ${data.team}. ${data.place}, ${data.year}.` : `${data.place}, ${data.year}.`,
    '',
    sourceCredit,
    '',
    hashtags.join(' '),
  ].join('\n');
}

// Mean brightness per row of a grayscale buffer.
function rowMeans(raw, width, height) {
  const means = new Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const base = y * width;
    for (let x = 0; x < width; x++) sum += raw[base + x];
    means[y] = sum / width;
  }
  return means;
}

// Pick the blankest row near the target so slices break between text lines.
function bestCut(means, target, lastCut) {
  const lo = Math.max(lastCut + Math.floor(CONTENT_H / 2), target - SEAM_WINDOW);
  const hi = Math.min(means.length - 1, target + SEAM_WINDOW, lastCut + CONTENT_H);
  let best = hi;
  for (let y = lo; y <= hi; y++) {
    if (means[y] >= means[best]) best = y; // ties go to the lower row
  }
  return best;
}

async function panelFromStrip(strip, stripH, outPath) {
  if (stripH > CONTENT_H) {
    strip = await sharp(strip).resize({ height: CONTENT_H }).toBuffer();
    stripH = CONTENT_H;
  }
  const { width: stripW } = await sharp(strip).metadata();
  await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: PAPER },
  })
    .composite([
      {
        input: strip,
        left: Math.round((CANVAS_W - stripW) / 2),
        top: stripH >= CONTENT_H ? MARGIN : Math.round((CANVAS_H - stripH) / 2),
      },
    ])
    .jpeg({ quality: 92 })
    .toFile(outPath);
}

function writeAlt(outDir, alt, panelCount) {
  if (!alt) return;
  if (panelCount <= 1) {
    fs.writeFileSync(path.join(outDir, 'alt.txt'), alt + '\n');
    return;
  }
  const lines = [`01: ${alt} Part 1 of ${panelCount}.`];
  for (let i = 2; i <= panelCount; i++) {
    lines.push(`${String(i).padStart(2, '0')}: Continuation of the same newspaper clipping, part ${i} of ${panelCount}.`);
  }
  fs.writeFileSync(path.join(outDir, 'alt.txt'), lines.join('\n') + '\n');
}

async function processClipping(mdPath) {
  const { data } = matter(fs.readFileSync(mdPath, 'utf8'));
  const slug = path.basename(mdPath, '.md');
  const imgPath = path.join('public', data.image);
  if (!fs.existsSync(imgPath)) {
    console.error(`${slug}: image not found at ${imgPath}`);
    return;
  }
  const outDir = path.join('ig', slug);
  fs.mkdirSync(outDir, { recursive: true });

  const meta = await sharp(imgPath).metadata();
  const scaledH = Math.round(meta.height * (CONTENT_W / meta.width));
  let panelCount = 1;

  if (scaledH <= CONTENT_H) {
    const strip = await sharp(imgPath).resize({ width: CONTENT_W }).toBuffer();
    await panelFromStrip(strip, scaledH, path.join(outDir, '01.jpg'));
    console.log(`${slug}: 1 panel`);
  } else if (scaledH <= CONTENT_H * 1.4) {
    // Close enough to fit: shrink to panel height rather than slice a photo in half.
    const strip = await sharp(imgPath).resize({ height: CONTENT_H }).toBuffer();
    await panelFromStrip(strip, CONTENT_H, path.join(outDir, '01.jpg'));
    console.log(`${slug}: 1 panel (shrunk to fit)`);
  } else {
    const column = await sharp(imgPath).resize({ width: CONTENT_W }).jpeg({ quality: 98 }).toBuffer();
    const raw = await sharp(column).grayscale().raw().toBuffer();
    const means = rowMeans(raw, CONTENT_W, scaledH);

    // Spread cuts evenly so the final panel is never a near-blank sliver.
    const nPanels = Math.ceil(scaledH / CONTENT_H);
    const step = scaledH / nPanels;
    const cuts = [];
    let cursor = 0;
    for (let i = 1; i < nPanels; i++) {
      const cut = bestCut(means, Math.round(step * i), cursor);
      cuts.push(cut);
      cursor = cut;
    }
    const bounds = [0, ...cuts, scaledH];
    for (let i = 0; i < bounds.length - 1; i++) {
      const top = bounds[i];
      const h = bounds[i + 1] - top;
      const strip = await sharp(column).extract({ left: 0, top, width: CONTENT_W, height: h }).toBuffer();
      const name = String(i + 1).padStart(2, '0') + '.jpg';
      await panelFromStrip(strip, h, path.join(outDir, name));
    }
    panelCount = bounds.length - 1;
    console.log(`${slug}: ${panelCount} panels`);
  }

  fs.writeFileSync(path.join(outDir, 'caption.txt'), buildCaption(data) + '\n');
  writeAlt(outDir, data.alt, panelCount);
}

let files = process.argv.slice(2);
if (files[0] === '--live') {
  const dir = 'src/content/clippings';
  const today = new Date().toISOString().slice(0, 10);
  files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f))
    .filter((f) => {
      const { data } = matter(fs.readFileSync(f, 'utf8'));
      if (data.draft) return false;
      const posted = data.posted instanceof Date ? data.posted.toISOString().slice(0, 10) : String(data.posted);
      return posted <= today;
    });
}
if (files.length === 0) {
  console.error('Usage: npm run ig -- path/to/clipping.md [...] | --live');
  process.exit(1);
}
for (const f of files) await processClipping(f);
