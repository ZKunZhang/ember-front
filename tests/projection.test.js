import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, SCENARIOS } from '../src/game/scenarios.js';
import { createView, project, unproject } from '../src/rendering/projection.js';

for (const scenario of SCENARIOS) test(`${scenario.id}: perspective tabletop view puts allies in front and keeps cells selectable`,()=>{
  const s=createScenario(scenario.id);
  for (const [width,height] of [[1000,620],[358,430]]) {
    const view=createView(s,width,height,1);
    const averageY=team=>{
      const units=s.deployments.filter(u=>u.team===team);
      return units.reduce((total,u)=>total+project(view,u.x+.5,u.y+.5).y,0)/units.length;
    };
    assert.ok(averageY('blue')>averageY('red')+height*.1);
    assert.ok(view.th/view.tw>.5&&view.th/view.tw<.7);
    const a=project(view,8,7),b=project(view,8,8),c=project(view,9,7);
    assert.equal(b.y,a.y);
    assert.ok(c.x<a.x);
    const farWidth=project(view,2,15).x-project(view,2,3).x;
    const nearWidth=project(view,20,15).x-project(view,20,3).x;
    assert.ok(nearWidth>farWidth*1.2);
    assert.ok(b.x>a.x);assert.ok(c.y>a.y);
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++) {
      if(s.terrain[y][x]<0)continue;
      const point=project(view,x+.5,y+.5);
      assert.deepEqual(unproject(view,point.x,point.y),{x,y});
      assert.ok(point.x>0&&point.x<width&&point.y>0&&point.y<height);
    }
  }
});
