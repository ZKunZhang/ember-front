import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { DIFFICULTIES } from '../src/game/difficulty.js';
import { SCENARIOS } from '../src/game/scenarios.js';
import { createState } from '../src/game/engine.js';

const expected = {
  simple: { count: 0.5, stats: 0.7 },
  easy: { count: 0.75, stats: 0.85 },
  hard: { count: 1, stats: 1 },
};

test('every scenario applies the selected enemy count and combat statistics', () => {
  for (const scenario of SCENARIOS) for (const [difficultyId, multiplier] of Object.entries(expected)) {
    const state = createState(scenario.id, difficultyId);
    const enemies = state.units.filter(unit => unit.team === 'red');
    assert.equal(state.difficultyId, difficultyId);
    assert.equal(state.difficulty, DIFFICULTIES[difficultyId].label);
    assert.equal(state.enemyCount, Math.ceil(scenario.enemyCount * multiplier.count));
    assert.equal(enemies.length, state.enemyCount);
    for (const enemy of enemies) {
      const base = UNIT_TYPES[enemy.type];
      assert.equal(enemy.maxHp, Math.ceil(base.maxHp * multiplier.stats));
      assert.equal(enemy.hp, enemy.maxHp);
      assert.equal(enemy.attack, Math.max(1, Math.round(base.attack * multiplier.stats)));
      assert.equal(enemy.move, state.deployments.find(u=>u.team===enemy.team&&u.x===enemy.x&&u.y===enemy.y)?.move??base.move);
      for(const stat of ['range','minRange','vision']) assert.equal(enemy[stat],base[stat]);
    }
  }
});

test('a new battle defaults to simple difficulty', () => {
  const state = createState('mountain-pass');
  assert.equal(state.difficultyId, 'simple');
  assert.equal(state.difficulty, '简单');
  assert.equal(state.enemyCount, 7);
});

test('hard map expansion preserves allied combat stats and deployment overrides',()=>{
  for(const scenario of SCENARIOS) {
    const easy=createState(scenario.id,'easy').units.filter(u=>u.team==='blue');
    const hard=createState(scenario.id,'hard').units.filter(u=>u.team==='blue');
    assert.equal(hard.length,easy.length);
    for(let i=0;i<hard.length;i++) for(const stat of ['type','maxHp','hp','attack','move','range','minRange','vision','heading','missionRole','initialHpRatio']) assert.deepEqual(hard[i][stat],easy[i][stat],`${scenario.id}: ${stat}`);
  }
});
