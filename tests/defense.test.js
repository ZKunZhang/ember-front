import test from 'node:test';
import assert from 'node:assert/strict';
import { defenseSummary } from '../src/game/defense.js';

function fixture() {
  const game = {
    mission: { kind: 'defend', turns: 5, points: [{ x: 5, y: 5 }, { x: 5, y: 6 }] },
    missionProgress: { defendedTurns: 2 }, winner: null,
    fog: Array.from({ length: 12 }, () => Array(12).fill(true)),
    units: [
      { id: 1, team: 'blue', hp: 9, x: 4, y: 5 },
      { id: 2, team: 'red', hp: 9, x: 2, y: 5 },
      { id: 3, team: 'red', hp: 9, x: 0, y: 0 },
      { id: 4, team: 'red', hp: 9, x: 5, y: 4 },
      { id: 5, team: 'red', hp: 0, x: 5, y: 5 },
    ],
  };
  for (const { x, y } of [game.units[1], game.units[2], game.units[4], game.mission.points[0]]) game.fog[y][x] = false;
  return game;
}

test('defense summary is absent for other missions', () => {
  assert.equal(defenseSummary({}), null);
  assert.equal(defenseSummary({ mission: { kind: 'hold' } }), null);
});

test('defense intelligence contains only living visible original units and uses hex distance', () => {
  const game = fixture();
  const summary = defenseSummary(game);
  assert.deepEqual(summary.visibleEnemies, [game.units[1], game.units[2]]);
  assert.deepEqual(summary.nearbyEnemies, [game.units[1]]);
  assert.equal(summary.visibleEnemies[0], game.units[1]);
  assert.equal(summary.nearbyEnemies[0], game.units[1]);
  assert.equal(summary.outcome, 'ongoing');
  assert.equal(summary.completed, 2);
  assert.equal(summary.remaining, 3);
  // Axial offsets (+2,+2) span four hexes, rather than two square-grid steps.
  Object.assign(game.units[1], { x: 7, y: 8 });
  game.fog[8][7] = false;
  assert.deepEqual(defenseSummary(game).nearbyEnemies, []);
});

test('adding or relocating hidden enemies never changes visible defense intelligence', () => {
  const game = fixture();
  const before = defenseSummary(game);
  game.units.push({ id: 6, team: 'red', hp: 18, x: 6, y: 5 });
  Object.assign(game.units[3], { x: 9, y: 9 });
  assert.deepEqual(defenseSummary(game), before);
  game.winner = 'red';
  Object.assign(game.units[3], { x: 5, y: 6 });
  const overrun = defenseSummary(game);
  assert.equal(overrun.outcome, 'overrun');
  assert.deepEqual(overrun.visibleEnemies, before.visibleEnemies);
  assert.deepEqual(overrun.nearbyEnemies, before.nearbyEnemies);
});

test('unobserved runway points stay explicitly unknown with no visible enemies', () => {
  const game = fixture();
  game.fog = game.fog.map(row => row.map(() => true));
  const summary = defenseSummary(game);
  assert.deepEqual(summary.unobservedPoints, game.mission.points);
  assert.deepEqual(summary.visibleEnemies, []);
  assert.deepEqual(summary.nearbyEnemies, []);
  game.fog[6][5] = undefined;
  assert.deepEqual(defenseSummary(game).unobservedPoints, game.mission.points);
});

test('defense progress clamps its real count without inventing completed rounds on early victory', () => {
  const game = fixture();
  game.winner = 'blue';
  assert.deepEqual([defenseSummary(game).completed, defenseSummary(game).remaining, defenseSummary(game).outcome], [2, 3, 'eliminated']);
  for (const [turns, expected] of [[-2, 0], [5, 5], [8, 5]]) {
    game.missionProgress.defendedTurns = turns;
    assert.equal(defenseSummary(game).completed, expected);
    assert.equal(defenseSummary(game).remaining, 5 - expected);
    assert.equal(defenseSummary(game).outcome, expected === 5 ? 'held' : 'eliminated');
  }
  delete game.missionProgress;
  assert.equal(defenseSummary(game).completed, 0);
});

test('defense distinguishes ongoing, held, eliminated, overrun and other loss outcomes', () => {
  const game = fixture();
  assert.equal(defenseSummary(game).outcome, 'ongoing');
  game.winner = 'blue';
  assert.equal(defenseSummary(game).outcome, 'eliminated');
  game.missionProgress.defendedTurns = 5;
  assert.equal(defenseSummary(game).outcome, 'held');
  game.winner = 'red';
  assert.equal(defenseSummary(game).outcome, 'lost');
  Object.assign(game.units[3], game.mission.points[1]);
  assert.equal(defenseSummary(game).outcome, 'overrun');
  game.units[0].hp = 0;
  assert.equal(defenseSummary(game).outcome, 'lost', 'allied elimination has priority over runway occupation');
  game.units[0].hp = 9;
  game.units[3].hp = 0;
  assert.equal(defenseSummary(game).outcome, 'lost');
});

test('defense summary does not change game data or progress', () => {
  const game = fixture();
  const before = structuredClone(game);
  defenseSummary(game);
  assert.deepEqual(game, before);
});
