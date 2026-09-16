import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { createView, project, unproject } from '../src/rendering/projection.js';

test('switching maps invalidates pending enemy steps without mutating old state',()=>{
  const a=initialGame('mountain-pass'),b=gameReducer(a,{type:'END_TURN'}),c=gameReducer(b,{type:'RESET',scenarioId:'twin-bridges'});
  assert.equal(a.turn,'blue');assert.equal(b.turn,'red');assert.equal(c.units.length,27);assert.equal(c.turnNumber,1);
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
