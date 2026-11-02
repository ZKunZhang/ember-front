import { onMap } from '../game/engine.js';
import { hexCorners } from '../game/hex.js';
import { createView, project, unproject, unprojectPoint } from './projection.js';

export const TACTICAL_WIDTH = 208;
export const TACTICAL_HEIGHT = 128;

// Copy only public marker data; never retain hidden units or occupation state.
export function getTacticalMarkers(state) {
  const units = state.units.filter(unit => unit.hp > 0 && onMap(state, unit.x, unit.y)
    && (unit.team === 'blue' || state.fog?.[unit.y]?.[unit.x] === false))
    .map(({ id, team, x, y }) => ({ id, team, x, y }));
  const points = [...(state.mission?.points ?? []), ...(state.mission?.point ? [state.mission.point] : []), ...(state.mission?.exits ?? [])];
  const seen = new Set();
  const objectives = points.filter(point => {
    const key = `${point.x},${point.y}`;
    if (!onMap(state, point.x, point.y) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ x, y }) => ({ x, y }));
  return { units, objectives };
}

export function tacticalCellAt(state, view, px, py) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const cell = unproject(view, px, py);
  return onMap(state, cell.x, cell.y) ? cell : null;
}

export function createTacticalView(state) {
  const view = createView(state, TACTICAL_WIDTH, TACTICAL_HEIGHT, 1, { x: 0, y: 0 }, { rotation: 0, tilt: 1.35 });
  const corners = [];
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    if (onMap(state, x, y)) corners.push(...hexCorners(x, y).map(([a, b]) => project(view, a, b)));
  }
  if (!corners.length) return view;
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  const fit = Math.min((TACTICAL_WIDTH - 16) / (maxX - minX), (TACTICAL_HEIGHT - 16) / (maxY - minY));
  return { ...view, scale: view.scale * fit, tw: view.tw * fit, th: view.th * fit,
    ox: TACTICAL_WIDTH / 2 + (view.ox - (minX + maxX) / 2) * fit,
    oy: TACTICAL_HEIGHT / 2 + (view.oy - (minY + maxY) / 2) * fit };
}

const TERRAIN_COLORS = ['#68765c', '#58616a', '#385747', '#b09e76', '#345469', '#72684f', '#527c86'];
function traceCell(ctx, view, x, y) {
  hexCorners(x, y).forEach(([a, b], index) => {
    const point = project(view, a, b);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

export function drawTacticalMap(ctx, state, mapView, battlefieldView) {
  ctx.clearRect(0, 0, TACTICAL_WIDTH, TACTICAL_HEIGHT);
  ctx.fillStyle = '#172326';
  ctx.fillRect(0, 0, TACTICAL_WIDTH, TACTICAL_HEIGHT);
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    if (!onMap(state, x, y)) continue;
    ctx.beginPath();
    traceCell(ctx, mapView, x, y);
    ctx.fillStyle = TERRAIN_COLORS[state.terrain[y][x]] ?? TERRAIN_COLORS[0];
    ctx.fill();
    if (state.fog?.[y]?.[x] !== false) {
      ctx.fillStyle = '#0b15294d';
      ctx.fill();
    }
  }
  const { units, objectives } = getTacticalMarkers(state);
  for (const point of objectives) {
    const p = project(mapView, point.x + .5, point.y + .5);
    ctx.strokeStyle = '#ffe3a1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - 2.5, p.y - 2.5, 5, 5);
  }
  for (const unit of units) {
    const p = project(mapView, unit.x + .5, unit.y + .5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, unit.id === state.selectedId ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = unit.team === 'blue' ? '#89d9ff' : '#ff8d80';
    ctx.fill();
    if (unit.id === state.selectedId) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (!battlefieldView?.width || !battlefieldView?.height) return;
  ctx.save();
  ctx.beginPath();
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    if (onMap(state, x, y)) traceCell(ctx, mapView, x, y);
  }
  ctx.clip();
  ctx.beginPath();
  [[0, 0], [battlefieldView.width, 0], [battlefieldView.width, battlefieldView.height], [0, battlefieldView.height]].forEach(([x, y], index) => {
    const world = unprojectPoint(battlefieldView, x, y);
    const point = project(mapView, world.x, world.y);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.strokeStyle = '#ffffffd9';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
