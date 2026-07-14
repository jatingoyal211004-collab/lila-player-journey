import type { EventRow, Filters, MatchSummary } from '../types';

/** Matches visible under the current map/day filter (used to populate the match dropdown
 *  and, when matchId === 'All', to scope playback to a coherent set). */
export function visibleMatches(matches: MatchSummary[], filters: Filters): MatchSummary[] {
  return matches.filter((m) => {
    if (filters.map !== 'All' && m.mapId !== filters.map) return false;
    if (filters.day !== 'All' && m.day !== filters.day) return false;
    return true;
  });
}

export function filterRows(rows: EventRow[], filters: Filters, matches: MatchSummary[]): EventRow[] {
  const matchScope = filters.matchId !== 'All'
    ? new Set([filters.matchId])
    : filters.map !== 'All' || filters.day !== 'All'
      ? new Set(visibleMatches(matches, filters).map((m) => m.matchId))
      : null;

  const bounds = timeBounds(matches, filters);

  return rows.filter((r) => {
    if (filters.map !== 'All' && r.mapId !== filters.map) return false;
    if (filters.day !== 'All' && r.day !== filters.day) return false;
    if (matchScope && !matchScope.has(r.matchId)) return false;
    if (filters.playerType === 'Human' && !r.isHuman) return false;
    if (filters.playerType === 'Bot' && r.isHuman) return false;
    if (!filters.eventTypes.has(r.event)) return false;
    if (bounds) {
      const [loPct, hiPct] = filters.timeRangePct;
      const span = bounds.max - bounds.min || 1;
      const lo = bounds.min + (loPct / 100) * span;
      const hi = bounds.min + (hiPct / 100) * span;
      if (r.ts < lo || r.ts > hi) return false;
    }
    return true;
  });
}

/** ts bounds used for the time-range slider and playback scrubber. Scoped to the
 *  single selected match when one is chosen; otherwise spans all visible matches. */
export function timeBounds(matches: MatchSummary[], filters: Filters): { min: number; max: number } | null {
  if (filters.matchId !== 'All') {
    const m = matches.find((x) => x.matchId === filters.matchId);
    return m ? { min: m.startTs, max: m.endTs } : null;
  }
  const scoped = visibleMatches(matches, filters);
  if (scoped.length === 0) return null;
  return {
    min: Math.min(...scoped.map((m) => m.startTs)),
    max: Math.max(...scoped.map((m) => m.endTs)),
  };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
