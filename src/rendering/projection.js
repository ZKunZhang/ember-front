// View the tabletop from its near edge: distant rows narrow toward the horizon.
export const DEFAULT_ZOOM = 1.15;
export const VEHICLE_SCALE = .72;
const TILE_WIDTH = 46;
const TILE_DEPTH = 28;
const depthScale = (view, x) => .76 + .24 * x / view.cols;

export function createView(state,width,height,zoom=DEFAULT_ZOOM,pan={x:0,y:0}) {
  const base={cols:state.cols,rows:state.rows,scale:1,tw:TILE_WIDTH,th:TILE_DEPTH,ox:0,oy:0};
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (let y=0;y<state.rows;y++) for(let x=0;x<state.cols;x++) {
    if (state.terrain[y][x]<0) continue;
    for(const [cx,cy] of [[x,y],[x+1,y],[x+1,y+1],[x,y+1]]) {
      const point=project(base,cx,cy);
      minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
      minY=Math.min(minY,point.y-44);maxY=Math.max(maxY,point.y+26);
    }
  }
  const scale=Math.max(.05,Math.min(Math.max(1,width-44)/(maxX-minX),Math.max(1,height-70)/(maxY-minY))*zoom);
  return {width,height,cols:state.cols,rows:state.rows,scale,tw:TILE_WIDTH*scale,th:TILE_DEPTH*scale,
    ox:width/2-(minX+maxX)*scale/2+pan.x,oy:height/2-(minY+maxY)*scale/2+pan.y};
}
export function project(view,x,y,z=0) {
  const across=(y-view.rows/2)*view.tw*depthScale(view,x);
  const depth=(x-view.cols/2)*view.th;
  return {x:view.ox+across,y:view.oy+depth-z*view.scale};
}
export function unproject(view,px,py) {
  const dx=px-view.ox,dy=py-view.oy;
  const across=dx,depth=dy;
  const x=depth/view.th+view.cols/2;
  return {x:Math.floor(x),y:Math.floor(across/(view.tw*depthScale(view,x))+view.rows/2)};
}
