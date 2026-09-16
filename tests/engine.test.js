import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_TYPES } from '../src/game/catalog.js';
import { SCENARIOS } from '../src/game/scenarios.js';
import { createState, reachable, moveUnit, attackUnit, repairUnit, damageFor, clearShot, enemyAct, checkOutcome, updateFog, beginPlayerTurn, passable } from '../src/game/engine.js';

const unit=(id,team,type,x,y,extra={})=>({...UNIT_TYPES[type],id,team,type,x,y,hp:UNIT_TYPES[type].maxHp,moved:false,fired:false,...extra});
const blank=(w=10,h=7)=>Array.from({length:h},()=>Array(w).fill(0));
const state=(units,terrain=blank())=>{const s={cols:terrain[0].length,rows:terrain.length,terrain,units,turn:'blue',turnNumber:1,winner:null};updateFog(s);return s;};
function terrainRoute(s,from,to) {
  const queue=[{...from,path:[]}],seen=new Set([`${from.x},${from.y}`]);
  for(let i=0;i<queue.length;i++) {
    const p=queue[i];if(p.x===to.x&&p.y===to.y)return p.path;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=`${x},${y}`;if(passable(s,x,y)&&!seen.has(k)){seen.add(k);queue.push({x,y,path:[...p.path,{x,y}]});}}
  }return null;
}

test('six ground vehicle types and all scenario forces have legal unique deployments',()=>{
  assert.deepEqual(Object.keys(UNIT_TYPES),['scout','tank','heavyTank','artillery','rocket','engineer']);
  for(const meta of SCENARIOS){const s=createState(meta.id,'hard'),blue=s.units.filter(u=>u.team==='blue'),red=s.units.filter(u=>u.team==='red');
    assert.equal(blue.length,9);assert.equal(red.length,meta.enemyCount);assert.equal(new Set(blue.map(u=>u.type)).size,6);
    assert.equal(new Set(s.units.map(u=>`${u.x},${u.y}`)).size,s.units.length);
    assert.ok(s.units.every(u=>passable(s,u.x,u.y)));assert.ok(s.terrain.flat().includes(-1));
    for(const u of red)assert.ok(terrainRoute(s,blue[0],u));
  }
});
test('mountain pass and north road are independent, both bridges are useful',()=>{
  const s=createState('mountain-pass'),from=s.units[0],to=s.units[9];
  for(let x=10;x<=12;x++)s.terrain[11][x]=1;
  const route=terrainRoute(s,from,to);assert.ok(route);assert.ok(route.some(p=>p.x===11&&p.y<=5));
  for(const blocked of [5,12]){const b=createState('twin-bridges');for(let x=10;x<=12;x++)b.terrain[blocked][x]=4;const path=terrainRoute(b,b.units[0],b.units[9]);assert.ok(path);assert.ok(path.some(p=>p.x===11&&p.y===(blocked===5?12:5)));}
  const b=createState('twin-bridges');for(const y of [5,12])for(let x=10;x<=12;x++)b.terrain[y][x]=4;assert.equal(terrainRoute(b,b.units[0],b.units[9]),null);
});
test('BFS never crosses mountains, woodland, water, void or known units',()=>{
  const s=state([unit(1,'blue','scout',3,3),unit(2,'red','tank',2,3)]);s.terrain[3][4]=1;s.terrain[2][3]=4;s.terrain[4][3]=-1;
  assert.equal(reachable(s,s.units[0]).size,0);s.terrain[3][4]=2;assert.equal(reachable(s,s.units[0]).size,0);
});
test('hidden enemies do not leak through reachable and interrupt real movement',()=>{
  const s=state([unit(1,'blue','tank',0,0,{vision:1,move:5}),unit(2,'red','tank',3,0)]);
  assert.equal(s.fog[0][3],true);assert.ok(reachable(s,s.units[0]).has('3,0'));assert.ok(reachable(s,s.units[0]).has('4,0'));
  assert.equal(moveUnit(s,1,4,0).moved,2);assert.equal(s.units[0].x,2);assert.equal(s.units[0].moved,true);assert.equal(s.fog[0][3],false);
});
test('move and attack once in either order, reset only on new turn',()=>{
  const s=state([unit(1,'blue','tank',1,2),unit(2,'red','heavyTank',5,2)]);
  assert.equal(moveUnit(s,1,2,2).ok,true);assert.equal(moveUnit(s,1,3,2).ok,false);assert.equal(attackUnit(s,1,2).damage,3);assert.equal(attackUnit(s,1,2).ok,false);
  beginPlayerTurn(s);assert.equal(s.turnNumber,2);assert.equal(attackUnit(s,1,2).ok,true);assert.equal(moveUnit(s,1,2,3).ok,true);
});
test('fog blocks attack without consuming a shot, reconnaissance enables it',()=>{
  const s=state([unit(1,'blue','artillery',0,2),unit(2,'red','tank',5,2)]);
  assert.equal(attackUnit(s,1,2).ok,false);assert.equal(s.units[0].fired,false);
  s.units.push(unit(3,'blue','scout',2,3));updateFog(s);assert.equal(attackUnit(s,1,2).ok,true);
});
test('direct fire blocked by mountains, indirect fire has minimum range, armor floors damage',()=>{
  const a=unit(1,'blue','tank',1,2),b=unit(2,'red','tank',4,2),s=state([a,b]);s.terrain[2][3]=1;
  assert.equal(clearShot(s,a,b),false);assert.equal(attackUnit(s,1,2).ok,false);
  Object.assign(a,UNIT_TYPES.artillery,{type:'artillery'});updateFog(s);assert.equal(clearShot(s,a,b),true);assert.equal(attackUnit(s,1,2).ok,true);
  a.fired=false;b.x=2;assert.equal(attackUnit(s,1,2).ok,false);assert.equal(a.fired,false);assert.equal(damageFor({attack:2},{armor:3}),1);
});
test('repair requires engineer, adjacency, living damaged ally and consumes fire action',()=>{
  const e=unit(1,'blue','engineer',2,2),t=unit(2,'blue','tank',3,2,{hp:7}),r=unit(3,'red','tank',2,3),s=state([e,t,r]);
  assert.equal(repairUnit(s,1,1).ok,false);assert.equal(repairUnit(s,1,3).ok,false);assert.equal(repairUnit(s,2,1).ok,false);
  t.x=4;assert.equal(repairUnit(s,1,2).ok,false);t.x=3;t.hp=0;assert.equal(repairUnit(s,1,2).ok,false);t.hp=t.maxHp;assert.equal(repairUnit(s,1,2).ok,false);t.hp=7;
  assert.equal(repairUnit(s,1,2).healed,5);assert.equal(t.hp,12);assert.equal(attackUnit(s,1,3).ok,false);assert.equal(repairUnit(s,1,2).ok,false);
  beginPlayerTurn(s);assert.equal(attackUnit(s,1,3).ok,true);assert.equal(repairUnit(s,1,2).ok,false);
});
test('enemy artillery can fire from fog without revealing the shooter',()=>{
  const s=state([unit(1,'blue','tank',1,3),unit(2,'red','artillery',6,3)]);s.turn='red';
  const result=enemyAct(s,2);assert.equal(result.hidden,true);assert.equal(result.damage,5);assert.equal(s.fog[3][6],true);assert.equal(enemyAct(s,2).damage,undefined);
});
test('AI uses a global detour even when first move increases target distance',()=>{
  const s=state([unit(1,'red','tank',2,3,{move:1,range:1}),unit(2,'blue','tank',4,3)],blank(8,8));s.turn='red';
  for(let y=0;y<=5;y++)s.terrain[y][3]=1;
  const before=Math.abs(s.units[0].x-4)+Math.abs(s.units[0].y-3);
  enemyAct(s,1);const after=Math.abs(s.units[0].x-4)+Math.abs(s.units[0].y-3);assert.ok(after>before);assert.equal(s.units[0].y,4);
});
test('dead targets are ignored, death removes vision, victory prevents further actions',()=>{
  const s=state([unit(1,'blue','tank',1,2,{hp:1}),unit(2,'red','artillery',5,2),unit(3,'blue','tank',4,2,{hp:0})]);s.turn='red';
  const r=enemyAct(s,2);assert.equal(r.targetId,1);assert.equal(s.winner,'red');assert.ok(s.fog.flat().every(Boolean));assert.equal(enemyAct(s,2).ok,false);beginPlayerTurn(s);assert.equal(s.turn,'red');
  const b=state([unit(1,'blue','tank',1,1),unit(2,'red','scout',2,1,{hp:1})]);assert.equal(attackUnit(b,1,2).ok,true);assert.equal(checkOutcome(b),'blue');assert.equal(moveUnit(b,1,1,2).ok,false);
});
