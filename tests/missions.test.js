import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { moveUnit, updateFog, updateMission, checkOutcome, beginPlayerTurn } from '../src/game/engine.js';

const unit=(id,team,type,x,y,extra={})=>({...UNIT_TYPES[type],id,team,type,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false,...extra});
const state=(mission,units)=>{const s={cols:8,rows:8,terrain:Array.from({length:8},()=>Array(8).fill(0)),units,mission,missionProgress:{captured:[],heldTurns:0},turn:'blue',turnNumber:1,winner:null};updateFog(s);return s;};

test('capture progress is cumulative and actual moves trigger its victory',()=>{
  const s=state({kind:'capture',points:[{x:2,y:1},{x:2,y:2}]},[
    unit(1,'blue','tank',1,1,{move:2}),unit(2,'blue','scout',1,2,{move:2}),unit(3,'red','tank',6,6),
  ]);
  assert.equal(moveUnit(s,1,2,1).ok,true);assert.deepEqual(s.missionProgress.captured,[true,false]);assert.equal(s.winner,null);
  assert.equal(moveUnit(s,2,2,2).ok,true);assert.deepEqual(s.missionProgress.captured,[true,true]);assert.equal(s.winner,'blue');
});

test('escort succeeds only for a living engineer at its point and fails when engineers are lost',()=>{
  const success=state({kind:'escort',point:{x:3,y:3}},[unit(1,'blue','engineer',3,3),unit(2,'red','tank',6,6)]);
  updateMission(success);checkOutcome(success);assert.equal(success.winner,'blue');
  const failure=state({kind:'escort',point:{x:3,y:3}},[unit(1,'blue','engineer',3,3,{hp:0}),unit(2,'blue','tank',2,2),unit(3,'red','tank',6,6)]);
  checkOutcome(failure);assert.equal(failure.winner,'red');
});

test('hold counts consecutive completed enemy turns and resets after an interruption',()=>{
  const s=state({kind:'hold',point:{x:3,y:3},turns:4},[unit(1,'blue','tank',3,3),unit(2,'red','tank',6,6)]);
  updateMission(s,true);updateMission(s,true);assert.equal(s.missionProgress.heldTurns,2);
  s.units[0].x=2;updateMission(s,true);assert.equal(s.missionProgress.heldTurns,0);
  s.units[0].x=3;
  for(let i=0;i<4;i++)updateMission(s,true);
  checkOutcome(s);assert.equal(s.missionProgress.heldTurns,4);assert.equal(s.winner,'blue');
});

test('beginPlayerTurn performs the completed-enemy-turn hold check',()=>{
  const s=state({kind:'hold',point:{x:3,y:3},turns:1},[unit(1,'blue','tank',3,3),unit(2,'red','tank',6,6)]);
  s.turn='red';beginPlayerTurn(s);assert.equal(s.missionProgress.heldTurns,1);assert.equal(s.winner,'blue');
});

test('eliminating every enemy does not bypass an unfinished mission target',()=>{
  const s=state({kind:'capture',points:[{x:3,y:3}]},[unit(1,'blue','tank',2,3),unit(2,'red','tank',6,6,{hp:0})]);
  checkOutcome(s);assert.equal(s.winner,null);
  assert.equal(moveUnit(s,1,3,3).ok,true);assert.equal(s.winner,'blue');
});
