import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { createState, updateFog, updateMission, checkOutcome, beginPlayerTurn, moveUnit, attackUnit, enemyAct } from '../src/game/engine.js';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { isOperationMission, getOperationStatus, operationArrivals } from '../src/game/operations.js';

const unit=(id,team,x,y,extra={})=>({...UNIT_TYPES.tank,type:'tank',id,team,x,y,hp:UNIT_TYPES.tank.maxHp,moved:false,fired:false,...extra});
const missions={
  rearguard:{kind:'rearguard',points:[{x:7,y:1},{x:7,y:2},{x:7,y:3}],exits:[{x:0,y:1},{x:0,y:2},{x:0,y:3}],turns:3,required:3,deadline:7},
  relief:{kind:'relief',point:{x:4,y:4},turns:2,deadline:6},
  raid:{kind:'raid',exits:[{x:0,y:1},{x:0,y:2}],targetCount:2,required:2,deadline:7},
  control:{kind:'control',points:[{x:3,y:3},{x:4,y:3}],turns:2,deadline:7},
};
function state(kind,units) {
  const s={cols:9,rows:9,terrain:Array.from({length:9},()=>Array(9).fill(0)),units,mission:structuredClone(missions[kind]),missionProgress:{captured:[],heldTurns:0,defendedTurns:0},turn:'blue',turnNumber:1,winner:null};
  updateFog(s);updateMission(s);return s;
}
const rear=()=>state('rearguard',[unit(1,'blue',1,1),unit(2,'blue',1,2),unit(3,'blue',1,3)]);
const relief=()=>state('relief',[unit(1,'blue',2,4),unit(2,'blue',4,4,{missionRole:'garrison'}),unit(3,'blue',5,4,{missionRole:'garrison'})]);
const raid=()=>state('raid',[unit(1,'blue',1,1),unit(2,'blue',1,2),unit(3,'blue',2,2),unit(4,'red',3,1,{missionRole:'battery',hp:1,move:0}),unit(5,'red',3,2,{missionRole:'battery',hp:1,move:0})]);
const round=s=>{s.turn='red';beginPlayerTurn(s);};
const enter=(s,id,x,y)=>{s.turn='blue';s.units.find(u=>u.id===id).moved=false;return moveUnit(s,id,x,y);};

test('operation status is pure, complete and recognizes only new kinds',()=>{
  assert.equal(isOperationMission({kind:'hold'}),false);assert.equal(getOperationStatus({}),null);
  for (const kind of Object.keys(missions)) assert.equal(isOperationMission(missions[kind]),true);
  const s=rear(),before=structuredClone(s),status=getOperationStatus(s);
  assert.deepEqual(s,before);
  assert.deepEqual(Object.keys(status),['kind','phase','elapsed','deadline','turnsLeft','held','holdRequired','arrivals','required','linked','garrisonAlive','garrisonTotal','targetsDestroyed','targetsTotal','occupiedPoints','totalPoints','outcomeReason']);
  for (const [key,value] of Object.entries(status)) if (!['kind','phase','outcomeReason'].includes(key)) assert.equal(typeof value,'number',key);
});

test('rearguard counts complete rounds despite no red units and opens without granting parked exits',()=>{
  const s=rear();Object.assign(s.units[0],{x:0,y:1});checkOutcome(s);
  for (let i=0;i<3;i++) { checkOutcome(s);updateMission(s);assert.equal(getOperationStatus(s).elapsed,i);round(s); }
  assert.equal(s.winner,null);assert.equal(getOperationStatus(s).phase,'withdraw');assert.equal(getOperationStatus(s).arrivals,0);
  enter(s,1,1,1);enter(s,1,0,1);assert.deepEqual(operationArrivals(s),[s.units[0]]);
  enter(s,2,0,2);assert.equal(s.winner,null);enter(s,3,0,3);assert.equal(s.winner,'blue');
});

test('rearguard fails immediately on a mid-route enemy breakthrough and insufficient survivors',()=>{
  const s=rear();s.mission.points=[{x:5,y:5},{x:7,y:2},{x:7,y:3}];
  s.units.push(unit(4,'red',3,5,{move:5}));s.turn='red';const result=enemyAct(s,4);
  assert.equal(s.winner,'red');assert.equal(getOperationStatus(s).outcomeReason,'通道突破');
  assert.deepEqual(result.path.at(-1),{x:5,y:5});
  const lost=rear();lost.units[0].hp=0;checkOutcome(lost);assert.equal(getOperationStatus(lost).outcomeReason,'兵力不足');
});

test('relief only links from a non-garrison hex neighbor and preserves that link',()=>{
  const s=relief();round(s);assert.equal(getOperationStatus(s).held,0);assert.equal(getOperationStatus(s).linked,0);
  enter(s,1,3,4);assert.equal(getOperationStatus(s).phase,'secure');assert.equal(getOperationStatus(s).linked,1);
  enter(s,1,1,4);assert.equal(getOperationStatus(s).linked,1);
  round(s);assert.equal(getOperationStatus(s).held,1);assert.equal(s.winner,null);
  round(s);assert.equal(s.winner,'blue');assert.equal(getOperationStatus(s).garrisonAlive,2);
});

test('relief requires living original garrison and fails even with linked reinforcements occupying',()=>{
  const s=relief();enter(s,1,3,4);round(s);
  s.units[1].hp=0;s.units[2].hp=0;Object.assign(s.units[0],s.mission.point);checkOutcome(s);
  assert.equal(s.winner,'red');assert.equal(getOperationStatus(s).outcomeReason,'守军全灭');
});

test('relief and control reset on departure immediately even if replaced within the same round',()=>{
  for (const s of [relief(),state('control',[unit(1,'blue',3,3),unit(2,'blue',4,3),unit(3,'blue',2,4)])]) {
    if (s.mission.kind==='relief') {Object.assign(s.units[0],{x:3,y:4});checkOutcome(s);}
    round(s);assert.equal(getOperationStatus(s).held,1);
    const guard=s.mission.kind==='relief'?2:1,point=s.mission.point??s.mission.points[0];
    enter(s,guard,point.x,point.y-1);assert.equal(getOperationStatus(s).held,0);
    enter(s,guard,point.x,point.y);assert.equal(getOperationStatus(s).held,0);
    round(s);assert.equal(s.winner,null);assert.equal(getOperationStatus(s).held,1);round(s);assert.equal(s.winner,'blue');
  }
});

test('raid must destroy both marked batteries; final shot opens extraction but never qualifies parked units',()=>{
  const s=raid();Object.assign(s.units[0],{x:0,y:1});checkOutcome(s);
  assert.equal(attackUnit(s,3,4).ok,true);assert.equal(getOperationStatus(s).targetsDestroyed,1);assert.equal(getOperationStatus(s).phase,'strike');
  s.units[2].fired=false;assert.equal(attackUnit(s,3,5).ok,true);
  assert.equal(getOperationStatus(s).phase,'extract');assert.equal(getOperationStatus(s).arrivals,0);assert.equal(s.winner,null);
  enter(s,1,1,1);enter(s,1,0,1);enter(s,2,0,2);assert.equal(s.winner,'blue');
});

test('qualified arrivals reflect departure and death and an exit-to-exit move is not a new entry',()=>{
  const s=rear();for(let i=0;i<3;i++)round(s);
  enter(s,1,0,1);assert.equal(operationArrivals(s).length,1);
  enter(s,1,1,1);assert.equal(operationArrivals(s).length,0);
  enter(s,1,0,1);s.units[0].hp=0;checkOutcome(s);assert.equal(operationArrivals(s).length,0);
  assert.equal(s.winner,'red');
  const parked=raid();Object.assign(parked.units[0],{x:0,y:1});checkOutcome(parked);parked.units.filter(u=>u.team==='red').forEach(u=>u.hp=0);checkOutcome(parked);
  enter(parked,1,0,2);assert.equal(operationArrivals(parked).length,0);
});

test('all four operations honor final player action window and timeout at the final enemy-round end',()=>{
  for (const kind of Object.keys(missions)) {
    const s=kind==='rearguard'?rear():kind==='relief'?relief():kind==='raid'?raid():state(kind,[unit(1,'blue',0,0),unit(2,'blue',1,0)]);
    for(let i=0;i<s.mission.deadline-1;i++)round(s);
    assert.equal(s.winner,null,kind);assert.equal(getOperationStatus(s).turnsLeft,1);
    round(s);assert.equal(s.winner,'red',kind);assert.equal(getOperationStatus(s).outcomeReason,'超时');assert.equal(getOperationStatus(s).elapsed,s.mission.deadline);
  }
});

test('success outranks same-round deadline, but critical failure outranks successful hold',()=>{
  const s=state('control',[unit(1,'blue',3,3),unit(2,'blue',4,3)]);s.missionProgress.elapsed=5;round(s);round(s);
  assert.equal(s.winner,'blue');assert.equal(getOperationStatus(s).elapsed,7);
  const lost=relief();Object.assign(lost.units[0],{x:3,y:4});checkOutcome(lost);round(lost);
  lost.units[1].hp=0;lost.units[2].hp=0;round(lost);assert.equal(lost.winner,'red');assert.equal(getOperationStatus(lost).outcomeReason,'守军全灭');
});

function reducerState(s) {
  return {...initialGame('mountain-pass'),...s,selectedId:1,undoHistory:[],enemyQueue:[],enemyIndex:0};
}
test('empty red queue counts one round, terminal notice reports the reason without turn recovery, undo restores everything',()=>{
  let s=reducerState(rear());s.missionProgress.elapsed=6;
  const before=structuredClone(s.missionProgress);
  s=gameReducer(s,{type:'END_TURN'});s=gameReducer(s,{type:'ENEMY_STEP',session:s.session});
  assert.equal(s.winner,'red');assert.match(s.notice.message,/超时/);assert.doesNotMatch(s.logs[0].message,/行动已恢复/);
  const undone=gameReducer(s,{type:'UNDO'});assert.equal(undone.winner,null);assert.deepEqual(undone.missionProgress,before);assert.equal(undone.turn,'blue');
});

test('reducer extraction victory undo restores qualification, phase, firing and health',()=>{
  const fixture=raid();fixture.units.filter(u=>u.team==='red').forEach(u=>u.hp=0);checkOutcome(fixture);
  enter(fixture,1,0,1);let s=reducerState(fixture);s.selectedId=2;
  const before=structuredClone(s.missionProgress);s=gameReducer(s,{type:'CELL',x:0,y:2});assert.equal(s.winner,'blue');assert.match(s.notice.message,/撤离完成/);
  const undone=gameReducer(s,{type:'UNDO'});assert.equal(undone.winner,null);assert.deepEqual(undone.missionProgress,before);assert.equal(undone.units[1].moved,false);
});

test('control and relief AI contest empty objectives without bypassing mission stages',()=>{
  for (const kind of ['control','relief']) {
    const s=kind==='relief'?relief():state(kind,[unit(1,'blue',0,0),unit(2,'blue',1,0)]);
    const point=s.mission.point??s.mission.points[0];
    if(kind==='relief') Object.assign(s.units[1],{x:5,y:5});
    s.units.push(unit(9,'red',point.x+1,point.y,{move:1,attack:0}));s.turn='red';enemyAct(s,9);
    assert.equal(s.units.at(-1).x,point.x);assert.equal(s.units.at(-1).y,point.y);assert.equal(s.winner,null);
  }
});

test('enemy lethal fire resets control continuity before any later replacement',()=>{
  const s=state('control',[unit(1,'blue',3,3,{hp:1}),unit(2,'blue',4,3),unit(3,'blue',2,4),unit(4,'red',3,2,{move:0,attack:100})]);
  round(s);assert.equal(getOperationStatus(s).held,1);s.turn='red';enemyAct(s,4);
  assert.equal(s.units[0].hp,0);assert.equal(getOperationStatus(s).held,0);assert.equal(s.winner,null);
  enter(s,3,3,3);round(s);assert.equal(getOperationStatus(s).held,1);assert.equal(s.winner,null);
});

test('raid survivor loss immediately fails and final available player turn can still extract',()=>{
  const failed=raid();failed.units[0].hp=0;failed.units[1].hp=0;checkOutcome(failed);
  assert.equal(failed.winner,'red');assert.equal(getOperationStatus(failed).outcomeReason,'兵力不足');
  const s=raid();s.units.filter(u=>u.team==='red').forEach(u=>u.hp=0);checkOutcome(s);
  for(let i=0;i<6;i++)round(s);enter(s,1,0,1);enter(s,2,0,2);
  assert.equal(s.winner,'blue');assert.equal(getOperationStatus(s).elapsed,6);
});
