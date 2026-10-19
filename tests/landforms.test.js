import test from 'node:test';
import assert from 'node:assert/strict';
import { HEX_DIRECTIONS, hexCorners, hexToPlane, roundHex } from '../src/game/hex.js';
import { mountainHeight, mountainMesh, forestHeight, forestMesh, forestTufts } from '../src/rendering/landforms.js';
import { createTerrainRenderer } from '../src/rendering/terrain.js';

const patch = type => Array.from({ length: 7 }, () => Array(7).fill(type));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`);
const area = ([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;

for (const [type, mesh, height] of [[1, mountainMesh, mountainHeight], [2, forestMesh, forestHeight]]) {
  test(`${type === 1 ? 'mountain' : 'forest'} surface meets every neighboring edge without a tile seam`, () => {
    const terrain = patch(type), center = mesh(terrain, 3, 3);
    const corners = hexCorners(3, 3);
    near(center.reduce((sum, face) => sum + area(face), 0), 1);
    for (const [side, [dx, dy]] of HEX_DIRECTIONS.entries()) {
      const other = mesh(terrain, 3 + dx, 3 + dy);
      const a = corners[side], b = corners[(side + 1) % 6];
      const shared = center.flat().filter(point => Math.abs((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])) < 1e-8);
      assert.ok(new Set(shared.map(([x, y]) => `${x},${y}`)).size >= 5, 'edges have several shared samples');
      for (const point of shared) {
        const match = other.flat().find(([x, y]) => Math.abs(x - point[0]) < 1e-8 && Math.abs(y - point[1]) < 1e-8);
        assert.ok(match, 'neighbor must contain each boundary sample');
        near(match[2], point[2]);
        assert.ok(point[2] > 0, 'interior edges remain raised and continuous');
      }
    }
    assert.ok(center.flat().every(point => point[2] >= 0 && point[2] <= (type === 1 ? 58 : 32)));
    assert.equal(height(terrain, -3, -3), 0);
  });

  test(`${type === 1 ? 'mountain' : 'forest'} exposed boundaries return to ground`, () => {
    const terrain = [[type]];
    for (const [i, a] of hexCorners(0, 0).entries()) {
      const b = hexCorners(0, 0)[(i + 1) % 6];
      for (let j = 0; j <= 10; j++) near(height(terrain, a[0] + (b[0] - a[0]) * j / 10, a[1] + (b[1] - a[1]) * j / 10), 0);
    }
    assert.ok(height(terrain, .5, .5) > 0);
  });
}

test('forest texture belongs to forest cells, is deterministic, and follows the shared canopy', () => {
  const terrain = [[2, 2, 0], [2, 1, 4], [3, 0, 2]], before = structuredClone(terrain);
  let count = 0;
  for (let y = 0; y < terrain.length; y++) for (let x = 0; x < terrain[y].length; x++) {
    const tufts = forestTufts(terrain, x, y);
    assert.deepEqual(tufts, forestTufts(structuredClone(terrain), x, y));
    if (terrain[y][x] !== 2) {
      assert.deepEqual(tufts, []);assert.deepEqual(forestMesh(terrain, x, y), []);
      assert.equal(forestHeight(terrain, x + .5, y + .5), 0);
      continue;
    }
    count += tufts.length;
    for (const tuft of tufts) {
      assert.deepEqual(roundHex(tuft.x - .5, tuft.y - .5), { x, y });
      near(tuft.z, forestHeight(terrain, tuft.x, tuft.y));
      assert.ok(tuft.z + tuft.radius * .66 < 32, 'flock stays within low canopy bounds');
      assert.ok(tuft.radius <= 6, 'texture stays within the detail atlas padding');
    }
  }
  assert.ok(count > 30, 'texture covers patches with many small flock details');
  assert.deepEqual(terrain, before, 'rendering must preserve gameplay terrain');
  assert.deepEqual(forestMesh([[0]], 0, 0), []);
  assert.deepEqual(mountainMesh([[2]], 0, 0), []);
});

test('mountain faces paint in projected ground depth for rotated views', () => {
  const state = { terrain: patch(1) };
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const depths = [];
    const painter = {
      ctx: {}, scale: 1,
      p(x, y, z = 0) {
        const point = hexToPlane({ x, y });
        const depth = point.x * Math.cos(angle) + point.y * Math.sin(angle);
        return { x: point.x, y: depth * 28 - z, groundDepth: depth };
      },
      polygon(points) { depths.push(points.reduce((sum, point) => sum + point.groundDepth, 0) / points.length); },
      line() {}, tile() {},
    };
    createTerrainRenderer(painter, state).details(3, 3, false);
    assert.ok(depths.length > 100);
    for (let i = 1; i < depths.length; i++) assert.ok(depths[i] >= depths[i - 1] - 1e-9);
  }
});
