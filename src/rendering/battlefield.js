import { project } from './projection.js';
import { reachable, unitAt, inFireRange, distance, onMap } from '../game/engine.js';

export function drawBattlefield(ctx,view,state,{hover=null,effect=null,now=performance.now()}={}) {
  const p=(x,y,z=0)=>project(view,x,y,z),scale=view.scale;
  function polygon(points,fill,stroke) {
    ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}
  }
  function tile(x,y,fill,stroke,inset=0,z=0) {
    polygon([[x+inset,y+inset],[x+1-inset,y+inset],[x+1-inset,y+1-inset],[x+inset,y+1-inset]].map(([a,b])=>p(a,b,z)),fill,stroke);
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
    const wide=u.type==='heavyTank',scout=u.type==='scout';
    box(x+.13,y+.15,.74,.17,5,'#3a463d','#23332a','#17251d',1);
    box(x+.13,y+.69,.74,.17,5,'#3a463d','#23332a','#17251d',1);
    box(x+(scout?.22:.12),y+.25,scout?.55:.76,.5,wide?12:8,top,side,dark,4);
    if(u.type==='rocket') {
      box(x+.24,y+.29,.5,.42,10,light,side,top,13);
      for(let i=0;i<3;i++) box(x+.08,y+.31+i*.13,.63,.08,3,'#d1c7a0',dark,side,24);
    } else if(u.type==='engineer') {
      box(x+.12,y+.3,.3,.38,9,light,side,top,12);
      box(x+.55,y+.34,.25,.3,5,top,side,dark,12);
      const a=p(x+.28,y+.48,23);ctx.fillStyle='#d5e3b4';ctx.fillRect(a.x-4*scale,a.y-1*scale,8*scale,2*scale);ctx.fillRect(a.x-scale,a.y-4*scale,2*scale,8*scale);
    } else {
      box(x+.3,y+.32,wide?.43:.32,.33,scout?5:8,light,side,top,wide?17:12);
      const length=u.type==='artillery'?.72:scout?.25:wide?.58:.48;
      box(x+(blue?.4-length:.55),y+.43,length,scout?.07:.11,scout?2:4,light,side,dark,wide?25:scout?18:21);
      if(wide)box(x+.38,y+.39,.12,.13,3,top,side,dark,26);
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
  const moves=selected&&!selected.moved&&state.mode==='move'&&state.turn==='blue'?reachable(state,selected):new Map();
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
    if(moves.has(`${x},${y}`))tile(x,y,'#cff89330','#c3e49a',.055,.3);
    if(selected&&state.mode==='attack'&&!selected.fired&&inFireRange(state,selected,{x,y}))tile(x,y,'#d8936824','#d9a38370',.09,.4);
    if(selected&&state.mode==='repair'&&distance(selected,{x,y})===1)tile(x,y,'#83dcb73d','#98efc4',.06,.4);
    if(selected?.x===x&&selected?.y===y)tile(x,y,'#e5f3c135','#f5efab',.04,.5);
    if(hover?.x===x&&hover?.y===y)tile(x,y,'#edf7d429','#e9ecc6',.02,.6);
  }
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
