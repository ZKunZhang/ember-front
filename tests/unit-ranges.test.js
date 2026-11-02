import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { attackUnit, moveUnit, updateFog, routeCost, passable } from '../src/game/engine.js';
import { hexDistance, hexNeighbors } from '../src/game/hex.js';
import { getBattlefieldData } from '../src/rendering/battlefield.js';
import { gameReducer } from '../src/game/reducer.js';

const key = p => `${p.x},${p.y}`;
const unit = (type, id=1, team='blue', x=12, y=12) => ({...UNIT_TYPES[type],type,id,team,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false});
function battlefield(type) {
  const state={cols:25,rows:25,terrain:Array.from({length:25},()=>Array(25).fill(0)),units:[unit(type)],selectedId:1,turn:'blue',winner:null,mode:'move',mission:null};
  updateFog(state);
  return state;
}
function targetAt(state, distance) {
  const shooter=state.units[0];
  const target=unit('heavyTank',2,'red',shooter.x+distance,shooter.y);
  // A separate observer makes range independent of the shooter's own vision.
  state.units.push(target,unit('scout',3,'blue',target.x,target.y+1));
  updateFog(state);
  assert.equal(state.fog[target.y][target.x],false);
  return target;
}

for(const [type,spec] of Object.entries(UNIT_TYPES)) {
  test(`${type}: flat movement disk and fire annulus match every hex`,()=>{
    const state=battlefield(type),selected=state.units[0],data=getBattlefieldData(state);
    assert.equal(data.moves.size,3*spec.move*(spec.move+1));
    assert.equal(data.fire.size,3*spec.range*(spec.range+1)-3*(spec.minRange-1)*spec.minRange);
    for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
      const distance=hexDistance(selected,{x,y});
      assert.equal(data.moves.has(`${x},${y}`),distance>0&&distance<=spec.move,`move ${x},${y}`);
      assert.equal(data.fire.has(`${x},${y}`),distance>=spec.minRange&&distance<=spec.range,`fire ${x},${y}`);
    }
    assert.ok(data.moveContours.length>0);
    assert.ok(data.fireContours.length>0);
  });

  test(`${type}: command boundaries agree with movement and firing regions`,()=>{
    for(const distance of [spec.move,spec.move+1]) {
      const state=battlefield(type),selected=state.units[0],destination={x:selected.x+distance,y:selected.y};
      const shown=getBattlefieldData(state).moves.has(key(destination));
      const result=moveUnit(state,selected.id,destination.x,destination.y);
      assert.equal(result.ok,shown);
      assert.equal(selected.moved,distance===spec.move);
      assert.deepEqual({x:selected.x,y:selected.y},distance===spec.move?destination:{x:12,y:12});
    }
    for(const distance of [spec.minRange-1,spec.minRange,spec.range,spec.range+1]) {
      const state=battlefield(type),target=targetAt(state,distance),selected=state.units[0],before=target.hp;
      const shown=getBattlefieldData(state).fire.has(key(target));
      const result=attackUnit(state,selected.id,target.id);
      assert.equal(result.ok,shown,`distance ${distance}`);
      assert.equal(selected.fired,shown);
      assert.equal(target.hp<before,shown);
    }
  });

  test(`${type}: mountain and forest fire contours agree with actual shared-vision attacks`,()=>{
    for(const cover of [1,2]) {
      const state=battlefield(type),target=targetAt(state,Math.max(2,spec.minRange));
      state.terrain[12][13]=cover;
      updateFog(state);
      assert.equal(state.fog[target.y][target.x],false,'shared scout must still see the target');
      assert.equal(getBattlefieldData(state).fire.has(key(target)),spec.indirect);
      assert.equal(attackUnit(state,1,target.id).ok,spec.indirect);
      assert.equal(state.units[0].fired,spec.indirect);
    }
  });

  test(`${type}: each action hides its own overlay, while inactive states hide both`,()=>{
    const state=battlefield(type),original=getBattlefieldData(state);
    for(const field of ['moved','fired']) {
      const next=structuredClone(state);next.units[0][field]=true;
      const data=getBattlefieldData(next);
      assert.equal(data.moves.size,field==='moved'?0:original.moves.size);
      assert.equal(data.fire.size,field==='fired'?0:original.fire.size);
      assert.equal(data.moveContours.length===0,field==='moved');
      assert.equal(data.fireContours.length===0,field==='fired');
    }
    for(const next of [{...state,turn:'red'},{...state,winner:'blue'},{...state,selectedId:null}]) {
      const data=getBattlefieldData(next);
      assert.equal(data.moves.size,0);assert.equal(data.fire.size,0);
      assert.deepEqual(data.moveContours,[]);assert.deepEqual(data.fireContours,[]);
    }
    const preview=getBattlefieldData(state,true);
    assert.equal(preview.moves.size,0);assert.equal(preview.fire.size,0);
    assert.deepEqual(preview.moveContours,[]);assert.deepEqual(preview.fireContours,[]);
  });

  test(`${type}: mixed-terrain routes respect budget, obstacles and known occupancy`,()=>{
    const state=battlefield(type);
    state.terrain[12][13]=5;state.terrain[13][12]=6;
    state.terrain[12][11]=1;state.terrain[13][11]=2;state.terrain[11][12]=4;
    const hidden=unit('tank',2,'red',13,11),known=unit('tank',3,'red',14,11),ally=unit('scout',4,'blue',12,14);
    state.units.push(hidden,known,ally);updateFog(state);
    state.fog[hidden.y][hidden.x]=true;state.fog[known.y][known.x]=false;
    const data=getBattlefieldData(state);
    assert.equal(data.moves.has(key(hidden)),true,'hidden occupancy must not leak into previews');
    assert.equal(data.moves.has(key(known)),false);
    assert.equal(data.moves.has(key(ally)),false);
    for(const [destination,path] of data.moves) {
      assert.equal(key(path.at(-1)),destination);
      assert.ok(routeCost(state,path)<=spec.move);
      let previous=state.units[0];
      for(const point of path) {
        assert.equal(hexDistance(previous,point),1);
        assert.equal(passable(state,point.x,point.y),true);
        assert.notEqual(key(point),key(known));assert.notEqual(key(point),key(ally));
        previous=point;
      }
    }
    const result=moveUnit(state,1,hidden.x,hidden.y);
    assert.equal(result.ok,true);
    assert.equal(result.moved,0);
    assert.deepEqual({x:state.units[0].x,y:state.units[0].y},{x:12,y:12});
    assert.equal(state.units[0].moved,true);
  });
}

test('engineer repair mode replaces move/fire regions and cancelling restores them',()=>{
  const state=battlefield('engineer'),original=getBattlefieldData(state);
  const repairing=gameReducer(state,{type:'MODE',mode:'repair'}),data=getBattlefieldData(repairing);
  assert.equal(repairing.mode,'repair');
  assert.equal(data.moves.size,0);assert.equal(data.fire.size,0);
  assert.deepEqual(data.moveContours,[]);assert.deepEqual(data.fireContours,[]);
  assert.deepEqual([...data.repair].sort(),hexNeighbors(state.units[0]).map(key).sort());
  assert.ok(data.repairContours.length>0);
  const restored=getBattlefieldData(gameReducer(repairing,{type:'MODE',mode:'move'}));
  assert.deepEqual([...restored.moves.keys()],[...original.moves.keys()]);
  assert.deepEqual(restored.fire,original.fire);
  assert.equal(restored.repair.size,0);
});
