# Architecture

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript, Vite | Fast dev loop, small bundle, no framework overhead for a single-page tool. |
| Rendering | HTML5 Canvas (2D context), hand-rolled | Full control over draw order (image → heatmap → paths → markers) and per-frame performance; avoids the abstraction cost of an SVG/DOM-per-marker approach at ~89k points. |
| State | Zustand | One global store for loaded data + filters + playback, no boilerplate, selective re-renders. |
| Data prep | Python (pandas + pyarrow), offline script | Parquet parsing belongs in Python; output is static JSON the browser can fetch directly. |
| Hosting | Static site (Vercel/Netlify/GitHub Pages) | See "Backend tradeoff" below. |

## Data flow

```
player_data/*.nakama-0 (parquet, 1,243 files)
        │  scripts/preprocess.py
        │  - reads every file with pyarrow
        │  - decodes event bytes → utf-8
        │  - classifies human/bot from user_id shape (UUID vs numeric)
        │  - dictionary-encodes user_id / match_id / event (they repeat heavily)
        ▼
public/data/{Feb_10..14}.json   (compact columnar payload, one per day)
public/data/matches.json        (796-match index: map, day, start/end ts, human/bot counts)
public/data/maps.json           (scale/origin per map, from the README table)
public/data/manifest.json       (global stats + data-quality notes)
        │  fetched by the browser on load (src/lib/dataLoader.ts)
        ▼
src/store/useStore.ts           (expands columnar → row objects once, holds filters/playback)
        │
        ├─ src/lib/filtering.ts   → filtered EventRow[] for current map/day/match/type/event/time filters
        ├─ src/lib/heatmap.ts     → bins filtered rows into a 48×48 density grid per mode
        ├─ src/lib/insights.ts    → derives the Insights Panel metrics from filtered rows
        └─ src/components/MapCanvas.tsx → draws minimap image + heatmap + paths + markers per frame
```

Nothing downstream of `preprocess.py` ever re-touches the parquet files — the browser only
ever sees pre-decoded JSON, which is what keeps filtering/playback fast.

## Coordinate mapping

This is implemented in exactly one place, `src/lib/mapCoords.ts`, and nowhere else computes
pixel positions — every component (paths, event markers, heatmap grid, hover hit-testing)
calls `worldToPixel(x, z, mapConfig)`. Per the README:

```
u = (x - originX) / scale
v = (z - originZ) / scale
px = u * 1024
py = (1 - v) * 1024        // Y flipped: image origin is top-left
```

`scale`/`originX`/`originZ` come from `public/data/maps.json`, which is generated from the
README's table, not hardcoded in component code — swapping in a 4th map only requires adding
a row there. The `y` column (elevation) is intentionally never used for 2D placement, per the
README's note.

## Assumptions and data-quality notes

- **Human/bot classification uses `user_id` shape (UUID vs numeric), not the event name.**
  751 bot rows (out of ~22,900 bot rows) carry non-`Bot`-prefixed event names
  (`Position`/`Loot`/`BotKilled` mixed in) — classifying by event name would have silently
  misfiled some bots as humans. This is flagged in `manifest.json` → `dataQualityNotes` and
  visible to anyone reading the preprocessing output.
- **`match_id` in the raw data still carries a trailing `.nakama-0`** (visible in the README's
  own sample row) — stripped during preprocessing so it's a clean join key.
- **Per-file time span is far shorter than "a match lasts several minutes" (README's
  description).** Across all 796 matches, the `ts` span within a single match file averages
  under 1 second (mean 0.4s, max 0.9s). This doesn't block the tool — playback, the timeline,
  and "average survival time" all faithfully reflect whatever `ts` range the data contains —
  but it means the current dataset behaves like short high-frequency capture windows rather
  than full multi-minute matches. Flagged here rather than "corrected," since silently
  stretching timestamps would misrepresent the source data.
- **February 14 is a partial day** (per the README) — included as-is, not excluded, since a
  Level Designer would want to see partial-day data too, just aware it's incomplete.

## Major tradeoffs

| Decision | Chosen | Alternative considered | Why |
|---|---|---|---|
| Backend | None — static JSON, all filtering client-side | FastAPI + live parquet queries | The dataset is small enough (~89k rows, ~6MB as JSON) to hold entirely in the browser. A live backend adds a server to keep running, an extra deploy target, and CORS/latency for zero real benefit at this data size — Level Designers get instant filtering with no round-trip. Documented here as a deliberate simplification, not an oversight: revisit if the dataset grows past low tens of millions of rows. |
| Rendering | Raw Canvas 2D | react-konva / SVG | At ~89k points across paths + markers, per-DOM-node SVG or Konva's scene graph adds overhead a single `<canvas>` draw call avoids. Costs some ergonomics (manual hit-testing for hover/tooltips) in exchange for predictable frame time. |
| Heatmap smoothing | Simple Gaussian-weighted box kernel over a 48×48 grid | KDE / WebGL density shader | Good enough visual result at this data size, runs in plain JS with no extra dependency, recomputes well under the 500ms target. |
| Match dropdown | Plain `<select>` with all 796 matches | Searchable combobox | Faster to build correctly; a native select handles 796 options fine. Would add a search box if the roster grew into the thousands. |
| Zone labels in Insights Panel | Coarse 8×8 sector grid (A1–H8) overlaid on the 48×48 density grid | Raw pixel coordinates | Sector labels are legible to a Level Designer at a glance; raw coordinates aren't. |

## Not implemented (documented, not silently dropped)

- Direction arrows and trail-fade on paths — called out as optional in the brief; skipped to
  keep the core 8 required features solid rather than spreading effort thin.
- A live FastAPI backend — see tradeoff table above.
