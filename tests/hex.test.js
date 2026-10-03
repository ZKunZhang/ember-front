import test from 'node:test';
import assert from 'node:assert/strict';
import { HEX_DIRECTIONS, hexCorners, hexDistance, roundHex, hexContains } from '../src/game/hex.js';
import { reachable, updateFog, inFireRange, repairUnit, moveUnit } from '../src/game/engine.js';
import { lineOfSight } from '../src/game/sight.js';
import { createView, project, unproject } from '../src/rendering/projection.js';
import { rangeContours } from '../src/rendering/contours.js';
import { movementDuration, movementPosition } from '../src/game/movement.js';
import { UNIT_TYPES } from '../src/game/catalog.js';

const vehicle=(id,team,type,x,y,extra={})=>({...UNIT_TYPES[type],id,team,type,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false,...extra});
const field=units=>{
  const s={cols:15,rows:15,terrain:Array.from({length:15},()=>Array(15).fill(0)),units,turn:'blue',turnNumber:1,winner:null};
  updateFog(s);return s;
};

test('open hex movement and vision have six neighbors and complete rings',()=>{
  const unit=vehicle(1,'blue','scout',7,7,{vision:2}),s=field([unit]);
  const one=reachable(s,unit,1);
  assert.deepEqual(new Set(one.keys()),new Set(['8,7','7,8','6,8','6,7','7,6','8,6']));
  assert.equal(s.fog.flat().filter(v=>!v).length,19);
  for(const radius of [1,2,3,4]) {
    const routes=reachable(s,unit,radius);
    assert.equal(routes.size,3*radius*(radius+1));
    for(const path of routes.values()) {
      assert.equal(path.length,hexDistance(unit,path.at(-1)));
      for(const [i,p] of path.entries())assert.equal(hexDistance(i?path[i-1]:unit,p),1);
    }
  }
  assert.equal(moveUnit(s,1,8,6).moved,1,'the new diagonal is one legal move');
});

test('all six hex directions agree on range, repair, and blocking terrain',()=>{
  for(const [dx,dy] of HEX_DIRECTIONS) {
    const engineer=vehicle(1,'blue','engineer',7,7);
    const ally=vehicle(2,'blue','tank',7+dx,7+dy,{hp:5});
    const s=field([engineer,ally]);
    assert.equal(repairUnit(s,1,2).ok,true);
    engineer.fired=false;Object.assign(ally,{x:7+2*dx,y:7+2*dy});
    assert.equal(repairUnit(s,1,2).ok,false);
    const gun={...engineer,minRange:2,range:3,indirect:true};
    assert.equal(inFireRange(s,gun,{x:7+dx,y:7+dy}),false);
    assert.equal(inFireRange(s,gun,{x:7+3*dx,y:7+3*dy}),true);
    assert.equal(inFireRange(s,gun,{x:7+4*dx,y:7+4*dy}),false);
    for(const terrain of [1,2,4,-1]) {
      s.terrain[7+dy][7+dx]=terrain;
      assert.equal(reachable(s,engineer,1).has(`${7+dx},${7+dy}`),false);
    }
    const target={x:7+2*dx,y:7+2*dy};
    for(const terrain of [1,2]) {
      s.terrain[7+dy][7+dx]=terrain;updateFog(s);
      assert.equal(lineOfSight(s,engineer,target),false);
      assert.equal(lineOfSight(s,target,engineer),false);
      assert.equal(inFireRange(s,{...gun,indirect:false},target),false);
      assert.equal(inFireRange(s,gun,target),true);
    }
  }
});

test('hex line of sight is symmetric, includes edge contacts, and reveals the cover itself',()=>{
  const source={x:5,y:5},target={x:7,y:7},s=field([]);
  // The ray follows the shared edge of these two hexes. Either side blocks it.
  for(const cell of [{x:6,y:5},{x:5,y:6}]) {
    s.terrain[cell.y][cell.x]=1;
    assert.equal(lineOfSight(s,source,cell),true);
    assert.equal(lineOfSight(s,source,target),false);
    assert.equal(lineOfSight(s,target,source),false);
    s.terrain[cell.y][cell.x]=0;
  }
  assert.equal(lineOfSight(s,source,target),true);
  for(let y=0;y<15;y++)for(let x=0;x<15;x++)if((x*7+y*11)%13===0)s.terrain[y][x]=2;
  for(let y=0;y<15;y++)for(let x=0;x<15;x++) {
    assert.equal(lineOfSight(s,source,{x,y}),lineOfSight(s,{x,y},source));
  }
});

test('hex picking follows painted edges and vertices at desktop/mobile sizes, zoom and pan',()=>{
  const s=field([]),cell={x:7,y:7};
  for(const [width,height] of [[1440,1080],[390,720]])for(const zoom of [.6,1,2]) {
    const view=createView(s,width,height,zoom,{x:51,y:-27});
    const center=project(view,7.5,7.5),corners=hexCorners(7,7).map(([x,y])=>project(view,x,y));
    assert.deepEqual(unproject(view,center.x,center.y),cell);
    for(const [i,a] of corners.entries()) {
      const b=corners[(i+1)%6],middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const inside={x:middle.x*.999+center.x*.001,y:middle.y*.999+center.y*.001};
      const outside={x:middle.x*1.001-center.x*.001,y:middle.y*1.001-center.y*.001};
      assert.deepEqual(unproject(view,inside.x,inside.y),cell);
      const [dx,dy]=HEX_DIRECTIONS[i];
      assert.deepEqual(unproject(view,outside.x,outside.y),{x:7+dx,y:7+dy});
      assert.deepEqual(unproject(view,a.x*.99+center.x*.01,a.y*.99+center.y*.01),cell);
    }
  }
});

test('new diagonal hex neighbors share a contour and curved motion stays on route',()=>{
  const loops=rangeContours(new Set(['0,1','1,0']));
  assert.equal(loops.length,1);assert.equal(loops[0].length,10);
  const path=[{x:3,y:3},{x:4,y:2},{x:4,y:1},{x:3,y:1}];
  const motion={unitId:1,started:0,path},unit={id:1,...path.at(-1)};
  for(let i=0;i<=100;i++) {
    const p=movementPosition(unit,[motion],movementDuration(motion)*i/100);
    const cell=roundHex(p.x,p.y);
    assert.ok(path.some(q=>q.x===cell.x&&q.y===cell.y));
    assert.ok(path.some(q=>hexContains(p.x+.5,p.y+.5,q)));
  }
});
