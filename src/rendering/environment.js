import { worldToGround, groundToWorld } from './projection.js';

// Feature models use the same orthogonal tabletop plane as roads and vehicles.
export function runwayFrame(runway) {
  const start=worldToGround({x:runway.from.x+.5,y:runway.from.y+.5});
  const end=worldToGround({x:runway.to.x+.5,y:runway.to.y+.5});
  const length=Math.hypot(end.x-start.x,end.y-start.y);
  if(!length)return null;
  const forward={x:(end.x-start.x)/length,y:(end.y-start.y)/length};
  return {length,point(along,across=0){return groundToWorld({x:start.x+forward.x*along-forward.y*across,y:start.y+forward.y*along+forward.x*across});}};
}

export function drawEnvironmentGround(painter,state) {
  const {p,polygon,line}=painter;
  for(const feature of state.features||[]) {
    if(feature.type!=='airfield')continue;
    const frame=runwayFrame(feature.runway);if(!frame)continue;
    const hidden=state.fog[feature.runway.from.y]?.[feature.runway.from.x]||state.fog[feature.runway.to.y]?.[feature.runway.to.x];
    const q=(along,across,z=.2)=>{const point=frame.point(along,across);return p(point.x,point.y,z);};
    const strip=(a,b,width,color)=>polygon([q(a,-width),q(b,-width),q(b,width),q(a,width)],color);
    strip(-.5,frame.length+.5,.49,hidden?'#444b40':'#777a65');
    strip(-.43,frame.length+.43,.37,hidden?'#303937':'#505956');
    for(const side of [-.33,.33])line(q(-.33,side,.25),q(frame.length+.33,side,.25),hidden?'#788078':'#bac0ac',.75);
    for(let along=.35;along<frame.length;along+=.8)line(q(along,0,.3),q(Math.min(along+.34,frame.length),0,.3),hidden?'#83887c':'#e3e2cb',1.6);
    for(const end of [0,frame.length])for(const across of [-.24,-.12,0,.12,.24])line(q(end-.14,across,.3),q(end+.14,across,.3),hidden?'#83887c':'#dddcca',1.5);
    // Aprons connect to the runway without pretending to be playable units.
    for(const hangar of feature.hangars||[]) {
      const center=worldToGround({x:hangar.x+.5,y:hangar.y+.5});
      const corners=[[-.55,-.58],[.55,-.58],[.55,.58],[-.55,.58]].map(([x,y])=>{const world=groundToWorld({x:center.x+x,y:center.y+y});return p(world.x,world.y,.18);});
      polygon(corners,hidden?'#50564a':'#939583');
    }
  }
}

export function getEnvironmentItems(state) {
  const items=[];
  for(const feature of state.features||[]) {
    if(feature.type!=='airfield')continue;
    for(const hangar of feature.hangars||[]) {
      // Undiscovered buildings stay hidden; feature drawing never reads units.
      if(state.fog[hangar.y]?.[hangar.x])continue;
      items.push({type:'hangar',x:hangar.x+.5,y:hangar.y+.5,runway:feature.runway});
      const frame=runwayFrame(feature.runway);
      if(frame) {
        const base=worldToGround({x:hangar.x+.5,y:hangar.y+.5});
        const toward=worldToGround({x:feature.runway.from.x-hangar.x,y:feature.runway.from.y-hangar.y});
        const length=Math.hypot(toward.x,toward.y)||1;
        const point=groundToWorld({x:base.x+toward.x/length*.7,y:base.y+toward.y/length*.7});
        items.push({type:'aircraft',x:point.x,y:point.y,runway:feature.runway});
      }
    }
  }
  return items;
}

export function drawEnvironmentItem(painter,item) {
  const {p,polygon,line}=painter,frame=runwayFrame(item.runway);if(!frame)return;
  const origin=worldToGround({x:item.x,y:item.y});
  const start=worldToGround(frame.point(0)),end=worldToGround(frame.point(1));
  const forward={x:end.x-start.x,y:end.y-start.y};
  const q=(along,across,z=0)=>{const world=groundToWorld({x:origin.x+forward.x*along-forward.y*across,y:origin.y+forward.y*along+forward.x*across});return p(world.x,world.y,z);};
  const face=(points,color,stroke)=>polygon(points.map(([a,b,z])=>q(a,b,z)),color,stroke,.7);
  if(item.type==='hangar') {
    face([[-.42,-.35,0],[.42,-.35,0],[.42,.35,0],[-.42,.35,0]],'#343d32');
    const faces=[
      {a:0,b:-.35,points:[[-.42,-.35,0],[.42,-.35,0],[.42,-.35,13],[-.42,-.35,13]],color:'#697361'},
      {a:0,b:.35,points:[[-.42,.35,0],[.42,.35,0],[.42,.35,13],[-.42,.35,13]],color:'#515e51'},
      {a:-.42,b:0,points:[[-.42,-.35,0],[-.42,.35,0],[-.42,.35,13],[-.42,0,19],[-.42,-.35,13]],color:'#7f8974'},
      {a:.42,b:0,points:[[.42,-.35,0],[.42,.35,0],[.42,.35,13],[.42,0,19],[.42,-.35,13]],color:'#6b7665'},
    ];
    faces.sort((a,b)=>q(a.a,a.b).y-q(b.a,b.b).y);
    for(const side of faces)face(side.points,side.color,'#414b40');
    face([[-.42,-.35,13],[.42,-.35,13],[.42,0,19],[-.42,0,19]],'#89917a','#565f50');
    face([[-.42,0,19],[.42,0,19],[.42,.35,13],[-.42,.35,13]],'#65725f','#465342');
    for(const a of [-.32,-.16,0,.16,.32])line(q(a,-.35,13),q(a,0,19),'#b3b59b66',.65);
  } else {
    // Small parked aircraft silhouette, with raised fuselage and broad wings.
    face([[-.48,-.04,1],[.48,-.04,1],[.48,.04,1],[-.48,.04,1]],'#323b34');
    face([[-.16,-.5,2],[.02,-.5,2],[.15,.5,2],[-.03,.5,2]],'#9a9c85','#535d50');
    face([[-.43,-.2,3],[-.3,-.2,3],[-.21,.2,3],[-.34,.2,3]],'#8d947d','#535d50');
    face([[-.48,-.06,3],[.39,-.06,3],[.51,0,3],[.39,.06,3],[-.48,.06,3]],'#bbc0a6','#5f6959');
    face([[.06,-.055,4],[.24,-.045,4],[.24,.045,4],[.06,.055,4]],'#3a5659');
    line(q(-.4,0,4),q(-.42,0,10),'#7e8a70',2);
  }
}
