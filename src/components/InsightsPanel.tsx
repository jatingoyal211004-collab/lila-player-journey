import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { filterRows, visibleMatches, formatDuration } from '../lib/filtering';
import { computeInsights } from '../lib/insights';
import type { MapId } from '../types';

export default function InsightsPanel() {
  const { rows, matches, mapConfigs, filters } = useStore();

  const activeMap: MapId | null = useMemo(() => {
    if (filters.map !== 'All') return filters.map;
    if (filters.matchId !== 'All') return matches.find((m) => m.matchId === filters.matchId)?.mapId ?? null;
    const vis = visibleMatches(matches, filters);
    if (vis.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const m of vis) counts[m.mapId] = (counts[m.mapId] ?? 0) + 1;
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as MapId) ?? null;
  }, [filters, matches]);

  const cfg = activeMap && mapConfigs ? mapConfigs[activeMap] : null;
  const filtered = useMemo(() => activeMap ? filterRows(rows, { ...filters, map: activeMap }, matches) : [], [rows, filters, matches, activeMap]);
  const insights = useMemo(() => computeInsights(filtered, cfg), [filtered, cfg]);
  const scoped = useMemo(() => visibleMatches(matches, filters), [matches, filters]);

  const rows_: { label: string; value: string }[] = [
    { label: 'Matches in view', value: String(scoped.length) },
    { label: 'Events in view', value: filtered.length.toLocaleString() },
    { label: 'Top combat zone', value: insights.topCombatZone ?? '—' },
    { label: 'Safest area', value: insights.safestArea ?? '—' },
    { label: 'Most visited area', value: insights.mostVisitedArea ?? '—' },
    { label: 'Least visited area', value: insights.leastVisitedArea ?? '—' },
    { label: 'Highest loot density', value: insights.highestLootZone ?? '—' },
    { label: 'Bot hotspot', value: insights.botHotspot ?? '—' },
    {
      label: 'Longest route',
      value: insights.longestRoute ? `${Math.round(insights.longestRoute.distance)}m (${insights.longestRoute.userId.slice(0, 6)})` : '—',
    },
    { label: 'Avg. survival time', value: insights.avgSurvivalMs != null ? formatDuration(insights.avgSurvivalMs) : '—' },
    { label: 'Map coverage', value: insights.coveragePct != null ? `${insights.coveragePct.toFixed(0)}%` : '—' },
  ];

  return (
    <div className="glass" style={{ width: 260, borderRadius: 'var(--radius-lg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: 0.4, margin: '0 0 4px 0' }}>INSIGHTS</h2>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
        {filters.map === 'All' && filters.matchId === 'All'
          ? `showing: ${activeMap ?? '—'} (busiest map — pick one to focus)`
          : `showing: ${activeMap ?? '—'}`}
      </div>
      {rows_.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--storm)', fontWeight: 600, textAlign: 'right' }}>{r.value}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Zone labels use an 8×8 sector grid (A1–H8) over the minimap. Recomputes live as filters change.
      </div>
    </div>
  );
}
