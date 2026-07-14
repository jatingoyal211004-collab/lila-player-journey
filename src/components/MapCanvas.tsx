import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { filterRows, timeBounds, visibleMatches } from '../lib/filtering';
import { computeGrid, densityColor, GRID_SIZE } from '../lib/heatmap';
import { worldToPixel, MINIMAP_PX } from '../lib/mapCoords';
import { minimapUrl } from '../lib/dataLoader';
import type { EventRow, EventType, MapId } from '../types';

const EVENT_STYLE: Record<EventType, { color: string; shape: 'dot' | 'diamond' | 'x' | 'star'; r: number }> = {
  Position: { color: 'var(--human)', shape: 'dot', r: 0 },
  BotPosition: { color: 'var(--bot)', shape: 'dot', r: 0 },
  Kill: { color: '#ff5c5c', shape: 'diamond', r: 5 },
  BotKill: { color: '#ff8c50', shape: 'diamond', r: 5 },
  Killed: { color: '#b3283f', shape: 'x', r: 5 },
  BotKilled: { color: '#c65a2f', shape: 'x', r: 5 },
  KilledByStorm: { color: '#a25bff', shape: 'star', r: 6 },
  Loot: { color: '#ffd23f', shape: 'dot', r: 3.5 },
};

const CANVAS_SIZE = 760;

export default function MapCanvas() {
  const { rows, matches, mapConfigs, filters, heatmapMode, playback } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [view, setView] = useState({ scale: 1, ox: 0, oy: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; row: EventRow } | null>(null);

  const activeMap: MapId | null = useMemo(() => {
    if (filters.map !== 'All') return filters.map;
    if (filters.matchId !== 'All') return matches.find((m) => m.matchId === filters.matchId)?.mapId ?? null;
    // default to the map with the most visible matches so the canvas is never empty
    const vis = visibleMatches(matches, filters);
    if (vis.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const m of vis) counts[m.mapId] = (counts[m.mapId] ?? 0) + 1;
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as MapId) ?? null;
  }, [filters, matches]);

  const cfg = activeMap && mapConfigs ? mapConfigs[activeMap] : null;

  const filtered = useMemo(() => {
    if (!activeMap) return [];
    const scoped = filterRows(rows, { ...filters, map: activeMap }, matches);
    return scoped;
  }, [rows, filters, matches, activeMap]);

  const bounds = useMemo(() => timeBounds(matches, { ...filters, map: activeMap ?? filters.map }), [matches, filters, activeMap]);

  // load minimap image whenever active map changes
  useEffect(() => {
    if (!cfg) return;
    setImgLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = minimapUrl(cfg.image);
  }, [cfg]);

  // reset view on map change
  useEffect(() => { setView({ scale: 1, ox: 0, oy: 0 }); }, [activeMap]);

  const heatGrid = useMemo(() => {
    if (heatmapMode === 'none' || !cfg) return null;
    return computeGrid(filtered, heatmapMode, cfg);
  }, [filtered, heatmapMode, cfg]);

  // draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cfg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.save();
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.scale, view.scale);

      const s = CANVAS_SIZE / MINIMAP_PX;
      ctx.scale(s, s);

      if (imgLoaded && imgRef.current) {
        ctx.drawImage(imgRef.current, 0, 0, MINIMAP_PX, MINIMAP_PX);
      } else {
        ctx.fillStyle = '#141826';
        ctx.fillRect(0, 0, MINIMAP_PX, MINIMAP_PX);
      }

      // heatmap overlay
      if (heatGrid) {
        const cell = heatGrid.cellPx;
        for (let gy = 0; gy < GRID_SIZE; gy++) {
          for (let gx = 0; gx < GRID_SIZE; gx++) {
            const v = heatGrid.grid[gy * GRID_SIZE + gx];
            if (v <= 0.02) continue;
            const [r, g, b] = densityColor(v);
            ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.15 + v * 0.55})`;
            ctx.fillRect(gx * cell, gy * cell, cell + 0.5, cell + 0.5);
          }
        }
      }

      // player paths (grouped by userId+matchId). Only apply the playback cutoff once
      // the user has actually pressed play or scrubbed past the start — otherwise
      // (currentTs sitting at bounds.min, the just-loaded default) show full paths.
      const cutoff = playback.playing || (bounds && playback.currentTs > bounds.min) ? playback.currentTs : Infinity;
      const byPlayer = new Map<string, EventRow[]>();
      for (const r of filtered) {
        if (r.event !== 'Position' && r.event !== 'BotPosition') continue;
        const key = r.userId + '::' + r.matchId;
        if (!byPlayer.has(key)) byPlayer.set(key, []);
        byPlayer.get(key)!.push(r);
      }
      ctx.lineWidth = 1.8 / (s * view.scale);
      for (const [, pts] of byPlayer) {
        pts.sort((a, b) => a.ts - b.ts);
        const visible = pts.filter((p) => p.ts <= cutoff);
        if (visible.length < 2) continue;
        const isHuman = visible[0].isHuman;
        ctx.strokeStyle = isHuman ? 'rgba(79,168,255,0.55)' : 'rgba(255,159,64,0.55)';
        ctx.beginPath();
        visible.forEach((p, i) => {
          const { px, py } = worldToPixel(p.x, p.z, cfg);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        // current position marker
        const last = visible[visible.length - 1];
        const { px, py } = worldToPixel(last.x, last.z, cfg);
        ctx.fillStyle = isHuman ? '#4fa8ff' : '#ff9f40';
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // discrete event markers
      for (const r of filtered) {
        if (r.event === 'Position' || r.event === 'BotPosition') continue;
        if (r.ts > cutoff) continue;
        const { px, py } = worldToPixel(r.x, r.z, cfg);
        const style = EVENT_STYLE[r.event];
        drawMarker(ctx, px, py, style);
      }

      ctx.restore();
    };
    draw();
  }, [filtered, cfg, imgLoaded, view, heatGrid, playback.currentTs, playback.playing]);

  function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, style: { color: string; shape: string; r: number }) {
    const color = resolveColor(style.color);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    const r = style.r;
    if (style.shape === 'dot') {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    } else if (style.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (style.shape === 'x') {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
      ctx.stroke();
    } else if (style.shape === 'star') {
      drawStar(ctx, x, y, r);
    }
  }

  function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI / 5) * i * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      const ia = angle + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(ia) * r * 0.45, cy + Math.sin(ia) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  function resolveColor(v: string): string {
    if (v.startsWith('var(')) {
      const name = v.slice(4, -1);
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
    }
    return v;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setView((v) => ({ ...v, scale: Math.min(6, Math.max(1, v.scale + delta * v.scale)) }));
  }
  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
      setView((v) => ({ ...v, ox: dragRef.current!.ox + dx, oy: dragRef.current!.oy + dy }));
      return;
    }
    // hover detection
    if (!cfg) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = (e.clientX - rect.left - view.ox) / view.scale;
    const my = (e.clientY - rect.top - view.oy) / view.scale;
    const wx = mx / (CANVAS_SIZE / MINIMAP_PX), wy = my / (CANVAS_SIZE / MINIMAP_PX);
    let best: EventRow | null = null, bestD = 14;
    for (const r of filtered) {
      const { px, py } = worldToPixel(r.x, r.z, cfg);
      const d = Math.hypot(px - wx, py - wy);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) setHover({ x: e.clientX, y: e.clientY, row: best });
    else setHover(null);
  }
  function onMouseUp() { dragRef.current = null; }

  return (
    <div style={{ position: 'relative', width: CANVAS_SIZE, height: CANVAS_SIZE, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { onMouseUp(); setHover(null); }}
        style={{ display: 'block', cursor: dragRef.current ? 'grabbing' : 'grab', background: '#0d1017' }}
      />
      {!activeMap && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
          No matches for the current filters
        </div>
      )}
      {hover && (
        <div className="glass" style={{
          position: 'fixed', left: hover.x + 14, top: hover.y + 14, padding: '8px 10px',
          borderRadius: 'var(--radius-sm)', fontSize: 12, pointerEvents: 'none', zIndex: 50,
          fontFamily: 'var(--font-mono)', lineHeight: 1.5, minWidth: 160,
        }}>
          <div style={{ color: hover.row.isHuman ? 'var(--human)' : 'var(--bot)', fontWeight: 600 }}>
            {hover.row.isHuman ? 'HUMAN' : 'BOT'} · {hover.row.event}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>player: {hover.row.userId.slice(0, 8)}</div>
          <div style={{ color: 'var(--text-secondary)' }}>match: {hover.row.matchId.slice(0, 8)}</div>
          <div style={{ color: 'var(--text-secondary)' }}>t+{Math.round((hover.row.ts - (bounds?.min ?? 0)) / 1000)}s</div>
        </div>
      )}
    </div>
  );
}
