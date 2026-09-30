import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { moveUnit, updateFog, updateMission, checkOutcome, beginPlayerTurn, enemyAct, attackUnit, breakthroughArrivals } from '../src/game/engine.js';

const unit=(id,team,type,x,y,extra={})=>({...UNIT_TYPES[type],id,team,type,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false,...extra});
const state=(mission,units)=>{const s={cols:8,rows:8,terrain:Array.from({length:8},()=>Array(8).fill(0)),units,mission,missionProgress:{captured:[],heldTurns:0},turn:'blue',turnNumber:1,winner:null};updateFog(s);return s;};

test('crossing requires three living arrivals and wins by moving despite surviving enemies',()=>{
  const mission={kind:'breakthrough',required:3,points:[{x:1,y:1},{x:1,y:2},{x:1,y:3},{x:1,y:4}]};
  const s=state(mission,[unit(1,'blue','tank',1,1),unit(2,'blue','tank',1,2),unit(3,'blue','scout',2,3),unit(4,'red','tank',7,7)]);
  checkOutcome(s);assert.equal(s.winner,null);assert.equal(breakthroughArrivals(s).length,2);
  assert.equal(moveUnit(s,3,1,3).ok,true);assert.equal(s.winner,'blue');assert.ok(s.units[3].hp>0);
});

test('crossing does not preserve departed arrivals or allow elimination to bypass the exit',()=>{
  const s=state({kind:'breakthrough',required:3,points:[{x:1,y:1},{x:1,y:2},{x:1,y:3}]},[
    unit(1,'blue','tank',1,1),unit(2,'blue','tank',1,2),unit(3,'blue','scout',3,3),unit(4,'red','tank',7,7,{hp:0}),
  ]);
  moveUnit(s,1,2,1);assert.equal(breakthroughArrivals(s).length,1);assert.equal(s.winner,null);
  s.units[2].hp=0;checkOutcome(s);assert.equal(s.winner,'red');
});

test('crossing victory can be undone and replayed through the reducer',()=>{
  const s=initialGame('silent-transit');
  const [a,b,c]=s.units.filter(u=>u.team==='blue');
  Object.assign(a,{x:3,y:14});Object.assign(b,{x:4,y:14});Object.assign(c,{x:2,y:15});s.selectedId=c.id;
  updateFog(s);
  const won=gameReducer(s,{type:'CELL',x:3,y:15});assert.equal(won.winner,'blue');
  const restored=gameReducer(won,{type:'UNDO'});assert.equal(restored.winner,null);assert.equal(breakthroughArrivals(restored).length,2);
  assert.equal(gameReducer(restored,{type:'CELL',x:3,y:15}).winner,'blue');
});

test('route outposts wait until approached and stay alerted on later turns',()=>{
  for(const mission of [{kind:'breakthrough',required:1,points:[{x:0,y:7}]},{kind:'escort',outposts:true,point:{x:0,y:7}}]){
    const s=state(mission,[unit(1,'blue','engineer',0,0),unit(2,'red','tank',7,7)]);
    s.turn='red';const guard=s.units[1];
    assert.equal(enemyAct(s,2).moved,false);assert.deepEqual([guard.x,guard.y],[7,7]);assert.equal(guard.alerted,false);
    Object.assign(s.units[0],{x:5,y:7});enemyAct(s,2);assert.equal(guard.alerted,true);assert.ok(s.units[0].hp<s.units[0].maxHp);
    beginPlayerTurn(s);assert.equal(guard.alerted,true);
  }
});

test('firing at a distant outpost alerts it before a repair can hide the damage',()=>{
  const s=state({kind:'breakthrough',required:1,points:[{x:0,y:7}]},[
    unit(1,'blue','artillery',1,1),unit(2,'blue','scout',2,1),unit(3,'red','tank',6,1),
  ]);
  assert.equal(attackUnit(s,1,3).ok,true);assert.equal(s.units[2].alerted,true);
  s.units[2].hp=s.units[2].maxHp;s.turn='red';enemyAct(s,3);assert.equal(s.units[2].alerted,true);
});

test('both new escort operations fail immediately on target loss and succeed on arrival',()=>{
  for(const id of ['engineer-relay','valley-lifeline']){
    const s=initialGame(id),engineer=s.units.find(u=>u.team==='blue'&&u.type==='engineer');
    const target=s.mission.point;
    Object.assign(engineer,{x:target.x-1,y:target.y});s.selectedId=engineer.id;updateFog(s);
    const won=gameReducer(s,{type:'CELL',x:target.x,y:target.y});assert.equal(won.winner,'blue');
    assert.ok(won.units.some(u=>u.team==='red'&&u.hp>0));
    const failed=initialGame(id);failed.units.find(u=>u.team==='blue'&&u.type==='engineer').hp=0;
    checkOutcome(failed);assert.equal(failed.winner,'red');
  }
});

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

test('hold wins immediately when all enemies are destroyed, even away from its point',()=>{
  const s=state({kind:'hold',point:{x:3,y:3},turns:4},[unit(1,'blue','tank',1,1),unit(2,'red','tank',6,6,{hp:0})]);
  checkOutcome(s);assert.equal(s.winner,'blue');assert.equal(s.missionProgress.heldTurns,0);
});

test('hold cannot win while enemies survive or when all allied units are lost',()=>{
  const s=state({kind:'hold',point:{x:3,y:3},turns:4},[unit(1,'blue','tank',1,1),unit(2,'red','tank',6,6)]);
  checkOutcome(s);assert.equal(s.winner,null);
  s.units.forEach(u=>u.hp=0);checkOutcome(s);assert.equal(s.winner,'red');
});

test('eliminating enemies still requires a surviving engineer to reach the escort target',()=>{
  const s=state({kind:'escort',point:{x:3,y:3}},[unit(1,'blue','engineer',2,3),unit(2,'red','tank',6,6,{hp:0})]);
  checkOutcome(s);assert.equal(s.winner,null);
  moveUnit(s,1,3,3);assert.equal(s.winner,'blue');
});


test('Ardennes final shot settles immediately and undo restores the unfinished defense',()=>{
  const s=initialGame('ardennes-watch');
  const target=s.units.find(u=>u.team==='red');
  for(const u of s.units.filter(u=>u.team==='red'))u.hp=0;
  Object.assign(target,{x:16,y:3,hp:1});s.fog[3][16]=false;
  const next=gameReducer(s,{type:'CELL',x:16,y:3});
  assert.equal(next.winner,'blue');assert.equal(next.turn,'blue');
  assert.equal(next.missionProgress.heldTurns,0);
  const restored=gameReducer(next,{type:'UNDO'});
  assert.equal(restored.winner,null);
  assert.equal(restored.units.find(u=>u.id===target.id).hp,1);
});
