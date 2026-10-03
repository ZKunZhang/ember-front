import { HEX_DIRECTIONS, hexCorners } from '../game/hex.js';

// Trace shared hex edges once per tactical state, including holes and islands.
export function rangeContours(cells) {
  const edges=[],from=new Map();
  for(const key of cells.keys()){
    const [x,y]=key.split(',').map(Number);
    const corners=hexCorners(x,y);
    for(const [dir,[dx,dy]] of HEX_DIRECTIONS.entries()){
      if(cells.has(`${x+dx},${y+dy}`))continue;
      const a=corners[dir],b=corners[(dir+1)%6];
      const edge={a,b,dir,used:false};edges.push(edge);
      const start=a.join(',');if(!from.has(start))from.set(start,[]);from.get(start).push(edge);
    }
  }
  const loops=[];
  for(const first of edges){
    if(first.used)continue;
    const loop=[];let edge=first;
    while(edge&&!edge.used){
      edge.used=true;loop.push(edge.a);
      if(edge.b[0]===first.a[0]&&edge.b[1]===first.a[1])break;
      const next=(from.get(edge.b.join(','))||[]).filter(item=>!item.used);
      edge=next[0];
    }
    if(loop.length>=3)loops.push(loop);
  }
  return loops;
}

export function roundedPath(ctx,points,radius,closed=true) {
  if(points.length<2)return;
  const cuts=points.map((point,index)=>{
    if(!closed&&(index===0||index===points.length-1))return {before:point,after:point,point};
    const prev=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];
    const beforeLength=Math.hypot(prev.x-point.x,prev.y-point.y),afterLength=Math.hypot(next.x-point.x,next.y-point.y);
    const amount=Math.min(radius,beforeLength*.2,afterLength*.2);
    const along=(other,length)=>({x:point.x+(other.x-point.x)*amount/(length||1),y:point.y+(other.y-point.y)*amount/(length||1)});
    return {before:along(prev,beforeLength),after:along(next,afterLength),point};
  });
  ctx.moveTo(cuts[0].before.x,cuts[0].before.y);
  cuts.forEach(({before,after,point},index)=>{
    if(index)ctx.lineTo(before.x,before.y);
    ctx.quadraticCurveTo(point.x,point.y,after.x,after.y);
  });
  if(closed)ctx.closePath();
}
