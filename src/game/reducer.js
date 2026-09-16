import { createState, unitAt, moveUnit, attackUnit, repairUnit, enemyAct, beginPlayerTurn, onMap } from './engine.js';

function addLog(s,message,kind='info') {
  s.logSequence++;
  s.logs.unshift({id:s.logSequence,round:s.turnNumber,message,kind});
  s.logs=s.logs.slice(0,60);
}
function effect(s,result) {
  const target=s.units.find(u=>u.id===result.targetId);
  if (!target) return;
  // Effects attach only to a known target; hidden shooters never enter the UI.
  if (target.team==='red'&&s.fog[target.y][target.x]) return;
  s.effect={id:++s.effectSequence,x:target.x,y:target.y,amount:result.healed??-result.damage};
}
function finishPlayerTurn(s) {
  s.turn='red';s.selectedId=null;s.enemyIndex=0;
  s.enemyQueue=s.units.filter(u=>u.team==='red'&&u.hp>0).map(u=>u.id);
  addLog(s,'敌方行动开始，保持警戒。','warn');
}
export function initialGame(id,session=1) {
  const s={...createState(id),session,mode:'move',inspectedId:null,logs:[],logSequence:0,effectSequence:0,effect:null,enemyIndex:0,enemyQueue:[]};
  addLog(s,`${s.name}：9 支车辆编队完成部署。`,'good');
  addLog(s,'侦察车开路，工程车随队，火炮利用共享视野。');
  return s;
}
export function gameReducer(current,action) {
  if (action.type==='RESET') return initialGame(action.scenarioId??current.id,current.session+1);
  if (action.type==='ENEMY_STEP'&&action.session!==current.session) return current;
  const s=structuredClone(current);
  const selected=()=>s.units.find(u=>u.id===s.selectedId&&u.hp>0);
  if (action.type==='SELECT') {
    if (s.turn!=='blue'||s.winner) return current;
    const u=s.units.find(u=>u.id===action.id&&u.hp>0&&u.team==='blue');
    if (!u) return current;
    s.selectedId=u.id;s.inspectedId=null;s.mode=u.moved?'attack':'move';
  } else if (action.type==='MODE') {
    if (s.turn!=='blue'||s.winner) return current;
    const u=selected();
    if (!u||!['move','attack','repair'].includes(action.mode)) return current;
    if (action.mode==='move'?u.moved:u.fired) return current;
    if (action.mode==='repair'&&!u.repair) return current;
    s.mode=action.mode;
  } else if (action.type==='CANCEL_REPAIR') {
    if (s.turn!=='blue'||s.winner||s.mode!=='repair') return current;
    s.mode=selected()?.moved?'attack':'move';
  } else if (action.type==='CELL') {
    if (!onMap(s,action.x,action.y)) return current;
    const target=unitAt(s,action.x,action.y),u=selected();
    if (target?.team==='red'&&!s.fog[target.y][target.x]) {
      s.inspectedId=target.id;
      if (s.turn!=='blue'||s.winner||s.mode!=='attack'||!u||u.fired) return s;
    }
    if (s.turn!=='blue'||s.winner) return current;
    if (target?.team==='blue'&&s.mode!=='repair') {
      s.selectedId=target.id;s.inspectedId=null;s.mode=target.moved?'attack':'move';return s;
    }
    if (!u) { addLog(s,'请先选择一个我方单位。'); return s; }
    let result;
    if (s.mode==='repair') result=repairUnit(s,u.id,target?.id);
    else if (s.mode==='attack'&&target?.team==='red'&&!s.fog[target.y][target.x]) result=attackUnit(s,u.id,target.id);
    else if (s.mode==='move') result=moveUnit(s,u.id,action.x,action.y);
    else result={ok:false,message:'请选择射程内可见的敌军；山林可能阻挡直射火力。'};
    addLog(s,result.message,result.ok?'good':'warn');
    if (result.damage||result.healed) effect(s,result);
    if (result.ok&&s.mode==='repair') s.mode=u.moved?'attack':'move';
    if (result.ok&&result.path) s.mode=u.fired?'move':'attack';
    if (result.ok&&!s.winner&&s.units.filter(u=>u.team==='blue'&&u.hp>0).every(u=>u.moved&&u.fired)) {
      addLog(s,'所有存活车辆已完成移动和行动，自动结束回合。');
      finishPlayerTurn(s);
    }
  } else if (action.type==='END_TURN') {
    if (s.turn!=='blue'||s.winner) return current;
    finishPlayerTurn(s);
  } else if (action.type==='ENEMY_STEP') {
    if (s.turn!=='red'||s.winner) return current;
    const id=s.enemyQueue[s.enemyIndex];
    if (id!==undefined) {
      const result=enemyAct(s,id);
      if (result.damage) {
        const target=s.units.find(u=>u.id===result.targetId);
        addLog(s,`${result.message}，${target.name}受到 ${result.damage} 点伤害${target.hp<=0?'，单位损失':''}。`,'warn');effect(s,result);
      } else if (result.healed&&!result.hidden) { addLog(s,'敌方工程车正在维修。');effect(s,result); }
      else if (result.ok&&!result.hidden&&result.moved) addLog(s,'侦察到敌方车辆推进。');
      s.enemyIndex++;
    }
    if (s.enemyIndex>=s.enemyQueue.length&&!s.winner) {
      beginPlayerTurn(s);addLog(s,`第 ${s.turnNumber} 回合，所有车辆行动已恢复。`,'good');
    }
  } else return current;
  if (!s.units.some(u=>u.id===s.inspectedId&&u.hp>0&&u.team==='red'&&!s.fog[u.y][u.x])) s.inspectedId=null;
  return s;
}
