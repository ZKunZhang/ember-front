import test from 'node:test';
import assert from 'node:assert/strict';
import { HEX_DIRECTIONS } from '../src/game/hex.js';
import { worldToGround, project } from '../src/rendering/projection.js';
import { drawVehicleModel } from '../src/rendering/vehicles.js';
import { createTerrainRenderer } from '../src/rendering/terrain.js';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { drawCombat, IMPACT_DELAY } from '../src/rendering/combat.js';

test('vehicle bodies retain perpendicular sides in the same ground plane as the tabletop',()=>{
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>gradient:()=>{}});
  for(const type of Object.keys(UNIT_TYPES)) {
    for(const team of ['blue','red'])for(const [x,y] of HEX_DIRECTIONS){
      const plates=[];
      const painter={ctx,scale:1,p:(x,y)=>worldToGround({x,y}),line(){},polygon:points=>plates.push(points)};
      drawVehicleModel(painter,{type,team,x:10,y:8,heading:{x,y}});
      const plate=plates.find(points=>points.length===8);
      assert.ok(plate,`${type}: model has a rectangular armor or track plate`);
      const a={x:plate[1].x-plate[0].x,y:plate[1].y-plate[0].y};
      const b={x:plate[3].x-plate[2].x,y:plate[3].y-plate[2].y};
      const cosine=(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y));
      assert.ok(Math.abs(cosine)<1e-10,`${type}/${team}/${x},${y}: body was sheared`);
    }
  }
});

test('projectile trajectories follow each catalog weapon firing mode',()=>{
  const view={cols:12,rows:10,scale:1,tw:46,th:28,ox:0,oy:0};
  for(const type of Object.keys(UNIT_TYPES)) {
    const arcs=[];
    const ctx=new Proxy({arc(x,y){arcs.push({x,y});}}, {get:(object,key)=>object[key]??(()=>{})});
    const effect={id:1,started:0,amount:-3,x:7,y:4,source:{type,x:2,y:4}};
    drawCombat(ctx,view,[effect],IMPACT_DELAY/2);
    const source=project(view,2.5,4.5,19),target=project(view,7.5,4.5,14);
    const projectile=arcs.at(-1);
    assert.ok(Math.abs(projectile.x-(source.x+target.x)/2)<1e-10,`${type}: horizontal interpolation`);
    assert.ok(Math.abs(projectile.y-((source.y+target.y)/2-(UNIT_TYPES[type].indirect?36:0)))<1e-10,`${type}: catalog firing mode`);
  }
});

test('bridges keep constant width across the three road axes and meet neighboring centers',()=>{
  for(let axis=0;axis<3;axis++){
    const terrain=Array.from({length:7},()=>Array(7).fill(0));
    const [dx,dy]=HEX_DIRECTIONS[axis],[wx,wy]=HEX_DIRECTIONS[(axis+1)%3];
    terrain[3][3]=terrain[3+dy][3+dx]=terrain[3-dy][3-dx]=3;
    terrain[3+wy][3+wx]=4;
    const lines=[];
    const painter={ctx:{},view:{},scale:1,p:(x,y,z=0)=>({...worldToGround({x,y}),z}),polygon(){},tile(){},line:(a,b)=>lines.push([a,b])};
    createTerrainRenderer(painter,{terrain}).details(3,3,false);
    assert.equal(lines.length,8);
    const left=lines[0],right=lines[4];
    assert.ok(Math.abs(Math.hypot(right[0].x-left[0].x,right[0].y-left[0].y)-.54)<1e-10);
    const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const start=middle(left[0],right[0]),end=middle(left[1],right[1]);
    const expectedStart=worldToGround({x:3.5-dx/2,y:3.5-dy/2}),expectedEnd=worldToGround({x:3.5+dx/2,y:3.5+dy/2});
    for(const component of ['x','y']){
      assert.ok(Math.abs(start[component]-expectedStart[component])<1e-10);
      assert.ok(Math.abs(end[component]-expectedEnd[component])<1e-10);
    }
  }
});
