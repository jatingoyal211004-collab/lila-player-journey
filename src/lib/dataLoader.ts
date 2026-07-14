import type { DayPayload, EventRow, EventType, MapConfig, MapId, Manifest, MatchSummary } from '../types';

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

export async function loadManifest(): Promise<Manifest> {
  const res = await fetch(`${DATA_BASE}/manifest.json`);
  if (!res.ok) throw new Error(`Failed to load manifest.json (${res.status})`);
  return res.json();
}

export async function loadMapConfigs(): Promise<Record<MapId, MapConfig>> {
  const res = await fetch(`${DATA_BASE}/maps.json`);
  if (!res.ok) throw new Error(`Failed to load maps.json (${res.status})`);
  return res.json();
}

export async function loadMatches(): Promise<MatchSummary[]> {
  const res = await fetch(`${DATA_BASE}/matches.json`);
  if (!res.ok) throw new Error(`Failed to load matches.json (${res.status})`);
  return res.json();
}

export async function loadDay(day: string): Promise<DayPayload> {
  const res = await fetch(`${DATA_BASE}/${day}.json`);
  if (!res.ok) throw new Error(`Failed to load ${day}.json (${res.status})`);
  return res.json();
}

export function minimapUrl(image: string): string {
  return `${DATA_BASE}/minimaps/${image}`;
}

/** Expand a columnar day payload into row objects. Done once per day at load time
 *  (not per-frame) — after this, all filtering operates on plain arrays. */
export function expandDayPayload(payload: DayPayload): EventRow[] {
  const rows: EventRow[] = new Array(payload.n);
  for (let i = 0; i < payload.n; i++) {
    rows[i] = {
      userId: payload.userDict[payload.userIdx[i]],
      matchId: payload.matchDict[payload.matchIdx[i]],
      mapId: payload.mapId[i],
      x: payload.x[i],
      z: payload.z[i],
      y: payload.y[i],
      ts: payload.ts[i],
      event: payload.eventDict[payload.eventIdx[i]] as EventType,
      isHuman: payload.isHuman[i],
      day: payload.day,
    };
  }
  return rows;
}
