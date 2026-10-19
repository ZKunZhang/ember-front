import { HEX_DIRECTIONS, hexCorners, roundHex } from '../game/hex.js';
import { worldToGround, groundToWorld } from './projection.js';

// Terrain rows are immutable game-state data. Camera/fog changes reuse geometry.
const geometryCache = new WeakMap();
function cached(terrain, key, build) {
  if (!geometryCache.has(terrain)) geometryCache.set(terrain, new Map());
  const cache = geometryCache.get(terrain);
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
const coordinate = value => Math.round(value * 1e10) / 1e10;

const cellAt = (terrain, x, y) => {
  const cell = roundHex(x - .5, y - .5);
  return terrain[cell.y]?.[cell.x];
};

// Distance to the outside of a terrain patch, rather than to individual cell
// centers. Every surface samples this same field, including shared edge points.
function inlandDistance(terrain, x, y, type) {
  if (cellAt(terrain, x, y) !== type) return 0;
  const cell = roundHex(x - .5, y - .5), point = worldToGround({ x, y });
  let distance = 3;
  for (let b = cell.y - 3; b <= cell.y + 3; b++) for (let a = cell.x - 3; a <= cell.x + 3; a++) {
    if (terrain[b]?.[a] !== type) continue;
    const corners = hexCorners(a, b);
    for (const [i, [dx, dy]] of HEX_DIRECTIONS.entries()) {
      if (terrain[b + dy]?.[a + dx] === type) continue;
      const start = worldToGround({ x: corners[i][0], y: corners[i][1] });
      const end = worldToGround({ x: corners[(i + 1) % 6][0], y: corners[(i + 1) % 6][1] });
      const ex = end.x - start.x, ey = end.y - start.y;
      const t = Math.max(0, Math.min(1, ((point.x - start.x) * ex + (point.y - start.y) * ey) / (ex * ex + ey * ey)));
      distance = Math.min(distance, Math.hypot(point.x - start.x - t * ex, point.y - start.y - t * ey));
    }
  }
  return distance < 1e-8 ? 0 : distance;
}

export function mountainHeight(terrain, x, y) {
  x = coordinate(x); y = coordinate(y);
  return cached(terrain, `mountain-height:${x},${y}`, () => {
    const inland = inlandDistance(terrain, x, y, 1);
    const ridge = 37 + 8 * Math.sin(x * .95 + y * .35) + 6 * Math.cos(y * .78 - x * .23);
    const rock = 1.5 * Math.sin(x * 8.1 + y * 3.7) * Math.sin(y * 6.3 - x * 2.8);
    return Math.max(0, Math.min(58, (ridge + rock) * Math.pow(inland, .65)));
  });
}

export function forestHeight(terrain, x, y) {
  x = coordinate(x); y = coordinate(y);
  return cached(terrain, `forest-height:${x},${y}`, () => {
    const inland = inlandDistance(terrain, x, y, 2);
    const canopy = 18 + 3.5 * Math.sin(x * 5.3 + y * 2.1) + 2.5 * Math.cos(y * 7.2 - x * 1.7);
    return canopy * (1 - Math.exp(-inland * 9));
  });
}

// Fine triangles approximate a continuous surface; no tile-sized peak fans.
// Rational coordinates are rounded before sampling so both owners of an edge
// use identical vertices, even when their interpolation order is reversed.
function surfaceMesh(terrain, x, y, type, height, divisions) {
  if (terrain[y]?.[x] !== type) return [];
  const corners = hexCorners(x, y), facets = [], samples = new Map();
  const vertex = (a, b) => {
    a = coordinate(a); b = coordinate(b);
    const key = `${a},${b}`;
    if (!samples.has(key)) samples.set(key, [a, b, height(terrain, a, b)]);
    return samples.get(key);
  };
  for (let side = 0; side < 6; side++) {
    const a = corners[side], b = corners[(side + 1) % 6];
    const at = (i, j) => vertex(x + .5 + (a[0] - x - .5) * i / divisions + (b[0] - x - .5) * j / divisions,
      y + .5 + (a[1] - y - .5) * i / divisions + (b[1] - y - .5) * j / divisions);
    for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions - i; j++) {
      facets.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
      if (i + j < divisions - 1) facets.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
    }
  }
  return facets;
}

export const mountainMesh = (terrain, x, y, interactive=false) => cached(terrain, `mountain:${x},${y}:${interactive}`, () => surfaceMesh(terrain, x, y, 1, mountainHeight, interactive?2:5));
export const forestMesh = (terrain, x, y, interactive=false) => cached(terrain, `forest:${x},${y}:${interactive}`, () => surfaceMesh(terrain, x, y, 2, forestHeight, interactive?2:4));

const noise = (x, y, seed) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

// A jittered world-space distribution creates flocking texture across the whole
// forest. These are low canopy patches, with no separate trunks or tree icons.
export const forestTufts = (terrain, x, y) => cached(terrain, `tufts:${x},${y}`, () => buildForestTufts(terrain, x, y));

function buildForestTufts(terrain, x, y) {
  if (terrain[y]?.[x] !== 2) return [];
  const corners = hexCorners(x, y).map(([x, y]) => worldToGround({ x, y }));
  const spacing = .21, tufts = [];
  const minX = Math.floor(Math.min(...corners.map(p => p.x)) / spacing) - 1;
  const maxX = Math.ceil(Math.max(...corners.map(p => p.x)) / spacing) + 1;
  const minY = Math.floor(Math.min(...corners.map(p => p.y)) / spacing) - 1;
  const maxY = Math.ceil(Math.max(...corners.map(p => p.y)) / spacing) + 1;
  for (let a = minX; a <= maxX; a++) for (let b = minY; b <= maxY; b++) {
    const point = groundToWorld({ x: (a + .15 + noise(a, b, 1) * .7) * spacing, y: (b + .15 + noise(a, b, 2) * .7) * spacing });
    const cell = roundHex(point.x - .5, point.y - .5);
    if (cell.x !== x || cell.y !== y || noise(a, b, 3) < .12) continue;
    const height = forestHeight(terrain, point.x, point.y);
    if (height < 1) continue;
    tufts.push({ x: point.x, y: point.y, z: height, radius: 3 + noise(a, b, 4) * 3, tone: noise(a, b, 5) });
  }
  return tufts;
}
