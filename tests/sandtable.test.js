import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame } from '../src/game/reducer.js';
import { SCENARIOS } from '../src/game/scenarios.js';
import { HEX_DIRECTIONS, hexCorners } from '../src/game/hex.js';
import { createView, initialRotation, project, unproject } from '../src/rendering/projection.js';
import { createTerrainCache } from '../src/rendering/cache.js';

test('default camera puts every deployment at lower left and remains stable as units move', () => {
  for (const {id} of SCENARIOS) {
    const state=initialGame(id),view=createView(state,1440,1080);
    const allies=state.deployments.filter(unit=>unit.team==='blue');
    const x=allies.reduce((sum,u)=>sum+u.x+.5,0)/allies.length;
    const y=allies.reduce((sum,u)=>sum+u.y+.5,0)/allies.length;
    const center=project(view,state.cols/2,state.rows/2),deployment=project(view,x,y);
    assert.ok(state.advance==='right'?deployment.x<center.x:deployment.y>center.y,`${id}: deployment faces its approach`);
    assert.equal(view.rotation,initialRotation(state));
    assert.equal(view.rotation,0,'default view faces the table edge without a preset orbit');
    const a=project(view,3,state.rows/2),b=project(view,18,state.rows/2);
    assert.ok(Math.abs(state.advance==='right'?a.y-b.y:a.x-b.x)<1e-7,'advance stays on one screen axis');
    for (const unit of state.units) Object.assign(unit,{x:3,y:3});
    assert.equal(createView(state,1440,1080).rotation,view.rotation,'moving units cannot rotate the default camera');
  }
});

test('sandtable centers and painted hex edges remain pickable through full rotations', () => {
  for (const scenario of ['mountain-pass', 'forest-corridor', 'lake-crossroads']) {
    const state = initialGame(scenario);
    const cells = [{x:3,y:3}, {x:10,y:8}, {x:18,y:14}];
    for (const [width,height] of [[1440,1080], [390,720]]) {
      for (const quarter of [0,1,2,3]) for (const offset of [-.001,0,.001]) {
        for (const tilt of [.65,1,1.35]) for (const zoom of [.65,1.15,2.8]) {
          const view = createView(state,width,height,zoom,{x:51,y:-27},{rotation:quarter*Math.PI/2+offset,tilt});
          for (const cell of cells) {
            const center = project(view,cell.x+.5,cell.y+.5);
            const corners = hexCorners(cell.x,cell.y).map(([x,y])=>project(view,x,y));
            const toward = (p,factor) => ({x:center.x+(p.x-center.x)*factor,y:center.y+(p.y-center.y)*factor});
            assert.deepEqual(unproject(view,center.x,center.y),cell);
            for (const [i,a] of corners.entries()) {
              const b=corners[(i+1)%6],middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
              const inside=toward(middle,.999),outside=toward(middle,1.001),vertex=toward(a,.99);
              const [dx,dy]=HEX_DIRECTIONS[i];
              assert.deepEqual(unproject(view,inside.x,inside.y),cell);
              assert.deepEqual(unproject(view,outside.x,outside.y),{x:cell.x+dx,y:cell.y+dy});
              assert.deepEqual(unproject(view,vertex.x,vertex.y),cell);
            }
          }
        }
      }
    }
  }
});

test('sandtable tilt clamps to the supported camera range', () => {
  const state=initialGame();
  for (const [input,expected] of [[-4,.65],[.65,.65],[1,1],[1.35,1.35],[9,1.35]]) {
    assert.equal(createView(state,1000,720,1.15,undefined,{tilt:input}).tilt,expected);
  }
});

test('rotation and tilt invalidate both ground and fog-dependent detail rasters at fixed scale', () => {
  const canvases=[];
  const state={cols:1,rows:1,terrain:[[1]],fog:[[false]]};
  const base=createView(state,1000,720);
  const gradient={addColorStop(){}};
  const realContext=new Proxy({}, {get:(_,key)=>()=>key==='createLinearGradient'||key==='createRadialGradient'?gradient:undefined});
  const detailCache=createTerrainCache(()=>{
    const canvas={width:0,height:0,getContext:()=>realContext};
    canvases.push(canvas);return canvas;
  });
  const render=view=>{
    detailCache.prepare(state,view,1);
    detailCache.ground(realContext,view,state,()=>{},1);
    detailCache.details(realContext,view,state,0,0,false,()=>{},1);
  };
  render(base);
  assert.equal(canvases.length,2);
  let previous=canvases.slice(-2);
  for (const camera of [{rotation:Math.PI/2,tilt:1},{rotation:Math.PI/2,tilt:.65}]) {
    // Retain scale to prove orientation itself participates in the cache key.
    const view={...base,...camera,th:base.th*camera.tilt};
    render(view);
    assert.ok(previous.every(canvas=>canvas.width===0&&canvas.height===0));
    assert.ok(canvases.slice(-2).every(canvas=>canvas.width>0&&canvas.height>0));
    const count=canvases.length;
    render({...view,ox:view.ox+10,oy:view.oy-20});
    assert.equal(canvases.length,count,'pan reuses the oriented rasters');
    previous=canvases.slice(-2);
  }
  detailCache.clear();
  assert.ok(canvases.every(canvas=>canvas.width===0&&canvas.height===0));
});
