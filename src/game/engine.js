import { UNIT_TYPES } from './catalog.js';
import { createScenario } from './scenarios.js';
import { DEFAULT_DIFFICULTY, applyEnemyDifficulty, getDifficulty } from './difficulty.js';

export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const keyOf = (x, y) => `${x},${y}`;
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];
export const onMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.terrain[y][x] >= 0;
export const passable = (s, x, y) => onMap(s, x, y) && [0,3].includes(s.terrain[y][x]);
export const unitAt = (s, x, y) => s.units.find(u => u.hp > 0 && u.x === x && u.y === y);

export function createState(scenarioId, difficultyId = DEFAULT_DIFFICULTY, formationId) {
  const scenario = createScenario(scenarioId, difficultyId, formationId);
  const units = scenario.deployments.map((deployment, i) => {
    const spec = deployment.team === 'red'
      ? applyEnemyDifficulty(UNIT_TYPES[deployment.type], scenario.difficultyId)
      : UNIT_TYPES[deployment.type];
    return { ...spec, ...deployment, id: i + 1, hp: spec.maxHp, moved: false, fired: false };
  });
  // The cursor is part of game state, so an undo also restores future AI choices.
  const aiSeed = ((Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0) || 1;
  const s = { ...scenario, units, fog: [], selectedId: 1, turn: 'blue', turnNumber: 1, winner: null, aiSeed, missionProgress: { captured: [], heldTurns: 0 } };
  updateFog(s);
  updateMission(s);
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
  u.moved = true; updateFog(s); updateMission(s); checkOutcome(s);
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

// A small deterministic PRNG makes equivalent AI choices vary between deployments
// without making replay after undo depend on ambient randomness.
function nextAiRandom(s) {
  if (!Number.isInteger(s.aiSeed)) return 0;
  s.aiSeed = (Math.imul(s.aiSeed, 1664525) + 1013904223) >>> 0;
  return s.aiSeed / 0x100000000;
}
function choose(s, choices, score) {
  if (!choices.length) return null;
  let bestScore = -Infinity, best = [];
  for (const choice of choices) {
    const value = score(choice);
    if (value > bestScore) { bestScore = value; best = [choice]; }
    else if (value === bestScore) best.push(choice);
  }
  return best[Math.floor(nextAiRandom(s) * best.length)] ?? best[0];
}
const healthRatio = u => u.hp / u.maxHp;
const targetValue = t => t.attack * 2 + t.range + (t.repair ? 4 : 0) + (t.indirect ? 3 : 0);
function targetFor(s, u, targets, mode) {
  return choose(s, targets, t => {
    const kill = u.attack >= t.hp + t.armor ? 1000 : 0;
    if (mode === 'coordinated') return kill + (1 - healthRatio(t)) * 100 + targetValue(t) - distance(u,t);
    if (mode === 'tactical') return kill + (1 - healthRatio(t)) * 40 + targetValue(t) - distance(u,t);
    return -t.hp * 10 - distance(u,t);
  });
}
function threatAt(s, point, enemies) {
  return enemies.reduce((total, enemy) => total + (inFireRange(s, enemy, point) ? enemy.attack : 0), 0);
}
function repairTarget(s, u, adjacentOnly = false) {
  return s.units.filter(t => t.team === 'red' && t.hp > 0 && t.id !== u.id && t.hp < t.maxHp && (!adjacentOnly || distance(t,u) === 1))
    .sort((a,b) => healthRatio(a) - healthRatio(b) || b.attack - a.attack || a.id - b.id)[0];
}
function moveToRepair(s, u, target) {
  const routes = reachable(s,u,u.move,false);
  const choices = [...routes.values()].filter(path => distance(path.at(-1),target) === 1);
  const path = choose(s, choices, path => -path.length);
  if (path) Object.assign(u,path.at(-1));
  return Boolean(path);
}
function retreat(s, u, enemies) {
  const current = threatAt(s,u,enemies), routes = reachable(s,u,u.move,false);
  const choices = [...routes.values()].filter(path => threatAt(s,path.at(-1),enemies) < current);
  const path = choose(s, choices, path => {
    const point = path.at(-1);
    return -threatAt(s,point,enemies) * 100 + Math.min(...enemies.map(t => distance(point,t))) - path.length;
  });
  if (path) Object.assign(u,path.at(-1));
  return Boolean(path);
}

// Search the whole connected map for firing positions. This allows moving away
// from the target temporarily when a mountain wall requires a long detour.
export function enemyAct(s,id) {
  const u = s.units.find(u=>u.id===id);
  if (s.winner || s.turn!=='red' || !u || u.team!=='red' || u.hp<=0) return {ok:false};
  const origin = {x:u.x,y:u.y};
  const enemies = s.units.filter(t=>t.team==='blue'&&t.hp>0);
  const mode = getDifficulty(s.difficultyId).ai;
  if (!enemies.length) { checkOutcome(s); return {ok:false}; }
  const targetsAt = point => enemies.filter(t=>inFireRange(s,{...u,...point},t));
  if (!u.fired && u.repair) {
    // Preserve the adjacent repair action before considering a hard-AI reposition.
    let damaged = repairTarget(s,u,true);
    if (!damaged && mode === 'coordinated' && !u.moved) {
      const distant = repairTarget(s,u);
      if (distant && moveToRepair(s,u,distant)) {
        u.moved = true;
        updateFog(s);
        damaged = distance(distant,u)===1 ? distant : repairTarget(s,u,true);
      }
    }
    if (damaged) {
      const healed = Math.min(u.repair,damaged.maxHp-damaged.hp);
      damaged.hp += healed; u.fired = true;
      return {ok:true,healed,targetId:damaged.id,hidden:s.fog[u.y][u.x],message:'敌方工程车维修友军'};
    }
  }
  if (mode === 'coordinated' && healthRatio(u) <= 0.4 && !u.moved && retreat(s,u,enemies)) u.moved = true;
  if (!targetsAt(u).length && !u.moved) {
    const routes = reachable(s,u,s.cols*s.rows,false);
    const firingPaths = [];
    for (const path of routes.values()) {
      const point = path.at(-1), targets = targetsAt(point);
      if (targets.length) firingPaths.push({path,point,targets});
    }
    const best = choose(s, firingPaths, candidate => {
      const target = targetFor(s,{...u,...candidate.point},candidate.targets,mode);
      // Tactical and coordinated AI prefer a useful firing position, then a short route.
      const targetScore = mode === 'direct' ? 0 : targetValue(target) + (1 - healthRatio(target)) * 10 + (u.attack >= target.hp + target.armor ? 1000 : 0);
      return targetScore * 100 - candidate.path.length;
    });
    if (best) Object.assign(u,best.path[Math.min(u.move,best.path.length)-1]);
    u.moved = true;
  }
  updateFog(s);
  const hidden = s.fog[u.y][u.x], target = targetFor(s,u,targetsAt(u),mode);
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
  if (s.winner) return s.winner;
  const blue = s.units.filter(u=>u.team==='blue'&&u.hp>0);
  if (!blue.length) { s.winner='red'; return s.winner; }
  const mission = s.mission;
  if (mission?.kind==='escort' && !blue.some(u=>u.type==='engineer')) { s.winner='red'; return s.winner; }
  if (mission) {
    const progress = s.missionProgress ?? { captured: [], heldTurns: 0 };
    if (mission.kind==='capture' && progress.captured.length===mission.points.length && progress.captured.every(Boolean)) s.winner='blue';
    else if (mission.kind==='escort' && blue.some(u=>u.type==='engineer'&&u.x===mission.point.x&&u.y===mission.point.y)) s.winner='blue';
    else if (mission.kind==='hold' && progress.heldTurns>=mission.turns) s.winner='blue';
  } else if (!s.units.some(u=>u.team==='red'&&u.hp>0)) s.winner='blue';
  return s.winner;
}
export function updateMission(s,endEnemyTurn=false) {
  const mission=s.mission;
  const progress=s.missionProgress ?? (s.missionProgress={captured:[],heldTurns:0});
  if (!mission || s.winner) return progress;
  const blue=s.units.filter(u=>u.team==='blue'&&u.hp>0);
  if (mission.kind==='capture') {
    progress.captured=mission.points.map((point,index)=>Boolean(progress.captured[index])||blue.some(u=>u.x===point.x&&u.y===point.y));
  } else if (mission.kind==='hold' && endEnemyTurn) {
    progress.heldTurns=blue.some(u=>u.x===mission.point.x&&u.y===mission.point.y) ? progress.heldTurns+1 : 0;
  }
  return progress;
}
export function beginPlayerTurn(s) {
  if (s.winner) return;
  s.turn='blue'; s.turnNumber++;
  for (const u of s.units) { u.moved=false; u.fired=false; }
  updateFog(s);
  updateMission(s,true); checkOutcome(s);
}
