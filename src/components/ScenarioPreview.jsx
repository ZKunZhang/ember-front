import { useEffect, useMemo, useRef } from 'react';
import { createScenario } from '../game/scenarios.js';
import { UNIT_TYPES } from '../game/catalog.js';
import { createView } from '../rendering/projection.js';
import { drawBattlefield } from '../rendering/battlefield.js';

export default function ScenarioPreview({id,difficulty,formationId}) {
  const canvasRef=useRef(null);
  const state=useMemo(()=>{
    const scenario=createScenario(id,difficulty,formationId);
    return {...scenario,selectedId:null,turn:'blue',winner:null,
      fog:Array.from({length:scenario.rows},()=>Array(scenario.cols).fill(false)),
      units:scenario.deployments.map((unit,index)=>({...unit,id:index+1,hp:UNIT_TYPES[unit.type].maxHp,maxHp:UNIT_TYPES[unit.type].maxHp}))
        .filter(unit=>!(scenario.mission?.kind==='breakthrough'||scenario.mission?.outposts)||unit.team==='blue'),
    };
  },[id,difficulty,formationId]);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d');
    let frame;
    const draw=()=>{
      const {width,height}=canvas.getBoundingClientRect();
      if(!width||!height)return;
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      // The overview fits the entire board and shares every terrain/vehicle model.
      const view=createView(state,width,height,1);
      drawBattlefield(ctx,view,state,{preview:true,reducedMotion:true});
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
    const observer=new ResizeObserver(schedule);observer.observe(canvas);schedule();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[state]);
  return <canvas ref={canvasRef} className="scenario-preview" width="450" height="225" style={{aspectRatio:'2 / 1'}} role="img" aria-label={`${state.name}地形与部署预览`}/>;
}
