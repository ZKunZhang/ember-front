import test from 'node:test';
import assert from 'node:assert/strict';
import { combatMotion, vehicleKick, IMPACT_DELAY, EFFECT_DURATION } from '../src/rendering/combat.js';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { createView } from '../src/rendering/projection.js';

test('shot effects retain a visible source and lethal target for the animation',()=>{
  const s=initialGame(),red=s.units.find(u=>u.team==='red');
  red.x=16;red.y=3;red.hp=1;s.fog[3][16]=false;
  const next=gameReducer(s,{type:'CELL',x:16,y:3});
  assert.equal(next.effect.source.id,s.selectedId);
  assert.equal(next.effect.targetId,red.id);
  assert.equal(next.effect.destroyed,true);
  assert.equal(gameReducer(next,{type:'UNDO'}).effect,null);
});

test('hidden artillery effects never disclose their firing position',()=>{
  const s=initialGame(),blue=s.units[0],red=s.units.find(u=>u.team==='red');
  s.units=[blue,red];Object.assign(red,{type:'artillery',x:blue.x-4,y:blue.y,range:9,minRange:1,indirect:true,move:0});
  s.turn='red';s.enemyQueue=[red.id];s.enemyIndex=0;
  s.fog=s.fog.map(row=>row.map(()=>true));blue.vision=1;
  const next=gameReducer(s,{type:'ENEMY_STEP',session:s.session});
  assert.ok(next.effect);assert.equal(next.effect.source,null);
});

test('recoil precedes impact and reduced motion suppresses all displacement',()=>{
  const s=initialGame(),u=s.units[0],view=createView(s,800,620);
  const effects=[{started:0,id:1,amount:-3,x:u.x-2,y:u.y,source:{...u},targetId:99}];
  assert.notDeepEqual(vehicleKick(u,effects,view,70),{x:0,y:0});
  assert.deepEqual(combatMotion(effects,70),{x:0,y:0});
  assert.notDeepEqual(combatMotion(effects,IMPACT_DELAY+30),{x:0,y:0});
  assert.deepEqual(combatMotion(effects,EFFECT_DURATION),{x:0,y:0});
  assert.deepEqual(vehicleKick(u,effects,view,70,true),{x:0,y:0});
  assert.deepEqual(combatMotion(effects,IMPACT_DELAY+30,true),{x:0,y:0});
});
