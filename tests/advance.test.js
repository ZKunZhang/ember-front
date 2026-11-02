import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, SCENARIOS } from '../src/game/scenarios.js';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { DIFFICULTIES, enemyCountFor } from '../src/game/difficulty.js';
import { createState, updateFog, reachable, moveUnit, enemyAct, beginPlayerTurn, attackUnit, checkOutcome, distance } from '../src/game/engine.js';
import { authoredToHex } from '../src/game/layout.js';
import { createView, project } from '../src/rendering/projection.js';

const scenarioId = 'long-road-contact';
const key = p=>`${p.x},${p.y}`;
const enemies = s=>s.units.filter(u=>u.team==='red');

test('the march has three local hidden patrols at every difficulty and a usable exit',()=>{
  for (const difficulty of Object.keys(DIFFICULTIES)) for (const formation of Object.keys(FORMATIONS)) {
    const s=createState(scenarioId,difficulty,formation),blue=s.units.filter(u=>u.team==='blue'),red=enemies(s);
    assert.equal(red.length,enemyCountFor(18,difficulty));
    assert.deepEqual([...new Set(red.map(u=>u.patrolGroup))].sort(),[0,1,2]);
    assert.ok(red.every(u=>s.fog[u.y][u.x]));
    assert.ok(s.mission.points.length>=s.mission.required);
    for (const u of red) assert.ok(blue.every(b=>distance(u,b)>u.vision));
    const originals=red.map(u=>[u.id,u.x,u.y,u.hp]);
    s.turn='red';for (const u of red) enemyAct(s,u.id);
    assert.deepEqual(red.map(u=>[u.id,u.x,u.y,u.hp]),originals);
    assert.ok(red.every(u=>!u.alerted));
    const view=createView(s,1440,1080);
    assert.ok(project(view,blue[0].x,blue[0].y).x<project(view,s.mission.points[0].x,s.mission.points[0].y).x);
    assert.match(s.direction,/向右推进/);
  }
});

test('real movement contacts each patrol in order without waking later groups',()=>{
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const s=createState(scenarioId,difficulty),scout=s.units[0];
    const posts=new Map(enemies(s).map(u=>[u.id,key(u)]));
    // Keep the observer alive while testing all contacts, independently of damage rolls.
    scout.hp=scout.maxHp=1000;
    for (const [group,position] of [[0,{x:24,y:8}],[1,{x:15,y:15}],[2,{x:6,y:9}]]) {
      const target=authoredToHex(s,position);
      let contacts=0,steps=0;
      while (!enemies(s).filter(u=>u.patrolGroup===group).every(u=>u.alerted)) {
        assert.ok(++steps<20,'valley remains traversable between contacts');
        const route=reachable(s,scout,Infinity,false).get(key(target));
        assert.ok(route,'scout can reach the next segment');
        const destination=route[Math.min(scout.move,route.length)-1];
        const move=moveUnit(s,scout.id,destination.x,destination.y);
        assert.equal(move.ok,true);contacts+=move.encountered;
        s.turn='red';
        for (const u of enemies(s).filter(u=>u.hp>0)) enemyAct(s,u.id);
        assert.ok(enemies(s).filter(u=>u.patrolGroup>group).every(u=>!u.alerted),'later patrols stay asleep');
        assert.ok(enemies(s).filter(u=>u.patrolGroup>group).every(u=>key(u)===posts.get(u.id)),'later patrols stay at their original posts');
        beginPlayerTurn(s);
      }
      assert.ok(contacts>0,'marching reveals a fresh contact');
      assert.ok(enemies(s).filter(u=>u.patrolGroup===group).every(u=>u.alerted));
      for (const u of enemies(s).filter(u=>u.patrolGroup===group)) u.hp=0;
    }
  }
});

test('mountain and forest terrain offers wide valley and separate flank passages without roads',()=>{
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const s=createState(scenarioId,difficulty),scale=s.mapScale??1;
    assert.equal(s.terrain.flat().filter(t=>t===3).length,0);
    assert.ok(s.terrain.flat().filter(t=>t===1).length>=80*scale*scale);
    assert.ok(s.terrain.flat().filter(t=>t===2).length>=140*scale*scale);
    assert.ok(s.terrain.flat().filter(t=>t===0).length>=400*scale*scale);
    for (const [x,main,flank] of [[27,6,17],[18,14,5],[9,8,18]]) {
      for (const start of [main,flank]) for (let y=start;y<start+4;y++) {
        const p=authoredToHex(s,{x,y});
        assert.equal(s.terrain[p.y][p.x],0,'four-cell opening remains clear for maneuver');
      }
    }
  }
});

test('march victory still requires five simultaneous arrivals and fails below five survivors',()=>{
  const s=createState(scenarioId),blue=s.units.filter(u=>u.team==='blue');
  for (const u of enemies(s)) u.hp=0;
  checkOutcome(s);assert.equal(s.winner,null);
  for (let i=0;i<4;i++) Object.assign(blue[i],s.mission.points[i]);
  checkOutcome(s);assert.equal(s.winner,null);
  Object.assign(blue[4],s.mission.points[4]);checkOutcome(s);assert.equal(s.winner,'blue');
  const failed=createState(scenarioId);
  failed.units.filter(u=>u.team==='blue').slice(4).forEach(u=>{u.hp=0;});
  checkOutcome(failed);assert.equal(failed.winner,'red');
});

const makeUnit=(type,id,team,x,y)=>({...UNIT_TYPES[type],type,id,team,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false});
function firingField(type) {
  const units=[makeUnit(type,1,'blue',1,3),makeUnit('tank',2,'red',6,3)];
  const s={cols:12,rows:8,terrain:Array.from({length:8},()=>Array(12).fill(0)),units,turn:'blue',winner:null};
  updateFog(s);return s;
}

test('new guns require shared vision; cannon is blocked by cover while howitzers fire over it',()=>{
  for (const type of ['cannon','howitzer','gunHowitzer']) for (const cover of [1,2]) {
    const s=firingField(type),gun=s.units[0],target=s.units[1];
    s.terrain[3][3]=cover;updateFog(s);
    assert.equal(attackUnit(s,1,2).ok,false,'unobserved target remains protected');
    s.units.push(makeUnit('scout',3,'blue',6,4));updateFog(s);
    const hp=target.hp,result=attackUnit(s,1,2);
    assert.equal(result.ok,type!=='cannon');
    if (type==='cannon') { assert.match(result.message,/山林阻挡/);assert.equal(gun.fired,false);assert.equal(target.hp,hp); }
    else { assert.equal(result.damage,gun.attack-target.armor);assert.equal(gun.fired,true); }
  }
});

test('new guns enforce their exact minimum and maximum range without wasting failed shots',()=>{
  for (const type of ['cannon','howitzer','gunHowitzer']) {
    const spec=UNIT_TYPES[type];
    for (const [range,ok] of [[spec.minRange-1,false],[spec.minRange,true],[spec.range,true],[spec.range+1,false]]) {
      const s=firingField(type),gun=s.units[0],target=s.units[1];
      target.x=gun.x+range;
      s.units.push(makeUnit('scout',3,'blue',target.x,4));updateFog(s);
      assert.equal(attackUnit(s,1,2).ok,ok,`${type}: ${range}`);
      assert.equal(gun.fired,ok);
    }
  }
});

test('shelling alerts only the struck patrol, and short escort rosters keep their engineer',()=>{
  const s=createState(scenarioId),gun=s.units.find(u=>u.type==='howitzer'),target=enemies(s)[0];
  Object.assign(gun,{x:target.x+4,y:target.y});
  s.units.push(makeUnit('scout',100,'blue',target.x,target.y+1));updateFog(s);
  assert.equal(attackUnit(s,gun.id,target.id).ok,true);
  assert.ok(enemies(s).filter(u=>u.patrolGroup===0).every(u=>u.alerted));
  assert.ok(enemies(s).filter(u=>u.patrolGroup!==0).every(u=>!u.alerted));
  for (const meta of SCENARIOS.filter(m=>m.mission?.kind==='escort')) {
    const escort=createState(meta.id,'hard','fireSupport');
    checkOutcome(escort);assert.equal(escort.winner,null);
    assert.ok(escort.units.some(u=>u.team==='blue'&&u.type==='engineer'));
  }
});
