import { VEHICLE_SCALE } from './projection.js';
import { createPainter } from './primitives.js';
import { drawVehicleModel } from './vehicles.js';
import { createTerrainRenderer } from './terrain.js';
import { combatMotion, vehicleKick, drawCombat } from './combat.js';
import { reachable, unitAt, inFireRange, distance, onMap } from '../game/engine.js';

export function drawBattlefield(ctx,view,state,{hover=null,effects=[],now=performance.now(),reducedMotion=false,preview=false}={}) {
  const painter=createPainter(ctx,view),{p,polygon,tile,line,scale}=painter;
  const terrain=createTerrainRenderer(painter,state);
  function vehicle(u) {
    const {x,y}=u,blue=u.team==='blue',center=p(x+.5,y+.5);
    const kick=vehicleKick(u,effects,view,now,reducedMotion);
    ctx.save();ctx.translate(kick.x,kick.y);ctx.translate(center.x,center.y);ctx.scale(VEHICLE_SCALE,VEHICLE_SCALE);ctx.translate(-center.x,-center.y);
    drawVehicleModel(painter,u);
    ctx.restore();
    if(preview)return;
    const hp=p(x+.5,y+.5,38*VEHICLE_SCALE),w=25*scale;
    ctx.save();
    const glow=ctx.createRadialGradient(hp.x,hp.y-7*scale,0,hp.x,hp.y-7*scale,22*scale);
    glow.addColorStop(0,blue?'#168fffbb':'#ff302dbb');glow.addColorStop(1,blue?'#168fff00':'#ff302d00');
    ctx.fillStyle=glow;ctx.fillRect(hp.x-24*scale,hp.y-24*scale,48*scale,36*scale);
    ctx.font=`900 ${Math.max(10,13*scale)}px system-ui`;ctx.textAlign='center';
    ctx.lineJoin='round';ctx.strokeStyle='#251e26';ctx.lineWidth=3*scale;
    ctx.strokeText(String(u.hp),hp.x,hp.y-3*scale);ctx.fillStyle='#fff8e7';ctx.fillText(String(u.hp),hp.x,hp.y-3*scale);
    ctx.fillStyle='#332b26';ctx.fillRect(hp.x-w/2-1,hp.y,w+2,4*scale);
    ctx.fillStyle=blue?'#69d6ff':'#ff876b';ctx.fillRect(hp.x-w/2,hp.y+scale,w*u.hp/u.maxHp,2*scale);
    ctx.font=`700 ${Math.max(8,8*scale)}px system-ui`;
    ctx.strokeText(blue?String(u.id).padStart(2,'0'):'敌',center.x,center.y+15*scale);
    ctx.fillText(blue?String(u.id).padStart(2,'0'):'敌',center.x,center.y+15*scale);
    if(u.moved&&u.fired&&blue){ctx.fillStyle='#fff1b0';ctx.fillText('✓',hp.x+19*scale,hp.y+3*scale);}
    ctx.restore();
  }
  ctx.clearRect(0,0,view.width,view.height);
  ctx.save();
  const shake=combatMotion(effects,now,reducedMotion);ctx.translate(shake.x,shake.y);
  const selected=preview?null:state.units.find(u=>u.id===state.selectedId&&u.hp>0);
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

  // Raised terrain cutaway with layered earth.
  ctx.save();
  ctx.shadowColor='#00000080';ctx.shadowBlur=24*scale;ctx.shadowOffsetY=14*scale;
  ctx.beginPath();
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    if(!onMap(state,x,y))continue;
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>p(a,b,-22));
    corners.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
    ctx.closePath();
  }
  ctx.fillStyle='#101812';ctx.fill();
  ctx.restore();
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    if(!onMap(state,x,y))continue;
    for(const [dx,dy,a,b] of [[1,0,[x+1,y],[x+1,y+1]],[0,-1,[x,y],[x+1,y]],[0,1,[x+1,y+1],[x,y+1]]]) {
      if(onMap(state,x+dx,y+dy))continue;
      polygon([p(...a),p(...b),p(...b,-22),p(...a,-22)],dx?'#6d7150':'#4c563e');
      for(const z of [-7,-14,-21])line(p(...a,z),p(...b,z),'#25362b88',.8);
      line(p(...a),p(...b),'#bace91',1.7);
    }
  }
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    const t=state.terrain[y][x];if(t<0)continue;
    const hidden=state.fog[y][x];
    terrain.ground(x,y,hidden);
    const cellKey=`${x},${y}`;
    if(moves.has(cellKey))tile(x,y,'#b1e9ef16',null,0,.3);
    if(fire.has(cellKey))tile(x,y,'#ffc69f12',null,0,.4);
    if(repair.has(cellKey))tile(x,y,'#b5e7c81c',null,0,.4);
    const inspected=unitAt(state,x,y);
    if(!preview&&!hidden&&inspected?.team==='red'&&inspected.id===state.inspectedId)tile(x,y,'#e5957335','#f5ae87',.04,.5);
    if(selected?.x===x&&selected?.y===y)tile(x,y,'#e5f3c135','#f5efab',.04,.5);
    if(hover?.x===x&&hover?.y===y)tile(x,y,'#edf7d429','#e9ecc6',.02,.6);
  }
  const objectives=state.mission?.points||(state.mission?.point?[state.mission.point]:[]);
  for(const [index,point] of objectives.entries()){
    const secured=state.missionProgress?.captured?.[index];
    tile(point.x,point.y,secured?'#a8deb944':'#f9d57744',secured?'#bcecd0':'#ffe7a3',.1,1,2);
  }
  outline(moves,'#a8dbe6');
  outline(fire,'#eec39e',true);
  outline(repair,'#b5e7c8');
  // Ghost a planned route without querying or drawing unknown enemy positions.
  const route=hover&&moves.get(`${hover.x},${hover.y}`);
  if(route&&selected){let last=selected;for(const cell of route){line(p(last.x+.5,last.y+.5,2),p(cell.x+.5,cell.y+.5,2),'#e1edb8',2);last=cell;}}
  for(let x=0;x<state.cols;x++)for(let y=0;y<state.rows;y++) {
    if(!onMap(state,x,y))continue;
    const hidden=state.fog[y][x];
    terrain.details(x,y,hidden);
    const u=unitAt(state,x,y);if(u&&(u.team==='blue'||!hidden))vehicle(u);
  }
  if(!preview)for(const landmark of state.landmarks){const v=p(landmark.x+.5,landmark.y+.5,10);ctx.font=`${Math.max(9,10*scale)}px sans-serif`;ctx.textAlign='center';const w=ctx.measureText(landmark.label).width+15;ctx.fillStyle='#38291fe8';ctx.fillRect(v.x-w/2,v.y-9,w,17);ctx.fillStyle='#ffe6ae';ctx.fillText(landmark.label,v.x,v.y+3);}
  drawCombat(ctx,view,effects,now,reducedMotion);
  ctx.restore();
}
