import { rangeContours, roundedPath } from './contours.js';
import { movementPosition, vehicleMotion } from '../game/movement.js';
import { VEHICLE_SCALE } from './projection.js';
import { createPainter } from './primitives.js';
import { drawVehicleModel } from './vehicles.js';
import { createTerrainRenderer } from './terrain.js';
import { combatMotion, vehicleKick, drawCombat } from './combat.js';
import { reachable, inFireRange, distance, onMap } from '../game/engine.js';

const dataCache = new WeakMap();
export function getBattlefieldData(state,preview=false) {
  let variants=dataCache.get(state);
  if(!variants){variants=new Map();dataCache.set(state,variants);}
  if(variants.has(preview))return variants.get(preview);
  const selected=preview?null:state.units.find(u=>u.id===state.selectedId&&u.hp>0);
  const canShowRanges=selected&&selected.team==='blue'&&state.turn==='blue'&&!state.winner&&state.mode!=='repair';
  const moves=canShowRanges&&!selected.moved?reachable(state,selected):new Map();
  const fire=new Set(),repair=new Set();
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++)if(onMap(state,x,y)){
    if(canShowRanges&&!selected.fired&&inFireRange(state,selected,{x,y}))fire.add(`${x},${y}`);
    if(selected&&state.turn==='blue'&&!state.winner&&state.mode==='repair'&&!selected.fired&&distance(selected,{x,y})===1)repair.add(`${x},${y}`);
  }
  const units=new Map(),wrecks=new Map();
  for(const unit of state.units){
    const key=`${unit.x},${unit.y}`;
    if(unit.hp>0)units.set(key,unit);
    else wrecks.set(key,(wrecks.get(key)||0)+1);
  }
  const data={selected,moves,fire,repair,units,wrecks,moveContours:rangeContours(moves),fireContours:rangeContours(fire),repairContours:rangeContours(repair)};
  variants.set(preview,data);return data;
}

function drawTerrainGround(ctx,view,state) {
  const painter=createPainter(ctx,view),{p,polygon,line,scale}=painter;
  const terrain=createTerrainRenderer(painter,state);
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
      polygon([p(...a),p(...b),p(...b,-22),p(...a,-22)],dx?'#655b48':'#484638');
      for(const z of [-7,-14,-21])line(p(...a,z),p(...b,z),'#25362b88',.8);
      line(p(...a),p(...b),'#a79974',1.7);
    }
  }
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    if(state.terrain[y][x]>=0)terrain.ground(x,y,state.fog[y][x]);
  }
}

export function drawBattlefield(ctx,view,state,{hover=null,effects=[],now=performance.now(),reducedMotion=false,preview=false,cache=null,dpr=1,movements=[]}={}) {
  const painter=createPainter(ctx,view),{p,polygon,tile,line,scale}=painter;
  const terrain=createTerrainRenderer(painter,state);
  function vehicle(u) {
    const {x,y}=u,blue=u.team==='blue',center=p(x+.5,y+.5);
    const kick=vehicleKick(u,effects,view,now,reducedMotion);
    ctx.save();ctx.translate(kick.x,kick.y);ctx.translate(center.x,center.y);ctx.scale(VEHICLE_SCALE,VEHICLE_SCALE);ctx.translate(-center.x,-center.y);
    const motion=vehicleMotion(u,movements,now,reducedMotion);
    if(motion.active){
      for(let i=0;i<6;i++){
        const age=(motion.dustPhase+i/6)%1;
        const dust=p(x+.5-motion.dx*(.2+age*.5),y+.5-motion.dy*(.2+age*.5));
        ctx.fillStyle=`rgba(180,157,119,${(1-age)*.3})`;
        ctx.beginPath();ctx.ellipse(dust.x+((i%3)-1)*4*scale,dust.y-age*3*scale,(3+age*8)*scale,(1+age*3)*scale,0,0,Math.PI*2);ctx.fill();
      }
    }
    drawVehicleModel(painter,u,motion);
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
  if(!preview){
    const sky=ctx.createLinearGradient(0,0,view.width,view.height);
    sky.addColorStop(0,'#343b3e');sky.addColorStop(.48,'#48483e');sky.addColorStop(1,'#171e24');
    ctx.fillStyle=sky;ctx.fillRect(0,0,view.width,view.height);
    const haze=ctx.createRadialGradient(view.width*.28,view.height*.18,0,view.width*.28,view.height*.18,view.width*.7);
    haze.addColorStop(0,'#cbb58c26');haze.addColorStop(1,'#a0927700');
    ctx.fillStyle=haze;ctx.fillRect(0,0,view.width,view.height);
  }
  ctx.save();
  const shake=combatMotion(effects,now,reducedMotion);ctx.translate(shake.x,shake.y);
  const {selected,moves,units,wrecks,moveContours,fireContours,repairContours}=getBattlefieldData(state,preview);
  function area(contours,color,fill,dashed=false) {
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dashed?[5*scale,5*scale]:[]);
    ctx.beginPath();
    for(const contour of contours)roundedPath(ctx,contour.map(([x,y])=>p(x,y,.5)),5*scale);
    ctx.fillStyle=fill;ctx.fill('evenodd');ctx.strokeStyle=color;ctx.lineWidth=1.4*scale;ctx.stroke();ctx.restore();
  }
  function marker(x,y,color,fill) {
    const center=p(x+.5,y+.5,1),radius=Math.abs(p(x+.5,y+1).x-p(x+.5,y).x)*.42;
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(1,view.th*.43/radius);
    const glow=ctx.createRadialGradient(0,0,radius*.25,0,0,radius*1.25);
    glow.addColorStop(0,fill);glow.addColorStop(.7,fill);glow.addColorStop(1,'#0000');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius*1.25,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=1.3*scale;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
  }

  if(cache){
    cache.prepare(state,view,dpr);
    cache.ground(ctx,view,state,drawTerrainGround,dpr);
  }else drawTerrainGround(ctx,view,state);
  area(moveContours,'#a8dbe6bb','#b1e9ef14');
  area(fireContours,'#eec39eaa','#ffc69f0c',true);
  area(repairContours,'#b5e7c8bb','#b5e7c816');
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    const t=state.terrain[y][x];if(t<0)continue;
    const hidden=state.fog[y][x];

    const cellKey=`${x},${y}`;
    const inspected=units.get(cellKey);
    if(!preview&&!hidden&&inspected?.team==='red'&&inspected.id===state.inspectedId)marker(x,y,'#ed997c','#df876d22');
    if(selected?.x===x&&selected?.y===y)marker(x,y,'#bde6ee','#8bd4e528');
    if(hover?.x===x&&hover?.y===y)marker(x,y,'#e5dfc9a0','#e5dfc914');
  }
  const objectives=state.mission?.points||(state.mission?.point?[state.mission.point]:[]);
  for(const [index,point] of objectives.entries()){
    const secured=state.missionProgress?.captured?.[index];
    marker(point.x,point.y,secured?'#bcecd0':'#ffe7a3',secured?'#a8deb92c':'#f9d5772c');
  }
  // Ghost a planned route without querying or drawing unknown enemy positions.
  const route=hover&&moves.get(`${hover.x},${hover.y}`);
  if(route&&selected){ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();roundedPath(ctx,[selected,...route].map(cell=>p(cell.x+.5,cell.y+.5,2)),6*scale,false);ctx.strokeStyle='#dce8bdba';ctx.lineWidth=2*scale;ctx.stroke();ctx.restore();}
  const movingIds=new Set(),movingCells=new Map();
  for(const movement of movements){
    const unit=state.units.find(u=>u.id===movement.unitId&&u.hp>0);
    if(!unit||reducedMotion)continue;
    const position=movementPosition(unit,movements,now);
    const x=Math.floor(position.x),y=Math.floor(position.y);
    movingIds.add(unit.id);
    if(unit.team==='red'&&state.fog[y]?.[x])continue;
    const key=`${x},${y}`;
    if(!movingCells.has(key))movingCells.set(key,[]);
    movingCells.get(key).push(position);
  }
  for(let x=0;x<state.cols;x++)for(let y=0;y<state.rows;y++) {
    if(!onMap(state,x,y))continue;
    const hidden=state.fog[y][x];
    if(cache)cache.details(ctx,view,state,x,y,hidden,terrain.details,dpr);
    else terrain.details(x,y,hidden);
    if(!preview&&!hidden){
      for(let i=0;i<(wrecks.get(`${x},${y}`)||0);i++){
        const center=p(x+.5,y+.5);
        ctx.save();
        ctx.fillStyle='#181b1bcc';ctx.beginPath();ctx.ellipse(center.x,center.y,17*scale,8*scale,0,0,Math.PI*2);ctx.fill();
        polygon([p(x+.24,y+.28,3),p(x+.7,y+.24,5),p(x+.78,y+.72,3),p(x+.3,y+.74,7)],'#363431','#171d20',1);
        line(p(x+.4,y+.5,9),p(x+.1,y+.63,6),'#252b2b',3);
        for(let i=0;i<5;i++){
          const sx=center.x+(i*2-3)*scale,sy=center.y-(12+i*8)*scale,r=(5+i*2)*scale;
          const smoke=ctx.createRadialGradient(sx,sy,0,sx,sy,r);
          smoke.addColorStop(0,'#22282b60');smoke.addColorStop(1,'#22282b00');
          ctx.fillStyle=smoke;ctx.fillRect(sx-r,sy-r,r*2,r*2);
        }
        ctx.fillStyle='#db773e';ctx.fillRect(center.x-3*scale,center.y-5*scale,3*scale,2*scale);
        ctx.restore();
      }
    }
    const u=units.get(`${x},${y}`);if(u&&!movingIds.has(u.id)&&(u.team==='blue'||!hidden))vehicle(u);
    for(const moving of movingCells.get(`${x},${y}`)||[])vehicle(moving);
  }
  if(!preview)for(const landmark of state.landmarks){const v=p(landmark.x+.5,landmark.y+.5,10);ctx.font=`${Math.max(9,10*scale)}px sans-serif`;ctx.textAlign='center';const w=ctx.measureText(landmark.label).width+15;ctx.fillStyle='#38291fe8';ctx.fillRect(v.x-w/2,v.y-9,w,17);ctx.fillStyle='#ffe6ae';ctx.fillText(landmark.label,v.x,v.y+3);}
  drawCombat(ctx,view,effects,now,reducedMotion);
  ctx.restore();
  if(!preview){
    ctx.save();
    const vignette=ctx.createRadialGradient(view.width*.48,view.height*.48,Math.min(view.width,view.height)*.22,view.width*.5,view.height*.5,Math.max(view.width,view.height)*.68);
    vignette.addColorStop(0,'#10171e00');vignette.addColorStop(1,'#0b111b96');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,view.width,view.height);
    ctx.restore();
  }
}
