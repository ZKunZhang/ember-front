import { mountainMesh } from './landforms.js';
import { HEX_DIRECTIONS, hexCorners, hexToPlane, planeToHex } from '../game/hex.js';

export function createTerrainRenderer(painter, state) {
  const { ctx, scale, p, polygon, line, tile } = painter;
  const terrainAt = (x, y) => state.terrain[y]?.[x];
  const directions = HEX_DIRECTIONS;
  const paint = (points, color, stroke, width) => polygon(points.map(point => p(...point)), color, stroke, width);

  function bridgeAxis(x, y) {
    for(let i=0;i<3;i++) {
      const [dx,dy]=directions[i];
      if(terrainAt(x+dx,y+dy)===3&&terrainAt(x-dx,y-dy)===3&&
        directions.some(([a,b],j)=>j%3!==i&&terrainAt(x+a,y+b)===4))return [dx,dy];
    }
    return null;
  }
  function bridgePoint(x,y,axis) {
    const forward=hexToPlane({x:axis[0],y:axis[1]});
    return (along,across,z=0)=>{
      const offset=planeToHex({x:forward.x*along-forward.y*across,y:forward.y*along+forward.x*across});
      return p(x+.5+offset.x,y+.5+offset.y,z);
    };
  }
  function road(x, y, hidden) {
    const corners=hexCorners(x,y),center=[x+.5,y+.5];
    const connected=directions.map(([dx,dy],i)=>terrainAt(x+dx,y+dy)===3?i:-1).filter(i=>i>=0);
    const surface=hidden?'#69725d':'#b6b69a',shoulder=hidden?'#505d48':'#818b68';
    tile(x,y,shoulder,null,.25,.02);tile(x,y,surface,null,.32,.04);
    for(const i of connected) {
      const a=corners[i],b=corners[(i+1)%6];
      const edge=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.05];
      for(const [inset,color] of [[.08,shoulder],[.18,surface]]) {
        const left=edge(inset),right=edge(1-inset);
        const near=point=>[point[0]-(a[0]+b[0])/2+center[0],point[1]-(a[1]+b[1])/2+center[1],.05];
        paint([near(left),left,right,near(right)],color);
      }
      const middle=edge(.5);
      line(p(center[0]*.4+middle[0]*.6,center[1]*.4+middle[1]*.6,.1),p(...middle),hidden?'#8d8767':'#d3c49e',.8);
    }
    const axis=bridgeAxis(x,y);
    if(axis) {
      const q=bridgePoint(x,y,axis);
      polygon([q(-.5,-.26,1.5),q(.5,-.26,1.5),q(.5,.26,1.5),q(-.5,.26,1.5)],hidden?'#6a6952':'#a99b77');
      for(let i=0;i<=6;i++)line(q(i/6-.5,-.26,1.6),q(i/6-.5,.26,1.6),hidden?'#424d3d':'#786d55',.8);
    }
  }

  function water(x, y, hidden) {
    for(let i=0;i<3;i++) {
      const a=x+.25+i*.22;
      line(p(a,y+.25,.1),p(a+.015,y+.55,.1),hidden?'#496561':'#709a90',.65);
    }
    const corners=hexCorners(x,y);
    for(const [i,[dx,dy]] of directions.entries()) {
      const neighbor=terrainAt(x+dx,y+dy);
      if(neighbor===undefined||neighbor<0||neighbor===4||(neighbor===3&&bridgeAxis(x+dx,y+dy)))continue;
      const a=corners[i],b=corners[(i+1)%6];
      const inner=point=>[point[0]*.86+(x+.5)*.14,point[1]*.86+(y+.5)*.14,.3];
      paint([[...a,.3],[...b,.3],inner(b),inner(a)],hidden?'#62664e':'#a8a07a');
    }
  }

  function ground(x, y, hidden) {
    const type = terrainAt(x, y), variation = (x * 13 + y * 7) % 4;
    const grass = hidden ? ['#343d3c', '#39413f', '#333c39', '#3d4340'] : ['#817b60', '#898066', '#77765c', '#82785f'];
    ctx.save();
    polygon(hexCorners(x,y).map(([a,b])=>p(a,b)));ctx.clip();
    tile(x,y,type===4?(hidden?'#293f3c':'#426c76'):grass[variation]);
    if (type === 4) water(x, y, hidden);
    else if (type === 3) road(x, y, hidden);
    else {
      // Deterministic surface scars are decoration, never obstacles or unit intel.
      const scar = (x * 37 + y * 19) % 23;
      if (type === 0 && scar < 3) {
        const center = p(x + .48, y + .52, .15);
        ctx.save();
        const radius = (9 + scar * 3) * scale;
        const soil = ctx.createRadialGradient(center.x, center.y, radius * .1, center.x, center.y, radius);
        soil.addColorStop(0, hidden ? '#171f2090' : '#24211de0');
        soil.addColorStop(.58, hidden ? '#29302e80' : '#4b4130b0');
        soil.addColorStop(1, '#5e513500');
        ctx.translate(center.x, center.y);ctx.scale(1, .52);
        ctx.fillStyle = soil;ctx.translate(-center.x, -center.y);
        ctx.beginPath();ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);ctx.fill();
        ctx.restore();
        line(p(x + .65, y + .27, .2), p(x + .7, y + .65, .2), hidden ? '#73705b33' : '#c0a17a70', 1.2);
      }
      if (type === 0 && scar > 18) {
        for (const offset of [.32, .64]) {
          line(p(x, y + offset, .12), p(x + 1, y + offset + .08, .12), hidden ? '#20292338' : '#39362b60', 2.2);
          for (let i = 0; i < 6; i++) line(p(x + i / 6, y + offset - .035, .14), p(x + i / 6, y + offset + .05, .14), '#292c2440', .8);
        }
      }
      // Broken tufts and soft patches retain a natural field beneath the tactical grid.
      for (let i = 0; i < 4; i++) {
        const a = x + .12 + ((x * 19 + y * 7 + i * 23) % 69) / 100;
        const b = y + .14 + ((y * 17 + x * 5 + i * 29) % 67) / 100;
        const root = p(a,b,.1);
        line(root,p(a-.015,b,2),hidden?'#596b4e':'#a5a07a',.7);
        line(root,p(a+.04,b+.025,1.2),hidden?'#465d42':'#626449',.8);
      }

    }
    ctx.restore();
    tile(x,y,null,hidden?'#84928512':'#26382f55',0,.15,.75);
  }

  function mountain(x, y, hidden) {
    const facets=mountainMesh(state.terrain,x,y);
    for(const [a,b,c] of facets) {
      const slope=(a[2]-c[2])*.55+(b[2]-c[2])*.25;
      const light=Math.max(22,Math.min(65,(hidden?29:49)+slope*.45));
      paint([a,b,c],`hsl(95 10% ${light}%)`);
    }
    // Texture stays on the shared surface; no cell outlines split the massif.
    const peak=facets[0][2];
    if((x+y)%3===0) {
      const shoulder=facets[5][0];
      line(p(...peak),p(...shoulder),hidden?'#68746566':'#d0c6a866',.7);
    }
  }

  function tree(x, y, height, hidden, seed) {
    const center = p(x, y);
    ctx.fillStyle = '#11291c4d';ctx.beginPath();ctx.ellipse(center.x + 4 * scale, center.y + 2 * scale, height * .28 * scale, height * .11 * scale, 0, 0, Math.PI * 2);ctx.fill();
    line(center, p(x, y, height * .82), hidden ? '#544a38' : '#795033', 3.4);
    for (const side of [-1, 1]) line(p(x, y, height * .35), { x: center.x + side * height * .19 * scale, y: center.y - height * .74 * scale }, hidden ? '#665741' : '#9c7141', 1.8);
    const colors = hidden ? ['#2d4837', '#395840', '#50684a'] : ['#303e35', '#4b5940', '#707652', '#93946b'];
    // Overlapping rounded foliage masses give the trees a sculpted, painted silhouette.
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4 + seed, radius = height * (i < 6 ? .24 : .17) * scale;
      const cx = center.x + Math.cos(angle) * height * .2 * scale;
      const cy = center.y - height * (.66 + Math.sin(angle) * .19) * scale;
      ctx.beginPath();ctx.ellipse(cx, cy, radius, radius * .85, angle, 0, Math.PI * 2);
      const foliage=ctx.createRadialGradient(cx-radius*.35,cy-radius*.4,radius*.08,cx,cy,radius);
      foliage.addColorStop(0,colors[(i+1)%colors.length]);foliage.addColorStop(1,colors[i%colors.length]);
      ctx.fillStyle = foliage;ctx.fill();
      if (!hidden) {
        ctx.beginPath();ctx.ellipse(cx - radius * .2, cy - radius * .28, radius * .46, radius * .22, -.3, 0, Math.PI * 2);
        ctx.fillStyle = '#dfcfab24';ctx.fill();
      }
    }
    for (let i = 0; i < 5; i++) {
      const leaf = p(x + Math.sin(seed + i * 3) * .28, y + Math.cos(seed + i * 2) * .3, .3);
      ctx.fillStyle = colors[(i + 1) % colors.length];
      ctx.beginPath();ctx.ellipse(leaf.x, leaf.y, 2.4 * scale, 1.1 * scale, i, 0, Math.PI * 2);ctx.fill();
    }
  }

  function bridge(x, y, hidden) {
    const axis=bridgeAxis(x,y);
    if(!axis)return;
    const q=bridgePoint(x,y,axis);
    for(const side of [-.27,.27]) {
      line(q(-.5,side,4.5),q(.5,side,4.5),hidden?'#858069':'#c6b390',1.6);
      for(const along of [-.46,0,.46])line(q(along,side,.4),q(along,side,5),hidden?'#565e48':'#827a5c',1.4);
    }
  }
  function details(x, y, hidden) {
    const type = terrainAt(x, y);
    if (type === 1) mountain(x, y, hidden);
    if (type === 2) {
      tile(x,y,hidden?'#304436':'#475940',null,0,18);
      for(const [a,b,i] of [[.5,.5,0],[.2,.65,1],[.65,.15,2],[.7,.55,3]])
        tree(x+a,y+b,29+(x*3+y+i*7)%8,hidden,x+y+i);
    }
    if (type === 3) bridge(x, y, hidden);
  }
  return { ground, details };
}
