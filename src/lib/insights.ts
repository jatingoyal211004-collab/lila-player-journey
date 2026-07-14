import type { EventRow, MapConfig } from '../types';
import { computeGrid, GRID_SIZE } from './heatmap';

export interface Insights {
  topCombatZone: string | null;
  safestArea: string | null;
  mostVisitedArea: string | null;
  leastVisitedArea: string | null;
  longestRoute: { userId: string; matchId: string; distance: number } | null;
  highestLootZone: string | null;
  botHotspot: string | null;
  avgSurvivalMs: number | null;
  coveragePct: number | null;
}

function cellLabel(idx: number): string {
  const x = idx % GRID_SIZE, y = Math.floor(idx / GRID_SIZE);
  const col = String.fromCharCode(65 + Math.floor((x / GRID_SIZE) * 8));
  const row = Math.floor((y / GRID_SIZE) * 8) + 1;
  return `${col}${row}`; // e.g. "C4" — coarse 8x8 sector label over the 48x48 grid
}

function argmax(arr: Float32Array, mask?: (i: number) => boolean): number {
  let best = -1, bestVal = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (mask && !mask(i)) continue;
    if (arr[i] > bestVal) { bestVal = arr[i]; best = i; }
  }
  return best;
}

function argminNonZeroRegion(arr: Float32Array): number {
  // "safest" = lowest combat density among cells that have movement traffic (excludes
  // cells nobody ever visits, which aren't "safe", just empty).
  let best = -1, bestVal = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < bestVal) { bestVal = arr[i]; best = i; }
  }
  return best;
}

export function computeInsights(rows: EventRow[], cfg: MapConfig | null): Insights {
  if (!cfg || rows.length === 0) {
    return {
      topCombatZone: null, safestArea: null, mostVisitedArea: null, leastVisitedArea: null,
      longestRoute: null, highestLootZone: null, botHotspot: null, avgSurvivalMs: null, coveragePct: null,
    };
  }

  const killGrid = computeGrid(rows, 'kill', cfg);
  const movementGrid = computeGrid(rows, 'movement', cfg);
  const lootGrid = computeGrid(rows, 'loot', cfg);

  const topCombatIdx = killGrid ? argmax(killGrid.raw) : -1;
  const mostVisitedIdx = movementGrid ? argmax(movementGrid.raw) : -1;
  const leastVisitedIdx = movementGrid ? argminNonZeroPositive(movementGrid.raw) : -1;
  const safestIdx = killGrid ? argminNonZeroRegion(killGrid.raw) : -1;
  const lootIdx = lootGrid ? argmax(lootGrid.raw) : -1;

  // bot hotspot: densest cell of bot-only movement
  const botRows = rows.filter((r) => !r.isHuman && (r.event === 'BotPosition' || r.event === 'Position'));
  const botGrid = botRows.length ? computeGrid(botRows, 'movement', cfg) : null;
  const botIdx = botGrid ? argmax(botGrid.raw) : -1;

  // longest route: sum of segment distances per (userId, matchId), Position/BotPosition only
  const byPlayer = new Map<string, EventRow[]>();
  for (const r of rows) {
    if (r.event !== 'Position' && r.event !== 'BotPosition') continue;
    const key = `${r.userId}::${r.matchId}`;
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(r);
  }
  let longest: Insights['longestRoute'] = null;
  for (const [key, pts] of byPlayer) {
    pts.sort((a, b) => a.ts - b.ts);
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z;
      dist += Math.hypot(dx, dz);
    }
    if (!longest || dist > longest.distance) {
      const [userId, matchId] = key.split('::');
      longest = { userId, matchId, distance: dist };
    }
  }

  // average survival time: per (userId, matchId), time from first to last event
  // for players whose journey ends in a death event.
  const deathEvents = new Set(['Killed', 'BotKilled', 'KilledByStorm']);
  const survivals: number[] = [];
  const byPlayerAll = new Map<string, EventRow[]>();
  for (const r of rows) {
    const key = `${r.userId}::${r.matchId}`;
    if (!byPlayerAll.has(key)) byPlayerAll.set(key, []);
    byPlayerAll.get(key)!.push(r);
  }
  for (const [, pts] of byPlayerAll) {
    pts.sort((a, b) => a.ts - b.ts);
    const died = pts.some((p) => deathEvents.has(p.event));
    if (died && pts.length > 1) {
      survivals.push(pts[pts.length - 1].ts - pts[0].ts);
    }
  }
  const avgSurvivalMs = survivals.length ? survivals.reduce((a, b) => a + b, 0) / survivals.length : null;

  const visitedCells = movementGrid ? movementGrid.raw.filter((v) => v > 0).length : 0;
  const coveragePct = movementGrid ? (visitedCells / (GRID_SIZE * GRID_SIZE)) * 100 : null;

  return {
    topCombatZone: topCombatIdx >= 0 && killGrid && killGrid.raw[topCombatIdx] > 0 ? cellLabel(topCombatIdx) : null,
    safestArea: safestIdx >= 0 ? cellLabel(safestIdx) : null,
    mostVisitedArea: mostVisitedIdx >= 0 && movementGrid && movementGrid.raw[mostVisitedIdx] > 0 ? cellLabel(mostVisitedIdx) : null,
    leastVisitedArea: leastVisitedIdx >= 0 ? cellLabel(leastVisitedIdx) : null,
    longestRoute: longest,
    highestLootZone: lootIdx >= 0 && lootGrid && lootGrid.raw[lootIdx] > 0 ? cellLabel(lootIdx) : null,
    botHotspot: botIdx >= 0 && botGrid && botGrid.raw[botIdx] > 0 ? cellLabel(botIdx) : null,
    avgSurvivalMs,
    coveragePct,
  };
}

function argminNonZeroPositive(arr: Float32Array): number {
  let best = -1, bestVal = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > 0 && arr[i] < bestVal) { bestVal = arr[i]; best = i; }
  }
  return best;
}
