import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, FORMATIONS, createScenario } from '../src/game/scenarios.js';
import { DIFFICULTIES } from '../src/game/difficulty.js';

test('every scenario and difficulty has legal deployments and a connected approach',()=>{
  for (const meta of SCENARIOS) for (const difficulty of Object.keys(DIFFICULTIES)) {
    const s=createScenario(meta.id,difficulty), occupied=new Set(s.deployments.map(u=>`${u.x},${u.y}`));
    assert.equal(s.deployments.length,9+s.enemyCount);
    assert.equal(occupied.size,s.deployments.length);
    for (const u of s.deployments) assert.ok(s.terrain[u.y][u.x]>=0);
    const passable=(x,y)=>x>=0&&y>=0&&x<s.cols&&y<s.rows&&[0,3].includes(s.terrain[y][x]);
    const seen=new Set(s.deployments.filter(u=>u.team==='blue').map(u=>`${u.x},${u.y}`)), queue=[...seen];
    for(let i=0;i<queue.length;i++){const [x,y]=queue[i].split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=`${x+dx},${y+dy}`;if(!seen.has(k)&&passable(x+dx,y+dy)){seen.add(k);queue.push(k);}}}
    for (const u of [...s.deployments.filter(u=>u.team==='red'),...(s.mission?.points||(s.mission?.point?[s.mission.point]:[]))]) assert.ok(seen.has(`${u.x},${u.y}`),`${meta.id} cannot reach ${u.x},${u.y}`);
  }
});

test('maps and formations provide distinct rosters and valid overrides',()=>{
  const allTypes=new Set(['scout','tank','heavyTank','artillery','rocket','engineer']);
  for (const formation of Object.values(FORMATIONS)) { assert.equal(formation.types.length,9); assert.deepEqual(new Set(formation.types),allTypes); }
  assert.deepEqual(createScenario('mountain-pass').deployments.slice(0,9).map(u=>u.type),FORMATIONS.balanced.types);
  assert.notDeepEqual(createScenario('forest-corridor').terrain,createScenario('broken-basin').terrain);
  const custom=createScenario('mountain-pass','hard','artillery');
  assert.equal(custom.formationId,'artillery');assert.equal(custom.formationName,FORMATIONS.artillery.name);
  assert.equal(createScenario('mountain-pass','hard','missing').formationId,'balanced');
});

test('historical adaptation scenarios expose story and mission contracts',()=>{
  const expected = {
    'alamein-breakthrough': ['capture', 14],
    'bridge-relief': ['escort', 16],
    'ardennes-watch': ['hold', 18],
  };
  for (const [id,[kind,count]] of Object.entries(expected)) {
    const meta=SCENARIOS.find(s=>s.id===id), s=createScenario(id);
    assert.ok(meta?.story); assert.match(meta.story.chapter,/^战史改编 · 0[1-3]$/);
    assert.equal(typeof meta.story.history,'string'); assert.ok(meta.story.sourceUrl.startsWith('https://'));
    for (const key of ['intro','success','failure']) assert.ok(meta.story[key].length>10);
    assert.equal(meta.mission.kind,kind); assert.equal(meta.enemyCount,count);
    const target=kind==='capture'?meta.mission.points:[meta.mission.point];
    for (const point of target) assert.ok([0,3].includes(s.terrain[point.y][point.x]),`${id} mission point is impassable`);
  }
});
