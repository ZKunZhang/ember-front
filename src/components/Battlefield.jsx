import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createView, unproject, DEFAULT_ZOOM } from '../rendering/projection.js';
import { pickUnit } from '../rendering/picking.js';
import { drawBattlefield } from '../rendering/battlefield.js';
import { EFFECT_DURATION } from '../rendering/combat.js';
import { onMap, reachable } from '../game/engine.js';

export default function Battlefield({game,onCell,onReset,onUndo}) {
  const canvasRef=useRef(null),drag=useRef(null),effectRef=useRef([]),previousEffect=useRef(null);
  const [size,setSize]=useState({width:800,height:620}),[camera,setCamera]=useState({zoom:DEFAULT_ZOOM,pan:{x:0,y:0}}),[hover,setHover]=useState(null),[dragging,setDragging]=useState(false);
  const view=createView(game,size.width,size.height,camera.zoom,camera.pan);
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;
    const resize=()=>{const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0)setSize({width:r.width,height:r.height});};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();return()=>observer.disconnect();
  },[]);
  useEffect(()=>{setCamera({zoom:DEFAULT_ZOOM,pan:{x:0,y:0}});setHover(null);effectRef.current=[];previousEffect.current=null;},[game.session]);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(size.width*dpr);canvas.height=Math.round(size.height*dpr);
    if(game.effect&&previousEffect.current!==`${game.session}:${game.effect.id}`){previousEffect.current=`${game.session}:${game.effect.id}`;effectRef.current.push({...game.effect,started:performance.now()});}
    let frame;
    const draw=()=>{
      const now=performance.now();effectRef.current=effectRef.current.filter(effect=>now-effect.started<EFFECT_DURATION);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawBattlefield(ctx,view,game,{hover,effects:effectRef.current,now,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
      if(effectRef.current.length)frame=requestAnimationFrame(draw);
    };
    draw();return()=>cancelAnimationFrame(frame);
  },[game,size,camera,hover]);
  const local=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const cell=e=>{const v=local(e),p=unproject(view,v.x,v.y);return onMap(game,p.x,p.y)?p:null;};
  const unitHit=e=>{
    const point=local(e),ground=cell(e),selected=game.units.find(u=>u.id===game.selectedId&&u.hp>0);
    const destination=ground&&selected&&game.mode==='move'&&!selected.moved&&reachable(game,selected).has(`${ground.x},${ground.y}`);
    return pickUnit(game,view,point,destination);
  };
  const click=e=>{
    const p=cell(e),hit=unitHit(e);
    if(hit)onCell(hit.x,hit.y);else if(p)onCell(p.x,p.y);
  };
  const zoom=delta=>setCamera(c=>({...c,zoom:Math.max(.65,Math.min(2.8,c.zoom+delta))}));
  const pan=dx=>{setHover(null);setCamera(c=>({...c,pan:{x:c.pan.x+dx,y:c.pan.y}}));};
  useEffect(()=>{const el=canvasRef.current;const wheel=e=>{
    e.preventDefault();
    if(!e.ctrlKey&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))){
      const delta=(e.deltaX||e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1);
      pan(-delta);
    } else if(e.deltaY)zoom(e.deltaY<0?.1:-.1);
  };el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
  const hoveredUnit=game.units.find(u=>u.id===hover?.unitId&&u.hp>0&&(u.team==='blue'||!game.fog[u.y][u.x]));
  return <section className="battlefield">
    <div className="map-top"><span><i className="live-dot"/> 战术视图 <small>/ SAND TABLE · 桌面俯视</small></span><span className="coordinates">{hoveredUnit?`${hoveredUnit.team==='blue'?'我方':'敌方'} ${String(hoveredUnit.id).padStart(2,'0')} · ${hoveredUnit.name}`:hover?`GRID ${hover.x+1} : ${hover.y+1}`:'22 × 18 · 不规则战区'}</span></div>
    <div className="canvas-wrap"><canvas ref={canvasRef} id="map" style={{cursor:dragging?'grabbing':hoveredUnit?'pointer':'grab'}} aria-label="桌面俯视沙盘战场，可左右滑动或拖动平移；点击车辆选择，点击高亮地格移动" onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,pan:camera.pan,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const d=drag.current;if(d){if(d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(d.moved){setDragging(true);setHover(null);setCamera(c=>({...c,pan:{x:d.pan.x+dx,y:d.pan.y+dy}}));return;}}const hit=unitHit(e);setHover(hit?{x:hit.x,y:hit.y,unitId:hit.id}:cell(e));}}
      onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;if(!drag.current.moved)click(e);drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{drag.current=null;setDragging(false);}} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} onPointerLeave={()=>setHover(null)}/>
      <div className="map-caption"><span className="crosshair">⌖</span><div>{game.name}<small>我方由下向上推进 · {game.landmarks.map(l=>l.label).join(' / ')}</small></div></div>
      <div className="north">推进<span>↑</span></div>
      {game.winner&&<div className="result"><span>OPERATION COMPLETE</span><h2>{game.winner==='blue'?'战区已肃清':'行动失败'}</h2><p>{game.winner==='blue'?`第 ${game.turnNumber} 回合 · ${game.mission?'任务目标达成':'敌军全部歼灭'}`:'行动目标未能达成，请调整部署战术。'}</p>{game.story&&<p>{game.winner==='blue'?game.story.success:game.story.failure}</p>}<button onClick={onReset}>重新部署</button></div>}
    </div>
    <div className="map-toolbar">
      <button id="undo" className="undo-button" disabled={!game.undoHistory?.length} onClick={onUndo} title="撤回上一次移动、开火、维修或结束回合">↶ 撤回</button>
      <div className="map-controls"><button onClick={()=>pan(-120)} title="向左平移" aria-label="向左平移">←</button><button onClick={()=>zoom(-.2)} title="缩小">−</button><button onClick={()=>setCamera({zoom:DEFAULT_ZOOM,pan:{x:0,y:0}})} title="重置视图">⌖</button><button onClick={()=>zoom(.2)} title="放大">＋</button><button onClick={()=>pan(120)} title="向右平移" aria-label="向右平移">→</button></div>
      <div className="map-command-hint">{game.turn==='red'?'敌方行动中…':game.mode==='repair'?'维修模式 · 点击相邻受损友军；点击敌军开火':'点击蓝格移动 · 点击敌军开火并查看情报'}</div>
    </div>
    <div className="map-bottom"><div className="legend"><span><i className="swatch blue"/>我方</span><span><i className="swatch red"/>敌方</span><span><i className="swatch move"/>移动范围</span><span><i className="swatch attack"/>火力范围</span><span><i className="swatch road"/>道路 / 桥梁</span><span><i className="swatch fog"/>迷雾</span></div><span className="map-tip">左右滑动 / 拖动平移 · 滚轮缩放</span></div>
  </section>;
}
