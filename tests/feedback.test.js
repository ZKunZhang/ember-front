import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, initialGame } from '../src/game/reducer.js';
import { reachable } from '../src/game/engine.js';
import { progressKey, readProgress, recordVictory } from '../src/game/progress.js';
import { readAudioSettings, DEFAULT_AUDIO } from '../src/audio/battleAudio.js';

test('repeated rejected commands notify without consuming actions or undo history', () => {
  const game = initialGame();
  const action = { type: 'CELL', x: 16, y: 3 };
  const moved = gameReducer(game, action);
  const target = reachable(moved, moved.units[0]).values().next().value.at(-1);
  const failed = gameReducer(moved, { type: 'CELL', ...target });
  const repeated = gameReducer(failed, { type: 'CELL', ...target });
  assert.equal(failed.notice.kind, 'warn');
  assert.equal(failed.notice.cue, 'reject');
  assert.match(failed.notice.message, /移动/);
  assert.equal(repeated.notice.id, failed.notice.id + 1);
  assert.deepEqual(repeated.units, moved.units);
  assert.equal(repeated.undoHistory.length, 1);
});

test('undo and turn transitions replace transient feedback and invalidate stale AI', () => {
  const game = initialGame();
  let ended = gameReducer(game, { type: 'END_TURN' });
  assert.equal(ended.notice.cue, 'enemyTurn');
  const undo = gameReducer(ended, { type: 'UNDO' });
  assert.equal(undo.notice.cue, 'undo');
  assert.equal(gameReducer(undo, { type: 'ENEMY_STEP', session: ended.session }), undo);
  while (ended.turn === 'red') ended = gameReducer(ended, { type: 'ENEMY_STEP', session: ended.session });
  assert.equal(ended.notice.cue, 'turn');
  assert.match(ended.notice.message, /第 2 回合/);
});

test('campaign best results are idempotent, independent by difficulty and exclude defeats', () => {
  const game = { ...initialGame(), winner: 'blue', turnNumber: 8 };
  const key = progressKey(game.id, game.difficultyId);
  const first = recordVictory({}, game);
  assert.deepEqual(first[key], { rounds: 8, survivors: 9 });
  assert.equal(recordVictory(first, game), first);
  assert.equal(recordVictory(first, { ...game, turnNumber: 10 }), first);
  assert.equal(recordVictory(first, { ...game, winner: 'red' }), first);
  const faster = recordVictory(first, { ...game, turnNumber: 5 });
  assert.equal(faster[key].rounds, 5);
  assert.equal(first[key].rounds, 8);
  const hard = recordVictory(faster, { ...game, difficultyId: 'hard' });
  assert.equal(Object.keys(hard).length, 2);
});

test('storage validates data and tolerates blocked storage for audio and campaign', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({
      'mountain-pass:simple': { rounds: 4, survivors: 8 },
      'mountain-pass:hard': { rounds: -1, survivors: 9 },
      unknown: { rounds: 1, survivors: 9 }, muted: 'false', volume: 12,
    }) } });
    assert.deepEqual(readProgress(), { 'mountain-pass:simple': { rounds: 4, survivors: 8 } });
    assert.deepEqual(readAudioSettings(), { muted: false, volume: 1 });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.deepEqual(readProgress(), {});
    assert.deepEqual(readAudioSettings(), DEFAULT_AUDIO);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

for (const kind of ['capture', 'breakthrough']) test(`${kind} advancement gives objective feedback without ending the mission early`, () => {
  const game = initialGame();
  const destination = reachable(game, game.units[0]).values().next().value.at(-1);
  game.mission = { kind, points: [destination, { x: 1, y: 1 }], required: 3 };
  const next = gameReducer(game, { type: 'CELL', ...destination });
  assert.equal(next.winner, null);
  assert.equal(next.notice.cue, 'objective');
  assert.match(next.notice.message, kind === 'capture' ? /1 \/ 2/ : /1 \/ 3/);
  assert.equal(next.undoHistory.length, 1);
});

test('holding a point reports progress when actions return to the player', () => {
  const game = initialGame();
  game.mission = { kind: 'hold', point: { x: game.units[0].x, y: game.units[0].y }, turns: 4 };
  game.turn = 'red';
  const next = gameReducer(game, { type: 'ENEMY_STEP', session: game.session });
  assert.equal(next.notice.cue, 'objective');
  assert.match(next.notice.message, /坚守成功 1 \/ 4/);
  assert.equal(next.turn, 'blue');
});
