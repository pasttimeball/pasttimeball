#!/usr/bin/env node
// Searches Chronicling America (via the loc.gov API) for a team name and
// prints matching newspaper pages with dates, papers and source links.
//
// Usage:
//   npm run find -- "boston bloomer girls"
//   npm run find -- "salt packers" --state kansas --start 1900 --end 1910
//   npm run find -- "salt packers" --pick 2   (prints clipping front matter for result 2)

const API = 'https://www.loc.gov/collections/chronicling-america/';

function parseArgs(argv) {
  const args = { terms: [], limit: 15 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--state') args.state = argv[++i];
    else if (arg === '--start') args.start = argv[++i];
    else if (arg === '--end') args.end = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--pick') args.pick = Number(argv[++i]);
    else args.terms.push(arg);
  }
  return args;
}

function asYear(value) {
  if (!value) return undefined;
  const match = String(value).match(/\d{4}/);
  return match ? match[0] : undefined;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function titleCase(text) {
  return String(text).replace(/\w+/g, (w) => w[0].toUpperCase() + w.slice(1));
}

const args = parseArgs(process.argv.slice(2));
const phrase = args.terms.join(' ').trim();
if (!phrase) {
  console.error('Usage: npm run find -- "team name" [--state kansas] [--start 1900] [--end 1910] [--limit 15] [--pick N]');
  process.exit(1);
}

const params = new URLSearchParams({
  q: `"${phrase}"`,
  fo: 'json',
  c: String(args.limit),
});
if (args.state) params.set('fa', `location_state:${args.state.toLowerCase()}`);
const start = asYear(args.start);
const end = asYear(args.end);
if (start || end) params.set('dates', `${start ?? '1690'}/${end ?? '1999'}`);

const url = `${API}?${params}`;
console.error(`Searching Chronicling America for "${phrase}"...`);

const response = await fetch(url, { headers: { accept: 'application/json' } });
if (!response.ok) {
  console.error(`The loc.gov API answered ${response.status} ${response.statusText}. Try again in a minute.`);
  process.exit(1);
}
const data = await response.json();
const results = data.results ?? [];
const total = data.pagination?.of ?? results.length;

if (results.length === 0) {
  console.log('No matches. Try fewer words, a wider date range or no state filter.');
  process.exit(0);
}

console.log(`\n${total.toLocaleString()} matching pages. Showing ${results.length}:\n`);

const entries = results.map((r, i) => {
  const rawTitle = first(r.partof_title) ?? first(r.newspaper_title) ?? r.title ?? 'Unknown paper';
  const newspaper = titleCase(String(rawTitle).replace(/\s*\([^)]*\)\s*[\d?]{4}-(?:[\d?]{4}|current)\s*$/i, ''));
  const city = titleCase(first(r.location_city) ?? '');
  const state = titleCase(first(r.location_state) ?? '');
  const place = [city, state].filter(Boolean).join(', ');
  const date = first(r.date) ?? '';
  const year = Number(String(date).slice(0, 4));
  const link = (r.id ?? r.url ?? '').replace(/^http:/, 'https:');
  return { n: i + 1, newspaper, place, date, year, link };
});

for (const e of entries) {
  console.log(`${String(e.n).padStart(2)}. ${e.date}  ${e.newspaper}${e.place ? ` (${e.place})` : ''}`);
  console.log(`    ${e.link}\n`);
}

if (args.pick) {
  const e = entries[args.pick - 1];
  if (!e) {
    console.error(`--pick ${args.pick} is out of range.`);
    process.exit(1);
  }
  console.log('--- front matter for your clipping file ---\n');
  console.log(`---
title: "Your headline here"
team: "${titleCase(phrase)}"
place: "${e.place || 'City, State'}"
year: ${e.year || 'YYYY'}
newspaper: "${e.newspaper}"
source: "${e.link}"
image: "/images/clippings/your-scan.jpg"
alt: "Describe the clipping for screen readers."
tags: ["great-names"]
name_rating: 4
blurb: "A sentence or two of commentary."
---`);
} else {
  console.log('Tip: add --pick N to print ready-to-paste front matter for result N.');
}
