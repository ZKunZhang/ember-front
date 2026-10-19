import { sourceToHex } from '../src/game/layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, FORMATIONS, createScenario } from '../src/game/scenarios.js';
import { DIFFICULTIES } from '../src/game/difficulty.js';
import { hexNeighbors, hexDistance } from '../src/game/hex.js';

const ids = ['bog-rescue','ford-crossing','last-bridge','airfield-defense'];
const key = p => `${p.x},${p.y}`;
const targets = s => [...(s.mission?.points??[]),...(s.mission?.point?[s.mission.point]:[])];
function distances(s, start, allowed = value => [0,3,5,6].includes(value)) {
  const seen = new Map([[key(start),0]]), queue = [start];
  for (let i=0;i<queue.length;i++) for (const p of hexNeighbors(queue[i])) {
    if (!seen.has(key(p)) && allowed(s.terrain[p.y]?.[p.x],p)) {
      seen.set(key(p),seen.get(key(queue[i]))+1); queue.push(p);
    }
  }
  return seen;
}

test('four terrain missions extend the existing roster to 27 maps',()=>{
  assert.equal(SCENARIOS.length,27);
  assert.deepEqual(SCENARIOS.slice(-4).map(s=>s.id),ids);
  for(const id of ids) for(const difficulty of Object.keys(DIFFICULTIES)) for(const formation of Object.keys(FORMATIONS)) {
    const s=createScenario(id,difficulty,formation), blue=s.deployments.filter(u=>u.team==='blue');
    assert.equal(s.deployments.length,s.allyCount+s.enemyCount);
    assert.equal(new Set(s.deployments.map(key)).size,s.deployments.length);
    assert.deepEqual(blue.map(u=>u.type),FORMATIONS[formation].types);
    const seen=distances(s,blue[0]);
    for(const p of [...s.deployments,...targets(s)]) {
      assert.ok([0,3,5,6].includes(s.terrain[p.y][p.x]),`${id} illegal ground at ${key(p)}`);
      assert.ok(seen.has(key(p)),`${id}/${difficulty}/${formation} disconnected at ${key(p)}`);
    }
  }
});

test('the sole bridge is the only connection across a full-width deep river',()=>{
  const s=createScenario('last-bridge','hard'), [near,far]=s.mission.points;
  const bridge=[];
  for(let y=8;y<=10;y++) for(let x=1;x<=20;x++) {
    const p=sourceToHex(s,{x,y}), value=s.terrain[p.y][p.x];
    if(value<0)continue;
    if(value===3) bridge.push(p);
    else assert.equal(value,4);
  }
  assert.deepEqual(bridge,[{x:11,y:8},{x:11,y:9},{x:11,y:10}].map(p=>sourceToHex(s,p)));
  assert.ok(distances(s,near).has(key(far)));
  for(const p of bridge) s.terrain[p.y][p.x]=4;
  assert.ok(!distances(s,near).has(key(far)));
});

test('the multi-cell ford provides a real crossing and deep water has no bypass',()=>{
  const s=createScenario('ford-crossing','hard'), [near,far]=s.mission.points;
  const shallow=s.terrain.flat().filter(value=>value===6);
  assert.ok(shallow.length>=5);
  assert.ok(s.landmarks.some(p=>p.label==='河心岛' && s.terrain[p.y][p.x]===0));
  assert.ok(distances(s,near).has(key(far)));
  s.terrain=s.terrain.map(row=>row.map(value=>value===6?4:value));
  assert.ok(!distances(s,near).has(key(far)));
});

test('a contiguous bog offers a shorter muddy route and a usable dry detour',()=>{
  const s=createScenario('bog-rescue'), mud=[];
  for(let y=0;y<s.rows;y++) for(let x=0;x<s.cols;x++) if(s.terrain[y][x]===5) mud.push({x,y});
  assert.ok(mud.length>=60);
  assert.equal(distances(s,mud[0],value=>value===5).size,mud.length);
  const from=sourceToHex(s,{x:16,y:5}),to=sourceToHex(s,{x:6,y:12});
  const direct=distances(s,from).get(key(to));
  const dry=distances(s,from,value=>[0,3].includes(value)).get(key(to));
  assert.ok(Number.isFinite(dry));
  assert.ok(direct<dry,`muddy ${direct}, dry ${dry}`);
  assert.equal(s.mission.kind,'escort');
  assert.ok(s.deployments.some(u=>u.team==='blue' && u.type==='engineer'));
});

test('airport guards deploy around the runway while attackers have a connected advance',()=>{
  const s=createScenario('airfield-defense','hard');
  assert.equal(s.mission.kind,'defend'); assert.equal(s.mission.turns,5);
  assert.equal(s.mission.points.length,6);
  const protectedCells=new Set(s.mission.points.map(key));
  for(const u of s.deployments.filter(u=>u.team==='red')) {
    assert.ok(!protectedCells.has(key(u)));
    assert.ok(s.mission.points.every(p=>hexDistance(u,p)>=5));
    assert.ok(distances(s,u).has(key(s.mission.point)));
  }
  assert.ok(s.deployments.filter(u=>u.team==='blue').every(u=>s.mission.points.some(p=>hexDistance(u,p)<=2)));
  const feature=s.features[0];
  assert.equal(feature.type,'airfield'); assert.equal(feature.label,'前线机场');
  assert.deepEqual(feature.runway,{from:sourceToHex(s,{x:15,y:6}),to:sourceToHex(s,{x:15,y:11})});
  assert.deepEqual(feature.hangars,[{x:16,y:7},{x:16,y:10}].map(p=>sourceToHex(s,p)));
  assert.ok(s.story.intro.length>20); assert.equal(s.story.history,undefined);
});

test('mission markers and nested feature geometry share the terrain orientation',()=>{
  const meta=SCENARIOS.find(s=>s.id==='airfield-defense'), original=meta.approach;
  try {
    for(const approach of ['southwest','northwest','southeast','northeast']) {
      meta.approach=approach;
      const s=createScenario(meta.id), fx=['northwest','northeast'].includes(approach),fy=['southeast','northeast'].includes(approach);
      const orient=p=>sourceToHex(s,{...p,x:fx?21-p.x:p.x,y:fy?17-p.y:p.y});
      assert.deepEqual(s.mission.point,orient(meta.mission.point));
      assert.deepEqual(s.mission.points,meta.mission.points.map(orient));
      assert.deepEqual(s.features[0].runway,{from:orient({x:15,y:6}),to:orient({x:15,y:11})});
      assert.deepEqual(s.features[0].hangars,[{x:16,y:7},{x:16,y:10}].map(orient));
      assert.equal(key(s.features[0]),key(orient({x:15,y:8})));
      for(const p of targets(s)) assert.equal(s.terrain[p.y][p.x],3);
    }
  } finally { meta.approach=original; }
  assert.equal(createScenario('ford-crossing').advance,'right');
  assert.equal(createScenario('airfield-defense').advance,'right');
  assert.equal(createScenario('last-bridge').advance,'up');
  assert.match(createScenario('ford-crossing').direction,/向右/);
});
