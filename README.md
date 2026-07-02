# Past Time Ball

A static Astro site that publishes scanned newspaper clippings of old baseball and softball stories, ads and teams, with a special focus on great historical team names.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at localhost:4321 |
| `npm run build` | Build the site to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run caption -- src/content/clippings/some-clipping.md` | Print an Instagram caption for a clipping |
| `npm run find -- "team name"` | Search Chronicling America for a team and print sources |
| `npm run grab -- "<loc.gov page url>"` | Download the full-resolution scan of a newspaper page |

## Adding a new clipping

1. Drop the scan in `public/images/clippings/`.
2. Copy an existing file in `src/content/clippings/`, rename it and fill in the front matter (title, place, year, newspaper, source, image, alt and tags, plus team and blurb when they apply).
3. Run `npm run dev` to check it. Every page updates automatically.

## Structure

- `src/content/clippings/`: one markdown file per clipping, schema enforced with zod in `src/content.config.ts`
- `src/pages/`: home (paginated), decades, places, tags, random, individual clippings, about and the RSS feed
- `scripts/caption.mjs`: Instagram caption generator
- `scripts/find.mjs`: Chronicling America search. Flags: `--state kansas`, `--start 1905`, `--end 1910`, `--limit 15` and `--pick N` to print front matter for result N
- `scripts/grab.mjs`: full-resolution page downloader. Saves master scans into `archive/` (kept out of the deployed site). Crop your clipping from the master and save the crop into `public/images/clippings/`. Flags: `--width 3000` for a smaller image and `--out name.jpg` to pick the filename
- `netlify.toml`: Netlify deploy config (build to `dist/`, Node 20)
