// Symmetric supercover ray between tile centers. At an exact corner both
// adjoining cells count, so units cannot see through a diagonal gap in a ridge.
export function lineOfSight(state, from, to) {
  const blocks=(x,y)=>state.terrain[y]?.[x]===undefined||[-1,1,2].includes(state.terrain[y][x]);
  const nx=Math.abs(to.x-from.x),ny=Math.abs(to.y-from.y);
  const sx=Math.sign(to.x-from.x),sy=Math.sign(to.y-from.y);
  let x=from.x,y=from.y,ix=0,iy=0;
  while(ix<nx||iy<ny) {
    const horizontal=(1+2*ix)*ny,vertical=(1+2*iy)*nx;
    if(horizontal===vertical) {
      if(blocks(x+sx,y)||blocks(x,y+sy))return false;
      x+=sx;y+=sy;ix++;iy++;
    } else if(horizontal<vertical) {x+=sx;ix++;}
    else {y+=sy;iy++;}
    if(x===to.x&&y===to.y)return true;
    if(blocks(x,y))return false;
  }
  return true;
}

export const canSee=(state,observer,target)=>Math.abs(observer.x-target.x)+Math.abs(observer.y-target.y)<=observer.vision&&lineOfSight(state,observer,target);
