# LILA Player Journey Visualization Tool

A browser-based tool for LILA Games' Level Design team to explore player behavior across
LILA BLACK's three maps — movement paths, combat, loot, storm deaths, and heatmaps — filterable
by map, day, match, player type, event type, and time range, with full match playback.

**\*\*Live demo:\*\* https://lila-player-journey-flame.vercel.app**

Tech stack

* **Frontend:** React 19 + TypeScript, Vite, Zustand, raw Canvas 2D for rendering
* **Data prep:** Python (pandas + pyarrow), run once offline
* **Hosting:** Fully static — no backend server. See `ARCHITECTURE.md` for why.

## Project layout

```
scripts/preprocess.py    — parquet → JSON pipeline (re-run if the raw data changes)
public/data/              — generated output of preprocess.py (committed, so `npm install \\\\\\\\\\\\\\\&\\\\\\\\\\\\\\\& npm run dev` works out of the box)
public/data/minimaps/     — the 3 minimap images
src/                       — the React app
ARCHITECTURE.md           — one-page architecture writeup, coordinate mapping, tradeoffs
INSIGHTS.md               — three findings from the data
```

## Setup

Requires Node 20+ and (only if you want to regenerate `public/data/`) Python 3.10+.

```bash
npm install
npm run dev        # http://localhost:5173
```

No environment variables are required — the app reads static JSON from `public/data/`.

### Regenerating the data (optional)

Only needed if the raw `player\\\\\\\\\\\\\\\_data/` parquet files change. Requires the original
`player\\\\\\\\\\\\\\\_data/` folder (with `February\\\\\\\\\\\\\\\_10..14/`, `README.md`, `minimaps/`) placed at the
repo root, next to `scripts/`.

```bash
pip install pyarrow pandas --break-system-packages   # or use a venv
cd scripts \\\\\\\\\\\\\\\&\\\\\\\\\\\\\\\& python3 preprocess.py
```

This regenerates everything under `public/data/`.

## Build \& deploy

```bash
npm run build       # outputs to dist/
npm run preview     # sanity-check the production build locally
```

Since this is a static site, it deploys in one command to any static host:

**Vercel**

```bash
npx vercel --prod
```

**Netlify**

```bash
npx netlify deploy --prod --dir=dist
```

Both `vercel.json` and `netlify.toml` are already in this repo (SPA fallback routing
configured), so either command works with no extra setup once you're logged into your
own account.

## Using the tool

* **Filters** (left panel): map, day, match, human/bot, event type. Combine freely.
* **Heatmap** (right of the map): switch between movement density, kill/death/loot/storm
density, "Cold Zones" (underutilized areas), and path density. Recomputes live as you
filter — e.g. select one match and "Kill zones" to see just that match's fights.
* **Playback** (bottom bar): press Space or the play button to animate the selected
match(es) unfolding over time; scrub the timeline directly; change speed (0.5x–5x).
* **Map canvas**: scroll/pinch to zoom, drag to pan, hover any marker for a tooltip
(player, event, match, timestamp).
* **Insights** (right panel): live-computed stats (top combat zone, safest area, coverage,
etc.) for whatever's currently filtered.

## Known limitations (see ARCHITECTURE.md for the full list)

* No backend — the entire dataset loads client-side (\~6MB JSON), which is fine at this
data volume but wouldn't scale indefinitely as-is.
* Direction arrows and trail-fade on paths (both marked optional in the brief) aren't
implemented.

