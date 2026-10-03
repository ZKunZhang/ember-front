import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { movementDuration, movementPosition } from '../src/game/movement.js';
import { reachable, passable, distance } from '../src/game/engine.js';
import { createView, project, VEHICLE_SCALE } from '../src/rendering/projection.js';
import { pickUnit } from '../src/rendering/picking.js';

const position=unit=>({x:unit.x,y:unit.y});

test('successful movement records the real route, and undo/reset clear animation',()=>{
  const game=initialGame(),unit=game.units[0];
  game.units=game.units.filter(u=>u.team==='blue');game.mission=null;
  const path=[...reachable(game,unit).values()].find(path=>path.length>=3);
  const next=gameReducer(game,{type:'CELL',...path.at(-1)});
  assert.equal(next.movement.unitId,unit.id);
  assert.deepEqual(next.movement.path,[position(unit),...path]);
  assert.deepEqual(position(next.units[0]),path.at(-1));
  assert.deepEqual(next.units[0].heading,{x:path.at(-1).x-path.at(-2).x,y:path.at(-1).y-path.at(-2).y});
  assert.equal(gameReducer(next,{type:'UNDO'}).movement,null);
  assert.equal(gameReducer(next,{type:'RESET'}).movement,null);
  const invalid=gameReducer(game,{type:'CELL',x:-1,y:-1});
  assert.equal(invalid.movement,null);
});

test('movement interpolates around corners and picking follows the visible vehicle',()=>{
  const game=initialGame(),unit={...game.units[0],x:16,y:3};
  const motion={unitId:unit.id,started:0,path:[{x:18,y:4},{x:17,y:4},{x:17,y:3},{x:16,y:3}]};
  assert.deepEqual(position(movementPosition(unit,[motion],0)),motion.path[0]);
  const halfway=movementPosition(unit,[motion],movementDuration(motion)/2);
  assert.deepEqual(position(halfway),{x:17,y:3.5});
  assert.equal(movementPosition(unit,[motion],movementDuration(motion)),unit);
  assert.equal(movementPosition(unit,[motion],10,true),unit);
  const state={...game,units:[unit]},view=createView(state,1000,720);
  const point=project(view,halfway.x+.5,halfway.y+.5,10*VEHICLE_SCALE);
  assert.equal(pickUnit(state,view,point,false,[motion],movementDuration(motion)/2)?.id,unit.id);
  assert.equal(pickUnit(state,view,point,false,[],movementDuration(motion)/2),null);
});

test('stopping at a hidden enemy never animates through the occupied tile',()=>{
  const game=initialGame(),unit=game.units[0];
  const route=[...reachable(game,unit).values()].find(path=>path.length>=3);
  const enemy=game.units.find(u=>u.team==='red');
  Object.assign(enemy,route[1]);game.fog[enemy.y][enemy.x]=true;
  const moved=gameReducer(game,{type:'CELL',...route.at(-1)});
  assert.deepEqual(moved.movement.path,[position(unit),route[0]]);
  assert.deepEqual(position(moved.units[0]),route[0]);
});

test('visible enemy movement follows passable cells; hidden routes produce no animation',()=>{
  const source=initialGame();
  source.mission=null;
  source.terrain=source.terrain.map(row=>row.map(()=>0));
  source.units=[source.units[0],source.units.find(u=>u.team==='red')];
  const [blue,red]=source.units;
  Object.assign(blue,{x:10,y:5,vision:30});
  Object.assign(red,{x:3,y:5,range:1,minRange:1,move:3});
  source.turn='red';source.enemyQueue=[red.id];source.enemyIndex=0;
  source.fog=source.fog.map(row=>row.map(()=>false));
  const visible=gameReducer(source,{type:'ENEMY_STEP',session:source.session});
  assert.ok(visible.movement);
  assert.equal(visible.movement.unitId,red.id);
  assert.deepEqual(visible.movement.path[0],position(red));
  for(let i=1;i<visible.movement.path.length;i++){
    const a=visible.movement.path[i-1],b=visible.movement.path[i];
    assert.equal(distance(a,b),1);
    assert.ok(passable(visible,b.x,b.y));
  }
  const hidden=structuredClone(source);hidden.fog[red.y][red.x]=true;
  assert.equal(gameReducer(hidden,{type:'ENEMY_STEP',session:hidden.session}).movement,null);
});

test('suspension, track motion and dust settle at both endpoints and obey reduced motion',async()=>{
  const {vehicleMotion}=await import('../src/game/movement.js');
  const unit={id:1,type:'tank'},motion={unitId:1,started:0,path:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]};
  const end=movementDuration(motion),moving=vehicleMotion(unit,[motion],end*.4);
  assert.equal(moving.active,true);
  assert.notEqual(moving.bob,0);assert.notEqual(moving.roll,0);assert.ok(moving.trackPhase>0);
  assert.ok(Math.abs(moving.bob)<=2.8&&Math.abs(moving.roll)<=2.2);
  for(const time of [0,end,end+500])assert.equal(vehicleMotion(unit,[motion],time).active,false);
  assert.equal(vehicleMotion(unit,[motion],end*.4,true).active,false);
});


test('vehicle steering follows route corners and settles into the final heading',async()=>{
  const {vehicleMotion}=await import('../src/game/movement.js');
  const unit={id:1,type:'tank',team:'blue',heading:{x:0,y:1}};
  const movement={unitId:1,started:0,heading:{x:1,y:0},path:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]};
  const duration=movementDuration(movement);
  const first=vehicleMotion(unit,[movement],duration*.35);
  assert.ok(first.heading.x>.99&&Math.abs(first.heading.y)<.01);
  const later=vehicleMotion(unit,[movement],duration*.8);
  assert.ok(later.heading.y>.99&&Math.abs(later.heading.x)<.01);
  assert.deepEqual(vehicleMotion(unit,[movement],duration).heading,unit.heading);
  assert.deepEqual(vehicleMotion(unit,[movement],duration*.4,true).heading,unit.heading);
});
