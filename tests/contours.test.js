import { roundHex } from '../src/game/hex.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeContours } from '../src/rendering/contours.js';
import { movementPosition, movementDuration } from '../src/game/movement.js';

const area=points=>points.reduce((sum,[x,y],i)=>{const [a,b]=points[(i+1)%points.length];return sum+x*b-a*y;},0)/2;

test('rounded range boundaries keep disconnected diagonal cells separate',()=>{
  const loops=rangeContours(new Set(['0,0','1,1']));
  assert.equal(loops.length,2);
  assert.ok(loops.every(loop=>Math.abs(area(loop)-1)<1e-9));
  assert.ok(loops.every(loop=>loop.length===6));
});

test('range contours retain holes and trace only exposed edges',()=>{
  const cells=new Set();for(let x=0;x<3;x++)for(let y=0;y<3;y++)if(x!==1||y!==1)cells.add(`${x},${y}`);
  const loops=rangeContours(cells);
  assert.equal(loops.length,2);
  assert.ok(Math.abs(loops.reduce((sum,loop)=>sum+area(loop),0)-8)<1e-9);
  assert.equal(loops.reduce((sum,loop)=>sum+loop.length,0),28);
  assert.deepEqual(rangeContours(new Set()),[]);
});

test('smoothed movement corners stay inside the actual route cells',()=>{
  const motion={unitId:1,started:0,path:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}]};
  const unit={id:1,x:2,y:1},cells=new Set(motion.path.map(p=>`${p.x},${p.y}`));
  let diagonal=false;
  for(let i=0;i<=100;i++){
    const p=movementPosition(unit,[motion],movementDuration(motion)*i/100);
    const cell=roundHex(p.x,p.y);
    assert.ok(cells.has(`${cell.x},${cell.y}`));
    if(!Number.isInteger(p.x)&&!Number.isInteger(p.y))diagonal=true;
  }
  assert.equal(diagonal,true,'corners should curve within the passable cell');
});
