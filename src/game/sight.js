import { hexDistance } from './hex.js';

// Clip the center-to-center ray against all three pairs of hex sides.
// Boundary contact counts on both sides, so a ray cannot leak along cover edges.
function intersectsHex(from, to, x, y) {
  const q = from.x - x, r = from.y - y;
  const dq = to.x - from.x, dr = to.y - from.y;
  let enter = 0, leave = 1;
  for (const [origin, delta] of [[2*q+r, 2*dq+dr], [q+2*r, dq+2*dr], [q-r, dq-dr]]) {
    if (delta === 0) { if (Math.abs(origin) > 1 + 1e-9) return false; }
    else {
      const a = (-1-origin)/delta, b = (1-origin)/delta;
      enter = Math.max(enter, Math.min(a,b));
      leave = Math.min(leave, Math.max(a,b));
      if (enter > leave + 1e-9) return false;
    }
  }
  return true;
}

export function lineOfSight(state, from, to) {
  if (from.x === to.x && from.y === to.y) return true;
  for (let y = Math.min(from.y,to.y)-1; y <= Math.max(from.y,to.y)+1; y++) {
    for (let x = Math.min(from.x,to.x)-1; x <= Math.max(from.x,to.x)+1; x++) {
      if ((x === from.x && y === from.y) || (x === to.x && y === to.y)) continue;
      const terrain = state.terrain[y]?.[x];
      if ((terrain === undefined || [-1,1,2].includes(terrain)) && intersectsHex(from,to,x,y)) return false;
    }
  }
  return true;
}

export const canSee = (state, observer, target) => hexDistance(observer,target) <= observer.vision && lineOfSight(state,observer,target);
