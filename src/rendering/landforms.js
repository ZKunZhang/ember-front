import { hexCorners, hexContains, hexToPlane, roundHex } from '../game/hex.js';

// A continuous surface measured against exposed hex edges joins neighboring peaks.
export function mountainHeight(terrain, x, y) {
  const cell=roundHex(x-.5,y-.5),point=hexToPlane({x,y});
  if(terrain[cell.y]?.[cell.x]!==1)return 0;
  let inland=3;
  for(let b=cell.y-3;b<=cell.y+3;b++)for(let a=cell.x-3;a<=cell.x+3;a++) {
    if(terrain[b]?.[a]===1)continue;
    if(hexContains(x,y,{x:a,y:b}))return 0;
    const corners=hexCorners(a,b).map(([x,y])=>hexToPlane({x,y}));
    for(let i=0;i<6;i++) {
      const start=corners[i],end=corners[(i+1)%6],dx=end.x-start.x,dy=end.y-start.y;
      const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/(dx*dx+dy*dy)));
      inland=Math.min(inland,Math.hypot(point.x-start.x-t*dx,point.y-start.y-t*dy));
    }
  }
  const ridge=36+8*Math.sin(x*.95+y*.35)+6*Math.cos(y*.78-x*.23);
  return Math.min(58,ridge*Math.pow(inland,.65));
}

export function mountainMesh(terrain,x,y) {
  const point=(a,b)=>[a,b,mountainHeight(terrain,a,b)];
  const corners=hexCorners(x,y),ring=[];
  for(let i=0;i<6;i++) {
    const a=corners[i],b=corners[(i+1)%6];
    ring.push(point(...a),point((a[0]+b[0])/2,(a[1]+b[1])/2));
  }
  const peak=point(x+.5,y+.5);
  return ring.map((a,i)=>[a,ring[(i+1)%ring.length],peak]);
}
