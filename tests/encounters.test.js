import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, FORMATIONS } from '../src/game/scenarios.js';
import { createState, updateFog, enemyAct, attackUnit, reachable, checkOutcome } from '../src/game/engine.js';
import { initialGame, gameReducer } from '../src/game/reducer.js';
import { lineOfSight } from '../src/game/sight.js';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { mountainMesh, mountainHeight } from '../src/rendering/landforms.js';

const unit=(id,team,x,y,extra={})=>({...UNIT_TYPES.scout,type:'scout',hp:9,id,team,x,y,moved:false,fired:false,...extra});
function field(units) {
  const s={cols:9,rows:9,terrain:Array.from({length:9},()=>Array(9).fill(0)),units,turn:'blue',turnNumber:1,winner:null};
  updateFog(s);return s;
}

for(const terrain of [1,2])test(`${terrain===1?'mountains':'forests'} hide units on the far side until a scout rounds the cover`,()=>{
  const s=field([unit(1,'blue',1,3),unit(2,'red',4,3)]);
  s.terrain[3][2]=terrain;updateFog(s);
  assert.equal(s.fog[3][2],false);assert.equal(s.fog[3][4],true);
  assert.equal(attackUnit(s,1,2).ok,false);
  assert.equal(s.units[0].fired,false);
  Object.assign(s.units[0],{x:3,y:2});updateFog(s);
  assert.equal(s.fog[3][4],false);
});

test('sight is symmetric and cannot leak through touching obstacle corners',()=>{
  const s=field([]),a={x:2,y:2},b={x:4,y:4};
  s.terrain[2][3]=1;s.terrain[3][2]=2;
  assert.equal(lineOfSight(s,a,b),false);assert.equal(lineOfSight(s,b,a),false);
  for(let x=0;x<9;x++)for(let y=0;y<9;y++) {
    const p={x,y};
    if(s.terrain[y][x]===0)assert.equal(lineOfSight(s,a,p),lineOfSight(s,p,a));
  }
});

test('a concealed patrol waits behind cover and only its local group wakes on contact',()=>{
  const s=field([unit(1,'blue',1,3),unit(2,'red',4,3,{patrolGroup:0}),unit(3,'red',6,3,{patrolGroup:0}),unit(4,'red',7,7,{patrolGroup:1})]);
  s.mission={kind:'breakthrough',required:1,points:[{x:8,y:8}]};s.turn='red';
  for(let y=1;y<=5;y++)s.terrain[y][2]=1;
  updateFog(s);
  assert.equal(enemyAct(s,2).moved,false);assert.equal(s.units[1].alerted,false);
  Object.assign(s.units[0],{x:3,y:3});updateFog(s);
  enemyAct(s,2);
  assert.equal(s.units[1].alerted,true);assert.equal(s.units[2].alerted,true);
  assert.notEqual(s.units[3].alerted,true);
});

test('movement stops on the first newly spotted enemy and undo restores fog and actions',()=>{
  const s={...initialGame(),...field([unit(1,'blue',0,4,{vision:2,move:6}),unit(2,'red',6,4)])};
  s.mission=null;s.selectedId=1;
  assert.ok(reachable(s,s.units[0]).has('5,4'));
  const next=gameReducer(s,{type:'CELL',x:5,y:4});
  assert.equal(next.units[0].x,4);assert.equal(next.units[0].fired,false);
  assert.equal(next.turn,'blue','contact must leave time to react even when the last vehicle has moved');
  assert.equal(next.fog[4][6],false);assert.match(next.notice.message,/发现 1 辆敌军/);
  const undone=gameReducer(next,{type:'UNDO'});
  assert.deepEqual(undone.units,s.units);assert.deepEqual(undone.fog,s.fog);
});

test('crossing operations vary force sizes, survival requirements and starting corners',()=>{
  const missions=SCENARIOS.filter(s=>s.mission?.kind==='breakthrough');
  assert.ok(missions.length>=10);
  assert.equal(new Set(missions.map(s=>s.approach)).size,4);
  assert.ok(new Set(missions.map(s=>s.allyCount)).size>=3);
  assert.ok(new Set(missions.map(s=>s.mission.required)).size>=3);
  for(const m of missions)for(const formation of Object.keys(FORMATIONS))for(const difficulty of ['simple','easy','hard']) {
    const s=createState(m.id,difficulty,formation),allies=s.units.filter(u=>u.team==='blue');
    assert.equal(allies.length,m.allyCount);
    assert.ok(s.units.filter(u=>u.team==='red').every(u=>s.fog[u.y][u.x]),`${m.id} exposes a starting patrol`);
    assert.ok(s.mission.points.length>=s.mission.required);
    assert.ok(allies.every(u=>!s.mission.points.some(p=>p.x===u.x&&p.y===u.y)));
    for(const enemy of s.units.filter(u=>u.team==='red'))enemy.hp=0;
    checkOutcome(s);assert.equal(s.winner,null,`${m.id} must still require extraction`);
  }
});

test('mountain tiles share elevated edges and meet walkable terrain at ground level',()=>{
  const terrain=Array.from({length:5},()=>Array(5).fill(0));
  for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)terrain[y][x]=1;
  const a=mountainMesh(terrain,1,2).flat(),b=mountainMesh(terrain,2,2).flat();
  for(const p of a.filter(p=>p[0]===2))assert.ok(b.some(q=>q.every((value,i)=>value===p[i])));
  assert.ok(mountainHeight(terrain,2,2.5)>20);
  assert.equal(mountainHeight(terrain,1,2.5),0);
  assert.ok(a.every(p=>p[2]>=0&&p[2]<60));
});
