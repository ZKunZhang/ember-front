import { mountainMesh, forestMesh, forestTufts } from './landforms.js';
import { HEX_DIRECTIONS, hexCorners } from '../game/hex.js';
import { worldToGround, groundToWorld } from './projection.js';

const materials=new WeakMap();
const noise=(x,y,seed=0)=>{
  const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;
  return n-Math.floor(n);
};
function surfaceMaterials(facets,forest) {
  if(materials.has(facets))return materials.get(facets);
  const data=facets.map(points=>{
    const [a,b,c]=points;
    const pa=worldToGround({x:a[0],y:a[1]}),pb=worldToGround({x:b[0],y:b[1]}),pc=worldToGround({x:c[0],y:c[1]});
    const ux=(pb.x-pa.x)*40,uy=(pb.y-pa.y)*40,uz=b[2]-a[2];
    const vx=(pc.x-pa.x)*40,vy=(pc.y-pa.y)*40,vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nz<0){nx=-nx;ny=-ny;nz=-nz;}
    const light=(-nx*.38-ny*.34+nz*.78)/(Math.hypot(nx,ny,nz)||1);
    const x=(a[0]+b[0]+c[0])/3,y=(a[1]+b[1]+c[1])/3;
    const grain=Math.sin(x*2.3+y*1.1)*Math.cos(y*1.7-x*.8);
    const elevation=(a[2]+b[2]+c[2])/3;
    const moss=Math.max(0,1-elevation/20)*(.5+.5*Math.sin(x*1.8+y*1.3));
    const color=hidden=>{
      const tone=(hidden?29:36)+light*8+grain;
      if(forest)return `hsl(140 ${hidden?31:40}% ${tone}%)`;
      const brightness=(hidden?.75:.94)+light*.2+grain*.012;
      const rgb=[166-moss*34,185-moss*13,181-moss*45].map(value=>Math.round(value*brightness));
      return `rgb(${rgb.join(' ')})`;
    };
    return {points,x,y,visible:color(false),hidden:color(true)};
  });
  materials.set(facets,data);return data;
}

export function createTerrainRenderer(painter, state) {
  const { ctx, scale, p, polygon, line, tile } = painter;
  const interactive=Boolean(painter.view?.interactive),projected=new WeakMap();
  const vertex=point=>{
    if(!projected.has(point))projected.set(point,p(...point));
    return projected.get(point);
  };
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
    const forward=worldToGround({x:axis[0],y:axis[1]}),length=Math.hypot(forward.x,forward.y);
    return (along,across,z=0)=>{
      const offset=groundToWorld({x:forward.x*along-forward.y/length*across,y:forward.y*along+forward.x/length*across});
      return p(x+.5+offset.x,y+.5+offset.y,z);
    };
  }
  function road(x, y, hidden) {
    const center=worldToGround({x:x+.5,y:y+.5});
    const connected=directions.map(([dx,dy],i)=>terrainAt(x+dx,y+dy)===3?i:-1).filter(i=>i>=0);
    const surface=hidden?'#a59d7f':'#d5bd8d',shoulder=hidden?'#698460':'#91aa70';
    const point=(a,b,z=.05)=>{
      const world=groundToWorld({x:center.x+a,y:center.y+b});
      return [world.x,world.y,z];
    };
    for(const [width,color] of [[.20,shoulder],[.14,surface]]){
      paint(Array.from({length:12},(_,i)=>point(Math.cos(i*Math.PI/6)*width,Math.sin(i*Math.PI/6)*width)),color);
    }
    for(const i of connected) {
      const [dx,dy]=directions[i],forward=worldToGround({x:dx,y:dy}),length=Math.hypot(forward.x,forward.y);
      const normal={x:-forward.y/length,y:forward.x/length};
      // Clip the shared, perpendicular road strip at the actual hex boundary.
      // Each neighbor paints the same centerline and width from its own side.
      for(const [width,color] of [[.20,shoulder],[.14,surface]]) {
        const ax=normal.x*width,ay=normal.y*width;
        paint([point(ax,ay),point(forward.x+ax,forward.y+ay),point(forward.x-ax,forward.y-ay),point(-ax,-ay)],color);
      }
      line(p(...point(forward.x*.3,forward.y*.3,.1)),p(...point(forward.x*.5,forward.y*.5,.1)),hidden?'#c4b994':'#f2dfb2',.8);
      for(const side of [-1,1]) {
        line(p(...point(normal.x*.075*side,normal.y*.075*side,.12)),
          p(...point(forward.x*.55+normal.x*.075*side,forward.y*.55+normal.y*.075*side,.12)),hidden?'#8b806344':'#a78c6144',.65);
      }
    }
    const axis=bridgeAxis(x,y);
    if(axis) {
      const q=bridgePoint(x,y,axis);
      polygon([q(-.5,-.26,1.5),q(.5,-.26,1.5),q(.5,.26,1.5),q(-.5,.26,1.5)],hidden?'#6a6952':'#a99b77');
      for(let i=0;i<=6;i++)line(q(i/6-.5,-.26,1.6),q(i/6-.5,.26,1.6),hidden?'#424d3d':'#786d55',.8);
    }
  }

  function patch(x,y,rx,ry,color,z=.12,phase=0) {
    const center=worldToGround({x,y});
    paint(Array.from({length:14},(_,i)=>{
      const angle=i*Math.PI/7,r=1+Math.sin(i*2.3+phase)*.12;
      const point=groundToWorld({x:center.x+Math.cos(angle)*rx*r,y:center.y+Math.sin(angle)*ry*r});
      return [point.x,point.y,z];
    }),color);
  }

  function meadow(x,y,hidden,type) {
    // Broad satin highlights keep the meadow legible as a painted miniature.
    const center=p(x+.5,y+.5);
    const radius=36*scale;
    const shade=ctx.createRadialGradient(center.x-9*scale,center.y-6*scale,0,center.x,center.y,radius);
    shade.addColorStop(0,hidden?'#b4d59220':'#e4eead32');
    shade.addColorStop(1,'#163a2100');
    polygon(hexCorners(x,y).map(([a,b])=>p(a,b)),shade);
    for(let i=0;i<(interactive?1:2);i++) {
      const a=x+.08+noise(x,y,i+2)*.84,b=y+.08+noise(x,y,i+13)*.84;
      const at=p(a,b,.1),r=(9+noise(x,y,i+23)*13)*scale;
      const mottling=ctx.createRadialGradient(at.x,at.y,0,at.x,at.y,r);
      mottling.addColorStop(0,i%2?(hidden?'#376c4218':'#4a8b491c'):(hidden?'#b8ce9020':'#deeb9a28'));
      mottling.addColorStop(1,'#577b4400');
      ctx.fillStyle=mottling;ctx.fillRect(at.x-r,at.y-r,r*2,r*2);
    }
    // A few grouped blades suggest toy grass without a noisy flock texture.
    for(let pigment=0;pigment<3;pigment++) {
      ctx.beginPath();
      for(let i=0;i<(interactive?1:4);i++) {
        const seed=i+pigment*23,a=x-.1+noise(x,y,seed+37)*1.2,b=y-.1+noise(x,y,seed+103)*1.2;
        const root=p(a,b,.12),tip=p(a+.012,b-.012,.6+noise(x,y,seed+207)*1.2);
        ctx.moveTo(root.x,root.y);ctx.lineTo(tip.x,tip.y);
        if(i%3===0){const leaf=p(a-.025,b+.012,1.1);ctx.moveTo(root.x,root.y);ctx.lineTo(leaf.x,leaf.y);}
      }
      ctx.strokeStyle=(hidden?['#c6dca540','#3b704340','#cbdba130']:['#e5edb570','#4e8b4d55','#edf1b050'])[pigment];
      ctx.lineWidth=.85*scale;ctx.stroke();
    }
    if(!interactive&&type===0&&noise(x,y,301)>.65) {
      for(let i=0;i<3;i++) {
        const a=x+.15+noise(x,y,310+i)*.7,b=y+.15+noise(x,y,320+i)*.7;
        const at=p(a,b,1.3);
        ctx.fillStyle=hidden?'#b5bb8e50':i%2?'#e1dba4bb':'#dce5bcbb';
        ctx.beginPath();ctx.ellipse(at.x,at.y,.65*scale,.45*scale,0,0,Math.PI*2);ctx.fill();
      }
    }
  }

  function water(x, y, hidden, shallow=false) {
    if(shallow) {
      // Sand and gravel remain visible through a thin, pale layer of water.
      patch(x+.5,y+.5,.36,.45,hidden?'#7e9b733f':'#c2cf9b60',.08,x+y);
      for(let i=0;i<8;i++) {
        const a=x+.1+((x*17+y*29+i*31)%81)/100;
        const b=y+.12+((x*23+y*13+i*37)%77)/100;
        patch(a,b,.018+(i%3)*.009,.025,hidden?'#75806a55':'#c2bfa0b0',.14,i);
      }
      for(const offset of [.3,.67])patch(x+.52,y+offset,.07,.045,hidden?'#6b7564':'#9ca58e',.45,offset);
    }
    const center=worldToGround({x:x+.5,y:y+.5});
    for(let i=0;i<(interactive?2:4);i++) {
      const q=(a,b)=>{const point=groundToWorld({x:center.x+a,y:center.y+b});return p(point.x,point.y,.2);};
      const a=-.45+noise(x,y,i+401)*.9,b=-.5+noise(x,y,i+417);
      const start=q(a,b),end=q(a+.08+noise(x,y,i+431)*.15,b-.025);
      ctx.beginPath();ctx.moveTo(start.x,start.y);
      ctx.quadraticCurveTo((start.x+end.x)/2,(start.y+end.y)/2-1.1*scale,end.x,end.y);
      ctx.strokeStyle=hidden?'#a2cec450':shallow?'#e4f5e8bb':'#c7eff1a0';ctx.lineWidth=.85*scale;ctx.stroke();
    }
    const corners=hexCorners(x,y);
    for(const [i,[dx,dy]] of directions.entries()) {
      const neighbor=terrainAt(x+dx,y+dy);
      if(neighbor===undefined||neighbor<0||neighbor===4||neighbor===6||(neighbor===3&&bridgeAxis(x+dx,y+dy)))continue;
      const a=corners[i],b=corners[(i+1)%6];
      const inner=(point,inset,z=.3)=>[point[0]*(1-inset)+(x+.5)*inset,point[1]*(1-inset)+(y+.5)*inset,z];
      paint([[...a,.3],[...b,.3],inner(b,.22),inner(a,.22)],hidden?'#486f5655':'#adc69888');
      paint([[...a,.34],[...b,.34],inner(b,.08,.34),inner(a,.08,.34)],hidden?'#a0ac8455':'#e0d5aaae');
      line(p(...inner(a,.24,.36)),p(...inner(b,.24,.36)),hidden?'#8bb7ab44':'#d1e9d990',.7);
      if(interactive)continue;
      for(let j=0;j<5;j++) {
        const t=(j+.3)/5,point=[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t];
        const base=inner(point,.035,.4),height=1.2+noise(x+i,y,j)*2.8;
        const root=p(...base);
        line(root,p(base[0]-.015,base[1]+.015,height),hidden?'#668858':'#7d9b59',.8);
        if(j%2===0){const stone=p(...inner(point,.1,.5));ctx.fillStyle=hidden?'#9da18a':'#d6cfac';ctx.beginPath();ctx.ellipse(stone.x,stone.y,1.5*scale,.75*scale,-.3,0,Math.PI*2);ctx.fill();}
      }
    }
  }
  function mud(x,y,hidden) {
    patch(x+.5,y+.5,.4,.5,hidden?'#443f3290':'#655139a0',.08,x*3+y);
    // Broken glints and shallow puddles suggest saturated, heavy soil.
    for(let i=0;i<3;i++) {
      const a=x+.2+((x*19+y*11+i*29)%57)/100,b=y+.2+((x*13+y*23+i*31)%59)/100;
      patch(a,b,.08+i*.025,.04+i*.018,hidden?'#58605a80':'#82908490',.14,i+x);
      const center=worldToGround({x:a,y:b});
      const ends=[-.045,.045].map(offset=>{const point=groundToWorld({x:center.x+offset,y:center.y});return p(point.x,point.y,.2);});
      line(...ends,hidden?'#8a8b7040':'#c4c1a466',.65);
    }
    for(const across of [-.15,.15]) {
      const center=worldToGround({x:x+.5,y:y+.5});
      const q=(a,b)=>{const point=groundToWorld({x:center.x+a,y:center.y+b});return p(point.x,point.y,.18);};
      line(q(across,-.65),q(across+.025,.65),hidden?'#292e2680':'#3c382bcc',2.2);
      line(q(across+.035,-.65),q(across+.06,.65),hidden?'#77735c55':'#a28a6466',.7);
    }
    const corners=hexCorners(x,y);
    for(const [i,[dx,dy]] of directions.entries()) {
      if(terrainAt(x+dx,y+dy)!==0)continue;
      const a=corners[i],b=corners[(i+1)%6];
      const inner=point=>[point[0]*.72+(x+.5)*.28,point[1]*.72+(y+.5)*.28,.22];
      paint([[...a,.22],[...b,.22],inner(b),inner(a)],hidden?'#57584655':'#8b805a80');
    }
  }

  function ground(x, y, hidden) {
    const type = terrainAt(x, y), variation = (x * 13 + y * 7) % 4;
    const grass = hidden ? ['#5c8861', '#5d8962', '#5b8760', '#5c8861'] : ['#90b76b', '#91b86c', '#8fb66a', '#90b76b'];
    const corners=hexCorners(x,y),top=corners.map(([a,b])=>p(a,b));
    const center=p(x+.5,y+.5);
    // Only exposed terrain edges have thickness; internal faces caused brown seams.
    for(let i=0;i<6;i++) {
      const j=(i+1)%6;
      const [dx,dy]=directions[i],neighbor=terrainAt(x+dx,y+dy);
      if((neighbor===undefined||neighbor<0)&&(top[i].y+top[j].y)/2>=center.y)polygon([top[i],top[j],p(...corners[j],-2.4),p(...corners[i],-2.4)],hidden?'#48563b':'#637348');
    }
    ctx.save();
    // A subpixel overlap closes antialias seams without moving tactical boundaries.
    polygon(hexCorners(x,y,-.003).map(([a,b])=>p(a,b)));ctx.clip();
    const base=type===4?(hidden?'#3a7a8d':'#55acbf'):type===6?(hidden?'#71a795':'#a5d6be'):type===5?(hidden?'#626e4b':'#a28b60'):grass[variation];
    tile(x,y,base,base,-.003,0,.3);
    if(type!==4&&type!==6&&type!==5)meadow(x,y,hidden,type);
    if (type === 4 || type === 6) water(x, y, hidden, type===6);
    else if (type === 5) mud(x,y,hidden);
    else if (type === 3) road(x, y, hidden);
    ctx.restore();
    const bevel=hexCorners(x,y,.012).map(([a,b])=>p(a,b,.15));
    for(let i=0;i<6;i++) {
      const [dx,dy]=directions[i];
      if((type===4||type===6)&&terrainAt(x+dx,y+dy)===type)continue;
      const j=(i+1)%6,mid={x:(top[i].x+top[j].x)/2,y:(top[i].y+top[j].y)/2};
      line(bevel[i],bevel[j],mid.x+mid.y<center.x+center.y?(hidden?'#b6cc9a20':'#d1e2ab30'):(hidden?'#233e2e25':'#294c3430'),.4);
    }
  }

  // Ground depth keeps overlapping faces and flocking patches ordered under
  // camera rotation. Elevation must not change which side of a hill is in front.
  function surface(facets, hidden, forest = false, tufts = []) {
    const ordered = surfaceMaterials(facets,forest).map(face => ({ face, depth:p(face.x,face.y).y }))
      .concat(tufts.filter((_,index)=>index%(interactive?4:2)===0).map(tuft => ({ tuft, depth: p(tuft.x, tuft.y).y })))
      .sort((a, b) => a.depth - b.depth);
    for (const item of ordered) {
      if (item.tuft) { flock(item.tuft, hidden); continue; }
      const color=hidden?item.face.hidden:item.face.visible;
      // A fine same-color overlap closes antialias hairlines between facets.
      polygon(item.face.points.map(vertex),color,color,.35);
    }
  }

  function mountain(x, y, hidden) {
    surface(mountainMesh(state.terrain, x, y,interactive), hidden);
  }

  function forest(x, y, hidden) {
    surface(forestMesh(state.terrain, x, y,interactive), hidden, true, forestTufts(state.terrain, x, y));
  }

  function flock(tuft, hidden) {
    const center = p(tuft.x, tuft.y, tuft.z), radius = tuft.radius * scale;
    const tone = (hidden ? 34 : 43) + tuft.tone * (hidden ? 8 : 11);
    if(interactive){
      ctx.fillStyle=`hsl(137 39% ${tone}%)`;
      ctx.beginPath();ctx.ellipse(center.x,center.y,radius,radius*.66,0,0,Math.PI*2);ctx.fill();
      return;
    }
    // Compact overlapping crowns add volume without tall trees hiding units.
    ctx.fillStyle=hidden?'#244f3838':'#28563a40';
    ctx.beginPath();ctx.ellipse(center.x+radius*.22,center.y+radius*.22,radius*.98,radius*.65,0,0,Math.PI*2);ctx.fill();
    const foliage = ctx.createRadialGradient(center.x - radius * .28, center.y - radius * .3, radius * .08, center.x, center.y, radius);
    foliage.addColorStop(0, `hsl(106 ${hidden ? 31 : 45}% ${tone + 16}%)`);
    foliage.addColorStop(.5, `hsl(131 ${hidden ? 30 : 43}% ${tone}%)`);
    foliage.addColorStop(1, `hsl(151 36% ${tone - 10}%)`);
    ctx.fillStyle = foliage;
    ctx.beginPath();
    for(let i=0;i<3;i++) {
      const angle=i*Math.PI*2/3+tuft.tone*2;
      const x=center.x+Math.cos(angle)*radius*.25,y=center.y+Math.sin(angle)*radius*.16;
      ctx.moveTo(x+radius*.73,y);ctx.ellipse(x,y,radius*.73,radius*.48,0,0,Math.PI*2);
    }
    ctx.closePath();ctx.fill();
    ctx.fillStyle=hidden?'#d7e9b132':'#ebf4c850';
    ctx.beginPath();ctx.ellipse(center.x-radius*.25,center.y-radius*.2,radius*.27,radius*.12,-.3,0,Math.PI*2);ctx.fill();
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
    if (type === 2) forest(x, y, hidden);
    if (type === 3) bridge(x, y, hidden);
  }
  return { ground, details };
}
