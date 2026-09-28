import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createView, unproject, DEFAULT_ZOOM } from '../rendering/projection.js';
import { pickUnit } from '../rendering/picking.js';
import { drawBattlefield, getBattlefieldData } from '../rendering/battlefield.js';
import { createTerrainCache, renderPixelRatio } from '../rendering/cache.js';
import { movementDuration } from '../game/movement.js';
import { EFFECT_DURATION } from '../rendering/combat.js';
import { onMap } from '../game/engine.js';
import FogLayer from './FogLayer.jsx';

export default function Battlefield({game,onCell,onReset,onUndo}) {
  const canvasRef=useRef(null),drag=useRef(null),effectRef=useRef([]),previousEffect=useRef(null),movementRef=useRef([]),previousMovement=useRef(null);
  const [size,setSize]=useState({width:800,height:620}),[camera,setCamera]=useState({zoom:DEFAULT_ZOOM,pan:{x:0,y:0}}),[hover,setHover]=useState(null),[dragging,setDragging]=useState(false);
  const cacheRef=useRef(null),cameraFrame=useRef(null),cameraUpdates=useRef([]);
  if(!cacheRef.current)cacheRef.current=createTerrainCache();
  // Panning changes only the origin; fitting all map vertices is a zoom/resize task.
  const baseView=useMemo(()=>createView(game,size.width,size.height,camera.zoom),[game.terrain,size,camera.zoom]);
  const view=useMemo(()=>({...baseView,ox:baseView.ox+camera.pan.x,oy:baseView.oy+camera.pan.y}),[baseView,camera.pan]);
  const destinations=useMemo(()=>getBattlefieldData(game).moves,[game]);
  const queueCamera=update=>{
    cameraUpdates.current.push(update);
    if(cameraFrame.current!==null)return;
    cameraFrame.current=requestAnimationFrame(()=>{
      cameraFrame.current=null;
      const updates=cameraUpdates.current;cameraUpdates.current=[];
      setCamera(current=>updates.reduce((next,apply)=>apply(next),current));
    });
  };
  const resetCamera=()=>{
    cancelAnimationFrame(cameraFrame.current);cameraFrame.current=null;cameraUpdates.current=[];
    setCamera({zoom:DEFAULT_ZOOM,pan:{x:0,y:0}});
  };
  useEffect(()=>()=>{cancelAnimationFrame(cameraFrame.current);cameraUpdates.current=[];cacheRef.current.clear();},[]);
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;
    const resize=()=>{const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0)setSize(current=>current.width===r.width&&current.height===r.height?current:{width:r.width,height:r.height});};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();return()=>observer.disconnect();
  },[]);
  useEffect(()=>{resetCamera();cacheRef.current.clear();setHover(null);effectRef.current=[];previousEffect.current=null;movementRef.current=[];previousMovement.current=game.movement?`${game.session}:${game.movement.id}`:null;},[game.session]);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),dpr=renderPixelRatio(size.width,size.height,window.devicePixelRatio||1);
    const width=Math.round(size.width*dpr),height=Math.round(size.height*dpr);
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started=performance.now();
    if(game.movement&&previousMovement.current!==`${game.session}:${game.movement.id}`){
      previousMovement.current=`${game.session}:${game.movement.id}`;
      movementRef.current=movementRef.current.filter(item=>item.unitId!==game.movement.unitId);
      movementRef.current.push({...game.movement,started});
    }
    if(game.effect&&previousEffect.current!==`${game.session}:${game.effect.id}`){previousEffect.current=`${game.session}:${game.effect.id}`;const moving=movementRef.current.find(item=>item.unitId===game.effect.source?.id);const launch=moving&&!reducedMotion?Math.max(started,moving.started+movementDuration(moving)):started;effectRef.current.push({...game.effect,started:launch});}
    let frame;
    const draw=()=>{
      const now=performance.now();movementRef.current=movementRef.current.filter(item=>!reducedMotion&&now-item.started<movementDuration(item));effectRef.current=effectRef.current.filter(effect=>now-effect.started<EFFECT_DURATION);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawBattlefield(ctx,view,game,{hover,effects:effectRef.current,now,reducedMotion,movements:movementRef.current,cache:cacheRef.current,dpr});
      if(effectRef.current.length||movementRef.current.length)frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[game,size,camera,hover]);
  const local=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const cell=e=>{const v=local(e),p=unproject(view,v.x,v.y);return onMap(game,p.x,p.y)?p:null;};
  const unitHit=e=>{
    const point=local(e),ground=cell(e);
    const destination=ground&&destinations.has(`${ground.x},${ground.y}`);
    return pickUnit(game,view,point,destination,movementRef.current,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  const click=e=>{
    const p=cell(e),hit=unitHit(e);
    if(hit)onCell(hit.x,hit.y);else if(p)onCell(p.x,p.y);
  };
  const zoom=delta=>queueCamera(c=>({...c,zoom:Math.max(.65,Math.min(2.8,c.zoom+delta))}));
  const pan=dx=>{setHover(null);queueCamera(c=>({...c,pan:{x:c.pan.x+dx,y:c.pan.y}}));};
  useEffect(()=>{const el=canvasRef.current;const wheel=e=>{
    e.preventDefault();
    if(e.ctrlKey||e.metaKey){
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1);
      queueCamera(c=>({...c,zoom:Math.max(.65,Math.min(2.8,c.zoom*Math.exp(-delta*.006)))}));
    }else if(e.deltaMode===0||e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){
      const unit=e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1;
      const dx=(e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX)*unit;
      const dy=e.shiftKey?0:e.deltaY*unit;
      setHover(null);
      queueCamera(c=>({...c,pan:{x:c.pan.x-dx,y:c.pan.y-dy}}));
    }else if(e.deltaY)zoom(e.deltaY<0?.1:-.1);
  };el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
  const hoveredUnit=game.units.find(u=>u.id===hover?.unitId&&u.hp>0&&(u.team==='blue'||!game.fog[u.y][u.x]));
  return <section className="battlefield">
    <div className="map-top"><span><i className="live-dot"/> 战场实况 <small>/ LIVE OPERATIONS</small></span><span className="coordinates">{hoveredUnit?`${hoveredUnit.team==='blue'?'我方':'敌方'} ${String(hoveredUnit.id).padStart(2,'0')} · ${hoveredUnit.name}`:hover?`GRID ${hover.x+1} : ${hover.y+1}`:'22 × 18 · 不规则战区'}</span></div>
    <div className="canvas-wrap"><canvas ref={canvasRef} id="map" style={{cursor:dragging?'grabbing':hoveredUnit?'pointer':'grab'}} aria-label="桌面俯视沙盘战场，可双指滑动或拖动平移；点击车辆选择，点击高亮地格移动" onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,pan:camera.pan,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const d=drag.current;if(d){if(d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(d.moved){setDragging(true);setHover(null);queueCamera(c=>({...c,pan:{x:d.pan.x+dx,y:d.pan.y+dy}}));return;}}const hit=unitHit(e),next=hit?{x:hit.x,y:hit.y,unitId:hit.id}:cell(e);setHover(current=>current?.x===next?.x&&current?.y===next?.y&&current?.unitId===next?.unitId?current:next);}}
      onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;if(!drag.current.moved)click(e);drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{drag.current=null;setDragging(false);}} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} onPointerLeave={()=>setHover(null)}/>
      <FogLayer game={game} view={view}/>
      <div className="map-caption"><span className="crosshair">⌖</span><div>{game.name}<small>我方由下向上推进 · {game.landmarks.map(l=>l.label).join(' / ')}</small></div></div>
      <div className="north">推进<span>↑</span></div>
      {game.winner&&<div className="result" role="status"><span>{game.winner==='blue'?'MISSION ACCOMPLISHED':'OPERATION ENDED'}</span><h2>{game.winner==='blue'?(game.mission?'任务目标达成':'战区已肃清'):'行动失败'}</h2><p>{game.winner==='blue'?`第 ${game.turnNumber} 回合 · ${game.mission?'任务目标达成':'敌军全部歼灭'}`:'行动目标未能达成，请调整部署战术。'}</p>{game.story&&<p>{game.winner==='blue'?game.story.success:game.story.failure}</p>}<button onClick={onReset}>重新部署</button></div>}
    </div>
    <div className="map-toolbar">
      <button id="undo" className="undo-button" disabled={!game.undoHistory?.length} onClick={onUndo} title="撤回上一次移动、开火、维修或结束回合">↶ 撤回</button>
      <div className="map-controls"><button onClick={()=>pan(-120)} title="向左平移" aria-label="向左平移">←</button><button onClick={()=>zoom(-.2)} title="缩小" aria-label="缩小">−</button><span className="zoom-level" aria-label="当前缩放">{Math.round(camera.zoom*100)}%</span><button onClick={resetCamera} title="重置视图" aria-label="重置视图">⌖</button><button onClick={()=>zoom(.2)} title="放大" aria-label="放大">＋</button><button onClick={()=>pan(120)} title="向右平移" aria-label="向右平移">→</button></div>
      <div className="map-command-hint">{game.turn==='red'?'敌方行动中…':game.mode==='repair'?'维修模式 · 点击相邻受损友军；点击敌军开火':'点击蓝格移动 · 点击敌军开火并查看情报'}</div>
    </div>
    <div className="map-bottom"><div className="legend"><span><i className="swatch blue"/>我方</span><span><i className="swatch red"/>敌方</span><span><i className="swatch move"/>移动范围</span><span><i className="swatch attack"/>火力范围</span><span><i className="swatch road"/>道路 / 桥梁</span><span><i className="swatch fog"/>迷雾</span></div><span className="map-tip">双指滑动 / 拖动平移 · 捏合或 Ctrl+滚轮缩放</span></div>
  </section>;
}
