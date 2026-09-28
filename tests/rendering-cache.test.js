import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { createView, project, unproject } from '../src/rendering/projection.js';
import { drawBattlefield, getBattlefieldData } from '../src/rendering/battlefield.js';
import { createTerrainCache, renderPixelRatio } from '../src/rendering/cache.js';

// Count drawing work without presenting timings as real browser/GPU performance.
function recordingContext(counts) {
  return new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        counts.calls++;
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          counts.gradients++;
          return { addColorStop() {} };
        }
        if (key === 'measureText') return { width: String(args[0]).length * 8 };
      };
    },
  });
}
function harness() {
  const counts={calls:0,gradients:0},canvases=[];
  const ctx=recordingContext(counts);
  const cache=createTerrainCache(()=>{
    const canvas={width:0,height:0,getContext:()=>recordingContext(counts)};
    canvases.push(canvas);return canvas;
  });
  return {counts,ctx,cache,canvases};
}

test('panning reuses terrain rasters and substantially reduces drawing commands',()=>{
  for(const id of ['mountain-pass','forest-corridor','lake-crossroads']){
    const game=initialGame(id),view=createView(game,1440,1080),dpr=renderPixelRatio(1440,1080,2);
    const {ctx,cache,counts,canvases}=harness();
    drawBattlefield(ctx,view,game,{cache,dpr});
    const ground=canvases[0];
    counts.calls=counts.gradients=0;
    const panned={...view,ox:view.ox+12,oy:view.oy+7};
    drawBattlefield(ctx,panned,game,{cache,dpr});
    const cached={...counts};
    counts.calls=counts.gradients=0;
    drawBattlefield(ctx,panned,game);
    assert.ok(cached.calls<counts.calls*.6,`${id}: ${cached.calls} cached vs ${counts.calls} uncached commands`);
    assert.ok(cached.gradients<counts.gradients*.75,`${id}: ${cached.gradients} cached vs ${counts.gradients} gradients`);
    assert.equal(canvases.length,2);
    assert.ok(ground.width>0,'pan must retain the original ground raster');
    const cell=project(panned,16.5,3.5);
    assert.deepEqual(unproject(panned,cell.x,cell.y),{x:16,y:3});
    cache.clear();
  }
});

test('terrain cache follows fog, zoom and deployment, and releases backing stores',()=>{
  const {ctx,cache,canvases}=harness();
  const game=initialGame(),view=createView(game,1000,720);
  drawBattlefield(ctx,view,game,{cache});
  const first=canvases[0];
  const selected=gameReducer(game,{type:'SELECT',id:2});
  drawBattlefield(ctx,view,selected,{cache});
  assert.equal(canvases.length,2,'selection alone must not redraw terrain');
  const visible=structuredClone(selected);visible.fog[0][0]=!visible.fog[0][0];
  drawBattlefield(ctx,view,visible,{cache});
  assert.equal(first.width,0,'fog change releases stale raster');
  const beforeZoom=canvases.at(-2);
  drawBattlefield(ctx,createView(visible,1000,720,2.8),visible,{cache});
  assert.equal(beforeZoom.width,0);
  const next=initialGame('forest-corridor');
  drawBattlefield(ctx,createView(next,1000,720),next,{cache});
  assert.equal(canvases.filter(canvas=>canvas.width>0).length,2);
  assert.ok(canvases.reduce((sum,c)=>sum+c.width*c.height,0)<8_210_000);
  cache.clear();
  assert.ok(canvases.every(canvas=>canvas.width===0&&canvas.height===0));
});

test('range cache updates for actions, selection, undo and preview mode',()=>{
  const game=initialGame(),first=getBattlefieldData(game);
  assert.equal(first,getBattlefieldData(game));
  assert.ok(first.moves.size>0);
  assert.equal(getBattlefieldData(game,true).moves.size,0);
  const moved=gameReducer(game,{type:'CELL',x:16,y:3});
  assert.notEqual(getBattlefieldData(moved),first);
  assert.equal(getBattlefieldData(moved).moves.size,0);
  const undo=gameReducer(moved,{type:'UNDO'});
  assert.deepEqual([...getBattlefieldData(undo).moves.keys()],[...first.moves.keys()]);
  const selected=gameReducer(game,{type:'SELECT',id:6});
  assert.equal(getBattlefieldData(selected).selected.id,6);
});

test('Retina pixel budget preserves normal displays and bounds large backing stores',()=>{
  assert.equal(renderPixelRatio(1000,720,1),1);
  assert.equal(renderPixelRatio(1000,720,2),2);
  for(const [width,height] of [[1440,1080],[2560,1440],[3840,2160]]){
    const ratio=renderPixelRatio(width,height,3);
    assert.ok(width*height*ratio*ratio<=4_000_001);
    assert.ok(ratio>0);
  }
});
