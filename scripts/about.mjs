#!/usr/bin/env node
// Renders the ABOUT-THIS-CLIPPING.pdf card that ships inside each digital
// download: masthead, clipping thumbnail, the story, what's in the kit,
// license and a clickable source link. One page, letter size.
//
// Usage: npm run about -- <clipping-slug>

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

const slug = (process.argv[2] ?? '').replace(/\.md$/, '').split(/[\\/]/).pop();
if (!slug) {
  console.error('Usage: npm run about -- <clipping-slug>');
  process.exit(1);
}
const mdPath = path.join('src', 'content', 'clippings', `${slug}.md`);
if (!fs.existsSync(mdPath)) {
  console.error(`No clipping found at ${mdPath}`);
  process.exit(1);
}
const { data } = matter(fs.readFileSync(mdPath, 'utf8'));
const imagePath = path.join('public', data.image.replace(/^\//, ''));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let dateText = String(data.year);
const dm = String(data.source).match(/(\d{4})-(\d{2})-(\d{2})/);
if (dm) dateText = `${MONTHS[Number(dm[2]) - 1]} ${Number(dm[3])}, ${dm[1]}`;
const citation = `${data.newspaper.toUpperCase()} · ${dateText.toUpperCase()}`;

// Colors and fonts (site palette; Georgia from Windows, Times fallback)
const INK = '#1b1b19';
const GREEN = '#2d5a3d';
const GRAY = '#6b6963';
const RULE = '#d6d3cb';
const F = fs.existsSync('C:/Windows/Fonts/georgia.ttf')
  ? { reg: 'C:/Windows/Fonts/georgia.ttf', bold: 'C:/Windows/Fonts/georgiab.ttf', ital: 'C:/Windows/Fonts/georgiai.ttf' }
  : { reg: 'Times-Roman', bold: 'Times-Bold', ital: 'Times-Italic' };

const outDir = path.join('prints', slug);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'ABOUT-THIS-CLIPPING.pdf');

const W = 612, H = 792, M = 70;
// Bottom margin sits below the pinned footer so it never forces a second page.
const doc = new PDFDocument({ size: 'letter', margins: { top: M, bottom: 24, left: M, right: M } });
doc.pipe(fs.createWriteStream(outPath));

// Paper tone
doc.rect(0, 0, W, H).fill('#fbfaf6');

const center = (w) => (W - w) / 2;
function hairline(y, w = 190) {
  doc.moveTo(center(w), y).lineTo(center(w) + w, y).lineWidth(0.7).stroke(RULE);
}

// Masthead
doc.font(F.reg).fontSize(13).fillColor(GREEN)
  .text('PAST TIME BALL', M, 58, { width: W - M * 2, align: 'center', characterSpacing: 7 });
hairline(84);

// Clipping thumbnail with keyline, optically centered
const meta = await sharp(imagePath).metadata();
const BOX_W = 330, BOX_H = 205;
const scale = Math.min(BOX_W / meta.width, BOX_H / meta.height);
const iw = meta.width * scale, ih = meta.height * scale;
const ix = center(iw), iy = 108;
doc.image(imagePath, ix, iy, { width: iw, height: ih });
doc.rect(ix - 7, iy - 7, iw + 14, ih + 14).lineWidth(0.8).stroke('#b8b5ab');

let y = iy + ih + 34;

// Title and citation
doc.font(F.bold).fontSize(17).fillColor(INK)
  .text(data.title, M, y, { width: W - M * 2, align: 'center' });
y = doc.y + 10;
doc.font(F.reg).fontSize(8.5).fillColor(GRAY)
  .text(citation, M, y, { width: W - M * 2, align: 'center', characterSpacing: 3.5 });
y = doc.y + 16;
hairline(y);
y += 20;

// The story
doc.font(F.reg).fontSize(10.5).fillColor(INK)
  .text(data.blurb ?? '', M + 22, y, { width: W - (M + 22) * 2, align: 'left', lineGap: 4.5 });
y = doc.y + 24;

function section(header, body, opts = {}) {
  doc.font(F.reg).fontSize(9).fillColor(GREEN)
    .text(header, M + 22, y, { characterSpacing: 3 });
  y = doc.y + 5;
  doc.font(F.reg).fontSize(9.5).fillColor(INK)
    .text(body, M + 22, y, { width: W - (M + 22) * 2, lineGap: 3, ...opts });
  y = doc.y + (opts.tight ? 6 : 16);
}

section('WHAT YOU HAVE',
  'Five print-ready files at 300 DPI: 5x7, 8x10 and 11x14 inches plus A5 and A4, ' +
  'with an ink-only transparent PNG for toned paper and craft projects. ' +
  'Prints beautifully at home, at a photo counter or through any print shop. Plain matte paper suits it best.');

section('FOR PERSONAL USE',
  'Print as many copies as you like for your own walls and your gifts. ' +
  'Please do not resell these files or prints made from them.');

section('THE SOURCE',
  'Drawn from a public domain newspaper digitized by the Library of Congress. The original page lives here:',
  { tight: true });
doc.font(F.reg).fontSize(8.5).fillColor(GREEN)
  .text(String(data.source), M + 22, y, { width: W - (M + 22) * 2, link: String(data.source), underline: false });
y = doc.y;

// Footer pinned to the bottom of the page
const fy = H - 92;
hairline(fy);
doc.font(F.ital).fontSize(10).fillColor(GRAY)
  .text('Found, cleaned and mounted by the Bleacherite.', M, fy + 14, { width: W - M * 2, align: 'center' });
doc.font(F.reg).fontSize(9).fillColor(GREEN)
  .text('pasttimeball.com', M, fy + 32, { width: W - M * 2, align: 'center', characterSpacing: 2, link: 'https://pasttimeball.com' });

doc.end();
console.log(outPath);
