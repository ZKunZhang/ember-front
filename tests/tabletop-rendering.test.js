import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTabletop } from '../src/rendering/battlefield.js';
import { drawVehicleBase } from '../src/rendering/vehicles.js';
import { createTerrainRenderer } from '../src/rendering/terrain.js';
import { createPainter } from '../src/rendering/primitives.js';
import { createView, project, worldToGround, tableBounds } from '../src/rendering/projection.js';
import { HEX_DIRECTIONS } from '../src/game/hex.js';

const context=()=>new Proxy({}, {get:(target,key)=>key in target?target[key]:key.startsWith('create')?()=>({addColorStop(){}}):()=>{}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const average=points=>points.reduce((sum,p)=>({x:sum.x+p.x/points.length,y:sum.y+p.y/points.length}),{x:0,y:0});

test('physical tray has four straight aligned sides even when the tactical footprint has holes',()=>{
  for(const approach of ['northwest','northeast','southwest','southeast'])for(const advance of ['up','right']) {
    const state={cols:4,rows:3,approach,advance,terrain:[[0,0,-1,-1],[-1,0,0,-1],[-1,-1,0,0]]};
    const view=createView(state,1000,720),painter=createPainter(context(),view),faces=[];
    painter.polygon=(points,fill)=>faces.push({points,fill});
    drawTabletop(painter,state);
    const outline=faces[0].points;
    assert.equal(outline.length,4,'the entire table uses one rectangular outline');
    for(let i=0;i<4;i++) {
      const a=outline[i],b=outline[(i+1)%4];
      assert.ok(Math.abs(a.x-b.x)<1e-8||Math.abs(a.y-b.y)<1e-8,'initial tray edges must face the viewer squarely');
    }
    const backing=tableBounds(state,.25).corners.map(([x,y])=>painter.p(x,y,-3));
    assert.ok(faces.some(face=>face.points.length===4&&face.points.every((point,i)=>
      Math.hypot(point.x-backing[i].x,point.y-backing[i].y)<1e-8)),
    'holes are backed by one continuous ungridded painted surface');
    for(const point of outline)assert.ok(point.x>=0&&point.x<=view.width&&point.y>=0&&point.y<=view.height,'full table fits the viewport');
  }
});

test('vehicle base remains centered on fractional tactical coordinates with a lower-right shadow',()=>{
  const state={cols:4,rows:3,terrain:Array.from({length:3},()=>Array(4).fill(0))};
  for(const rotation of [0,.65,-1.1])for(const team of ['blue','red']) {
    const view=createView(state,1000,720,1,{x:0,y:0},{rotation});
    const ctx=context(),painter=createPainter(ctx,view),faces=[];
    painter.polygon=(points,fill)=>faces.push({points,fill});
    const unit={x:1.27,y:.83,team};
    drawVehicleBase(painter,unit);
    const expected=project(view,unit.x+.5,unit.y+.5),center=average(faces[0].points);
    near(center.x,expected.x);near(center.y,expected.y-.1*view.scale);
    const top=faces.find(face=>typeof face.fill==='object');
    const topCenter=average(top.points);
    near(topCenter.x,expected.x);near(topCenter.y,expected.y-1.7*view.scale);
    assert.ok(ctx.shadowOffsetX>0&&ctx.shadowOffsetY>0);
  }
});

test('narrow road strips keep their centerline on every legal neighboring hex axis',()=>{
  for(const [dx,dy] of HEX_DIRECTIONS) {
    const terrain=Array.from({length:5},()=>Array(5).fill(0));
    terrain[2][2]=terrain[2+dy][2+dx]=3;
    const faces=[],ctx=context();
    const painter={ctx,view:{},scale:1,p:(x,y)=>worldToGround({x,y}),tile(){},line(){},polygon:(points,fill)=>faces.push({points,fill})};
    createTerrainRenderer(painter,{terrain}).ground(2,2,false);
    const strip=faces.find(face=>face.points.length===4&&
      Math.abs(Math.hypot(face.points[0].x-face.points[3].x,face.points[0].y-face.points[3].y)-.28)<1e-8).points;
    const from=average([strip[0],strip[3]]),to=average([strip[1],strip[2]]);
    const expectedFrom=worldToGround({x:2.5,y:2.5}),expectedTo=worldToGround({x:2.5+dx,y:2.5+dy});
    near(from.x,expectedFrom.x);near(from.y,expectedFrom.y);
    near(to.x,expectedTo.x);near(to.y,expectedTo.y);
    near(Math.hypot(strip[0].x-strip[3].x,strip[0].y-strip[3].y),.28);
  }
});
