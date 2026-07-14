import { useMemo } from 'react';
import { useStore, ALL_EVENT_TYPES } from '../store/useStore';
import { visibleMatches, formatDuration } from '../lib/filtering';
import type { EventType, MapId } from '../types';

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown'];
const EVENT_LABELS: Record<EventType, string> = {
  Position: 'Movement (human)', BotPosition: 'Movement (bot)',
  Kill: 'Kill', BotKill: 'Kill (of bot)', Killed: 'Death', BotKilled: 'Death (by bot)',
  KilledByStorm: 'Storm death', Loot: 'Loot',
};

export default function FilterPanel() {
  const { manifest, matches, filters, setFilter, toggleEventType, resetFilters } = useStore();
  const scopedMatches = useMemo(() => visibleMatches(matches, filters), [matches, filters]);

  return (
    <div className="glass" style={{ width: 280, borderRadius: 'var(--radius-lg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: 0.4, margin: 0, color: 'var(--text-primary)' }}>FILTERS</h2>
        <button onClick={resetFilters} className="reset-btn">Reset</button>
      </div>

      <Section label="Map">
        <select value={filters.map} onChange={(e) => setFilter('map', e.target.value as MapId | 'All')} className="select">
          <option value="All">All maps</option>
          {(manifest?.maps ?? MAPS).map((m) => <option key={m} value={m}>{prettyMap(m)}</option>)}
        </select>
      </Section>

      <Section label="Day">
        <select value={filters.day} onChange={(e) => setFilter('day', e.target.value)} className="select">
          <option value="All">All days</option>
          {(manifest?.days ?? []).map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
      </Section>

      <Section label={`Match (${scopedMatches.length})`}>
        <select value={filters.matchId} onChange={(e) => setFilter('matchId', e.target.value)} className="select">
          <option value="All">All matches</option>
          {scopedMatches.map((m) => (
            <option key={m.matchId} value={m.matchId}>
              {m.matchId.slice(0, 8)} · {m.numHumans}H/{m.numBots}B · {formatDuration(m.durationMs)}
            </option>
          ))}
        </select>
      </Section>

      <Section label="Player type">
        <div className="segmented">
          {(['All', 'Human', 'Bot'] as const).map((t) => (
            <button key={t} className={filters.playerType === t ? 'seg-active' : ''} onClick={() => setFilter('playerType', t)}>
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Event types">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALL_EVENT_TYPES.map((e) => (
            <label key={e} className="checkbox-row">
              <input type="checkbox" checked={filters.eventTypes.has(e)} onChange={() => toggleEventType(e)} />
              <span>{EVENT_LABELS[e]}</span>
            </label>
          ))}
        </div>
      </Section>

      <style>{`
        .select {
          width: 100%; background: var(--panel-raised); border: 1px solid var(--border);
          color: var(--text-primary); border-radius: var(--radius-sm); padding: 8px 10px;
          font-size: 13px; font-family: var(--font-body);
        }
        .segmented { display: flex; background: var(--panel-raised); border-radius: var(--radius-sm); border: 1px solid var(--border); overflow: hidden; }
        .segmented button { flex: 1; background: transparent; border: none; color: var(--text-secondary); padding: 7px 0; font-size: 12.5px; cursor: pointer; }
        .segmented button.seg-active { background: var(--storm-dim); color: white; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); cursor: pointer; }
        .checkbox-row input { accent-color: var(--storm); }
        .reset-btn { background: none; border: none; color: var(--storm); font-size: 12px; cursor: pointer; }
        .reset-btn:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>{label}</div>
      {children}
    </div>
  );
}

function prettyMap(m: MapId) {
  return m.replace(/([A-Z])/g, ' $1').trim();
}
