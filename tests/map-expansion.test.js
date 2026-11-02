import test from 'node:test';
import assert from 'node:assert/strict';
import { enlargeHardMap } from '../src/game/map-expansion.js';
import { SCENARIOS, createScenario } from '../src/game/scenarios.js';
import { authoredToHex, hexToSource, sourceToHex, offsetToAxial, layoutScenario } from '../src/game/layout.js';
import { hexDistance, hexNeighbors } from '../src/game/hex.js';
import { createState, checkOutcome } from '../src/game/engine.js';

const key=p=>`${p.x},${p.y}`;
const coords=p=>({x:p.x,y:p.y});
const footprint=(s,p)=>{
  const a=hexToSource(s,authoredToHex(s,p));
  return [0,1].flatMap(dy=>[0,1].map(dx=>sourceToHex(s,{x:a.x+dx,y:a.y+dy})));
};

for(const meta of SCENARIOS) test(`${meta.id}: hard expands the full map while simple and easy retain authored terrain`,()=>{
  const simple=createScenario(meta.id,'simple'),easy=createScenario(meta.id,'easy'),hard=createScenario(meta.id,'hard');
  assert.equal(enlargeHardMap(simple),simple);
  assert.equal(enlargeHardMap(easy),easy);
  assert.notEqual(simple.mapScale,2); assert.notEqual(easy.mapScale,2);
  // Existing deployment clearance depends on enemy count, so compare hard
  // against the same roster with the idempotent expansion marker set.
  const previousScale=meta.mapScale; let base;
  try { meta.mapScale=2; base=createScenario(meta.id,'hard'); }
  finally { if(previousScale===undefined) delete meta.mapScale; else meta.mapScale=previousScale; }
  assert.deepEqual(simple.gridLayout,easy.gridLayout);
  assert.equal(hard.mapScale,2);
  assert.deepEqual(hard.authoredSize,{cols:easy.gridLayout.cols,rows:easy.gridLayout.rows});
  assert.equal(hard.gridLayout.cols,2*easy.gridLayout.cols+1);
  assert.equal(hard.gridLayout.rows,2*easy.gridLayout.rows);
  const area=s=>s.terrain.flat().filter(v=>v>=0).length;
  assert.equal(area(hard),4*area(base));
  // Every authored cell keeps its terrain throughout its four-cell footprint.
  for(let y=0;y<base.rows;y++) for(let x=0;x<base.cols;x++) {
    if(base.terrain[y][x]<0) continue;
    const p=hexToSource(base,{x,y});
    for(const q of footprint(hard,p)) assert.equal(hard.terrain[q.y][q.x],base.terrain[y][x]);
  }
  const blue=s=>s.deployments.filter(u=>u.team==='blue');
  assert.equal(blue(hard).length,blue(easy).length);
  blue(easy).forEach((u,i)=>{
    const after=blue(hard)[i];
    assert.deepEqual(after,authoredToHex(hard,hexToSource(easy,u)));
    blue(easy).slice(i+1).forEach((v,j)=>assert.ok(hexDistance(after,blue(hard)[i+j+1])>=hexDistance(u,v)*2));
  });
  const m=easy.mission,n=hard.mission;
  if(!m) return;
  assert.equal(n.turns,m.turns); assert.equal(n.required,m.required); assert.equal(n.targetCount,m.targetCount);
  if(m.points) {
    assert.equal(n.points.length,m.points.length*(['defend','rearguard','breakthrough'].includes(m.kind)?4:1));
    const expected=m.points.flatMap(p=>['defend','rearguard','breakthrough'].includes(m.kind)?footprint(hard,hexToSource(easy,p)):[authoredToHex(hard,hexToSource(easy,p))]);
    assert.deepEqual(n.points.map(key).sort(),expected.map(key).sort());
    assert.equal(new Set(n.points.map(key)).size,n.points.length);
    assert.equal(new Set(n.points.map(p=>p.label)).size,n.points.length);
  }
  if(m.exits) {
    assert.equal(n.exits.length,m.exits.length*4);
    assert.deepEqual(n.exits.map(key).sort(),m.exits.flatMap(p=>footprint(hard,hexToSource(easy,p))).map(key).sort());
    assert.equal(new Set(n.exits.map(p=>p.label)).size,n.exits.length);
  }
  if(m.deadline) {
    assert.equal(n.deadline,m.deadline*2);
    assert.match(hard.objective,new RegExp(`限${n.deadline}轮`));
    assert.match(hard.briefing,new RegExp(`${n.deadline}轮`));
    assert.doesNotMatch(hard.briefing,new RegExp(`${m.deadline}轮期限`));
  }
});

test('nested feature geometry and landmarks use the same authored anchor transform',()=>{
  for(const meta of SCENARIOS) {
    const base=createScenario(meta.id,'easy'),expanded=createScenario(meta.id,'hard');
    const convert=p=>authoredToHex(expanded,hexToSource(base,p));
    assert.deepEqual(expanded.landmarks.map(p=>[p.x,p.y]),base.landmarks.map(p=>{const q=convert(p);return [q.x,q.y];}));
    assert.deepEqual(expanded.features,base.features.map(f=>({...convert(f),
      ...(f.runway?{runway:{from:convert(f.runway.from),to:convert(f.runway.to)}}:{}),
      ...(f.hangars?{hangars:f.hangars.map(convert)}:{})})));
    if(base.mission?.point) assert.deepEqual(expanded.mission.point,convert(base.mission.point));
  }
});

test('four-cell hex footprints preserve all six coarse neighbors without creating bypasses',()=>{
  const source={cols:9,rows:9,difficultyId:'hard',terrain:Array.from({length:9},()=>Array(9).fill(0)),deployments:[],landmarks:[],features:[]};
  const s=layoutScenario(source),owner=new Map();
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) for(const p of footprint(s,{x,y})) owner.set(key(p),key(offsetToAxial({x,y})));
  for(let y=1;y<8;y++) for(let x=1;x<8;x++) {
    const coarse=offsetToAxial({x,y}),neighbors=new Set();
    for(const p of footprint(s,{x,y})) for(const q of hexNeighbors(p)) {
      const other=owner.get(key(q)); if(other&&other!==key(coarse)) neighbors.add(other);
    }
    assert.deepEqual([...neighbors].sort(),hexNeighbors(coarse).map(key).sort());
  }
});

for(const id of ['airfield-defense','ember-rearguard']) test(`${id}: entering an added protection cell fails the mission`,()=>{
  const s=createState(id,'hard'),base=createScenario(id,'easy');
  const anchors=new Set(base.mission.points.map(p=>key(authoredToHex(s,hexToSource(base,p)))));
  const extra=s.mission.points.find(p=>!anchors.has(key(p)));
  assert.ok(extra);
  const enemy=s.units.find(u=>u.team==='red'); Object.assign(enemy,coords(extra));
  assert.equal(checkOutcome(s),'red');
});

test('hard deadline wording updates Chinese story numbers as well as numeric objectives',()=>{
  const s=createScenario('mist-harbor-raid','hard');
  assert.match(s.story.intro,/十四轮/);
  assert.doesNotMatch(s.story.intro,/七轮/);
});

test('expanded exits, routes and landmark labels agree with the real region sizes',()=>{
  const raid=createScenario('mist-harbor-raid','hard'),rear=createScenario('ember-rearguard','hard');
  assert.match(raid.briefing,new RegExp(`${raid.mission.exits.length}格出口`));
  assert.match(rear.routes[0],new RegExp(`${rear.mission.points.length}格山口`));
  assert.match(rear.routes[1],new RegExp(`${rear.mission.exits.length}格出口`));
  assert.equal(rear.landmarks[0].label,`${rear.mission.points.length}格后撤通道`);
  for(const difficulty of ['simple','easy']){
    assert.match(createScenario('mist-harbor-raid',difficulty).briefing,/四格出口/);
    assert.match(createScenario('ember-rearguard',difficulty).routes[0],/三格山口/);
  }
});
