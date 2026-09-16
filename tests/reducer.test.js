import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { createView, project, unproject } from '../src/rendering/projection.js';
import { reachable } from '../src/game/engine.js';

test('moving the last vehicle ends the turn without requiring or automatically firing',()=>{
  const s=initialGame();
  for(const u of s.units.filter(u=>u.team==='blue'))u.moved=true;
  s.units[0].moved=false;
  const destination=reachable(s,s.units[0]).values().next().value.at(-1);
  const next=gameReducer(s,{type:'CELL',...destination});
  assert.equal(next.turn,'red');assert.equal(next.selectedId,null);
  assert.ok(next.units.filter(u=>u.team==='blue').every(u=>!u.fired));
});

test('last movement ignores destroyed vehicles and starts exactly one enemy turn',()=>{
  const s=initialGame();
  for(const u of s.units.filter(u=>u.team==='blue')){u.moved=true;u.fired=true;}
  s.units[0].moved=false;
  s.units[8].hp=0;s.units[8].moved=false;s.units[8].fired=false;
  const destination=reachable(s,s.units[0]).values().next().value.at(-1);
  let next=gameReducer(s,{type:'CELL',...destination});
  assert.equal(next.turn,'red');assert.equal(next.selectedId,null);
  assert.equal(gameReducer(next,{type:'END_TURN'}),next);
  const count=next.enemyQueue.length;
  for(let i=0;i<count;i++)next=gameReducer(next,{type:'ENEMY_STEP',session:next.session});
  assert.equal(next.turn,'blue');assert.equal(next.turnNumber,2);
  assert.ok(next.units.every(u=>!u.moved&&!u.fired));
});

test('manual fire damages only the chosen target and completes the turn',()=>{
  const s=initialGame(),blue=s.units[0],reds=s.units.filter(u=>u.team==='red').slice(0,2);
  s.units=[blue,...reds];blue.moved=true;s.mode='attack';
  reds[0].x=16;reds[0].y=3;reds[0].hp=1;
  reds[1].x=17;reds[1].y=2;
  s.fog[3][16]=false;s.fog[2][17]=false;
  const next=gameReducer(s,{type:'CELL',x:17,y:2});
  assert.equal(next.units[1].hp,1);
  assert.ok(next.units[2].hp<reds[1].hp);assert.equal(next.turn,'red');
});

test('manual victory never starts enemy actions',()=>{
  const s=initialGame(),blue=s.units[0],red=s.units.find(u=>u.team==='red');
  s.units=[blue,red];blue.moved=true;s.mode='attack';red.x=16;red.y=3;red.hp=1;s.fog[3][16]=false;
  const next=gameReducer(s,{type:'CELL',x:16,y:3});
  assert.equal(next.winner,'blue');assert.equal(next.turn,'blue');assert.deepEqual(next.enemyQueue,[]);
});

for(const moved of [false,true])test(`manual repair exits repair mode and allows selection (moved=${moved})`,()=>{
  const s=initialGame(),engineer=s.units[5],target=s.units[2];
  target.hp-=5;engineer.moved=moved;s.selectedId=engineer.id;
  const repairing=gameReducer(s,{type:'MODE',mode:'repair'});
  const next=gameReducer(repairing,{type:'CELL',x:target.x,y:target.y});
  assert.equal(next.units[2].hp,target.maxHp);assert.equal(next.units[5].fired,true);
  assert.equal(next.mode,'move');
  assert.equal(next.turn,'blue');assert.equal(s.units[2].hp,target.maxHp-5);
  assert.equal(gameReducer(next,{type:'CELL',x:target.x,y:target.y}).selectedId,target.id);
  assert.equal(gameReducer(next,{type:'MODE',mode:'repair'}),next);
});

test('last repair ends the turn; invalid repair does not and can be cancelled',()=>{
  const s=initialGame(),engineer=s.units[5],target=s.units[2];
  for(const u of s.units.filter(u=>u.team==='blue')){u.moved=true;u.fired=true;}
  engineer.fired=false;s.selectedId=engineer.id;
  const repairing=gameReducer(s,{type:'MODE',mode:'repair'});
  const failed=gameReducer(repairing,{type:'CELL',x:target.x,y:target.y});
  assert.equal(failed.turn,'blue');assert.equal(failed.units[5].fired,false);
  const cancelled=gameReducer(failed,{type:'CANCEL_REPAIR'});
  assert.equal(cancelled.mode,'move');assert.equal(cancelled.units[5].fired,false);
  repairing.units[2].hp-=5;
  const repaired=gameReducer(repairing,{type:'CELL',x:target.x,y:target.y});
  assert.equal(repaired.turn,'red');assert.equal(repaired.units[2].hp,target.maxHp);
});

test('ending early skips unused fire and repair rather than picking targets',()=>{
  const s=initialGame();s.units[2].hp-=5;
  const next=gameReducer(s,{type:'END_TURN'});
  assert.deepEqual(next.units,s.units);assert.equal(next.turn,'red');
});

test('non-engineers and locked turns reject repair mode',()=>{
  const s=initialGame();assert.equal(gameReducer(s,{type:'MODE',mode:'repair'}),s);
  const next=gameReducer(s,{type:'END_TURN'});
  assert.equal(gameReducer(next,{type:'MODE',mode:'attack'}),next);
});

test('switching maps invalidates pending enemy steps without mutating old state',()=>{
  const a=initialGame('mountain-pass'),b=gameReducer(a,{type:'END_TURN'}),c=gameReducer(b,{type:'RESET',scenarioId:'twin-bridges'});
  assert.equal(a.turn,'blue');assert.equal(b.turn,'red');assert.equal(c.units.length,18);assert.equal(c.turnNumber,1);
  assert.equal(gameReducer(c,{type:'ENEMY_STEP',session:b.session}),c);
  const d=gameReducer(c,{type:'RESET'});assert.equal(gameReducer(d,{type:'ENEMY_STEP',session:c.session}),d);
});
test('enemy sequence ends once and returns a fresh player turn',()=>{
  let s=gameReducer(initialGame(),{type:'END_TURN'});const n=s.enemyQueue.length;
  for(let i=0;i<n;i++)s=gameReducer(s,{type:'ENEMY_STEP',session:s.session});
  assert.equal(s.turn,'blue');assert.equal(s.turnNumber,2);assert.ok(s.units.every(u=>!u.moved&&!u.fired));
  assert.equal(gameReducer(s,{type:'ENEMY_STEP',session:s.session}),s);
});
test('mirrored projection hit testing round-trips all active cells at zoom and pan',()=>{
  const s=initialGame();for(const zoom of [.65,1,2.8]){const v=createView(s,1000,620,zoom,{x:44,y:-18});
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++){if(s.terrain[y][x]<0)continue;const screen=project(v,x+.5,y+.5);assert.deepEqual(unproject(v,screen.x,screen.y),{x,y});}
  }
});

test('transient zero-size layout never produces negative canvas radii',()=>{
  const s=initialGame();for(const [w,h] of [[0,0],[20,10],[400,0]]){const v=createView(s,w,h);assert.ok(Number.isFinite(v.scale)&&v.scale>0);}
});


for(const mode of ['move','repair'])test(`out-of-range enemy click shows intel without consuming actions in ${mode} mode`,()=>{
  const s=initialGame(),red=s.units.find(u=>u.team==='red');
  s.fog[red.y][red.x]=false;s.mode=mode;
  const next=gameReducer(s,{type:'CELL',x:red.x,y:red.y});
  assert.equal(next.inspectedId,red.id);assert.equal(next.selectedId,s.selectedId);
  assert.deepEqual(next.units,s.units);assert.equal(next.mode,mode);assert.equal(next.logs[0].kind,'warn');
  const selected=gameReducer(next,{type:'SELECT',id:2});
  assert.equal(selected.inspectedId,null);assert.equal(selected.selectedId,2);
});

for(const mode of ['move','repair'])test(`clicking enemies directly fires and inspects in ${mode} mode`,()=>{
  const s=initialGame(),red=s.units.find(u=>u.team==='red');
  red.x=16;red.y=3;s.fog[3][16]=false;s.mode=mode;
  const next=gameReducer(s,{type:'CELL',x:16,y:3});
  assert.equal(next.inspectedId,red.id);assert.equal(next.units[0].fired,true);
  assert.ok(next.units.find(u=>u.id===red.id).hp<red.hp);
  assert.equal(next.selectedId,1);
});

test('inspection is available during enemy turns but never reveals hidden or dead enemies',()=>{
  const s=gameReducer(initialGame(),{type:'END_TURN'}),red=s.units.find(u=>u.team==='red');
  assert.equal(gameReducer(s,{type:'CELL',x:red.x,y:red.y}),s);
  s.fog[red.y][red.x]=false;
  const next=gameReducer(s,{type:'CELL',x:red.x,y:red.y});
  assert.equal(next.inspectedId,red.id);assert.deepEqual(next.units,s.units);
  assert.equal(next.enemyIndex,s.enemyIndex);
  s.units.find(u=>u.id===red.id).hp=0;
  assert.equal(gameReducer(s,{type:'CELL',x:red.x,y:red.y}),s);
  assert.equal(gameReducer(next,{type:'RESET'}).inspectedId,null);
});

test('enemy intel is cleared on death or loss of visibility',()=>{
  const s=initialGame(),red=s.units.find(u=>u.team==='red');
  s.inspectedId=red.id;s.fog[red.y][red.x]=true;
  assert.equal(gameReducer(s,{type:'MODE',mode:'attack'}).inspectedId,null);
  red.x=16;red.y=3;red.hp=1;s.fog[3][16]=false;s.mode='attack';
  const next=gameReducer(s,{type:'CELL',x:16,y:3});
  assert.equal(next.inspectedId,null);
});

test('difficulty survives redeployment and can be changed explicitly',()=>{
  const simple=initialGame();
  assert.equal(simple.difficultyId,'simple');assert.equal(simple.enemyCount,7);
  const hard=gameReducer(simple,{type:'RESET',difficulty:'hard'});
  assert.equal(hard.difficultyId,'hard');assert.equal(hard.enemyCount,14);
  const reset=gameReducer(hard,{type:'RESET'});
  assert.equal(reset.difficultyId,'hard');assert.equal(reset.enemyCount,14);
  const easy=gameReducer(reset,{type:'RESET',scenarioId:'twin-bridges',difficulty:'easy'});
  assert.equal(easy.difficultyId,'easy');assert.equal(easy.enemyCount,14);
});


test('remaining movement and failed moves do not automatically end the turn',()=>{
  const s=initialGame();
  for(const u of s.units.filter(u=>u.team==='blue'))u.moved=true;
  s.units[0].moved=false;s.units[1].moved=false;
  const destination=reachable(s,s.units[0]).values().next().value.at(-1);
  const moved=gameReducer(s,{type:'CELL',...destination});
  assert.equal(moved.turn,'blue');assert.equal(moved.units[0].moved,true);
  const other=reachable(moved,moved.units[0]).values().next().value.at(-1);
  const failed=gameReducer(moved,{type:'CELL',...other});
  assert.equal(failed.turn,'blue');assert.equal(failed.logs[0].kind,'warn');
  assert.equal(gameReducer(failed,{type:'END_TURN'}).turn,'red');
});
