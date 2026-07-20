#!/usr/bin/env node
// Builds EDITORIAL-CALENDAR.md (grep-friendly tables) and
// EDITORIAL-CALENDAR.html (visual month grids; open it in a browser)
// from clipping front matter + ig/SCHEDULE.md + ig/<slug>/ export folders.
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

// --- read IG export folders (root = awaiting a sitting, scheduled/ = in Business Suite) ---
const listDirs = (p) =>
  fs.existsSync(p) ? fs.readdirSync(p).filter((f) => fs.statSync(path.join(p, f)).isDirectory()) : [];
const igFolders = [...listDirs(IG_DIR).filter((f) => f !== 'scheduled'), ...listDirs(path.join(IG_DIR, 'scheduled'))];

// --- parse ig/SCHEDULE.md table rows ---
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const igRows = [];
let bsThrough = null; // "Business Suite scheduled through: Aug 3" line in SCHEDULE.md
const schedulePath = path.join(IG_DIR, 'SCHEDULE.md');
if (fs.existsSync(schedulePath)) {
  const bsMatch = fs.readFileSync(schedulePath, 'utf8').match(/scheduled through:\s*([A-Z][a-z]{2})\w*\s+(\d{1,2})/i);
  if (bsMatch) bsThrough = new Date(Date.UTC(2026, MONTHS[bsMatch[1]], Number(bsMatch[2])));
  for (const line of fs.readFileSync(schedulePath, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (!m || /^-+$/.test(m[1].replace(/\s/g, '')) || m[1] === 'Date') continue;
    const posted = /~~/.test(m[1]) || /POSTED/.test(m[2]);
    const dm = m[1].replace(/~~/g, '').match(/([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s*(\d{4}))?/);
    const date = dm ? new Date(Date.UTC(dm[3] ? Number(dm[3]) : 2026, MONTHS[dm[1].slice(0, 3)], Number(dm[2]))) : null;
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
  const bs = r.folder === '-' ? 'open slot' : bsThrough && r.date && r.date <= bsThrough ? 'scheduled' : 'NEEDS NEXT SITTING';
  lines.push(`| ${r.raw} | ${r.what.replace(/\bNEW\b\s*/, '')} | ${ex} | ${bs} |`);
}
lines.push('');

// To-do rollup
lines.push('## To do');
lines.push('');
const needExport = upcoming.filter((p) => !igFolders.includes(p.slug));
if (needExport.length) lines.push(`- Run \`npm run ig\` for: ${needExport.map((p) => `\`${p.slug}\``).join(', ')}`);
const needBS = igUpcoming.filter((r) => r.folder !== '-' && !(bsThrough && r.date && r.date <= bsThrough));
if (needBS.length) lines.push(`- Business Suite next sitting (${needBS.length} rows after ${bsThrough ? fmtDate(bsThrough) : '?'}): ${needBS.map((r) => `\`${r.folder}\``).join(', ')}`);
const unplanned = upcoming.filter((p) => !igScheduledSlugs.has(p.slug));
if (unplanned.length)
  lines.push(`- No IG row yet (add to ig/SCHEDULE.md or skip): ${unplanned.map((p) => `\`${p.slug}\``).join(', ')}`);
lines.push('- Business Suite schedules max 29 days out; plan a sitting roughly every 4 weeks.');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'));

// --- build the visual calendar (EDITORIAL-CALENDAR.html) ---
const HTML_OUT = path.join(ROOT, 'EDITORIAL-CALENDAR.html');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const iso = (d) => d.toISOString().slice(0, 10);

const dated = posts.filter((p) => !p.draft && p.posted).sort((a, b) => a.posted - b.posted);
const postsByDay = new Map();
for (const p of dated) {
  const k = iso(p.posted);
  if (!postsByDay.has(k)) postsByDay.set(k, []);
  postsByDay.get(k).push(p);
}
const slugsByDay = new Map([...postsByDay].map(([k, v]) => [k, new Set(v.map((p) => p.slug))]));
const igOnlyByDay = new Map();
for (const r of igRows) {
  if (!r.date || r.posted || r.folder === '-') continue;
  const k = iso(r.date);
  if (slugsByDay.get(k)?.has(r.folder)) continue;
  if (!igOnlyByDay.has(k)) igOnlyByDay.set(k, []);
  igOnlyByDay.get(k).push(r);
}
const igDateBySlug = new Map();
for (const r of igRows) if (r.date && r.folder !== '-') igDateBySlug.set(r.folder, r.date);

const igStatus = (p) => {
  if (!igFolders.includes(p.slug)) return ['none', 'no IG export yet (npm run ig)'];
  if (!igScheduledSlugs.has(p.slug)) return ['none', 'IG export ready, no SCHEDULE.md row yet'];
  const d = igDateBySlug.get(p.slug);
  if (bsThrough && d && d <= bsThrough) return ['sched', 'IG scheduled in Business Suite'];
  return ['sitting', 'IG export ready, NEEDS a Business Suite sitting'];
};

const TAG_COLORS = {
  stories: '#2d5a3d', ads: '#8a5a2d', cartoons: '#5a2d8a', photos: '#2d5a8a',
  'negro-leagues': '#8a2d5a', women: '#c2452d', 'town-teams': '#4a6d2d',
  'great-names': '#b8860b', 'indoor-base-ball': '#2d8a8a', fans: '#6d4a2d', letters: '#556',
};

const monthName = (y, m) => new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const firstMonth = [today.getUTCFullYear(), today.getUTCMonth()];
const lastPost = dated[dated.length - 1];
const lastMonth = lastPost ? [lastPost.posted.getUTCFullYear(), lastPost.posted.getUTCMonth()] : firstMonth;

const monthBlocks = [];
let openRun = [];
const flushOpenRun = () => {
  if (!openRun.length) return;
  const label = openRun.length === 1 ? openRun[0] : `${openRun[0]} through ${openRun[openRun.length - 1]}`;
  monthBlocks.push(`<div class="openmonths">${esc(label)}: wide open</div>`);
  openRun = [];
};
for (let y = firstMonth[0], m = firstMonth[1]; y < lastMonth[0] || (y === lastMonth[0] && m <= lastMonth[1]); m === 11 ? (y++, (m = 0)) : m++) {
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let hasContent = false;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = iso(new Date(Date.UTC(y, m, d)));
    if (postsByDay.has(k) || igOnlyByDay.has(k)) { hasContent = true; break; }
  }
  const isCurrent = y === today.getUTCFullYear() && m === today.getUTCMonth();
  if (!hasContent && !isCurrent) { openRun.push(monthName(y, m)); continue; }
  flushOpenRun();

  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<div class="day pad"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(y, m, d));
    const k = iso(date);
    const dayPosts = postsByDay.get(k) ?? [];
    const igOnly = igOnlyByDay.get(k) ?? [];
    const classes = ['day'];
    if (k === iso(today)) classes.push('today');
    if (date < today) classes.push('past');
    if (dayPosts.length + igOnly.length >= 2) classes.push('double');
    const bits = [`<div class="num">${d}${dayPosts.length + igOnly.length >= 2 ? '<span class="x2">2 today</span>' : ''}</div>`];
    for (const p of dayPosts) {
      const [ig, igTitle] = igStatus(p);
      const tagChips = p.tags.slice(0, 3).map((t) => `<i style="background:${TAG_COLORS[t] ?? '#777'}" title="${esc(t)}"></i>`).join('');
      bits.push(
        `<a class="card ${date < today ? 'live' : 'queued'}" href="src/content/clippings/${p.slug}.md" title="${esc(p.title)} (${p.slug}) — click to open the .md">` +
          `<span class="dot ${ig}" title="${esc(igTitle)}"></span><span class="t">${esc(p.title)}</span><span class="slug">${esc(p.slug)}</span><span class="chips">${tagChips}</span></a>`
      );
    }
    for (const r of igOnly) bits.push(`<div class="card igonly" title="${esc(r.what)}"><span class="t">IG: ${esc(r.what)}</span></div>`);
    cells.push(`<div class="${classes.join(' ')}">${bits.join('')}</div>`);
  }
  monthBlocks.push(
    `<section><h2>${esc(monthName(y, m))}</h2><div class="grid">` +
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => `<div class="wd">${w}</div>`).join('') +
      cells.join('') +
      `</div></section>`
  );
}
flushOpenRun();

const todoBits = [];
if (needExport.length) todoBits.push(`Run <code>npm run ig</code> for: ${needExport.map((p) => `<code>${esc(p.slug)}</code>`).join(', ')}`);
if (needBS.length) todoBits.push(`Next Business Suite sitting covers <b>${needBS.length}</b> rows (everything after ${bsThrough ? esc(fmtDate(bsThrough)) : '?'}). Max 29 days out, so plan a sitting roughly every 4 weeks.`);
if (unplanned.length) todoBits.push(`No IG row yet: ${unplanned.map((p) => `<code>${esc(p.slug)}</code>`).join(', ')}`);
if (undated.length) todoBits.push(`Undated drafts waiting: ${undated.map((p) => `<code>${esc(p.slug)}</code>`).join(', ')}`);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Past Time Ball editorial calendar</title>
<style>
  :root { --green: #2d5a3d; --paper: #f6f5f1; --ink: #1b1b19; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: var(--paper); color: var(--ink); margin: 0; padding: 24px; }
  header { max-width: 1200px; margin: 0 auto 20px; }
  h1 { font-size: 26px; margin: 0 0 4px; color: var(--green); }
  .gen { color: #666; font-size: 13px; margin-bottom: 14px; }
  .howto { background: #fff; border: 1px solid #ddd; border-left: 4px solid var(--green); padding: 10px 14px; font-size: 14px; max-width: 1200px; margin: 0 auto 10px; }
  .howto code { background: #eee; padding: 1px 4px; font-size: 12.5px; }
  .todo { background: #fff8ea; border: 1px solid #e5d9b8; border-left: 4px solid #b8860b; padding: 10px 14px; font-size: 14px; max-width: 1200px; margin: 0 auto 10px; }
  .todo div { margin: 3px 0; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 13px; color: #444; max-width: 1200px; margin: 0 auto 18px; }
  .legend .dot { position: static; display: inline-block; vertical-align: middle; margin-right: 4px; }
  section { max-width: 1200px; margin: 0 auto 26px; }
  h2 { font-size: 19px; color: var(--green); border-bottom: 2px solid var(--green); padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .wd { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; text-align: center; padding: 2px 0; }
  .day { background: #fff; border: 1px solid #e2e0da; border-radius: 4px; min-height: 64px; padding: 4px; font-size: 12.5px; }
  .day.pad { background: transparent; border: none; }
  .day.past { background: #efeee9; }
  .day.today { border: 2px solid var(--green); box-shadow: 0 0 0 2px #2d5a3d33; }
  .day.double { background: #fdfaf1; }
  .num { font-size: 11px; color: #999; margin-bottom: 2px; display: flex; justify-content: space-between; }
  .x2 { color: #b8860b; font-weight: bold; font-size: 10px; }
  .card { position: relative; display: block; background: #f1f5f2; border: 1px solid #d5ddd7; border-radius: 3px; padding: 3px 5px 3px 14px; margin-bottom: 3px; color: var(--ink); text-decoration: none; line-height: 1.25; }
  .card:hover { border-color: var(--green); background: #e8f0ea; }
  .card.live { opacity: 0.55; }
  .card.igonly { background: #f3eefa; border-color: #ddd0ee; font-style: italic; color: #555; }
  .card .t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dot { position: absolute; left: 4px; top: 7px; width: 7px; height: 7px; border-radius: 50%; }
  .dot.sched { background: #2d8a3d; }
  .dot.sitting { background: #e08a00; }
  .dot.none { background: #bbb; }
  .card .slug { display: block; font-family: Consolas, monospace; font-size: 10px; color: #7a8a7e; margin-top: 1px; word-break: break-all; }
  .chips { display: block; margin-top: 2px; }
  .chips i { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 3px; }
  .openmonths { max-width: 1200px; margin: 0 auto 26px; padding: 10px 14px; background: #fff; border: 1px dashed #bbb; border-radius: 4px; color: #666; font-size: 14px; font-style: italic; }
  @media (max-width: 760px) { .grid { grid-template-columns: repeat(1, 1fr); } .wd { display: none; } .day.pad { display: none; } .day { min-height: 0; } .day:not(:has(.card)) { display: none; } }
</style></head><body>
<header>
  <h1>Past Time Ball editorial calendar</h1>
  <div class="gen">Generated ${esc(fmtDate(new Date()))} · ${upcoming.length} posts queued · site posts go live 12:00 UTC · regenerate with <code>npm run calendar</code></div>
</header>
<div class="howto"><b>To move a post:</b> click its card to open the .md, change the <code>posted:</code> date (YYYY-MM-DD), save, then run <code>npm run calendar</code> and refresh this page. Doubles are fine (gold tint = 2 that day). The dot on each card is its Instagram status.</div>
${todoBits.length ? `<div class="todo"><b>To do</b>${todoBits.map((t) => `<div>${t}</div>`).join('')}</div>` : ''}
<div class="legend">
  <span><span class="dot sched"></span>IG scheduled</span>
  <span><span class="dot sitting"></span>IG needs next sitting</span>
  <span><span class="dot none"></span>no IG row/export</span>
  <span style="opacity:.55">faded = already live</span>
  <span style="font-style:italic;color:#555">italic purple = IG-only row</span>
  <span>${Object.entries(TAG_COLORS).slice(0, 6).map(([t, c]) => `<i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:${c};margin:0 3px 0 8px"></i>${t}`).join('')}</span>
</div>
${monthBlocks.join('\n')}
</body></html>`;
fs.writeFileSync(HTML_OUT, html);

console.log(`Wrote ${path.relative(ROOT, OUT)}: ${upcoming.length} queued posts, ${igUpcoming.length} upcoming IG rows.`);
console.log(`Wrote ${path.relative(ROOT, HTML_OUT)} — open it in a browser for the month-grid view.`);
