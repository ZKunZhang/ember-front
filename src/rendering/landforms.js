// Heights are sampled in world coordinates, shared by both sides of every tile.
// Adjacent cells form one ridge with saddles instead of separate rock models.
export function mountainHeight(terrain, x, y) {
  const xs=Number.isInteger(x)?[x-1,x]:[Math.floor(x)];
  const ys=Number.isInteger(y)?[y-1,y]:[Math.floor(y)];
  if(xs.some(a=>ys.some(b=>terrain[b]?.[a]!==1)))return 0;
  // Rise gradually from the nearest edge instead of building a flat rock wall.
  // Distance to each open cell's rectangle is continuous across tile seams.
  let inland=3;
  for(let b=Math.floor(y)-3;b<=Math.floor(y)+3;b++)for(let a=Math.floor(x)-3;a<=Math.floor(x)+3;a++) {
    if(terrain[b]?.[a]===1)continue;
    const dx=Math.max(a-x,0,x-a-1),dy=Math.max(b-y,0,y-b-1);
    inland=Math.min(inland,Math.hypot(dx,dy));
  }
  const ridge=36+8*Math.sin(x*.95+y*.35)+6*Math.cos(y*.78-x*.23);
  return Math.min(58,ridge*Math.pow(inland,.65));
}

export function mountainMesh(terrain,x,y) {
  const point=(a,b)=>[x+a,y+b,mountainHeight(terrain,x+a,y+b)];
  const ring=[[0,0],[0,.5],[0,1],[.5,1],[1,1],[1,.5],[1,0],[.5,0]].map(([a,b])=>point(a,b));
  const peak=point(.5,.5);
  return ring.map((a,i)=>[a,ring[(i+1)%ring.length],peak]);
}
