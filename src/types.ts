export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export type EventType =
  | 'Position' | 'BotPosition'
  | 'Kill' | 'Killed' | 'BotKill' | 'BotKilled'
  | 'KilledByStorm' | 'Loot';

export const COMBAT_EVENTS: EventType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled'];
export const MOVEMENT_EVENTS: EventType[] = ['Position', 'BotPosition'];

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
}

export interface MatchSummary {
  matchId: string;
  mapId: MapId;
  day: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  numHumans: number;
  numBots: number;
}

export interface Manifest {
  days: string[];
  totalRows: number;
  totalMatches: number;
  totalPlayers: number;
  maps: MapId[];
  eventDict: string[];
  dataQualityNotes: string[];
}

/** Raw columnar payload as emitted by scripts/preprocess.py for one day. */
export interface DayPayload {
  day: string;
  userDict: string[];
  matchDict: string[];
  eventDict: string[];
  n: number;
  userIdx: number[];
  matchIdx: number[];
  mapId: MapId[];
  x: number[];
  z: number[];
  y: number[];
  ts: number[];
  eventIdx: number[];
  isHuman: boolean[];
}

/** One decoded telemetry row, expanded from the columnar payload for use in the app. */
export interface EventRow {
  userId: string;
  matchId: string;
  mapId: MapId;
  x: number;
  z: number;
  y: number;
  ts: number;
  event: EventType;
  isHuman: boolean;
  day: string;
}

export interface Filters {
  map: MapId | 'All';
  day: string | 'All';
  matchId: string | 'All';
  playerType: 'All' | 'Human' | 'Bot';
  eventTypes: Set<EventType>;
  timeRangePct: [number, number]; // 0-100, fraction of match/selection duration
}

export type HeatmapMode =
  | 'none' | 'movement' | 'kill' | 'death' | 'loot' | 'storm' | 'underutilized' | 'path';

export interface PlaybackState {
  playing: boolean;
  speed: 0.5 | 1 | 2 | 5;
  currentTs: number;
}
