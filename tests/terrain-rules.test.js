import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { terrainCost, terrainLabel } from '../src/game/terrain.js';
import { reachable, routeCost, movementCost, moveUnit, enemyAct, updateFog, checkOutcome, beginPlayerTurn, updateMission, inFireRange } from '../src/game/engine.js';

const unit=(id,team,x,y,extra={})=>({...UNIT_TYPES.tank,id,team,type:'tank',x,y,hp:UNIT_TYPES.tank.maxHp,moved:false,fired:false,...extra});
function state(terrain,units,mission=null) {
  const s={cols:terrain[0].length,rows:terrain.length,terrain,units,mission,missionProgress:{captured:[],heldTurns:0,defendedTurns:0},turn:'blue',turnNumber:1,winner:null,difficultyId:'simple'};
  updateFog(s);return s;
}
const defend=points=>({kind:'defend',point:{...points[0],label:'机场'},points,turns:5});
const line=(cells,units,mission)=>state([cells],units,mission);

test('terrain costs and labels distinguish fordable shallows and impassable deep water',()=>{
  assert.equal(terrainCost(0),1);assert.equal(terrainCost(3),1);
  assert.equal(terrainCost(5),2);assert.equal(terrainCost(6),2);
  for(const type of [1,2,4,-1,99])assert.equal(terrainCost(type),Infinity);
  assert.equal(terrainLabel(6),'浅水');
  const s=line([0,6,4,0],[unit(1,'blue',0,0,{move:3})]);
  assert.equal(movementCost(s,-1,0),Infinity);
  assert.equal(routeCost(s,reachable(s,s.units[0]).get('1,0')),2);
  assert.equal(reachable(s,s.units[0]).has('2,0'),false);
  assert.equal(reachable(s,s.units[0],Infinity).has('3,0'),false);
});

test('Dijkstra replaces a short muddy route with a longer cheap dry route',()=>{
  const s=state([[0,5,5,0],[0,0,0,4]],[unit(1,'blue',0,0,{move:4})]);
  const routes=reachable(s,s.units[0]);
  assert.deepEqual(routes.get('3,0'),[{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:0}]);
  assert.equal(routeCost(s,routes.get('3,0')),4);
  assert.equal(reachable(s,s.units[0],3).has('3,0'),false);
  assert.equal(moveUnit(s,1,3,0).moved,4);
});

test('movement charges destination cells and never charges the muddy origin',()=>{
  const s=line([5,6,5,0],[unit(1,'blue',0,0,{move:3})]);
  assert.equal(reachable(s,s.units[0]).has('1,0'),true);
  assert.equal(reachable(s,s.units[0]).has('2,0'),false);
  assert.equal(moveUnit(s,1,2,0).ok,false);
  assert.equal(s.units[0].moved,false);
});

test('hidden occupied terrain remains previewable while actual movement stops before it',()=>{
  const s=line([0,5,6,0],[unit(1,'blue',0,0,{move:6,vision:0}),unit(2,'red',2,0)]);
  assert.equal(reachable(s,s.units[0]).has('3,0'),true);
  assert.equal(reachable(s,s.units[0],6,false).has('3,0'),false);
  const result=moveUnit(s,1,3,0);
  assert.deepEqual(result.path,[{x:1,y:0}]);
  assert.equal(s.units[0].x,1);
});

test('AI movement spends the actual terrain budget, including a final expensive cell',()=>{
  const s=line([0,5,6,0,0,0],[unit(1,'red',0,0,{move:3,range:1,minRange:1}),unit(2,'blue',5,0)]);
  s.turn='red';
  const result=enemyAct(s,1);
  assert.deepEqual(result.path,[{x:1,y:0}]);
  assert.equal(routeCost(s,result.path),2);
  assert.equal(s.units[0].x,1);
});

test('AI prefers a cheaper longer dry route to its firing position',()=>{
  const s=state([[0,5,5,0,0],[0,0,0,4,4]],[unit(1,'red',0,0,{move:4,range:1,minRange:1}),unit(2,'blue',4,0)]);
  s.turn='red';const result=enemyAct(s,1);
  assert.equal(result.path.length,4);assert.equal(routeCost(s,result.path),4);
  assert.deepEqual(result.path.at(-1),{x:3,y:0});assert.ok(result.damage);
});

test('airport AI advances before shooting and loses defense on entry without a shot',()=>{
  const s=line([0,0,0,0,0],[unit(1,'red',0,0,{move:3,fired:true}),unit(2,'blue',4,0)],defend([{x:2,y:0}]));
  s.turn='red';const result=enemyAct(s,1);
  assert.equal(s.winner,'red');assert.equal(s.units[0].x,2);
  assert.deepEqual(result.path,[{x:1,y:0},{x:2,y:0}]);
  assert.equal(result.damage,undefined);assert.equal(s.units[1].hp,s.units[1].maxHp);
});

test('airport movement stops at the first protected cell despite surplus movement budget',()=>{
  const s=line([0,0,0,0,0],[unit(1,'red',0,0,{move:4}),unit(2,'blue',4,0)],defend([{x:3,y:0},{x:1,y:0}]));
  s.turn='red';const result=enemyAct(s,1);
  assert.equal(s.winner,'red');assert.deepEqual(result.path,[{x:1,y:0}]);
  assert.equal(result.damage,undefined);
});

test('airport detects any living enemy on its six protected cells, with loss before turn victory',()=>{
  const points=Array.from({length:6},(_,x)=>({x:x+1,y:0}));
  for(const point of points){
    const s=line(Array(9).fill(0),[unit(1,'blue',0,0),unit(2,'red',point.x,0)],defend(points));
    s.missionProgress.defendedTurns=4;s.turn='red';beginPlayerTurn(s);
    assert.equal(s.winner,'red');assert.equal(s.missionProgress.defendedTurns,4);
  }
});

test('airport wins on five completed enemy turns or elimination; blue loss has priority',()=>{
  const s=line([0,0,0,0],[unit(1,'blue',0,0),unit(2,'red',3,0)],defend([{x:2,y:0}]));
  updateMission(s);assert.equal(s.missionProgress.defendedTurns,0);
  for(let turn=1;turn<=5;turn++){
    s.turn='red';beginPlayerTurn(s);assert.equal(s.missionProgress.defendedTurns,turn);
    assert.equal(s.winner,turn===5?'blue':null);
  }
  const eliminated=line([0,0,0],[unit(1,'blue',0,0),unit(2,'red',2,0,{hp:0})],defend([{x:1,y:0}]));
  checkOutcome(eliminated);assert.equal(eliminated.winner,'blue');
  const lost=structuredClone(eliminated);lost.winner=null;lost.units[0].hp=0;lost.missionProgress.defendedTurns=5;
  checkOutcome(lost);assert.equal(lost.winner,'red');
});

test('undo restores airport turn progress and permits replay of its fifth enemy turn',()=>{
  const base=initialGame();
  const custom=line([0,0,0,0],[unit(1,'blue',0,0),unit(2,'red',3,0,{move:0,range:0})],defend([{x:2,y:0}]));
  Object.assign(base,custom,{selectedId:1});base.missionProgress.defendedTurns=4;
  const ended=gameReducer(base,{type:'END_TURN'});
  const won=gameReducer(ended,{type:'ENEMY_STEP',session:ended.session});
  assert.equal(won.winner,'blue');assert.equal(won.missionProgress.defendedTurns,5);
  const restored=gameReducer(won,{type:'UNDO'});
  assert.equal(restored.winner,null);assert.equal(restored.missionProgress.defendedTurns,4);
  assert.equal(restored.turn,'blue');
});

test('mud and water do not alter indirect range or mountain and woodland line blocking',()=>{
  for(const terrain of [1,2,5,6]) {
    const s=line([0,terrain,0,0],[unit(1,'blue',0,0,{range:3,minRange:1}),unit(2,'red',3,0)]);
    assert.equal(inFireRange(s,s.units[0],s.units[1]),terrain===5||terrain===6);
    assert.equal(inFireRange(s,{...s.units[0],indirect:true},s.units[1]),true);
    assert.equal(inFireRange(s,{...s.units[0],indirect:true,range:2},s.units[1]),false);
  }
});


test('coordinated repair movement respects muddy approach cost',()=>{
  const s=line([0,5,5,0,0,0,0],[unit(1,'red',0,0,{repair:5,move:3}),unit(2,'red',3,0,{hp:1}),unit(3,'blue',6,0)]);
  s.difficultyId='hard';s.turn='red';const result=enemyAct(s,1);
  assert.ok(routeCost(s,result.path)<=3);
  assert.equal(result.healed,undefined);assert.equal(s.units[1].hp,1);
});

test('coordinated retreat movement respects expensive terrain budget',()=>{
  const s=line([0,0,0,5,6,0,0],[unit(1,'blue',0,0,{range:2}),unit(2,'red',2,0,{hp:1,move:3,range:1})]);
  s.difficultyId='hard';s.turn='red';const result=enemyAct(s,2);
  assert.deepEqual(result.path,[{x:3,y:0}]);assert.equal(routeCost(s,result.path),2);
});

test('airport AI attacks normally when every protected cell is occupied by blue',()=>{
  const s=line([0,0,0],[unit(1,'red',0,0,{range:1}),unit(2,'blue',1,0)],defend([{x:1,y:0}]));
  s.turn='red';const result=enemyAct(s,1);
  assert.ok(result.damage);assert.equal(s.winner,null);assert.equal(s.units[0].x,0);
});
