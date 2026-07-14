import { useEffect } from 'react';
import { useStore } from './store/useStore';
import FilterPanel from './components/FilterPanel';
import MapCanvas from './components/MapCanvas';
import HeatmapControls from './components/HeatmapControls';
import PlaybackBar from './components/PlaybackBar';
import Legend from './components/Legend';
import InsightsPanel from './components/InsightsPanel';

export default function App() {
  const { status, error, init, manifest, playback, setPlaying } = useStore();

  useEffect(() => { init(); }, [init]);

  // keyboard shortcuts: space = play/pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setPlaying(!playback.playing);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback.playing, setPlaying]);

  if (status === 'loading') {
    return <CenterMessage title="Loading telemetry…" sub="Parsing match data and minimaps" />;
  }
  if (status === 'error') {
    return <CenterMessage title="Failed to load data" sub={error ?? 'Unknown error'} danger />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 20, gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0, letterSpacing: 0.3 }}>
            LILA <span style={{ color: 'var(--storm)' }}>Player Journey</span>
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {manifest?.totalMatches} matches · {manifest?.totalPlayers} players · {manifest?.totalRows.toLocaleString()} events
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LILA BLACK · Feb 10–14, 2026</span>
      </header>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <FilterPanel />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, width: '100%', justifyContent: 'center' }}>
            <MapCanvas />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 200 }}>
              <HeatmapControls />
            </div>
          </div>
          <Legend />
          <PlaybackBar />
        </div>

        <InsightsPanel />
      </div>
    </div>
  );
}

function CenterMessage({ title, sub, danger }: { title: string; sub: string; danger?: boolean }) {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: danger ? 'var(--danger)' : 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{sub}</div>
      </div>
    </div>
  );
}
