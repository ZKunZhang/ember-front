import { useEffect, useMemo, useRef, useState } from 'react';
import { createTacticalView, drawTacticalMap, tacticalCellAt, TACTICAL_WIDTH, TACTICAL_HEIGHT } from '../rendering/tactical-map.js';

export default function TacticalMap({ game, view, onLocate, mobilePanel, onMobilePanelChange }) {
  const canvasRef = useRef(null);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 760px)').matches);
  useEffect(()=>{if(mobilePanel==='units')setOpen(false);},[mobilePanel]);
  const mapView = useMemo(() => createTacticalView(game), [game]);
  const selected = game.units.find(unit => unit.id === game.selectedId && unit.team === 'blue' && unit.hp > 0);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawTacticalMap(ctx, game, mapView, view);
  }, [game, mapView, view]);
  const locate = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const point = tacticalCellAt(game, mapView,
      (event.clientX - rect.left) * TACTICAL_WIDTH / rect.width,
      (event.clientY - rect.top) * TACTICAL_HEIGHT / rect.height);
    if (point) onLocate(point);
  };
  return <details className="tactical-map" open={open} onToggle={event => {
    const next=event.currentTarget.open;
    setOpen(next);
    if(next&&window.matchMedia('(max-width: 760px)').matches)onMobilePanelChange?.('map');
  }}>
    <summary>战术地图</summary>
    <div className="tactical-map-content">
      <canvas ref={canvasRef} width={TACTICAL_WIDTH} height={TACTICAL_HEIGHT}
        aria-label="战术地图，点击地格定位" onClick={locate}/>
      <button type="button" disabled={!selected} onClick={() => selected && onLocate({ x: selected.x, y: selected.y })}>定位选中单位</button>
    </div>
  </details>;
}
