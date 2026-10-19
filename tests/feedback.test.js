import { sourceToHex } from '../src/game/layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, initialGame } from '../src/game/reducer.js';
import { reachable } from '../src/game/engine.js';
import { progressKey, readProgress, recordVictory } from '../src/game/progress.js';
import { readAudioSettings, DEFAULT_AUDIO } from '../src/audio/battleAudio.js';

test('repeated rejected commands notify without consuming actions or undo history', () => {
  const game = initialGame();
  const action = { type: 'CELL', ...sourceToHex(game, { x: 16, y: 3 }) };
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

// Airport fixtures keep enemy motion deterministic while exercising real reducer turns.
import { UNIT_TYPES as AIRPORT_UNIT_TYPES } from '../src/game/catalog.js';
import { updateFog as updateAirportFog } from '../src/game/engine.js';
import { defenseSummary } from '../src/game/defense.js';

function airportFeedbackGame() {
  const game = initialGame('airfield-defense');
  const unit = (id, team, x, extra = {}) => ({ ...AIRPORT_UNIT_TYPES.tank,
    id, team, type: 'tank', x, y: 0, hp: 18, moved: false, fired: false, ...extra });
  Object.assign(game, {
    cols: 8, rows: 1, terrain: [Array(8).fill(0)],
    mission: { kind: 'defend', turns: 5, points: [{ x: 2, y: 0 }] },
    units: [unit(1, 'blue', 0), unit(2, 'red', 7, { move: 0, range: 0 })], selectedId: 1,
  });
  updateAirportFog(game);
  return game;
}

test('airport deployment asks the player to defend all runway cells for complete enemy rounds', () => {
  const game = initialGame('airfield-defense');
  assert.equal(game.notice.cue, 'deploy');
  assert.match(game.notice.message, /先布防/);
  assert.match(game.notice.message, /6 格跑道/);
  assert.match(game.notice.message, /5 个完整敌方回合/);
  assert.match(game.logs.map(entry => entry.message).join('\n'), /任何敌车进入保护区都会失败/);
  assert.doesNotMatch(game.notice.message, /推进/);
});

test('airport reports only fully completed enemy rounds and gives victory priority on round five', () => {
  let game = airportFeedbackGame();
  game.units.push({ ...game.units[1], id: 3, x: 6 });
  for (let round = 1; round <= 5; round++) {
    const ended = gameReducer(game, { type: 'END_TURN' });
    assert.equal(ended.missionProgress.defendedTurns, round - 1);
    const partial = gameReducer(ended, { type: 'ENEMY_STEP', session: ended.session });
    assert.equal(partial.turn, 'red');
    assert.equal(partial.missionProgress.defendedTurns, round - 1);
    game = gameReducer(partial, { type: 'ENEMY_STEP', session: partial.session });
    assert.equal(game.missionProgress.defendedTurns, round);
    assert.equal(game.turnNumber, round + 1);
    assert.equal(game.notice.cue, 'objective');
    if (round < 5) {
      assert.equal(game.notice.message, `机场守备 ${round} / 5 回合 · 还需守备 ${5 - round} 个敌方回合`);
      assert.equal(game.winner, null);
    }
  }
  assert.equal(game.winner, 'blue');
  assert.match(game.notice.message, /已守住 5 个完整敌方回合/);
  assert.doesNotMatch(game.logs.map(entry => entry.message).join('\n'), /第 6 回合.*恢复/);
  const restored = gameReducer(game, { type: 'UNDO' });
  assert.equal(restored.missionProgress.defendedTurns, 4);
  assert.equal(restored.winner, null);
  assert.equal(restored.turn, 'blue');
  assert.equal(restored.notice.cue, 'undo');
  assert.equal(gameReducer(restored, { type: 'ENEMY_STEP', session: game.session }), restored);
});

test('airport early elimination feedback preserves real progress and undo restores the enemy', () => {
  const game = airportFeedbackGame();
  Object.assign(game.units[1], { x: 1, hp: 1 });
  game.missionProgress.defendedTurns = 2;
  updateAirportFog(game);
  const won = gameReducer(game, { type: 'CELL', x: 1, y: 0 });
  assert.equal(won.winner, 'blue');
  assert.equal(won.missionProgress.defendedTurns, 2);
  assert.equal(defenseSummary(won).outcome, 'eliminated');
  assert.match(won.notice.message, /提前全歼敌军.*2 \/ 5/);
  assert.equal(won.logs[0].message, won.notice.message);
  const restored = gameReducer(won, { type: 'UNDO' });
  assert.equal(restored.winner, null);
  assert.equal(restored.units[1].hp, 1);
  assert.equal(restored.missionProgress.defendedTurns, 2);
});

test('airport breakthrough and allied elimination give distinct defeat feedback without counting an unfinished round', () => {
  for (const cause of ['overrun', 'lost']) {
    const game = airportFeedbackGame();
    game.missionProgress.defendedTurns = 4;
    Object.assign(game.units[1], cause === 'overrun' ? { x: 3, move: 1 } : { x: 1, attack: 99, range: 3 });
    if (cause === 'lost') game.units[0].hp = 1;
    updateAirportFog(game);
    const ended = gameReducer(game, { type: 'END_TURN' });
    const failed = gameReducer(ended, { type: 'ENEMY_STEP', session: ended.session });
    assert.equal(failed.winner, 'red');
    assert.equal(failed.missionProgress.defendedTurns, 4);
    assert.equal(defenseSummary(failed).outcome, cause);
    assert.match(failed.notice.message, cause === 'overrun' ? /跑道保护区.*突破/ : /我方车辆已全部损失/);
    assert.equal(failed.logs[0].message, failed.notice.message);
    assert.doesNotMatch(failed.notice.message, /行动.*恢复/);
  }
});

test('airport automatic turn ending and undo keep the original action and progress rules', () => {
  const game = airportFeedbackGame();
  const moved = gameReducer(game, { type: 'CELL', x: 1, y: 0 });
  assert.equal(moved.turn, 'red');
  assert.equal(moved.units[0].moved, true);
  assert.equal(moved.missionProgress.defendedTurns, 0);
  assert.equal(moved.undoHistory.length, 1);
  const completed = gameReducer(moved, { type: 'ENEMY_STEP', session: moved.session });
  assert.equal(completed.missionProgress.defendedTurns, 1);
  const restored = gameReducer(completed, { type: 'UNDO' });
  assert.equal(restored.missionProgress.defendedTurns, 0);
  assert.equal(restored.units[0].x, 0);
  assert.equal(restored.units[0].moved, false);
  assert.equal(restored.turn, 'blue');
});
