import { project } from './projection.js';
import { renderPixelRatio } from './cache.js';
import { hexCorners } from '../game/hex.js';

const TILE = 256;
export const FOG_FRAME_INTERVAL = 1000 / 12;

// The mask depends on visibility and zoom, not camera position or cloud time.
export function createFogRenderer(makeCanvas = () => document.createElement('canvas')) {
  let key, mask, texture, pattern, patternContext;
  const release = canvas => { if (canvas) { canvas.width=0;canvas.height=0; } };
  function clouds() {
    if (texture) return;
    texture=makeCanvas();texture.width=texture.height=TILE;
    const ctx=texture.getContext('2d');
    // Tileable, deterministic mist. Generated once; no per-frame blur or noise.
    for(let i=0;i<24;i++) {
      const x=(i*97)%TILE,y=(i*61)%TILE,r=35+(i*17)%48;
      for(const dx of [-TILE,0,TILE])for(const dy of [-TILE,0,TILE]) {
        const cx=x+dx,cy=y+dy;
        if(cx+r<0||cy+r<0||cx-r>TILE||cy-r>TILE)continue;
        const gradient=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
        gradient.addColorStop(0,'#91a3ad38');gradient.addColorStop(1,'#91a3ad00');
        ctx.fillStyle=gradient;ctx.fillRect(cx-r,cy-r,r*2,r*2);
      }
    }
  }
  return {
    prepare(state,view) {
      const next=`${view.scale}:${state.cols}:${state.rows}:${JSON.stringify(state.terrain)}:${JSON.stringify(state.fog)}`;
      if(next===key)return Boolean(mask);
      release(mask?.canvas);mask=null;key=next;
      const origin={...view,ox:0,oy:0},cells=[];
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
        if(state.terrain[y][x]<0||!state.fog[y][x])continue;
        const corners=hexCorners(x,y).map(([a,b])=>project(origin,a,b));
        cells.push(corners);
        for(const p of corners){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}
      }
      if(!cells.length)return false;
      const padding=32*view.scale;
      left-=padding;top-=padding;right+=padding;bottom+=padding;
      const ratio=renderPixelRatio(right-left,bottom-top,1,1_200_000);
      const canvas=makeCanvas();canvas.width=Math.ceil((right-left)*ratio);canvas.height=Math.ceil((bottom-top)*ratio);
      const ctx=canvas.getContext('2d');
      ctx.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);
      ctx.beginPath();
      for(const corners of cells){corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
      ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=14*view.scale*ratio;ctx.fill();
      mask={canvas,left,top,width:canvas.width/ratio,height:canvas.height/ratio};
      return true;
    },
    draw(ctx,view,now=0) {
      ctx.clearRect(0,0,view.width,view.height);
      if(!mask)return;
      clouds();
      if(!pattern||patternContext!==ctx){pattern=ctx.createPattern(texture,'repeat');patternContext=ctx;}
      ctx.save();
      ctx.fillStyle='#172630a6';ctx.fillRect(0,0,view.width,view.height);
      for(const [scale,speed,alpha] of [[1.65,.006,.7],[2.7,-.003,.35]]) {
        ctx.save();ctx.globalAlpha=alpha;
        const dx=view.ox+now*speed,dy=view.oy+now*speed*.35;
        ctx.translate(dx,dy);ctx.scale(scale,scale);ctx.fillStyle=pattern;
        ctx.fillRect(-dx/scale,-dy/scale,view.width/scale,view.height/scale);
        ctx.restore();
      }
      ctx.globalCompositeOperation='destination-in';
      ctx.drawImage(mask.canvas,view.ox+mask.left,view.oy+mask.top,mask.width,mask.height);
      ctx.restore();
    },
    clear() {
      release(mask?.canvas);release(texture);
      key=mask=texture=pattern=patternContext=null;
    },
  };
}
