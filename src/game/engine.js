import { UNIT_TYPES } from './catalog.js';
import { createScenario } from './scenarios.js';

export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const keyOf = (x, y) => `${x},${y}`;
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];
export const onMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.terrain[y][x] >= 0;
export const passable = (s, x, y) => onMap(s, x, y) && [0,3].includes(s.terrain[y][x]);
export const unitAt = (s, x, y) => s.units.find(u => u.hp > 0 && u.x === x && u.y === y);

export function createState(scenarioId) {
  const scenario = createScenario(scenarioId);
  const units = scenario.deployments.map((deployment, i) => {
    const spec = UNIT_TYPES[deployment.type];
    return { ...spec, ...deployment, id: i + 1, hp: spec.maxHp, moved: false, fired: false };
  });
  const s = { ...scenario, units, fog: [], selectedId: 1, turn: 'blue', turnNumber: 1, winner: null };
  updateFog(s);
  return s;
}

export function updateFog(s) {
  s.fog = Array.from({ length: s.rows }, () => Array(s.cols).fill(true));
  for (const u of s.units.filter(u => u.team === 'blue' && u.hp > 0)) {
    for (let dy = -u.vision; dy <= u.vision; dy++) for (let dx = -u.vision; dx <= u.vision; dx++) {
      const x = u.x + dx, y = u.y + dy;
      if (onMap(s,x,y) && Math.abs(dx) + Math.abs(dy) <= u.vision) s.fog[y][x] = false;
    }
  }
}

function occupied(s, x, y, u, knownOnly) {
  const target = unitAt(s,x,y);
  return target && target.id !== u.id && (!knownOnly || target.team === u.team || !s.fog[y][x]);
}

// BFS paths use known occupancy for player previews, actual occupancy for AI.
export function reachable(s, u, limit = u?.move ?? 0, knownOnly = u?.team === 'blue') {
  const out = new Map();
  if (!u || u.hp <= 0) return out;
  const queue = [{x:u.x,y:u.y,path:[]}], seen = new Set([keyOf(u.x,u.y)]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.path.length >= limit) continue;
    for (const [dx,dy] of DIRECTIONS) {
      const x = current.x + dx, y = current.y + dy, key = keyOf(x,y);
      if (seen.has(key) || !passable(s,x,y) || occupied(s,x,y,u,knownOnly)) continue;
      seen.add(key);
      const path = [...current.path,{x,y}];
      out.set(key,path); queue.push({x,y,path});
    }
  }
  return out;
}

// Direct fire is blocked by mountains and woodland; indirect artillery ignores them.
export function clearShot(s, from, to) {
  if (from.indirect) return true;
  const dx = to.x - from.x, dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3;
  for (let i = 1; i < steps; i++) {
    const x = Math.round(from.x + dx * i / steps), y = Math.round(from.y + dy * i / steps);
    if ((x === from.x && y === from.y) || (x === to.x && y === to.y)) continue;
    if (!onMap(s,x,y) || [1,2].includes(s.terrain[y][x])) return false;
  }
  return true;
}
export function inFireRange(s, u, target) {
  const d = distance(u,target);
  return d >= u.minRange && d <= u.range && clearShot(s,u,target);
}
export const damageFor = (u,t) => Math.max(1,u.attack-t.armor);
const fail = message => ({ok:false,message});
function playerError(s,u) {
  if (s.winner) return '战斗已结束';
  if (s.turn !== 'blue') return '请等待敌方行动结束';
  if (!u || u.team !== 'blue' || u.hp <= 0) return '单位不可用';
  return null;
}
export function moveUnit(s,id,x,y) {
  const u = s.units.find(u=>u.id===id), error = playerError(s,u);
  if (error) return fail(error);
  if (u.moved) return fail('本单位已移动');
  const path = reachable(s,u).get(keyOf(x,y));
  if (!path) return fail('无法到达：检查距离、地形与占位');
  const actual = [];
  for (const p of path) {
    if (unitAt(s,p.x,p.y)) break;
    Object.assign(u,p); actual.push(p);
  }
  u.moved = true; updateFog(s);
  return {ok:true,message:actual.length===path.length?'移动完成，可指定目标开火或维修':'前方遭遇敌军，推进停止',path:actual,moved:actual.length};
}
export function attackUnit(s,id,targetId) {
  const u = s.units.find(u=>u.id===id), t = s.units.find(u=>u.id===targetId), error = playerError(s,u);
  if (error) return fail(error);
  if (u.fired) return fail('本单位本回合已开火或维修');
  if (!t || t.team !== 'red' || t.hp <= 0 || s.fog[t.y][t.x]) return fail('目标不在视野内');
  if (distance(u,t) < u.minRange) return fail('目标太近，处于射击盲区');
  if (distance(u,t) > u.range) return fail('目标超出射程');
  if (!clearShot(s,u,t)) return fail('山林阻挡直射火力，请调整位置');
  const damage = damageFor(u,t);
  t.hp = Math.max(0,t.hp-damage); u.fired = true;
  updateFog(s); checkOutcome(s);
  return {ok:true,message:`命中${t.name}，造成 ${damage} 点伤害${t.hp===0?'，目标已击毁':''}`,damage,targetId:t.id};
}
export function repairUnit(s,id,targetId) {
  const u = s.units.find(u=>u.id===id), t = s.units.find(u=>u.id===targetId), error = playerError(s,u);
  if (error) return fail(error);
  if (!u.repair) return fail('只有工程车可以维修');
  if (u.fired) return fail('本回合已开火或维修');
  if (!t || t.id===u.id || t.team!==u.team || t.hp<=0 || distance(u,t)!==1) return fail('请选择相邻一格内的存活友军');
  if (t.hp===t.maxHp) return fail('目标无需维修');
  const healed = Math.min(u.repair,t.maxHp-t.hp);
  t.hp += healed; u.fired = true;
  return {ok:true,message:`${t.name}恢复 ${healed} 点生命`,healed,targetId:t.id};
}

// Search the whole connected map for a firing position. This allows moving away
// from the target temporarily when a mountain wall requires a long detour.
export function enemyAct(s,id) {
  const u = s.units.find(u=>u.id===id);
  if (s.winner || s.turn!=='red' || !u || u.team!=='red' || u.hp<=0) return {ok:false};
  const origin = {x:u.x,y:u.y};
  const enemies = s.units.filter(t=>t.team==='blue'&&t.hp>0);
  if (!enemies.length) { checkOutcome(s); return {ok:false}; }
  const targetsAt = point => enemies.filter(t=>inFireRange(s,{...u,...point},t)).sort((a,b)=>a.hp-b.hp);
  if (!u.fired && u.repair) {
    const damaged = s.units.find(t=>t.team==='red'&&t.hp>0&&t.hp<t.maxHp&&t.id!==u.id&&distance(t,u)===1);
    if (damaged) {
      const healed = Math.min(u.repair,damaged.maxHp-damaged.hp);
      damaged.hp += healed; u.fired = true;
      return {ok:true,healed,targetId:damaged.id,hidden:s.fog[u.y][u.x],message:'敌方工程车维修友军'};
    }
  }
  if (!targetsAt(u).length && !u.moved) {
    const routes = reachable(s,u,s.cols*s.rows,false);
    let best = null;
    for (const path of routes.values()) {
      if (targetsAt(path.at(-1)).length && (!best || path.length<best.length)) best=path;
    }
    if (best) Object.assign(u,best[Math.min(u.move,best.length)-1]);
    u.moved = true;
  }
  updateFog(s);
  const hidden = s.fog[u.y][u.x], target = targetsAt(u)[0];
  if (target && !u.fired) {
    const damage = damageFor(u,target);
    target.hp = Math.max(0,target.hp-damage); u.fired = true;
    updateFog(s); checkOutcome(s);
    return {ok:true,damage,targetId:target.id,hidden,message:hidden?'遭到迷雾炮火':'敌军开火'};
  }
  const moved = u.x!==origin.x || u.y!==origin.y;
  return {ok:true,hidden,moved,message:moved?'敌方推进':'敌方待命'};
}
export function checkOutcome(s) {
  if (!s.units.some(u=>u.team==='red'&&u.hp>0)) s.winner='blue';
  else if (!s.units.some(u=>u.team==='blue'&&u.hp>0)) s.winner='red';
  return s.winner;
}
export function beginPlayerTurn(s) {
  if (s.winner) return;
  s.turn='blue'; s.turnNumber++;
  for (const u of s.units) { u.moved=false; u.fired=false; }
  updateFog(s);
}
