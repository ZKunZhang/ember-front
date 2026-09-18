import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/game/reducer.js';
import {createView,project,VEHICLE_SCALE} from '../src/rendering/projection.js';
import {pickUnit} from '../src/rendering/picking.js';

test('dense diagonal formation is picked by visible body center at every zoom',()=>{
  const game=initialGame();
  for(const zoom of [.65,1,2.8]){
    const view=createView(game,1000,620,zoom,{x:130,y:-40});
    for(const unit of game.units.filter(u=>u.team==='blue')){
      const height=unit.type==='scout'?10:unit.type==='heavyTank'?24:17;
      const point=project(view,unit.x+.5,unit.y+.5,height*VEHICLE_SCALE);
      assert.equal(pickUnit(game,view,point)?.id,unit.id);
      assert.equal(pickUnit({...game,units:[...game.units].reverse()},view,point)?.id,unit.id);
    }
  }
});
test('picking excludes hidden enemies and wrecks',()=>{
  const game=initialGame(),view=createView(game,1000,620);
  const enemy=game.units.find(u=>u.team==='red');
  const point=project(view,enemy.x+.5,enemy.y+.5,10*VEHICLE_SCALE);
  assert.equal(pickUnit(game,view,point),null);
  game.fog[enemy.y][enemy.x]=false;
  assert.equal(pickUnit(game,view,point)?.id,enemy.id);
  enemy.hp=0;assert.equal(pickUnit(game,view,point),null);
});

test('nearby move tiles remain clickable while model centers win selection',()=>{
  const game=initialGame(),view=createView(game,1000,620);
  const destination=project(view,16.5,3.5);
  assert.equal(pickUnit(game,view,destination,true),null);
  const artillery=game.units.find(u=>u.id===4);
  const center=project(view,artillery.x+.5,artillery.y+.5,17*VEHICLE_SCALE);
  assert.equal(pickUnit(game,view,center,true)?.id,artillery.id);
});
