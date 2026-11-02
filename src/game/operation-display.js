import { getOperationStatus } from './operations.js';

const plans={
  rearguard:{title:'先拦截，再撤离',phases:['阻击追兵','收拢撤离'],
    rule:'敌车踏入任一金色通道格即失败；至少保住 3 辆车。',
    steps:[['封住路口','装甲卡住山口，火炮和工程车在后方支援；不要全队提前后撤。'],['拖住追兵','坚持 3 个完整敌方回合，撤离区才会开放。清光追兵不会跳过这段时间。'],['分批撤出','开放后让至少 3 辆存活车辆从区域外驶入青色撤离区，并同时停留；预先停在出口不计数。']],
    success:'阻击完成，后卫分队已按要求撤至接应区。'},
  relief:{title:'接应受损守军',phases:['接通支援','稳住据点'],
    rule:'至少 1 辆原守军必须存活；据点失去驻守会清空连续进度。',
    steps:[['先救急','两辆带「守」标记的原守军已受损、移动缓慢。可以指挥它们开火、换防，并用工程车维修。'],['打通接应','让一辆非原守军车辆抵达金色据点一格以内，接通支援。'],['稳住阵地','接通后持续派友军驻守据点，守过 2 个完整敌方回合；不要让原守军全部损失。']],
    success:'援军接通防线，原守军获救，据点已稳固。'},
  raid:{title:'猎炮后迅速脱离',phases:['摧毁炮组','带队脱离'],
    rule:'先摧毁两支指定炮组，再撤出至少 2 辆；不必歼灭外围守军。',
    steps:[['选一条切入线','北桥便于迅速过河，浅滩和南路可以绕开正面；侦察车为远程火力提供视野。'],['打掉指定目标','击毁两辆带「炮」标记的敌方炮兵，撤离区才会开放。攻击其他敌军不能代替任务目标。'],['及时收手','开放后至少 2 辆存活车辆从区域外进入青色撤离区，并同时停留；提前停车不计数。']],
    success:'两支炮组均已摧毁，突袭分队带回了作战成果。'},
  control:{title:'分兵控制双站',phases:['同时驻守','保持控制'],
    rule:'两站须同时有友军驻守；任一站空缺，连续进度立即归零。',
    steps:[['分兵抢站','上下两条通路通向不同通讯站，集中全队攻一侧会让另一站失守。'],['留下驻守车辆','金色站点必须同时有存活友军；换防时先安排好掩护，不能将驻守车直接调走。'],['维持连续控制','同时守过 2 个完整敌方回合即可完成，清光敌军仍需实际占领并守住双站。']],
    success:'两座通讯站持续运转，战区联络已经恢复。'},
};

export function operationPresentation(game) {
  const status=getOperationStatus(game);
  if(!status)return null;
  const plan=plans[status.kind];
  const withdrawing=status.phase==='withdraw'||status.phase==='extract';
  let value,max,label,detail,hint,firstDone;
  if(status.kind==='rearguard') {
    firstDone=status.held>=status.holdRequired;
    value=withdrawing?status.arrivals:status.held;max=withdrawing?status.required:status.holdRequired;
    label=withdrawing?'有效撤离':'完整阻击回合';
    detail=withdrawing?'出口已开放 · 必须从外面重新进入':'青色出口尚未开放 · 先守住金色通道';
    hint=withdrawing?'收拢部队，安排至少 3 辆车从外面进入青色出口':'先布防阻击追兵，守过 3 个完整敌方回合再撤';
  } else if(status.kind==='relief') {
    firstDone=Boolean(status.linked);
    value=status.linked?status.held:0;max=status.linked?status.holdRequired:1;
    label=status.linked?'连续守备回合':'支援接通';
    detail=`原守军存活 ${status.garrisonAlive} / ${status.garrisonTotal} · ${status.linked?'援军已接通':'援军须抵达据点一格内'}`;
    hint=status.linked?'保持据点有人驻守，保护至少一辆原守军':'让非原守军车辆接近金色据点，先接通支援';
  } else if(status.kind==='raid') {
    firstDone=status.targetsDestroyed>=status.targetsTotal;
    value=withdrawing?status.arrivals:status.targetsDestroyed;max=withdrawing?status.required:status.targetsTotal;
    label=withdrawing?'有效撤离':'指定炮组已击毁';
    detail=withdrawing?'出口已开放 · 不必继续清场':'青色出口尚未开放 · 两支炮组都是任务目标';
    hint=withdrawing?'目标已清除，安排至少 2 辆车从外面进入青色出口':'优先侦察并击毁两支指定炮组，避免被外围交火拖住';
  } else {
    firstDone=status.occupiedPoints===status.totalPoints;
    value=status.held;max=status.holdRequired;label='连续控制回合';
    detail=`当前驻守 ${status.occupiedPoints} / ${status.totalPoints} 站 · 空站会立即清零`;
    hint=firstDone?'保留两站驻守车辆，守过完整敌方回合':'分兵到上下两座金色通讯站，并同时驻守';
  }
  const secondActive=status.kind==='control'?firstDone:firstDone;
  const stage=secondActive?1:0;
  return {...status,...plan,value,max,label,detail,hint,stage,firstDone,
    stageLabel:plan.phases[stage],
    summary:game.winner?(game.winner==='blue'?'行动完成':`行动失败 · ${status.outcomeReason||'我方兵力损失'}`):`${label} ${value} / ${max}`,
    result:game.winner==='blue'?plan.success:`行动失败：${status.outcomeReason||'我方分队全部损失'}。`,
  };
}
