import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, SCENARIOS } from '../src/game/scenarios.js';
import { createView, project, unproject,worldToGround,tableBounds } from '../src/rendering/projection.js';
import { HEX_DIRECTIONS } from '../src/game/hex.js';

for (const scenario of SCENARIOS) test(`${scenario.id}: orthographic tabletop respects the approach and keeps cells selectable`,()=>{
  const s=createScenario(scenario.id);
  for (const [width,height] of [[1000,620],[358,430]]) {
    const view=createView(s,width,height,1);
    const average=team=>{
      const units=s.deployments.filter(u=>u.team===team);
      return units.reduce((total,u)=>{
        const p=project(view,u.x+.5,u.y+.5);
        return {x:total.x+p.x/units.length,y:total.y+p.y/units.length};
      },{x:0,y:0});
    };
    const blue=average('blue'),red=average('red');
    assert.ok(s.advance==='right'?blue.x<red.x-width*.1:blue.y>red.y+height*.1,'deployment faces the chosen advance direction');
    const farA=project(view,2,3),farB=project(view,2,15),nearA=project(view,20,3),nearB=project(view,20,15);
    assert.ok(Math.abs((farB.x-farA.x)-(nearB.x-nearA.x))<1e-7,'same width at every depth');
    assert.ok(Math.abs((farB.y-farA.y)-(nearB.y-nearA.y))<1e-7,'one orthographic scale covers the entire table');
    for(const [x,y] of tableBounds(s).corners)for(const z of [0,-22]){
      const p=project(view,x,y,z);
      assert.ok(p.x>0&&p.x<width&&p.y>0&&p.y<height,'the complete wooden tray and its thickness fit');
    }
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++) {
      if(s.terrain[y][x]<0)continue;
      const point=project(view,x+.5,y+.5);
      assert.deepEqual(unproject(view,point.x,point.y),{x,y});
      assert.ok(point.x>0&&point.x<width&&point.y>0&&point.y<height);
    }
  }
});

test('all six hex directions retain equal ground distance without shearing the board',()=>{
  for(const [x,y] of HEX_DIRECTIONS){
    const p=worldToGround({x,y});
    assert.ok(Math.abs(Math.hypot(p.x,p.y)-1)<1e-10);
  }
});
