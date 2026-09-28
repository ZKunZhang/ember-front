import { createPainter } from './primitives.js';
import { createTerrainRenderer } from './terrain.js';

// Bound backing-store memory on Retina displays without changing CSS coordinates.
export function renderPixelRatio(width, height, deviceRatio = 1, budget = 4_000_000) {
  return Math.min(deviceRatio, 2, Math.sqrt(budget / Math.max(1, width * height)));
}

// One ground bitmap and one packed detail atlas; no persistent canvas per tile.
export function createTerrainCache(makeCanvas = () => document.createElement('canvas')) {
  let key, ground, atlas, atlasContext, sprites = new Map(), cursorX = 0, cursorY = 0, rowHeight = 0;
  const release = canvas => { if (canvas) { canvas.width = 0; canvas.height = 0; } };
  const clear = () => {
    release(ground?.canvas); release(atlas);
    ground = atlas = atlasContext = null;
    sprites.clear();cursorX = cursorY = rowHeight = 0;key = undefined;
  };
  return {
    clear,
    prepare(state, view, dpr) {
      const next = `${view.scale}:${dpr}:${state.cols}:${state.rows}:${JSON.stringify(state.terrain)}:${JSON.stringify(state.fog)}`;
      if (next !== key) { clear();key = next; }
    },
    ground(ctx, view, state, draw, dpr) {
      if (!ground) {
        const origin = { ...view, ox: 0, oy: 0 }, { p } = createPainter(ctx, origin);
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
          if (state.terrain[y][x] < 0) continue;
          for (const [a, b] of [[x,y],[x+1,y],[x+1,y+1],[x,y+1]]) {
            const point = p(a,b);
            left=Math.min(left,point.x);right=Math.max(right,point.x);
            top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);
          }
        }
        if (!Number.isFinite(left)) return;
        const padding = 80 * view.scale;
        left -= padding;top -= padding;right += padding;bottom += padding;
        const width = right-left, height = bottom-top;
        const ratio = renderPixelRatio(width,height,dpr);
        const canvas = makeCanvas();canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
        const target = canvas.getContext('2d');
        target.setTransform(ratio,0,0,ratio,0,0);
        draw(target,{...origin,ox:-left,oy:-top},state);
        ground={canvas,left,top,width:canvas.width/ratio,height:canvas.height/ratio};
      }
      ctx.drawImage(ground.canvas,view.ox+ground.left,view.oy+ground.top,ground.width,ground.height);
    },
    details(ctx, view, state, x, y, hidden, draw, dpr) {
      if (![1,2,3].includes(state.terrain[y][x])) return;
      const { p } = createPainter(ctx,view);
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>p(a,b));
      const left=Math.min(...corners.map(p=>p.x))-14*view.scale;
      const top=Math.min(...corners.map(p=>p.y))-60*view.scale;
      const width=Math.max(...corners.map(p=>p.x))-left+14*view.scale;
      const height=Math.max(...corners.map(p=>p.y))-top+14*view.scale;
      // Skip offscreen scenery before allocating or drawing it.
      if(left>view.width+8||top>view.height+8||left+width< -8||top+height< -8)return;
      const id=`${x},${y}`;
      let sprite=sprites.get(id);
      if(!sprite){
        const w=Math.ceil(width*dpr)+2,h=Math.ceil(height*dpr)+2;
        if(w>2048||h>2048){draw(x,y,hidden);return;}
        if(!atlas){atlas=makeCanvas();atlas.width=atlas.height=2048;atlasContext=atlas.getContext('2d');}
        if(cursorX+w>2048){cursorX=0;cursorY+=rowHeight;rowHeight=0;}
        // A full atlas falls back to direct rendering, never grows without bounds.
        if(cursorY+h>2048){draw(x,y,hidden);return;}
        sprite={x:cursorX,y:cursorY,w,h};cursorX+=w;rowHeight=Math.max(rowHeight,h);
        atlasContext.save();
        atlasContext.setTransform(1,0,0,1,0,0);
        atlasContext.beginPath();atlasContext.rect(sprite.x,sprite.y,w,h);atlasContext.clip();
        atlasContext.setTransform(dpr,0,0,dpr,sprite.x+1,sprite.y+1);
        const painter=createPainter(atlasContext,{...view,ox:view.ox-left,oy:view.oy-top});
        createTerrainRenderer(painter,state).details(x,y,hidden);
        atlasContext.restore();sprites.set(id,sprite);
      }
      ctx.drawImage(atlas,sprite.x,sprite.y,sprite.w,sprite.h,left-1/dpr,top-1/dpr,sprite.w/dpr,sprite.h/dpr);
    },
  };
}
