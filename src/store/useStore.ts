import { create } from 'zustand';
import type { EventRow, EventType, Filters, HeatmapMode, MapConfig, MapId, Manifest, MatchSummary, PlaybackState } from '../types';
import { expandDayPayload, loadDay, loadManifest, loadMapConfigs, loadMatches } from '../lib/dataLoader';

const ALL_EVENT_TYPES: EventType[] = ['Position', 'BotPosition', 'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'];

interface Store {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  manifest: Manifest | null;
  mapConfigs: Record<MapId, MapConfig> | null;
  matches: MatchSummary[];
  rows: EventRow[]; // all loaded rows, across all days

  filters: Filters;
  heatmapMode: HeatmapMode;
  playback: PlaybackState;
  hoveredMatchId: string | null;

  init: () => Promise<void>;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleEventType: (e: EventType) => void;
  setHeatmapMode: (m: HeatmapMode) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: PlaybackState['speed']) => void;
  setCurrentTs: (ts: number) => void;
  resetFilters: () => void;
}

const defaultFilters: Filters = {
  map: 'All',
  day: 'All',
  matchId: 'All',
  playerType: 'All',
  eventTypes: new Set(ALL_EVENT_TYPES),
  timeRangePct: [0, 100],
};

export const useStore = create<Store>((set) => ({
  status: 'loading',
  error: null,
  manifest: null,
  mapConfigs: null,
  matches: [],
  rows: [],
  filters: { ...defaultFilters },
  heatmapMode: 'none',
  playback: { playing: false, speed: 1, currentTs: 0 },
  hoveredMatchId: null,

  init: async () => {
    try {
      const [manifest, mapConfigs, matches] = await Promise.all([
        loadManifest(), loadMapConfigs(), loadMatches(),
      ]);
      const dayPayloads = await Promise.all(manifest.days.map(loadDay));
      const rows = dayPayloads.flatMap(expandDayPayload);
      set({ manifest, mapConfigs, matches, rows, status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),

  toggleEventType: (e) => set((s) => {
    const next = new Set(s.filters.eventTypes);
    if (next.has(e)) next.delete(e); else next.add(e);
    return { filters: { ...s.filters, eventTypes: next } };
  }),

  setHeatmapMode: (m) => set({ heatmapMode: m }),
  setPlaying: (p) => set((s) => ({ playback: { ...s.playback, playing: p } })),
  setSpeed: (sp) => set((s) => ({ playback: { ...s.playback, speed: sp } })),
  setCurrentTs: (ts) => set((s) => ({ playback: { ...s.playback, currentTs: ts } })),
  resetFilters: () => set({ filters: { ...defaultFilters, eventTypes: new Set(ALL_EVENT_TYPES) } }),
}));

export { ALL_EVENT_TYPES };
export const getState = useStore.getState;
