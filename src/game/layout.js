import { enlargeHardMap,expandMapPoint } from './map-expansion.js';

// Author maps as a rectangular odd-column grid; the rules keep axial hexes.
// Adjacent columns alternate by half a cell instead of accumulating a shear.
export const offsetToAxial=(point,shift=0)=>({...point,x:point.x-Math.floor(point.y/2)+shift});
export const axialToOffset=(point,shift=0)=>({...point,x:point.x+Math.floor(point.y/2)-shift});
export const sourceToHex=(state,point)=>state.gridLayout?offsetToAxial(point,state.gridLayout.shift):point;
export const hexToSource=(state,point)=>state.gridLayout?axialToOffset(point,state.gridLayout.shift):point;
export const authoredToHex=(state,point)=>sourceToHex(state,state.mapScale===2?expandMapPoint(point):point);

export function layoutScenario(source) {
  source=enlargeHardMap(source);
  const shift=Math.floor((source.rows-1)/2),cols=source.cols+shift;
  const point=p=>offsetToAxial(p,shift);
  const terrain=Array.from({length:source.rows},()=>Array(cols).fill(-1));
  for(let y=0;y<source.rows;y++)for(let x=0;x<source.cols;x++){
    if(source.terrain[y][x]<0)continue;
    const p=point({x,y});terrain[p.y][p.x]=source.terrain[y][x];
  }
  const feature=f=>{
    if(Array.isArray(f))return f.map(feature);
    if(!f||typeof f!=='object')return f;
    const result=Number.isFinite(f.x)&&Number.isFinite(f.y)?point(f):{...f};
    for(const [key,value] of Object.entries(f))if(key!=='heading'&&value&&typeof value==='object')result[key]=feature(value);
    return result;
  };
  const mission=source.mission&&{...source.mission,...(source.mission.point?{point:point(source.mission.point)}:{}),...(source.mission.points?{points:source.mission.points.map(point)}:{}),...(source.mission.exits?{exits:source.mission.exits.map(point)}:{})};
  return {...source,cols,terrain,mission,gridLayout:{type:'odd-column',cols:source.cols,rows:source.rows,shift},
    deployments:source.deployments.map(point),landmarks:source.landmarks.map(point),features:(source.features??[]).map(feature)};
}
