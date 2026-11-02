import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, SCENARIOS, FORMATIONS } from '../src/game/scenarios.js';
import { OPERATION_SCENARIOS, buildOperationScenario } from '../src/game/operation-scenarios.js';
import { DIFFICULTIES, enemyCountFor } from '../src/game/difficulty.js';
import { hexNeighbors } from '../src/game/hex.js';
import { authoredToHex, hexToSource, sourceToHex } from '../src/game/layout.js';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { terrainCost } from '../src/game/terrain.js';

const key=p=>`${p.x},${p.y}`;
function distances(s,start,{blocked=()=>false,weighted=false}={}) {
  const distance=new Map([[key(start),0]]),pending=[start];
  while(pending.length){
    pending.sort((a,b)=>distance.get(key(a))-distance.get(key(b)));
    const p=pending.shift(),d=distance.get(key(p));
    for(const n of hexNeighbors(p)){
      const cost=terrainCost(s.terrain[n.y]?.[n.x]);
      if(!Number.isFinite(cost)||blocked(n))continue;
      const nd=d+(weighted?cost:1);
      if(nd<(distance.get(key(n))??Infinity)){distance.set(key(n),nd);pending.push(n);}
    }
  }
  return distance;
}
const objectives=s=>[...(s.mission.points??[]),...(s.mission.point?[s.mission.point]:[]),...(s.mission.exits??[])];

test('four original operations remain after the 28 other scenarios',()=>{
  assert.equal(SCENARIOS.length,32);
  assert.deepEqual(SCENARIOS.filter(s=>s.operation).map(s=>s.id),OPERATION_SCENARIOS.map(s=>s.id));
  for(const meta of OPERATION_SCENARIOS){
    assert.equal(meta.operation,true);assert.ok(meta.story.intro&&meta.story.success&&meta.story.failure);
    assert.equal(meta.story.sourceUrl,undefined);assert.match(meta.briefing,/全灭/);assert.match(meta.briefing,/全歼/);
  }
});

for(const meta of OPERATION_SCENARIOS)for(const difficulty of Object.values(DIFFICULTIES))for(const [formationId,formation] of Object.entries(FORMATIONS)){
  test(`${meta.id} / ${difficulty.id} / ${formationId}: roster, roles and connected targets`,()=>{
    const s=createScenario(meta.id,difficulty.id,formationId),blue=s.deployments.filter(u=>u.team==='blue'),red=s.deployments.filter(u=>u.team==='red');
    assert.equal(s.formationId,formationId);assert.equal(s.difficultyId,difficulty.id);
    assert.equal(blue.length,meta.allyCount);assert.equal(red.length,enemyCountFor(meta.enemyCount,difficulty.id));
    assert.equal(s.deployments.length,meta.allyCount+s.enemyCount);
    assert.equal(new Set(s.deployments.map(key)).size,s.deployments.length);
    const reached=distances(s,blue[0]);
    for(const p of [...s.deployments,...objectives(s)]){
      assert.ok([0,3,5,6].includes(s.terrain[p.y]?.[p.x]),`impassable ${key(p)}`);
      assert.ok(reached.has(key(p)),`unreachable ${key(p)}`);
    }
    assert.deepEqual(blue.slice(0,meta.id==='grayline-relief'?5:meta.allyCount).map(u=>u.type),formation.types.slice(0,meta.id==='grayline-relief'?5:meta.allyCount));
    if(meta.id==='grayline-relief'){
      assert.deepEqual(blue.slice(-2).map(u=>u.type),['tank','heavyTank']);
      for(const u of blue.slice(-2)){assert.equal(u.missionRole,'garrison');assert.equal(u.initialHpRatio,.6);assert.equal(u.move,1);}
    }
    if(meta.id==='mist-harbor-raid'){
      assert.deepEqual(red.slice(0,2).map(u=>u.type),['artillery','rocket']);
      for(const [i,u] of red.slice(0,2).entries()){
        assert.equal(u.missionRole,'battery');assert.equal(u.move,0);assert.equal(key(u),key(s.mission.points[i]));
      }
    }
    for(const u of red){assert.equal(u.attack,undefined);assert.equal(u.maxHp,undefined);assert.equal(u.hp,undefined);}
    if(s.mission.exits){assert.ok(s.mission.exits.length>=4);assert.ok(s.mission.exits.every(p=>!s.mission.points.some(q=>key(p)===key(q))));}
  });
}

test('approach mirrors all nested targets, exits, units and landmarks before axial layout',()=>{
  for(const meta of OPERATION_SCENARIOS){
    const options={formation:FORMATIONS[meta.formationId],formationId:meta.formationId,difficulty:DIFFICULTIES.hard,enemyCount:meta.enemyCount};
    const original=buildOperationScenario(meta,options);
    for(const approach of ['northwest','southeast','northeast']){
      const mirrored=buildOperationScenario({...meta,approach},options);
      const transform=p=>({...p,x:['northwest','northeast'].includes(approach)?21-p.x:p.x,y:['southeast','northeast'].includes(approach)?17-p.y:p.y});
      const expected=p=>{
        const q=hexToSource(original,p), y=Math.floor(q.y/2), x=Math.floor((q.x-y%2)/2);
        const base=transform({x,y}), anchor=hexToSource(mirrored,authoredToHex(mirrored,base));
        return sourceToHex(mirrored,{x:anchor.x+q.x-(2*x+y%2),y:anchor.y+q.y-2*y});
      };
      for(const [before,after] of [[objectives(original),objectives(mirrored)],[original.landmarks,mirrored.landmarks],[original.deployments,mirrored.deployments]]){
        assert.deepEqual(after.map(p=>[p.x,p.y]),before.map(p=>{const q=expected(p);return [q.x,q.y];}));
      }
      const reached=distances(mirrored,mirrored.deployments[0]);
      for(const p of [...mirrored.deployments,...objectives(mirrored)])assert.ok(reached.has(key(p)),`${meta.id} ${approach} ${key(p)}`);
    }
  }
});

test('operation terrain is distinct and supports the advertised route constraints',()=>{
  const maps=OPERATION_SCENARIOS.map(m=>createScenario(m.id,'hard'));
  assert.equal(new Set(maps.map(s=>JSON.stringify(s.terrain))).size,4);
  const [rear,relief,raid,control]=maps;
  const rearBlocked=distances(rear,rear.deployments[0],{blocked:p=>rear.mission.points.some(q=>key(p)===key(q))});
  assert.ok(rear.mission.exits.every(p=>!rearBlocked.has(key(p))),'mountain wall has no bypass');
  const retreat=distances(rear,rear.mission.points[1],{weighted:true});
  assert.ok(Math.min(...rear.mission.exits.map(p=>retreat.get(key(p))))<=UNIT_TYPES.heavyTank.move*(rear.mission.deadline-rear.mission.turns),'heavy armor can withdraw before the deadline');
  const reliefRoute=distances(relief,relief.deployments[0],{weighted:true});
  assert.ok(Math.ceil(reliefRoute.get(key(relief.mission.point))/UNIT_TYPES.scout.move)+relief.mission.turns<=relief.mission.deadline,'scout can reach the point and complete the required hold before the deadline');
  const mudFree=distances(relief,relief.deployments[0],{weighted:true,blocked:p=>relief.terrain[p.y]?.[p.x]===5});
  assert.ok(mudFree.has(key(relief.mission.point)),'dry route remains available');
  for(const row of [6,11]){
    const crossing=authoredToHex(raid,{x:11,y:row});
    assert.equal(raid.terrain[crossing.y][crossing.x],row===6?3:6);
  }
  const sealed=distances(raid,raid.deployments[0],{blocked:p=>{const a=hexToSource(raid,p);const y=Math.floor(a.y/2),x=Math.floor((a.x-y%2)/2);return x>=11&&x<=12&&[6,11].includes(y);}});
  assert.ok(raid.mission.points.every(p=>!sealed.has(key(p))),'only bridge and ford cross the harbor');
  for(const target of raid.mission.points){
    const route=distances(raid,target,{weighted:true});
    const outgoing=Math.min(...raid.deployments.filter(u=>u.team==='blue'&&u.type==='scout').map(p=>route.get(key(p))));
    const back=Math.min(...raid.mission.exits.map(p=>route.get(key(p))));
    assert.ok(Math.ceil(outgoing/UNIT_TYPES.scout.move)+Math.ceil(back/UNIT_TYPES.scout.move)+1<=raid.mission.deadline,'mobile units have time for the route and an attack before the deadline');
  }
  const stationRoute=distances(control,control.mission.points[0],{weighted:true});
  assert.ok(stationRoute.get(key(control.mission.points[1]))>=10,'central obstacle creates separated station approaches');
  assert.ok(control.terrain.flat().includes(5));
});
