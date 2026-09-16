import { project } from './projection.js';
import { reachable, unitAt, inFireRange, distance, onMap } from '../game/engine.js';

export function drawBattlefield(ctx,view,state,{hover=null,effect=null,now=performance.now()}={}) {
  const p=(x,y,z=0)=>project(view,x,y,z),scale=view.scale;
  function polygon(points,fill,stroke,width=.7) {
    ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width*scale;ctx.stroke();}
  }
  function tile(x,y,fill,stroke,inset=0,z=0,width=.7) {
    polygon([[x+inset,y+inset],[x+1-inset,y+inset],[x+1-inset,y+1-inset],[x+inset,y+1-inset]].map(([a,b])=>p(a,b,z)),fill,stroke,width);
  }
  function box(x,y,w,d,h,top,left,right,z=0) {
    const a=p(x,y,z+h),b=p(x+w,y,z+h),c=p(x+w,y+d,z+h),e=p(x,y+d,z+h);
    polygon([e,c,p(x+w,y+d,z),p(x,y+d,z)],left);
    polygon([b,c,p(x+w,y+d,z),p(x+w,y,z)],right);polygon([a,b,c,e],top);
  }
  function line(a,b,color,width=1) {ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width*scale;ctx.stroke();}
  function tree(x,y,height,hidden) {
    const v=p(x,y);line(v,p(x,y,height*.6),hidden?'#303f30':'#555240',3);
    for(let i=0;i<3;i++) {const z=4+i*height*.22,w=(height*.26-i*1.7)*scale;
      polygon([{x:v.x-w,y:v.y-z*scale},p(x,y,z+height*.5),{x:v.x+w,y:v.y-z*scale}],hidden?'#334536':['#425a3b','#516b43','#607b4c'][i]);
      polygon([p(x,y,z),p(x,y,z+height*.5),{x:v.x+w,y:v.y-z*scale}],hidden?'#29392f':'#394f35');
    }
  }
  function mountain(x,y,hidden) {
    const height=30+(x*7+y*3)%14,peak=p(x+.48,y+.48,height);
    polygon([p(x+.02,y+.97),p(x+.98,y+.97),peak],hidden?'#48513f':'#93917a');
    polygon([p(x+.98,y+.97),p(x+.98,y+.04),peak],hidden?'#354131':'#68715b');
    polygon([p(x+.02,y+.97),p(x+.04,y+.04),p(x+.98,y+.04),peak],hidden?'#525946':'#a3a08a');
    polygon([peak,p(x+.28,y+.63,height*.6),p(x+.67,y+.68,height*.54)],hidden?'#626650':'#c5bfa3');
  }
  function vehicle(u) {
    const {x,y}=u,blue=u.team==='blue',top=blue?'#94b4ab':'#c17e67',light=blue?'#c4d4bd':'#e7b19a',side=blue?'#506d63':'#815645',dark=blue?'#334c41':'#5e4236';
    const center=p(x+.5,y+.5);ctx.fillStyle='#090f0d65';ctx.beginPath();ctx.ellipse(center.x,center.y+3*scale,18*scale,7*scale,0,0,Math.PI*2);ctx.fill();
    const track=(left=.13,width=.74)=>{
      box(x+left,y+.15,width,.16,5,'#3a463d','#23332a','#17251d',1);
      box(x+left,y+.69,width,.16,5,'#3a463d','#23332a','#17251d',1);
    };
    if(u.type==='scout') {
      // A low wheeled hull with a tall antenna reads differently from any tracked vehicle.
      box(x+.22,y+.28,.56,.43,5,top,side,dark,4);
      box(x+.35,y+.37,.25,.25,4,light,side,top,9);
      for(const [wx,wy] of [[.27,.31],[.7,.31],[.27,.67],[.7,.67]]){
        const wheel=p(x+wx,y+wy,3);ctx.fillStyle='#17251d';ctx.beginPath();ctx.ellipse(wheel.x,wheel.y,4*scale,2.2*scale,0,0,Math.PI*2);ctx.fill();
      }
      line(p(x+.54,y+.48,13),p(x+.62,y+.39,25),light,1.2);
      const aerial=p(x+.62,y+.39,25);ctx.fillStyle=light;ctx.beginPath();ctx.arc(aerial.x,aerial.y,1.8*scale,0,Math.PI*2);ctx.fill();
    } else if(u.type==='heavyTank') {
      // Broad, stepped armor and a much heavier gun distinguish the assault tank.
      track(.08,.84);
      box(x+.1,y+.23,.8,.54,12,top,side,dark,4);
      box(x+.18,y+.31,.64,.38,7,light,side,top,16);
      box(x+.32,y+.35,.38,.31,9,top,side,dark,23);
      box(x+.39,y+.43,.12,.13,4,light,side,top,32);
      box(x+(blue?.14:.5),y+.42,.44,.15,5,light,side,dark,29);
    } else if(u.type==='artillery') {
      track(.1,.8);
      box(x+.12,y+.26,.76,.48,8,top,side,dark,4);
      box(x+.3,y+.34,.34,.31,6,light,side,top,13);
      // The exposed elevated barrel makes the artillery silhouette long and diagonal.
      line(p(x+.47,y+.46,20),p(x+.86,y+.17,31),light,3.2);
      line(p(x+.47,y+.46,20),p(x+.86,y+.17,31),dark,1);
    } else if(u.type==='rocket') {
      track(.13,.74);
      box(x+.16,y+.25,.68,.5,8,top,side,dark,4);
      box(x+.22,y+.32,.28,.34,8,light,side,top,13);
      // Four parallel launch tubes form an unmistakable rack above the rear deck.
      for(let i=0;i<4;i++){
        const offset=i*.075;
        line(p(x+.43,y+.31+offset,17),p(x+.78,y+.13+offset,27),'#d1c7a0',2.8);
        line(p(x+.43,y+.31+offset,17),p(x+.78,y+.13+offset,27),dark,.8);
      }
      line(p(x+.4,y+.29,14),p(x+.4,y+.63,14),side,2);
    } else if(u.type==='engineer') {
      track(.13,.74);
      box(x+.12,y+.25,.76,.5,8,top,side,dark,4);
      // A square equipment cabin and raised cross-shaped service arm identify the engineer.
      box(x+.17,y+.31,.34,.36,10,light,side,top,13);
      box(x+.55,y+.34,.25,.3,6,top,side,dark,12);
      const armBase=p(x+.63,y+.49,17),armTip=p(x+.78,y+.32,27);
      line(armBase,armTip,'#d5e3b4',2.3);
      line(p(x+.72,y+.29,27),p(x+.84,y+.41,27),'#d5e3b4',2.3);
      line(p(x+.72,y+.41,27),p(x+.84,y+.29,27),'#d5e3b4',2.3);
    } else {
      // The standard tank keeps the compact turret-and-barrel silhouette as the baseline.
      track();
      box(x+.12,y+.25,.76,.5,8,top,side,dark,4);
      box(x+.3,y+.32,.32,.33,8,light,side,top,12);
      box(x+(blue?.25:.55),y+.43,.48,.11,4,light,side,dark,21);
    }
    const hp=p(x+.5,y+.5,38),w=28*scale;
    ctx.fillStyle='#112319';ctx.fillRect(hp.x-w/2,hp.y,w,3*scale);
    ctx.fillStyle=blue?'#cce2a0':'#ee9c7c';ctx.fillRect(hp.x-w/2,hp.y,w*u.hp/u.maxHp,3*scale);
    ctx.font=`600 ${Math.max(8,9*scale)}px monospace`;ctx.textAlign='center';ctx.fillStyle=blue?'#e2ebcf':'#ffc7ae';
    ctx.fillText(blue?String(u.id).padStart(2,'0'):'敌',center.x,center.y+15*scale);
    if(u.moved&&u.fired&&blue){ctx.fillStyle='#a2b98a';ctx.fillText('✓',hp.x+19*scale,hp.y+3*scale);}
  }
  ctx.clearRect(0,0,view.width,view.height);
  const selected=state.units.find(u=>u.id===state.selectedId&&u.hp>0);
  const canShowRanges=selected&&selected.team==='blue'&&state.turn==='blue'&&!state.winner&&state.mode!=='repair';
  const moves=canShowRanges&&!selected.moved?reachable(state,selected):new Map();
  const fire=new Set(),repair=new Set();
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++)if(onMap(state,x,y)){
    if(canShowRanges&&!selected.fired&&inFireRange(state,selected,{x,y}))fire.add(`${x},${y}`);
    if(selected&&state.turn==='blue'&&!state.winner&&state.mode==='repair'&&!selected.fired&&distance(selected,{x,y})===1)repair.add(`${x},${y}`);
  }
  function outline(cells,color,dashed=false) {
    ctx.save();ctx.setLineDash(dashed?[6*scale,4*scale]:[]);
    for(const key of cells.keys()){
      const [x,y]=key.split(',').map(Number);
      for(const [dx,dy,a,b] of [[0,-1,[x,y],[x+1,y]],[1,0,[x+1,y],[x+1,y+1]],[0,1,[x+1,y+1],[x,y+1]],[-1,0,[x,y+1],[x,y]]]){
        if(!cells.has(`${x+dx},${y+dy}`))line(p(...a,.5),p(...b,.5),color,1.7);
      }
    }
    ctx.restore();
  }

  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    const t=state.terrain[y][x];if(t<0)continue;
    // Draw exposed cliff edges per tile, so the board silhouette follows its mask.
    if(!onMap(state,x+1,y))polygon([p(x+1,y),p(x+1,y+1),p(x+1,y+1,-11),p(x+1,y,-11)],'#414735');
    if(!onMap(state,x,y+1))polygon([p(x,y+1),p(x+1,y+1),p(x+1,y+1,-11),p(x,y+1,-11)],'#2e3b2a');
    const hidden=state.fog[y][x],n=(x*13+y*7)%4;
    const fill=t===4?(hidden?'#263e3e':'#3b686a'):t===3?(hidden?'#535440':'#a39770'):hidden?['#364332','#384736','#344131','#3b4937'][n]:['#728259','#78885e','#7e8d61','#6e7e55'][n];
    tile(x,y,fill,hidden?'#52604435':'#a6b38540');
    if(t===4){line(p(x+.2,y+.5),p(x+.7,y+.5),hidden?'#466360':'#6e9991',.7);}
    if(t===3&&((state.terrain[y]?.[x-1]===4)||(state.terrain[y]?.[x+1]===4))){line(p(x+.06,y+.06),p(x+.06,y+.94),'#cab990',2);line(p(x+.94,y+.06),p(x+.94,y+.94),'#cab990',2);}
    const cellKey=`${x},${y}`;
    if(moves.has(cellKey))tile(x,y,'#b1e9ef16',null,0,.3);
    if(fire.has(cellKey))tile(x,y,'#ffc69f12',null,0,.4);
    if(repair.has(cellKey))tile(x,y,'#b5e7c81c',null,0,.4);
    const inspected=unitAt(state,x,y);
    if(!hidden&&inspected?.team==='red'&&inspected.id===state.inspectedId)tile(x,y,'#e5957335','#f5ae87',.04,.5);
    if(selected?.x===x&&selected?.y===y)tile(x,y,'#e5f3c135','#f5efab',.04,.5);
    if(hover?.x===x&&hover?.y===y)tile(x,y,'#edf7d429','#e9ecc6',.02,.6);
  }
  outline(moves,'#a8dbe6');
  outline(fire,'#eec39e',true);
  outline(repair,'#b5e7c8');
  // Ghost a planned route without querying or drawing unknown enemy positions.
  const route=hover&&moves.get(`${hover.x},${hover.y}`);
  if(route&&selected){let last=selected;for(const cell of route){line(p(last.x+.5,last.y+.5,2),p(cell.x+.5,cell.y+.5,2),'#e1edb8',2);last=cell;}}
  for(let depth=0;depth<state.cols+state.rows-1;depth++)for(let x=0;x<state.cols;x++) {
    const y=depth-x;if(!onMap(state,x,y))continue;
    const hidden=state.fog[y][x],t=state.terrain[y][x];
    if(t===1)mountain(x,y,hidden);
    if(t===2){tree(x+.28,y+.32,28,hidden);tree(x+.7,y+.5,35,hidden);tree(x+.3,y+.8,23,hidden);}
    const u=unitAt(state,x,y);if(u&&(u.team==='blue'||!hidden))vehicle(u);
  }
  for(const landmark of state.landmarks){const v=p(landmark.x+.5,landmark.y+.5,10);ctx.font=`${Math.max(9,10*scale)}px sans-serif`;ctx.textAlign='center';const w=ctx.measureText(landmark.label).width+15;ctx.fillStyle='#132119d9';ctx.fillRect(v.x-w/2,v.y-9,w,17);ctx.fillStyle='#d9d3a6';ctx.fillText(landmark.label,v.x,v.y+3);}
  if(effect){const age=(now-effect.started)/850;if(age>=0&&age<1){const v=p(effect.x+.5,effect.y+.5,18);ctx.globalAlpha=1-age;ctx.strokeStyle=effect.amount>0?'#bcecd0':'#ffd298';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(v.x,v.y,age*33*scale,age*17*scale,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.font=`bold ${Math.max(13,18*scale)}px monospace`;ctx.fillText(`${effect.amount>0?'+':''}${effect.amount}`,v.x,v.y-12-age*30);ctx.globalAlpha=1;}}
}
