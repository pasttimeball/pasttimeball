#!/usr/bin/env node
// Prints a ready-to-paste Instagram caption for a clipping.
// Usage: npm run caption -- src/content/clippings/some-clipping.md

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

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

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: npm run caption -- path/to/clipping.md');
  process.exit(1);
}

const filePath = path.resolve(fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const { data } = matter(fs.readFileSync(filePath, 'utf8'));
const missing = ['title', 'place', 'year', 'newspaper', 'source'].filter(
  (key) => data[key] === undefined
);
if (missing.length > 0) {
  console.error(`Front matter is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const tagHashtags = (data.tags ?? [])
  .map((tag) => HASHTAGS_BY_TAG[tag])
  .filter(Boolean);
const hashtags = [...new Set([...tagHashtags, ...FALLBACK_HASHTAGS])].slice(0, 3);

const sourceCredit = /^https?:\/\//.test(data.source)
  ? `Source: ${data.newspaper}, ${data.year}, via ${new URL(data.source).hostname}`
  : `Source: ${data.source}`;

const caption = [
  data.title,
  '',
  data.team ? `The ${data.team}. ${data.place}, ${data.year}.` : `${data.place}, ${data.year}.`,
  '',
  sourceCredit,
  '',
  hashtags.join(' '),
].join('\n');

console.log(caption);
