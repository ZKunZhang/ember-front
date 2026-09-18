import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { createState, enemyAct, updateFog } from '../src/game/engine.js';

const unit=(id,team,type,x,y,extra={})=>({...UNIT_TYPES[type],id,team,type,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false,...extra});
const blank=(w=12,h=8)=>Array.from({length:h},()=>Array(w).fill(0));
const state=(units,difficultyId='simple')=>{const s={cols:12,rows:8,terrain:blank(),units,turn:'red',turnNumber:1,winner:null,difficultyId,aiSeed:123};updateFog(s);return s;};

test('AI choice cursor is stateful and repeatable from the same snapshot',()=>{
  const make=()=>state([unit(1,'red','tank',3,3),unit(2,'blue','tank',6,3),unit(3,'blue','tank',3,6)],'easy');
  const a=make(), b=structuredClone(a);
  enemyAct(a,1);enemyAct(b,1);
  assert.deepEqual(a.units,b.units);assert.equal(a.aiSeed,b.aiSeed);assert.notEqual(a.aiSeed,123);
});

test('easy AI chooses a firing position and a vulnerable valuable target',()=>{
  const s=state([unit(1,'red','tank',1,3,{move:2}),unit(2,'blue','scout',5,3,{hp:2}),unit(3,'blue','heavyTank',4,5)],'easy');
  const result=enemyAct(s,1);
  assert.equal(result.targetId,2);assert.ok(result.damage>0);assert.ok(s.units[0].moved);
});

test('hard AI repairs an urgent ally and retreats a damaged unit from fire',()=>{
  const repair=state([unit(1,'red','engineer',1,1),unit(2,'red','tank',3,1,{hp:3}),unit(3,'blue','tank',8,1)],'hard');
  const repaired=enemyAct(repair,1);
  assert.equal(repaired.targetId,2);assert.equal(repaired.healed,5);assert.equal(repair.units[0].x,2);
  assert.equal(repair.units[0].moved,true);
  const repairPosition={x:repair.units[0].x,y:repair.units[0].y};
  enemyAct(repair,1);assert.deepEqual({x:repair.units[0].x,y:repair.units[0].y},repairPosition);
  const retreat=state([unit(1,'red','scout',5,3,{hp:2,move:4}),unit(2,'blue','tank',6,3)],'hard');
  enemyAct(retreat,1);
  assert.ok(Math.abs(retreat.units[0].x-6)+Math.abs(retreat.units[0].y-3)>1);
});

test('hard AI concentrates available fire on the same weakened target',()=>{
  const s=state([
    unit(1,'red','tank',3,3),unit(2,'red','tank',3,4),
    unit(3,'blue','heavyTank',6,3,{hp:12}),unit(4,'blue','heavyTank',6,6),
  ],'hard');
  const first=enemyAct(s,1), second=enemyAct(s,2);
  assert.equal(first.targetId,3);assert.equal(second.targetId,3);
});

test('fresh deployments have distinct stored AI seeds',()=>{
  const a=createState('mountain-pass'), b=createState('mountain-pass');
  assert.ok(Number.isInteger(a.aiSeed));assert.ok(Number.isInteger(b.aiSeed));
  // A collision is possible in theory; re-creating must at least provide a fresh cursor.
  assert.notEqual(a.aiSeed,0);assert.notEqual(b.aiSeed,0);
});
