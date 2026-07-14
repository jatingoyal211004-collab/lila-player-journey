import type { EventRow, HeatmapMode, MapConfig } from '../types';
import { worldToPixel, MINIMAP_PX } from './mapCoords';

export const GRID_SIZE = 48; // 48x48 cells across the 1024px minimap

export interface GridResult {
  grid: Float32Array; // GRID_SIZE * GRID_SIZE, normalized 0-1
  raw: Float32Array;  // unnormalized counts, for insights (e.g. coverage %)
  max: number;
  cellPx: number;
  meta?: { uniquePlayers: Int32Array; dwellCount: Int32Array };
}

const EVENTS_FOR_MODE: Record<Exclude<HeatmapMode, 'none'>, EventRow['event'][] | 'all-positions'> = {
  movement: 'all-positions',
  path: 'all-positions',
  underutilized: 'all-positions',
  kill: ['Kill', 'BotKill'],
  death: ['Killed', 'BotKilled'],
  loot: ['Loot'],
  storm: ['KilledByStorm'],
};

/** Bins events into a GRID_SIZE x GRID_SIZE density grid over minimap pixel space. */
export function computeGrid(rows: EventRow[], mode: HeatmapMode, cfg: MapConfig): GridResult | null {
  if (mode === 'none') return null;
  const wanted = EVENTS_FOR_MODE[mode];
  const cellPx = MINIMAP_PX / GRID_SIZE;
  const raw = new Float32Array(GRID_SIZE * GRID_SIZE);
  const playerSets: Set<string>[] | null =
    mode === 'underutilized' ? Array.from({ length: GRID_SIZE * GRID_SIZE }, () => new Set<string>()) : null;

  for (const r of rows) {
    if (wanted !== 'all-positions' && !wanted.includes(r.event)) continue;
    if (wanted === 'all-positions' && r.event !== 'Position' && r.event !== 'BotPosition') continue;
    const { px, py } = worldToPixel(r.x, r.z, cfg);
    const cx = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(px / cellPx)));
    const cy = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(py / cellPx)));
    const idx = cy * GRID_SIZE + cx;
    raw[idx] += 1;
    if (playerSets) playerSets[idx].add(r.userId);
  }

  let grid: Float32Array;
  if (mode === 'underutilized') {
    // Engagement score: visits weighted down by unique players (a well-trafficked cell
    // visited by many distinct players is NOT underutilized even if any single count is low).
    grid = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0; i < grid.length; i++) {
      const visits = raw[i];
      const uniq = playerSets![i].size;
      grid[i] = visits === 0 ? 0 : Math.log1p(visits) * Math.log1p(uniq);
    }
  } else if (mode === 'kill' || mode === 'death') {
    grid = kernelSmooth(raw, 1.1);
  } else {
    grid = raw.slice();
  }

  const max = Math.max(...grid, 1e-6);
  const normalized = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) normalized[i] = grid[i] / max;

  return { grid: normalized, raw, max, cellPx };
}

/** Simple separable box-kernel smoothing to turn sparse combat events into readable hotspots. */
function kernelSmooth(src: Float32Array, sigmaCells: number): Float32Array {
  const radius = Math.max(1, Math.round(sigmaCells * 2));
  const out = new Float32Array(src.length);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let sum = 0, weight = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
          const d2 = dx * dx + dy * dy;
          const w = Math.exp(-d2 / (2 * sigmaCells * sigmaCells));
          sum += src[ny * GRID_SIZE + nx] * w;
          weight += w;
        }
      }
      out[y * GRID_SIZE + x] = weight > 0 ? sum / weight : 0;
    }
  }
  return out;
}

/** Blue -> Green -> Yellow -> Orange -> Red gradient, as specified in the brief. */
export function densityColor(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [59, 111, 255],   // blue
    [63, 214, 168],   // green
    [255, 210, 63],   // yellow
    [255, 140, 40],   // orange
    [255, 60, 60],    // red
  ];
  const scaled = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
