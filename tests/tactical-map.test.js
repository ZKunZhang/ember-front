import test from 'node:test';
import assert from 'node:assert/strict';
import { createTacticalView, getTacticalMarkers, tacticalCellAt } from '../src/rendering/tactical-map.js';
import { project } from '../src/rendering/projection.js';

const fixture = () => ({
  rows: 4, cols: 4, approach: 'south-west', advance: 'up',
  terrain: [[0, 0, 0, -1], [0, -1, 0, 0], [0, 0, 0, 0], [-1, 0, 0, 0]],
  fog: [[false, false, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]],
  units: [
    { id: 1, team: 'blue', x: 0, y: 2, hp: 5 },
    { id: 2, team: 'red', x: 1, y: 0, hp: 5 },
    { id: 3, team: 'red', x: 2, y: 2, hp: 5 },
    { id: 4, team: 'blue', x: 0, y: 0, hp: 0 },
    { id: 5, team: 'red', x: 0, y: 0, hp: 0 },
  ],
  mission: { kind: 'capture', points: [{ x: 3, y: 3, label: '公开目标' }], point: { x: 0, y: 1 }, exits: [{ x: 2, y: 3 }] },
  missionProgress: { captured: [false] },
});

test('visible enemies disappear immediately when their cell leaves current vision', () => {
  const state = fixture();
  assert.deepEqual(getTacticalMarkers(state).units.map(unit => unit.id), [1, 2]);
  state.fog[0][1] = true;
  assert.deepEqual(getTacticalMarkers(state).units.map(unit => unit.id), [1]);
  state.fog[0][1] = undefined;
  assert.deepEqual(getTacticalMarkers(state).units.map(unit => unit.id), [1]);
});

test('hidden enemy movement and occupation changes never alter public markers', () => {
  const state = fixture(), before = getTacticalMarkers(state);
  state.units[2].x = 3;
  state.units[2].y = 3;
  state.missionProgress.captured[0] = true;
  assert.deepEqual(getTacticalMarkers(state), before);
});

test('dead units are excluded and public mission points remain available in fog', () => {
  const markers = getTacticalMarkers(fixture());
  assert.deepEqual(markers.units, [{ id: 1, team: 'blue', x: 0, y: 2 }, { id: 2, team: 'red', x: 1, y: 0 }]);
  assert.deepEqual(markers.objectives, [{ x: 3, y: 3 }, { x: 0, y: 1 }, { x: 2, y: 3 }]);
});

for (const approach of ['south-west', 'south-east', 'north-west', 'north-east']) {
  for (const advance of ['up', 'right']) test(`${approach}/${advance}: picking follows projection and rejects map holes`, () => {
    const state = { ...fixture(), approach, advance }, view = createTacticalView(state);
    assert.equal(view.rotation, 0);
    assert.equal(view.tilt, 1.35);
    for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
      const p = project(view, x + .5, y + .5);
      assert.deepEqual(tacticalCellAt(state, view, p.x, p.y), state.terrain[y][x] < 0 ? null : { x, y });
    }
    const outside = project(view, -2, -2);
    assert.equal(tacticalCellAt(state, view, outside.x, outside.y), null);
    assert.equal(tacticalCellAt(state, view, NaN, 0), null);
  });
}
