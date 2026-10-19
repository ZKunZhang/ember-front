import { hexCorners, hexNeighbors, roundHex } from '../game/hex.js';

// Face the tabletop's near edge directly; orbiting is an explicit user action.
export const DEFAULT_ZOOM = 1;
export const VEHICLE_SCALE = .72;
const TILE_WIDTH = 46;
const TILE_DEPTH = 28;
const PLANE_DEPTH = Math.sqrt(3) / 2;
// Models and terrain share the table's orthogonal axes, independently of the
// tactical hex coordinates. Keep their local geometry in this same plane.
export const worldToGround=({x,y})=>({x:x*PLANE_DEPTH,y:y+x/2});
export const groundToWorld=({x,y})=>({x:x/PLANE_DEPTH,y:y-x/(2*PLANE_DEPTH)});
const boardBounds=new WeakMap();
const tableAxes=state=>{
  const facing=state.facing??(state.approach?.startsWith('north')?-1:1);
  const lateral=state.lateral??(state.approach?.endsWith('east')?-1:1);
  const angle=Math.atan(lateral/(Math.sqrt(3)*facing))+(state.advance==='right'?Math.PI/2:0);
  return {facing,lateral,angle};
};
export function tableBounds(state,padding=.75) {
  const {facing,lateral,angle}=tableAxes(state),cos=Math.cos(angle),sin=Math.sin(angle);
  if(!boardBounds.has(state.terrain))boardBounds.set(state.terrain,new Map());
  const cache=boardBounds.get(state.terrain),key=`${facing}:${lateral}:${state.advance}`;
  let bounds=cache.get(key);
  if(!bounds){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++){
      if(state.terrain[y][x]<0)continue;
      for(const [a,b] of hexCorners(x,y)){
        const ground=worldToGround({x:a,y:b}),u=ground.y*lateral,v=ground.x*facing;
        const p={x:u*cos-v*sin,y:u*sin+v*cos};
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
      }
    }
    bounds={minX,maxX,minY,maxY};cache.set(key,bounds);
  }
  const minX=bounds.minX-padding,maxX=bounds.maxX+padding,minY=bounds.minY-padding,maxY=bounds.maxY+padding;
  return {minX,maxX,minY,maxY,corners:[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]].map(([x,y])=>{
    const u=x*cos+y*sin,v=-x*sin+y*cos;
    const p=groundToWorld({x:v*facing,y:u*lateral});return [p.x,p.y];
  })};
}

export const initialRotation=()=>0;

export function createView(state,width,height,zoom=DEFAULT_ZOOM,pan={x:0,y:0},camera={}) {
  const rotation=camera.rotation??initialRotation(state),tilt=Math.max(.65,Math.min(1.35,camera.tilt??1));
  const facing=state.approach?.startsWith('north')?-1:1,lateral=state.approach?.endsWith('east')?-1:1;
  const advance=state.advance??'up';
  const base={cols:state.cols,rows:state.rows,scale:1,tw:TILE_WIDTH,th:TILE_DEPTH*tilt,ox:0,oy:0,rotation,tilt,facing,lateral,advance};
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const [cx,cy] of tableBounds(state).corners) {
      const point=project(base,cx,cy);
      minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
      minY=Math.min(minY,point.y-44);maxY=Math.max(maxY,point.y+26);
  }
  const scale=Math.max(.05,Math.min(Math.max(1,width-44)/(maxX-minX),Math.max(1,height-70)/(maxY-minY))*zoom);
  return {width,height,cols:state.cols,rows:state.rows,scale,tw:TILE_WIDTH*scale,th:TILE_DEPTH*tilt*scale,rotation,tilt,facing,lateral,advance,
    ox:width/2-(minX+maxX)*scale/2+pan.x,oy:height/2-(minY+maxY)*scale/2+pan.y};
}
export function project(view,x,y,z=0) {
  const angle=(view.rotation??0)+Math.atan((view.lateral??1)/(Math.sqrt(3)*(view.facing??1)))+(view.advance==='right'?Math.PI/2:0),cos=Math.cos(angle),sin=Math.sin(angle);
  const ground=worldToGround({x:x-view.cols/2,y:y-view.rows/2});
  const u=ground.y*view.tw*(view.lateral??1);
  const v=ground.x*view.tw*(view.facing??1);
  const across=u*cos-v*sin,depth=u*sin+v*cos;
  return {x:view.ox+across,y:view.oy+depth*view.th/(view.tw*PLANE_DEPTH)-z*view.scale};
}
export function unproject(view,px,py) {
  const dx=px-view.ox,dy=py-view.oy;
  const depth=dy*view.tw*PLANE_DEPTH/view.th,across=dx;
  const angle=(view.rotation??0)+Math.atan((view.lateral??1)/(Math.sqrt(3)*(view.facing??1)))+(view.advance==='right'?Math.PI/2:0),cos=Math.cos(angle),sin=Math.sin(angle);
  const u=across*cos+depth*sin,v=-across*sin+depth*cos;
  const ground=groundToWorld({x:v/view.tw*(view.facing??1),y:u/view.tw*(view.lateral??1)});
  const x=ground.x+view.cols/2,y=ground.y+view.rows/2;
  const nearest=roundHex(x-.5,y-.5);
  // Match the painted polygon edges, including clicks very close to a corner.
  for(const cell of [nearest,...hexNeighbors(nearest)]) {
    const corners=hexCorners(cell.x,cell.y).map(([a,b])=>project(view,a,b));
    let positive=false,negative=false;
    for(let i=0;i<6;i++) {
      const a=corners[i],b=corners[(i+1)%6];
      const cross=(b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x);
      if(cross>1e-8)positive=true;
      if(cross< -1e-8)negative=true;
    }
    if(!(positive&&negative))return cell;
  }
  return nearest;
}
