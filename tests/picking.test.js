import { sourceToHex } from '../src/game/layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/game/reducer.js';
import {createView,project,VEHICLE_SCALE} from '../src/rendering/projection.js';
import {pickUnit} from '../src/rendering/picking.js';
import {UNIT_TYPES} from '../src/game/catalog.js';
import {reachable, distance} from '../src/game/engine.js';

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
  const cell=sourceToHex(game,{x:16,y:3});
  assert.ok(game.terrain[cell.y][cell.x]>=0);
  const destination=project(view,cell.x+.5,cell.y+.5);
  assert.equal(pickUnit(game,view,destination,true),null);
  const artillery=game.units.find(u=>u.id===4);
  const center=project(view,artillery.x+.5,artillery.y+.5,17*VEHICLE_SCALE);
  assert.equal(pickUnit(game,view,center,true)?.id,artillery.id);
});


for(const difficulty of ['simple','hard']) {
  const scenario=initialGame(undefined,1,difficulty);
  for(const [type,spec] of Object.entries(UNIT_TYPES)) test(`${difficulty} map: ${type} selection works for both teams and leaves adjacent destinations clickable`,()=>{
    const origin=scenario.units.find(u=>u.team==='blue');
    const model={...origin,...spec,type,hp:spec.maxHp,moved:false,fired:false};
    const game={...scenario,units:[model],fog:scenario.fog.map(row=>row.map(()=>false))};
    const adjacent=[...reachable(game,model).values()].map(path=>path.at(-1)).filter(point=>distance(point,model)===1);
    assert.ok(adjacent.length>0,'fixture must offer a real adjacent movement destination');
    if(difficulty==='hard')assert.equal(game.mapScale,2);
    for(const zoom of [.65,1,2.8,5.6])for(const rotation of [0,.8,2.4]) {
      const view=createView(game,1000,620,zoom,{x:130,y:-40},{rotation});
      const height=type==='scout'?10:type==='heavyTank'?24:17;
      const center=project(view,model.x+.5,model.y+.5,height*VEHICLE_SCALE);
      for(const team of ['blue','red']) {
        const state={...game,units:[{...model,team}]};
        assert.equal(pickUnit(state,view,center)?.id,model.id,`${team} center, zoom ${zoom}, rotation ${rotation}`);
        assert.equal(pickUnit(state,view,center,true)?.id,model.id,`${team} center over destination`);
      }
      assert.ok(adjacent.every(point=>pickUnit(game,view,project(view,point.x+.5,point.y+.5),true)===null),
        `all adjacent reachable destinations must remain clickable, zoom ${zoom}, rotation ${rotation}`);
    }
  });
}
