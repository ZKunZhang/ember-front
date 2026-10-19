import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS,createScenario } from '../src/game/scenarios.js';
import { layoutScenario,sourceToHex,hexToSource } from '../src/game/layout.js';
import { createView,project,unproject } from '../src/rendering/projection.js';
import { hexNeighbors,hexDistance,hexCorners } from '../src/game/hex.js';

test('rectangular author columns alternate half a hex instead of accumulating diagonal displacement',()=>{
  for(const {id} of SCENARIOS){
    const state=createScenario(id),view=createView(state,1100,900);
    const rows=[0,1].map(()=>[]);
    for(let column=1;column<=16;column++){
      const cell=sourceToHex(state,{x:10,y:column}),p=project(view,cell.x+.5,cell.y+.5);
      rows[column%2].push(state.advance==='right'?p.x:p.y);
      assert.deepEqual(unproject(view,p.x,p.y),cell);
    }
    for(const row of rows)assert.ok(Math.max(...row)-Math.min(...row)<1e-7,`${id}: same-parity columns must line up`);
    const cell=sourceToHex(state,{x:10,y:8}),a=project(view,cell.x+.5,cell.y+.5);
    const next=sourceToHex(state,{x:11,y:8}),b=project(view,next.x+.5,next.y+.5);
    const halfStep=Math.abs(rows[0][0]-rows[1][0]);
    assert.ok(Math.abs(halfStep-Math.hypot(b.x-a.x,b.y-a.y)/2)<1e-7,`${id}: odd columns differ by exactly half a cell`);
  }
});

test('layout converts terrain, objective, structures and units together without moving headings',()=>{
  const point={x:3,y:3,label:'target'};
  const raw={cols:6,rows:5,terrain:Array.from({length:5},(_,y)=>Array.from({length:6},(_,x)=>(x+y)%7)),
    deployments:[{...point,heading:{x:-1,y:0},team:'blue'}],landmarks:[point],
    mission:{kind:'defend',point,points:[point],turns:5},
    features:[{...point,type:'airfield',runway:{from:point,to:{x:3,y:4}},hangars:[point]}]};
  const state=layoutScenario(raw);
  for(let y=0;y<raw.rows;y++)for(let x=0;x<raw.cols;x++){
    const cell=sourceToHex(state,{x,y});
    assert.equal(state.terrain[cell.y][cell.x],raw.terrain[y][x]);
    assert.deepEqual(hexToSource(state,cell),{x,y});
  }
  for(const converted of [state.deployments[0],state.landmarks[0],state.mission.point,state.mission.points[0],state.features[0],state.features[0].runway.from,state.features[0].hangars[0]]){
    const source=hexToSource(state,converted);
    assert.equal(source.x,point.x);assert.equal(source.y,point.y);
  }
  assert.deepEqual(state.deployments[0].heading,{x:-1,y:0});
});

test('offset columns still share exact hex edges with all six tactical neighbors',()=>{
  const state=createScenario('pine-highlands');
  for(const column of [5,6]){
    const cell=sourceToHex(state,{x:10,y:column}),corners=hexCorners(cell.x,cell.y);
    const neighbors=hexNeighbors(cell);
    assert.equal(neighbors.length,6);
    for(const neighbor of neighbors){
      assert.equal(hexDistance(cell,neighbor),1);
      const other=hexCorners(neighbor.x,neighbor.y);
      const shared=corners.filter(p=>other.some(q=>p.every((v,i)=>v===q[i])));
      assert.equal(shared.length,2,'true axial rules preserve the full shared edge');
      const source=hexToSource(state,neighbor);
      assert.ok(Math.abs(source.x-10)<=1&&Math.abs(source.y-column)<=1);
    }
  }
});
