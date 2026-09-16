// Mirrored 45-degree isometric projection: positive x points down-left.
export function createView(state,width,height,zoom=1,pan={x:0,y:0}) {
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (let y=0;y<state.rows;y++) for(let x=0;x<state.cols;x++) {
    if (state.terrain[y][x]<0) continue;
    minX=Math.min(minX,(y-x-1)*23);maxX=Math.max(maxX,(y-x+1)*23);
    minY=Math.min(minY,(x+y)*11.5-38);maxY=Math.max(maxY,(x+y+2)*11.5+12);
  }
  const scale=Math.max(.05,Math.min(Math.max(1,width-44)/(maxX-minX),Math.max(1,height-70)/(maxY-minY))*zoom);
  return {width,height,scale,tw:46*scale,th:23*scale,
    ox:width/2-(minX+maxX)*scale/2+pan.x,oy:height/2-(minY+maxY)*scale/2+pan.y};
}
export const project=(view,x,y,z=0)=>({x:view.ox+(y-x)*view.tw/2,y:view.oy+(x+y)*view.th/2-z*view.scale});
export function unproject(view,px,py) {
  const a=(view.ox-px)/(view.tw/2),b=(py-view.oy)/(view.th/2);
  return {x:Math.floor((a+b)/2),y:Math.floor((b-a)/2)};
}
