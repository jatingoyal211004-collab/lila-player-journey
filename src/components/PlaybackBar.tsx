import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { timeBounds, formatDuration } from '../lib/filtering';

const SPEEDS = [0.5, 1, 2, 5] as const;

export default function PlaybackBar() {
  const { matches, filters, playback, setPlaying, setSpeed, setCurrentTs } = useStore();
  const bounds = timeBounds(matches, filters);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  // Keep currentTs inside the active bounds whenever the selection changes
  // (new match/day/map filter, or first load) so playback always starts in range.
  useEffect(() => {
    if (!bounds) return;
    if (playback.currentTs < bounds.min || playback.currentTs > bounds.max) {
      setCurrentTs(bounds.min);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds?.min, bounds?.max]);

  useEffect(() => {
    if (!playback.playing || !bounds) return;
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;
      const next = playback.currentTs + dt * playback.speed;
      if (next >= bounds.max) {
        setCurrentTs(bounds.max);
        setPlaying(false);
        return;
      }
      setCurrentTs(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playing, playback.speed, bounds?.max]);

  if (!bounds) return null;

  const cur = playback.currentTs || bounds.min;
  const pct = ((cur - bounds.min) / (bounds.max - bounds.min || 1)) * 100;

  function togglePlay() {
    if (!bounds) return;
    if (!playback.playing && (playback.currentTs <= bounds.min || playback.currentTs >= bounds.max)) {
      setCurrentTs(bounds.min);
    }
    setPlaying(!playback.playing);
  }
  function replay() {
    if (!bounds) return;
    setCurrentTs(bounds.min);
    setPlaying(true);
  }

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <button onClick={togglePlay} className="play-btn" aria-label={playback.playing ? 'Pause' : 'Play'} title="Space">
        {playback.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button onClick={replay} className="icon-btn" aria-label="Replay" title="R">
        <ReplayIcon />
      </button>

      <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 46 }}>
        {formatDuration(cur - bounds.min)}
      </div>

      <input
        type="range" min={0} max={1000} value={pct * 10}
        onChange={(e) => setCurrentTs(bounds.min + (Number(e.target.value) / 1000) * (bounds.max - bounds.min))}
        style={{ flex: 1, accentColor: 'var(--storm)' }}
      />

      <div className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 46 }}>
        {formatDuration(bounds.max - bounds.min)}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`speed-btn ${playback.speed === s ? 'speed-active' : ''}`}>
            {s}x
          </button>
        ))}
      </div>

      <style>{`
        .play-btn { width: 36px; height: 36px; border-radius: 999px; border: none; background: var(--storm);
          color: white; display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
        .icon-btn { width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel-raised);
          color: var(--text-secondary); display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
        .speed-btn { background: var(--panel-raised); border: 1px solid var(--border); color: var(--text-secondary);
          font-size: 11px; padding: 5px 8px; border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font-mono); }
        .speed-active { background: var(--storm-dim); color: white; border-color: var(--storm); }
        input[type=range] { -webkit-appearance: none; height: 4px; background: var(--border); border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%; background: var(--storm); cursor: pointer; box-shadow: 0 0 8px var(--storm-glow); }
      `}</style>
    </div>
  );
}

function PlayIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="6,4 20,12 6,20" /></svg>; }
function PauseIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>; }
function ReplayIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
}
