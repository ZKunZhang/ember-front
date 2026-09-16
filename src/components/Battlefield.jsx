import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createView, unproject, project } from '../rendering/projection.js';
import { drawBattlefield } from '../rendering/battlefield.js';
import { onMap, reachable } from '../game/engine.js';

export default function Battlefield({game,onCell,onReset}) {
  const canvasRef=useRef(null),drag=useRef(null),effectRef=useRef(null),previousEffect=useRef(null);
  const [size,setSize]=useState({width:800,height:620}),[camera,setCamera]=useState({zoom:1,pan:{x:0,y:0}}),[hover,setHover]=useState(null);
  const view=createView(game,size.width,size.height,camera.zoom,camera.pan);
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;
    const resize=()=>{const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0)setSize({width:r.width,height:r.height});};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();return()=>observer.disconnect();
  },[]);
  useEffect(()=>{setCamera({zoom:1,pan:{x:0,y:0}});setHover(null);effectRef.current=null;previousEffect.current=null;},[game.session]);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(size.width*dpr);canvas.height=Math.round(size.height*dpr);
    if(game.effect&&previousEffect.current!==`${game.session}:${game.effect.id}`){previousEffect.current=`${game.session}:${game.effect.id}`;effectRef.current={...game.effect,started:performance.now()};}
    let frame;
    const draw=()=>{ctx.setTransform(dpr,0,0,dpr,0,0);drawBattlefield(ctx,view,game,{hover,effect:effectRef.current});if(effectRef.current&&performance.now()-effectRef.current.started<850)frame=requestAnimationFrame(draw);};
    draw();return()=>cancelAnimationFrame(frame);
  },[game,size,camera,hover]);
  const local=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const cell=e=>{const v=local(e),p=unproject(view,v.x,v.y);return onMap(game,p.x,p.y)?p:null;};
  const click=e=>{
    const v=local(e),p=cell(e);
    const selected=game.units.find(u=>u.id===game.selectedId&&u.hp>0);
    // A highlighted destination takes priority over a tall neighboring model.
    if(p&&selected&&game.mode==='move'&&!selected.moved&&reachable(game,selected).has(`${p.x},${p.y}`)){onCell(p.x,p.y);return;}
    // Elevated vehicle bodies remain clickable, without testing hidden units.
    const hit=game.units.filter(u=>u.hp>0&&(u.team==='blue'||!game.fog[u.y][u.x])).reverse().find(u=>{
      const q=project(view,u.x+.5,u.y+.5,17);return Math.abs(q.x-v.x)<13*view.scale&&Math.abs(q.y-v.y)<11*view.scale;
    });
    if(hit)onCell(hit.x,hit.y);else if(p)onCell(p.x,p.y);
  };
  const zoom=delta=>setCamera(c=>({...c,zoom:Math.max(.65,Math.min(2.8,c.zoom+delta))}));
  useEffect(()=>{const el=canvasRef.current;const wheel=e=>{e.preventDefault();zoom(e.deltaY<0?.1:-.1);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
  return <section className="battlefield">
    <div className="map-top"><span><i className="live-dot"/> 战术视图 <small>/ ISOMETRIC 45°</small></span><span className="coordinates">{hover?`GRID ${hover.x+1} : ${hover.y+1}`:'22 × 18 · 不规则战区'}</span></div>
    <div className="canvas-wrap"><canvas ref={canvasRef} id="map" aria-label="等距战场，点击车辆选择，点击高亮地格移动" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,pan:camera.pan,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const d=drag.current;if(d){const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(d.moved){setCamera(c=>({...c,pan:{x:d.pan.x+dx,y:d.pan.y+dy}}));return;}}setHover(cell(e));}}
      onPointerUp={e=>{if(drag.current&&!drag.current.moved)click(e);drag.current=null;}}
      onPointerCancel={()=>drag.current=null} onPointerLeave={()=>setHover(null)}/>
      <div className="map-caption"><span className="crosshair">⌖</span><div>{game.name}<small>{game.direction} · {game.landmarks.map(l=>l.label).join(' / ')}</small></div></div>
      <div className="north">N<span>↗</span></div>
      <div className="map-controls"><button onClick={()=>zoom(-.2)} title="缩小">−</button><button onClick={()=>setCamera({zoom:1,pan:{x:0,y:0}})} title="重置视图">⌖</button><button onClick={()=>zoom(.2)} title="放大">＋</button></div>
      <div className="map-command-hint">{game.turn==='red'?'敌方行动中…':game.mode==='repair'?'维修模式 · 点击相邻受损友军':game.mode==='attack'?'火力模式 · 点击可见敌军':'移动模式 · 点击绿色地格'}</div>
      {game.winner&&<div className="result"><span>OPERATION COMPLETE</span><h2>{game.winner==='blue'?'战区已肃清':'行动失败'}</h2><p>{game.winner==='blue'?`第 ${game.turnNumber} 回合 · 敌军全部歼灭`:'我方车辆全部损失，请调整部署战术。'}</p><button onClick={onReset}>重新部署</button></div>}
    </div>
    <div className="map-bottom"><div className="legend"><span><i className="swatch blue"/>我方</span><span><i className="swatch red"/>敌方</span><span><i className="swatch move"/>可移动</span><span><i className="swatch road"/>道路 / 桥梁</span><span><i className="swatch fog"/>迷雾</span></div><span className="map-tip">滚轮缩放 · 拖动平移</span></div>
  </section>;
}
