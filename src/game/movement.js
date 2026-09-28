// Rendering time is separate from the already-resolved tactical state.
export const movementDuration = movement => {
  const steps=(movement?.path.length||1)-1;
  return movement?.team==='red'?Math.min(650,Math.max(300,steps*135)):Math.min(1400,Math.max(360,steps*190));
};

function pathSample(path,progress) {
  const index=Math.min(path.length-2,Math.floor(progress)),fraction=progress-index;
  const a=path[index],b=path[index+1];
  let corner,previous,next,t;
  if(fraction>.8&&index+2<path.length){corner=b;previous=a;next=path[index+2];t=(fraction-.8)/.4;}
  else if(fraction<.2&&index>0){corner=a;previous=path[index-1];next=b;t=(fraction+.2)/.4;}
  if(corner){
    const start={x:corner.x+(previous.x-corner.x)*.2,y:corner.y+(previous.y-corner.y)*.2};
    const end={x:corner.x+(next.x-corner.x)*.2,y:corner.y+(next.y-corner.y)*.2};
    const dx=(1-t)*(corner.x-start.x)+t*(end.x-corner.x),dy=(1-t)*(corner.y-start.y)+t*(end.y-corner.y),length=Math.hypot(dx,dy)||1;
    return {x:(1-t)**2*start.x+2*(1-t)*t*corner.x+t*t*end.x,
      y:(1-t)**2*start.y+2*(1-t)*t*corner.y+t*t*end.y,heading:{x:dx/length,y:dy/length}};
  }
  return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,heading:{x:b.x-a.x,y:b.y-a.y}};
}

export function movementPosition(unit, movements, now, reducedMotion = false) {
  if (reducedMotion) return unit;
  const movement = movements.find(item => item.unitId === unit.id);
  if (!movement || movement.path.length < 2) return unit;
  const t = Math.max(0, Math.min(1, (now - movement.started) / movementDuration(movement)));
  if (t >= 1) return unit;
  const progress = t * t * (3 - 2 * t) * (movement.path.length - 1);
  const sample=pathSample(movement.path,progress);
  return { ...unit, x:sample.x, y:sample.y };
}


export function vehicleMotion(unit, movements, now, reducedMotion = false) {
  const still = { heading: unit.heading || {x:unit.team==='red'?1:-1,y:0}, bob: 0, pitch: 0, roll: 0, trackPhase: 0, dustPhase: 0, dx: 0, dy: 0, active: false };
  if (reducedMotion) return still;
  const movement = movements.find(item => item.unitId === unit.id);
  if (!movement || movement.path.length < 2) return still;
  const age = now - movement.started, t = age / movementDuration(movement);
  if (t <= 0 || t >= 1) return still;
  const progress = t * t * (3 - 2 * t) * (movement.path.length - 1);
  const index = Math.min(movement.path.length - 2, Math.floor(progress));
  const a = movement.path[index], b = movement.path[index + 1];
  const previous=index===0?(movement.heading||{x:unit.team==='red'?1:-1,y:0}):{
    x:a.x-movement.path[index-1].x,y:a.y-movement.path[index-1].y,
  };
  const from=Math.atan2(previous.y,previous.x),to=Math.atan2(b.y-a.y,b.x-a.x);
  const turn=Math.min(1,(progress-index)/.35);
  const angle=from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*turn*turn*(3-2*turn);
  const weight = unit.type === 'heavyTank' ? .65 : 1;
  const envelope = Math.sin(t * Math.PI) * weight;
  return {
    active: true,
    heading: progress<.35?{x:Math.cos(angle),y:Math.sin(angle)}:pathSample(movement.path,progress).heading,
    bob: Math.sin(progress * Math.PI * 3) * 2.8 * envelope,
    pitch: (Math.cos(progress*Math.PI*2)*3.5+Math.cos(t*Math.PI)*2)*envelope,
    roll: Math.sin(progress * Math.PI * 2 + .7) * 2.2 * envelope,
    trackPhase: (progress * 5) % 1,
    dustPhase: (age / 480) % 1,
    dx: b.x - a.x, dy: b.y - a.y,
  };
}
