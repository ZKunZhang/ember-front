import { hexDistance } from './hex.js';

export const isOperationMission = mission => ['rearguard','relief','raid','control'].includes(mission?.kind);
const at = (u,p) => u.x===p.x && u.y===p.y;
const livingBlue = s => s.units.filter(u=>u.team==='blue'&&u.hp>0);
const onExit = (s,u) => (s.mission.exits??[]).some(p=>at(u,p));
const extractionOpen = p => ['withdraw','extract'].includes(p.phase);

// All operation history lives here, so snapshots and undo restore boundary crossings too.
export function syncOperation(s, endEnemyTurn=false) {
  if (!isOperationMission(s.mission)) return s.missionProgress;
  const m=s.mission, p=s.missionProgress??(s.missionProgress={});
  p.captured??=[]; p.heldTurns??=0; p.defendedTurns??=0; p.elapsed??=0;
  p.supportLinked??=false; p.qualifiedIds??=[];
  p.garrisonIds??=s.units.filter(u=>u.team==='blue'&&u.missionRole==='garrison').map(u=>u.id);
  const blue=livingBlue(s), present=blue.filter(u=>onExit(s,u)).map(u=>u.id);
  p.exitPresence??=present;
  const wasOpen=extractionOpen(p);
  if (m.kind==='relief' && blue.some(u=>u.missionRole!=='garrison'&&hexDistance(u,m.point)<=1)) p.supportLinked=true;
  const targets=s.units.filter(u=>u.team==='red'&&u.missionRole==='battery');
  const destroyed=targets.filter(u=>u.hp<=0).length;
  const occupied=(m.points??[]).filter(point=>blue.some(u=>at(u,point))).length;
  const secure=m.kind==='relief'&&p.supportLinked&&blue.some(u=>at(u,m.point));
  if ((m.kind==='control'&&occupied!==(m.points??[]).length) || (m.kind==='relief'&&!secure)) p.heldTurns=0;
  // Failed objectives settle before counting a completed round or granting a win.
  let failure='';
  if (m.kind==='rearguard'&&s.units.some(u=>u.team==='red'&&u.hp>0&&(m.points??[]).some(point=>at(u,point)))) failure='通道突破';
  else if (m.kind==='relief'&&!blue.some(u=>p.garrisonIds.includes(u.id))) failure='守军全灭';
  else if (!blue.length || (['rearguard','raid'].includes(m.kind)&&blue.length<m.required)) failure='兵力不足';
  if (!s.winner&&!failure&&endEnemyTurn) {
    p.elapsed++;
    if (m.kind==='rearguard') p.defendedTurns=Math.min(m.turns,p.defendedTurns+1);
    if ((m.kind==='control'&&occupied===(m.points??[]).length) || secure) p.heldTurns++;
  }
  p.phase=m.kind==='rearguard'?(p.defendedTurns>=m.turns?'withdraw':'hold')
    :m.kind==='relief'?(p.supportLinked?'secure':'link')
    :m.kind==='raid'?(destroyed>=(m.targetCount??targets.length)?'extract':'strike'):'control';
  // Opening never qualifies pre-parked vehicles; only a later outside-to-inside edge does.
  p.qualifiedIds=p.qualifiedIds.filter(id=>present.includes(id));
  if (wasOpen&&extractionOpen(p)) for (const id of present) {
    if (!p.exitPresence.includes(id)&&!p.qualifiedIds.includes(id)) p.qualifiedIds.push(id);
  }
  p.exitPresence=present;
  if (!s.winner) {
    const arrivals=blue.filter(u=>p.qualifiedIds.includes(u.id)&&onExit(s,u)).length;
    const success=m.kind==='rearguard'||m.kind==='raid'
      ?extractionOpen(p)&&arrivals>=m.required
      :p.heldTurns>=m.turns&&(m.kind!=='relief'||p.supportLinked);
    if (failure) { s.winner='red'; p.outcomeReason=failure; }
    else if (success) { s.winner='blue'; p.outcomeReason=m.kind==='relief'?'接应稳固':m.kind==='control'?'双站控制完成':'撤离完成'; }
    else if (p.elapsed>=m.deadline) { s.winner='red'; p.outcomeReason='超时'; }
  }
  return p;
}

export function operationArrivals(s) {
  if (!isOperationMission(s.mission)||!extractionOpen(s.missionProgress??{})) return [];
  return livingBlue(s).filter(u=>(s.missionProgress?.qualifiedIds??[]).includes(u.id)&&onExit(s,u));
}

// A pure projection: rendering status never advances or otherwise mutates the mission.
export function getOperationStatus(s) {
  if (!isOperationMission(s.mission)) return null;
  const m=s.mission,p=s.missionProgress??{},blue=livingBlue(s);
  const garrisonIds=p.garrisonIds??s.units.filter(u=>u.team==='blue'&&u.missionRole==='garrison').map(u=>u.id);
  const targets=s.units.filter(u=>u.team==='red'&&u.missionRole==='battery');
  const elapsed=p.elapsed??0,deadline=m.deadline??0;
  return {kind:m.kind,phase:p.phase??({rearguard:'hold',relief:'link',raid:'strike',control:'control'}[m.kind]),
    elapsed,deadline,turnsLeft:Math.max(0,deadline-elapsed),held:m.kind==='rearguard'?(p.defendedTurns??0):(p.heldTurns??0),holdRequired:m.turns??0,
    arrivals:operationArrivals(s).length,required:m.required??0,linked:Number(Boolean(p.supportLinked)),
    garrisonAlive:blue.filter(u=>garrisonIds.includes(u.id)).length,garrisonTotal:garrisonIds.length,
    targetsDestroyed:targets.filter(u=>u.hp<=0).length,targetsTotal:m.targetCount??targets.length,
    occupiedPoints:(m.points??(m.point?[m.point]:[])).filter(point=>blue.some(u=>at(u,point))).length,totalPoints:m.points?.length??(m.point?1:0),
    outcomeReason:p.outcomeReason??''};
}
