import { rangeContours, roundedPath } from './contours.js';
import { movementPosition, vehicleMotion } from '../game/movement.js';
import { VEHICLE_SCALE, tableBounds } from './projection.js';
import { createPainter } from './primitives.js';
import { drawVehicleBase, drawVehicleModel } from './vehicles.js';
import { createTerrainRenderer } from './terrain.js';
import { drawEnvironmentGround, getEnvironmentItems, drawEnvironmentItem } from './environment.js';
import { combatMotion, vehicleKick, drawCombat } from './combat.js';
import { reachable, inFireRange, distance, onMap } from '../game/engine.js';
import { hexCorners, roundHex } from '../game/hex.js';

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
  const protectedCells=new Set(state.mission?.kind==='defend'?state.mission.points.map(point=>`${point.x},${point.y}`):[]);
  const data={selected,moves,fire,repair,units,wrecks,moveContours:rangeContours(moves),fireContours:rangeContours(fire),repairContours:rangeContours(repair),defenseContours:rangeContours(protectedCells)};
  variants.set(preview,data);return data;
}

// A warm wooden toy tray contains the hexes and a continuous painted meadow.
export function drawTabletop(painter,state) {
  const {ctx,p,polygon,line,scale}=painter;
  const outer=tableBounds(state,.75).corners,inner=tableBounds(state,.25).corners;
  const lip=tableBounds(state,.29).corners;
  const lower=outer.map(([x,y])=>p(x,y,-22));
  const top=outer.map(([x,y])=>p(x,y,0));
  ctx.save();
  ctx.shadowColor='#00000070';ctx.shadowBlur=18*scale;ctx.shadowOffsetX=5*scale;ctx.shadowOffsetY=12*scale;
  polygon(lower,'#5e4e38');
  ctx.restore();
  const center=top.reduce((sum,a)=>({x:sum.x+a.x/4,y:sum.y+a.y/4}),{x:0,y:0});
  const edges=top.map((a,i)=>({i,depth:(a.y+top[(i+1)%4].y)/2})).sort((a,b)=>a.depth-b.depth);
  for(const {i} of edges) {
    const j=(i+1)%4,lit=(top[i].x+top[j].x)/2<center.x;
    polygon([top[i],top[j],lower[j],lower[i]],lit?'#b08a56':'#8b6842','#685036',.6);
    for(const z of [-7,-16])line(p(...outer[i],z),p(...outer[j],z),lit?'#e1c38a55':'#674b3433',.65);
  }
  polygon(inner.map(([x,y])=>p(x,y,-3)),'#7f9b66');
  for(let i=0;i<4;i++) {
    const j=(i+1)%4;
    polygon([top[i],top[j],p(...lip[j]),p(...lip[i])],'#c1a06b','#806341',.55);
    polygon([p(...lip[i]),p(...lip[j]),p(...inner[j]),p(...inner[i])],'#e6ce98');
    polygon([p(...inner[i]),p(...inner[j]),p(...inner[j],-3),p(...inner[i],-3)],'#938759');
    const mid={x:(top[i].x+top[j].x)/2,y:(top[i].y+top[j].y)/2};
    line(top[i],top[j],mid.x+mid.y<center.x+center.y?'#f3deb0':'#a18153',1);
    line(p(...inner[i]),p(...inner[j]),'#f7e6bd',.65);
  }
}

function drawTerrainGround(ctx,view,state) {
  const painter=createPainter(ctx,view),terrain=createTerrainRenderer(painter,state);
  drawTabletop(painter,state);
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++) {
    if(state.terrain[y][x]>=0)terrain.ground(x,y,state.fog[y][x]);
  }
}

export function drawBattlefield(ctx,view,state,{hover=null,effects=[],now=performance.now(),reducedMotion=false,preview=false,cache=null,dpr=1,movements=[]}={}) {
  const painter=createPainter(ctx,view),{p,polygon,tile,line,scale}=painter;
  const terrain=createTerrainRenderer(painter,state);
  function vehicle(u) {
    const {x,y}=u,blue=u.team==='blue',center=p(x+.5,y+.5);
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(VEHICLE_SCALE,VEHICLE_SCALE);ctx.translate(-center.x,-center.y);
    drawVehicleBase(painter,u);
    ctx.restore();
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
    sky.addColorStop(0,'#35494b');sky.addColorStop(.48,'#465b4b');sky.addColorStop(1,'#23363d');
    ctx.fillStyle=sky;ctx.fillRect(0,0,view.width,view.height);
    const haze=ctx.createRadialGradient(view.width*.28,view.height*.18,0,view.width*.28,view.height*.18,view.width*.7);
    haze.addColorStop(0,'#e4edc426');haze.addColorStop(1,'#a0927700');
    ctx.fillStyle=haze;ctx.fillRect(0,0,view.width,view.height);
  }
  ctx.save();
  const shake=combatMotion(effects,now,reducedMotion);ctx.translate(shake.x,shake.y);
  const {selected,moves,units,wrecks,moveContours,fireContours,repairContours,defenseContours}=getBattlefieldData(state,preview);
  function area(contours,color,fill,dashed=false) {
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dashed?[5*scale,5*scale]:[]);
    ctx.beginPath();
    for(const contour of contours)roundedPath(ctx,contour.map(([x,y])=>p(x,y,.5)),5*scale);
    ctx.fillStyle=fill;ctx.fill('evenodd');ctx.strokeStyle=color;ctx.lineWidth=1.4*scale;ctx.stroke();ctx.restore();
  }
  function marker(x,y,color,fill) {
    const center=p(x+.5,y+.5,1),corners=hexCorners(x,y).map(([a,b])=>p(a,b));
    const radius=Math.max(1,(Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)))*.4);
    const depth=Math.max(1,(Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y)))*.4);
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(1,depth/radius);
    const glow=ctx.createRadialGradient(0,0,radius*.25,0,0,radius*1.25);
    glow.addColorStop(0,fill);glow.addColorStop(.7,fill);glow.addColorStop(1,'#0000');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius*1.25,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=1.3*scale;
    ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  if(cache){
    cache.prepare(state,view,dpr);
    cache.ground(ctx,view,state,drawTerrainGround,dpr);
  }else drawTerrainGround(ctx,view,state);
  // Draw after the cached ground so feature overlays survive every cache path.
  drawEnvironmentGround(painter,state);
  area(defenseContours,'#ffe4a1ee','#f8d27728');
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
    if(state.mission?.kind==='defend')continue;
    const secured=state.mission?.kind==='breakthrough'
      ? state.units.some(u=>u.team==='blue'&&u.hp>0&&u.x===point.x&&u.y===point.y)
      : state.missionProgress?.captured?.[index];
    marker(point.x,point.y,secured?'#bcecd0':'#ffe7a3',secured?'#a8deb92c':'#f9d5772c');
  }
  if(state.mission?.kind==='escort') {
    const escort=state.units.find(u=>u.team==='blue'&&u.type==='engineer'&&u.hp>0);
    if(escort)marker(escort.x,escort.y,'#ffe7a3','#f9d5772c');
  }
  // Ghost a planned route without querying or drawing unknown enemy positions.
  const route=hover&&moves.get(`${hover.x},${hover.y}`);
  if(route&&selected){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='miter';ctx.beginPath();
    [selected,...route].forEach((cell,i)=>{const point=p(cell.x+.5,cell.y+.5,2);if(i)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y);});
    ctx.strokeStyle='#c6d2a9c9';ctx.lineWidth=1.5*scale;ctx.stroke();ctx.restore();
  }
  const movingIds=new Set(),drawItems=[];
  for(const movement of movements){
    const unit=state.units.find(u=>u.id===movement.unitId&&u.hp>0);
    if(!unit||reducedMotion)continue;
    const position=movementPosition(unit,movements,now);
    const {x,y}=roundHex(position.x,position.y);
    movingIds.add(unit.id);
    if(unit.team==='red'&&state.fog[y]?.[x])continue;
    drawItems.push({unit:position,depth:p(position.x+.5,position.y+.5).y});
  }
  for(let x=0;x<state.cols;x++)for(let y=0;y<state.rows;y++) {
    if(!onMap(state,x,y))continue;
    drawItems.push({x,y,depth:p(x+.5,y+.5).y});
    const unit=units.get(`${x},${y}`);
    if(unit&&!movingIds.has(unit.id)&&(unit.team==='blue'||!state.fog[y][x]))drawItems.push({unit,depth:p(x+.5,y+.5).y});
  }
  for(const environment of getEnvironmentItems(state))drawItems.push({environment,depth:p(environment.x,environment.y).y});
  // Ground depth follows the camera; moving models retain their interpolated depth.
  drawItems.sort((a,b)=>a.depth-b.depth||Number(Boolean(a.unit))-Number(Boolean(b.unit)));
  for(const item of drawItems) {
    if(item.environment){drawEnvironmentItem(painter,item.environment,state);continue;}
    if(item.unit){vehicle(item.unit);continue;}
    const {x,y}=item;
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
  }
  if(!preview)for(const landmark of state.landmarks){const v=p(landmark.x+.5,landmark.y+.5,10);ctx.font=`${Math.max(9,10*scale)}px sans-serif`;ctx.textAlign='center';const w=ctx.measureText(landmark.label).width+15;ctx.fillStyle='#38291fe8';ctx.fillRect(v.x-w/2,v.y-9,w,17);ctx.fillStyle='#ffe6ae';ctx.fillText(landmark.label,v.x,v.y+3);}
  drawCombat(ctx,view,effects,now,reducedMotion);
  ctx.restore();
  if(!preview){
    ctx.save();
    const vignette=ctx.createRadialGradient(view.width*.48,view.height*.48,Math.min(view.width,view.height)*.22,view.width*.5,view.height*.5,Math.max(view.width,view.height)*.68);
    vignette.addColorStop(0,'#10171e00');vignette.addColorStop(1,'#0b1b285e');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,view.width,view.height);
    ctx.restore();
  }
}
