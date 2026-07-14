import { useStore } from '../store/useStore';
import type { HeatmapMode } from '../types';

const MODES: { id: HeatmapMode; label: string; hint: string }[] = [
  { id: 'none', label: 'Off', hint: 'No overlay' },
  { id: 'movement', label: 'Movement', hint: 'Overall traffic density' },
  { id: 'path', label: 'Path density', hint: 'Well-worn travel routes' },
  { id: 'kill', label: 'Kill zones', hint: 'Where kills happen' },
  { id: 'death', label: 'Death zones', hint: 'Where players die' },
  { id: 'loot', label: 'Loot zones', hint: 'Loot pickup density' },
  { id: 'storm', label: 'Storm deaths', hint: 'Caught by the storm' },
  { id: 'underutilized', label: 'Cold zones', hint: 'Low engagement — redesign candidates' },
];

export default function HeatmapControls() {
  const { heatmapMode, setHeatmapMode } = useStore();
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-dim)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
        Heatmap
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setHeatmapMode(m.id)}
            title={m.hint}
            className={`hm-btn ${heatmapMode === m.id ? 'hm-active' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <style>{`
        .hm-btn { background: var(--panel-raised); border: 1px solid var(--border); color: var(--text-secondary);
          font-size: 12px; padding: 8px 6px; border-radius: var(--radius-sm); cursor: pointer; text-align: left; }
        .hm-btn:hover { border-color: var(--storm-dim); }
        .hm-active { background: var(--storm-dim); color: white; border-color: var(--storm); }
      `}</style>
    </div>
  );
}
