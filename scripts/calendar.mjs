#!/usr/bin/env node
// Builds EDITORIAL-CALENDAR.md: the blog queue (from clipping front matter)
// and the Instagram picture (from ig/SCHEDULE.md + ig/<slug>/ export folders).
//
// Usage: npm run calendar

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPPINGS = path.join(ROOT, 'src/content/clippings');
const IG_DIR = path.join(ROOT, 'ig');
const OUT = path.join(ROOT, 'EDITORIAL-CALENDAR.md');

// Front-matter dates arrive as UTC midnight; keep every date in UTC so
// nothing drifts a day in local time.
const now = new Date();
const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// --- read clippings ---
const posts = fs
  .readdirSync(CLIPPINGS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const slug = f.replace(/\.md$/, '');
    const { data } = matter(fs.readFileSync(path.join(CLIPPINGS, f), 'utf8'));
    const posted = data.posted ? new Date(data.posted) : null;
    return { slug, title: data.title, posted, draft: data.draft === true, tags: data.tags ?? [] };
  });

// --- read IG export folders ---
const igFolders = fs.existsSync(IG_DIR)
  ? fs.readdirSync(IG_DIR).filter((f) => fs.statSync(path.join(IG_DIR, f)).isDirectory())
  : [];

// --- parse ig/SCHEDULE.md table rows ---
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const igRows = [];
const schedulePath = path.join(IG_DIR, 'SCHEDULE.md');
if (fs.existsSync(schedulePath)) {
  for (const line of fs.readFileSync(schedulePath, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (!m || /^-+$/.test(m[1].replace(/\s/g, '')) || m[1] === 'Date') continue;
    const posted = /~~/.test(m[1]) || /POSTED/.test(m[2]);
    const dm = m[1].replace(/~~/g, '').match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
    const date = dm ? new Date(Date.UTC(2026, MONTHS[dm[1].slice(0, 3)], Number(dm[2]))) : null;
    igRows.push({ raw: m[1].replace(/~~/g, ''), date, what: m[2], folder: m[3], panels: m[4], posted, isNew: /\bNEW\b/.test(m[2]) });
  }
}
const igScheduledSlugs = new Set(igRows.map((r) => r.folder).filter((f) => f && f !== '-'));
const lastIgDate = igRows.reduce((max, r) => (r.date && r.date > max ? r.date : max), new Date(0));

// --- build the calendar ---
const lines = [];
lines.push('# Past Time Ball editorial calendar');
lines.push('');
lines.push(`_Generated ${fmtDate(new Date())} by \`npm run calendar\`. Do not hand-edit; rerun the command after changing posted dates, ig/SCHEDULE.md or ig/ exports._`);
lines.push('');

// Blog queue
const upcoming = posts.filter((p) => !p.draft && p.posted && p.posted >= today).sort((a, b) => a.posted - b.posted);
lines.push('## Blog queue (site posts go live at 12:00 UTC via the daily rebuild)');
lines.push('');
lines.push('| Goes live | Clipping | IG export | On IG schedule |');
lines.push('|---|---|---|---|');
for (const p of upcoming) {
  const ex = igFolders.includes(p.slug) ? 'ready' : 'needs `npm run ig`';
  const sched = igScheduledSlugs.has(p.slug) ? 'yes' : p.posted > lastIgDate ? 'no (past last planned row)' : 'no';
  lines.push(`| ${fmtDate(p.posted)} | ${p.title} (\`${p.slug}\`) | ${ex} | ${sched} |`);
}
lines.push('');

// Drafts without dates
const undated = posts.filter((p) => p.draft || !p.posted);
if (undated.length) {
  lines.push('## Drafts / undated');
  lines.push('');
  for (const p of undated) lines.push(`- ${p.title} (\`${p.slug}\`)`);
  lines.push('');
}

// Recently live
const recent = posts.filter((p) => !p.draft && p.posted && p.posted < today).sort((a, b) => b.posted - a.posted).slice(0, 5);
lines.push('## Recently live');
lines.push('');
for (const p of recent) lines.push(`- ${fmtDate(p.posted)}: ${p.title} (\`${p.slug}\`)`);
lines.push('');

// Instagram
lines.push('## Instagram (planned rows from ig/SCHEDULE.md)');
lines.push('');
const igUpcoming = igRows.filter((r) => !r.posted && r.date && r.date >= today).sort((a, b) => a.date - b.date);
lines.push('| Date | Post | Export | Business Suite |');
lines.push('|---|---|---|---|');
for (const r of igUpcoming) {
  const ex = r.folder === '-' ? '-' : igFolders.includes(r.folder) ? 'ready' : 'needs `npm run ig`';
  const bs = r.folder === '-' ? 'open slot' : r.isNew ? 'NEEDS SCHEDULING' : r.date && r.date <= new Date(Date.UTC(2026, 6, 30)) ? 'scheduled Jul 2' : 'needs 2nd sitting (~Jul 22+)';
  lines.push(`| ${r.raw} | ${r.what.replace(/\bNEW\b\s*/, '')} | ${ex} | ${bs} |`);
}
lines.push('');

// To-do rollup
lines.push('## To do');
lines.push('');
const needExport = upcoming.filter((p) => !igFolders.includes(p.slug));
if (needExport.length) lines.push(`- Run \`npm run ig\` for: ${needExport.map((p) => `\`${p.slug}\``).join(', ')}`);
const needBS = igUpcoming.filter((r) => r.isNew);
if (needBS.length) lines.push(`- Schedule in Business Suite (marked NEW): ${needBS.map((r) => `\`${r.folder}\``).join(', ')}`);
const unplanned = upcoming.filter((p) => !igScheduledSlugs.has(p.slug));
if (unplanned.length)
  lines.push(`- No IG row yet (add to ig/SCHEDULE.md or skip): ${unplanned.map((p) => `\`${p.slug}\``).join(', ')}`);
lines.push('- Business Suite schedules max 29 days out; plan a sitting roughly every 4 weeks.');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${upcoming.length} queued posts, ${igUpcoming.length} upcoming IG rows.`);
