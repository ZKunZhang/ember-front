import test from 'node:test';
import assert from 'node:assert/strict';
import { HEX_DIRECTIONS } from '../src/game/hex.js';
import { worldToGround, createView } from '../src/rendering/projection.js';
import { runwayFrame, getEnvironmentItems, drawEnvironmentGround, drawEnvironmentItem } from '../src/rendering/environment.js';
import { drawBattlefield } from '../src/rendering/battlefield.js';
import { initialGame } from '../src/game/reducer.js';
import { createTerrainCache } from '../src/rendering/cache.js';

function airfield() {
  return {type:'airfield',runway:{from:{x:4,y:3},to:{x:4,y:8}},hangars:[{x:5,y:4},{x:5,y:7}]};
}
function recording() {
  const fills=[];
  const ctx=new Proxy({}, {get(target,key) {
    if(key in target)return target[key];
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    if(key==='measureText')return ()=>({width:20});
    if(key==='fill')return ()=>fills.push(target.fillStyle);
    return ()=>{};
  }});
  return {ctx,fills};
}

test('runway thresholds meet supplied cell centers and retain an orthogonal width in every hex direction',()=>{
  for(const [dx,dy] of HEX_DIRECTIONS) {
    const runway={from:{x:8,y:8},to:{x:8+dx*5,y:8+dy*5}},frame=runwayFrame(runway);
    for(const [along,cell] of [[0,runway.from],[frame.length,runway.to]]) {
      const actual=frame.point(along);
      assert.ok(Math.abs(actual.x-cell.x-.5)<1e-10);
      assert.ok(Math.abs(actual.y-cell.y-.5)<1e-10);
    }
    const a=worldToGround(frame.point(0)),b=worldToGround(frame.point(1)),c=worldToGround(frame.point(0,.74));
    assert.ok(Math.abs((b.x-a.x)*(c.x-a.x)+(b.y-a.y)*(c.y-a.y))<1e-10);
    assert.ok(Math.abs(Math.hypot(c.x-a.x,c.y-a.y)-.74)<1e-10);
  }
  assert.equal(runwayFrame({from:{x:1,y:2},to:{x:1,y:2}}),null);
});

test('feature geometry is deterministic and independent of all enemy information',()=>{
  const state={features:[airfield()],fog:Array.from({length:12},()=>Array(12).fill(false))};
  const other={...state,units:[{team:'red',x:5,y:4,hp:10}]};
  const items=getEnvironmentItems(state);
  assert.equal(items.length,4);
  assert.deepEqual(items,getEnvironmentItems(other));
  const render=game=>{
    const faces=[],lines=[];
    const painter={p:(x,y,z=0)=>({...worldToGround({x,y}),z}),polygon:(...args)=>faces.push(args),line:(...args)=>lines.push(args)};
    drawEnvironmentGround(painter,game);
    for(const item of getEnvironmentItems(game))drawEnvironmentItem(painter,item);
    return {faces,lines};
  };
  assert.deepEqual(render(state),render(other));
  const hidden=structuredClone(state);hidden.fog[4][5]=true;
  assert.equal(getEnvironmentItems(hidden).length,2);
  hidden.fog[7][5]=true;
  assert.deepEqual(getEnvironmentItems(hidden),[]);
});

test('runways survive cached and uncached ground painting in both live and preview views',()=>{
  const state=initialGame();state.features=[airfield()];
  for(const row of state.fog)row.fill(false);
  const view=createView(state,900,700);
  const cache=createTerrainCache(()=>({width:0,height:0,getContext:()=>recording().ctx}));
  for(const preview of [false,true])for(const cached of [false,true]) {
    const {ctx,fills}=recording();
    drawBattlefield(ctx,view,state,{preview,cache:cached?cache:null});
    assert.ok(fills.includes('#505956'),`asphalt must reach the destination canvas: preview=${preview}, cache=${cached}`);
    assert.ok(fills.includes('#bbc0a6'),'parked aircraft must share the model drawing path');
  }
  cache.clear();
});
