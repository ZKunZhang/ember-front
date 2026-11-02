import { layoutScenario } from './layout.js';

const exits = (label, x = 19) => [7,8,9,10].map((y,i)=>({x,y,label:`${label} ${i+1}`}));
export const OPERATION_SCENARIOS = [
  { id:'ember-rearguard', name:'余烬断后', subtitle:'EMBER REARGUARD', operation:true, allyCount:7, enemyCount:12, formationId:'armored', approach:'southwest', advance:'right', direction:'西侧阻击 → 东侧撤离', difficulty:'进阶',
    mission:{kind:'rearguard',points:[7,8,9].map(y=>({x:16,y,label:`后撤通道 ${y-6}`})),turns:3,required:3,exits:exits('后方出口'),deadline:7},
    objective:'守住通道3整轮，再撤出3辆车；限7轮',
    briefing:'7辆车在山墙西侧阻击12辆敌车。保持三处通道无敌车进入，坚持3个完整敌方回合后才解锁东侧出口；随后让至少3辆车实际进入出口。敌车进入任一通道、存活车辆不足3辆、我方全灭或7轮期限耗尽均失败。无需全歼，歼敌也不能跳过坚守和撤离。',
    routes:['三格山口：封住敌车，第三轮后收缩穿过','后方公路：山口东侧四格出口，解锁后再进入'],
    story:{chapter:'原创行动 · 余烬断后',intro:'运输纵队已驶入东侧山路，最后一支装甲分队留在山墙外。通讯员要求再争取三轮时间，随后断后车辆也必须撤过山口。',success:'断后分队守住了通道，三辆车在出口完成接应，山路上的纵队得以继续前进。',failure:'山口被突破，或断后车辆未能在期限内完成撤离，后撤行动中断。'} },
  { id:'grayline-relief', name:'灰线驰援', subtitle:'GRAYLINE RELIEF', operation:true, allyCount:7, enemyCount:12, formationId:'mobile', approach:'southwest', advance:'right', direction:'东侧援军 → 西侧据点', difficulty:'进阶',
    mission:{kind:'relief',point:{x:9,y:9,label:'灰线据点'},turns:2,deadline:6},
    objective:'保住至少1辆原守军，援军接通后守住据点2整轮；限6轮',
    briefing:'5辆援军从东侧赶来，两辆受损原守军已在灰线据点展开。至少保住一辆原守军，让援军进入据点或相邻一格接通支援，并持续控制据点2个完整敌方回合。两辆原守军全毁、我方全灭或6轮期限耗尽均失败；失去控制会打断连续坚守。无需全歼，歼敌不能替代接通和坚守。',
    routes:['泥地短线：直抵据点，工程车可随队抢修','北侧干路：绕开泥地，从碎岭缺口接近'],
    story:{chapter:'原创行动 · 灰线驰援',intro:'灰线中继据点的守军只剩两辆受损装甲车。东侧救援队接到最后一条求援电报：在守军还能回应之前，打通一条支援线。',success:'援军接通了灰线，幸存的原守军与救援队共同稳住据点，电台重新响起。',failure:'原守军失去回应，或救援队未能及时接通并守稳据点，灰线通讯沉寂。'} },
  { id:'mist-harbor-raid', name:'雾港猎炮', subtitle:'MIST HARBOR RAID', operation:true, allyCount:7, enemyCount:14, formationId:'mobile', approach:'southwest', advance:'right', direction:'东侧出击 → 西侧猎炮 → 东侧撤离', difficulty:'挑战',
    mission:{kind:'raid',points:[{x:8,y:6,label:'固定榴弹炮阵地'},{x:8,y:11,label:'固定火箭炮阵地'}],targetCount:2,required:2,exits:exits('东岸接应',17),deadline:7},
    objective:'摧毁2处指定炮组，再撤出2辆车；限7轮',
    briefing:'7辆突击车辆从东岸穿过港区，摧毁西岸两处已知固定炮组。两组炮全部被毁后才解锁东岸四格出口，至少2辆车必须在解锁后实际进入出口；提前停靠不计撤离。存活车辆不足2辆、我方全灭或7轮期限耗尽均失败。无需消灭其他守军，全歼也不能跳过撤离。',
    routes:['北侧公路桥：速度快，靠近榴弹炮阵地','南侧浅滩：涉水较慢，可包抄火箭炮阵地'],
    story:{chapter:'原创行动 · 雾港猎炮',intro:'两组岸炮借着浓雾封锁了港口。侦察员标出了炮位，突击队只有七轮时间穿过两条渡口，打掉炮组并返回东岸接应区。',success:'两组岸炮停止射击，突击队至少两辆车回到东岸，港口航线终于解封。',failure:'岸炮仍在封锁港口，或突击车辆未能按时撤回，猎炮行动失败。'} },
  { id:'twin-relay', name:'双站争频', subtitle:'TWIN RELAY', operation:true, allyCount:8, enemyCount:14, formationId:'balanced', approach:'southwest', advance:'right', direction:'东侧分兵 → 西侧双站', difficulty:'挑战',
    mission:{kind:'control',points:[{x:10,y:5,label:'北通讯站'},{x:10,y:12,label:'南通讯站'}],turns:2,deadline:7},
    objective:'同时控制两座通讯站2整轮；限7轮',
    briefing:'8辆车必须分兵夺取上下两座通讯站，同时保持我方占据、敌车不在站内，持续2个完整敌方回合。失去任意一站，连续计时立即清零。中央山林无法穿越，北侧公路较快，南侧泥地短线较慢。我方全灭或7轮期限耗尽均失败；无需全歼，歼敌不能替代双站控制。',
    routes:['北侧公路：快速占领北站，再建立火力支援','南侧泥路：短线较慢，南缘干路可绕行'],
    story:{chapter:'原创行动 · 双站争频',intro:'两座分离的通讯站需要同步占领才能恢复前线频段。中央山林切断了横向支援，分队必须协调两路推进，让两站同时完成两轮校频。',success:'两站在同一频段完成校准，分散的前线分队重新建立了联络。',failure:'双站未能持续同步，或分队错过校频窗口，通讯恢复行动中断。'} },
];

// These maps use their own author grid so old campaign terrain and deployment stay unchanged.
export function buildOperationScenario(meta,{formation,formationId,difficulty,enemyCount}) {
  const cols=22,rows=18;
  const terrain=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>x<1||x>20||y<1||y>16||x+y<5||x+y>33?-1:0));
  const put=(x,y,v)=>{if(terrain[y]?.[x]>=0)terrain[y][x]=v;};
  const line=(y,a,b,v=3)=>{for(let x=a;x<=b;x++)put(x,y,v);};
  const vertical=(x,a,b,v=3)=>{for(let y=a;y<=b;y++)put(x,y,v);};
  let bluePositions,redPositions,landmarks;
  if(meta.id==='ember-rearguard') {
    vertical(16,1,16,1);
    for(const y of [7,8,9])line(y,5,20);
    vertical(19,6,11);line(10,17,20);
    for(const y of [4,5,12,13])line(y,10,12,2);
    bluePositions=[[15,8],[14,7],[14,9],[13,7],[13,9],[15,7],[15,9]];
    redPositions=[[9,8],[9,7],[9,9],[8,8],[8,7],[8,9],[7,7],[7,8],[7,9],[6,7],[6,8],[6,9]];
    landmarks=[{x:16,y:8,label:'三格后撤通道'},{x:19,y:9,label:'解锁后撤离区'}];
  } else if(meta.id==='grayline-relief') {
    for(let y=8;y<=10;y++)line(y,10,13,5);
    line(6,8,17);vertical(15,6,11);line(9,8,9);
    for(const [x,y] of [[7,7],[7,8],[7,10],[7,11],[8,7],[8,11],[11,5],[12,5],[11,12],[12,12]])put(x,y,2);
    for(const [x,y] of [[6,6],[6,7],[6,11],[6,12],[10,5],[10,12]])put(x,y,1);
    bluePositions=[[15,8],[15,9],[16,8],[16,9],[16,10],[9,9],[9,10]];
    redPositions=[[5,8],[5,12],[4,9],[4,13],[6,8],[6,13],[5,7],[5,11],[4,8],[4,12],[3,9],[3,13]];
    landmarks=[{x:9,y:9,label:'原守军据点'},{x:12,y:9,label:'泥地短线'},{x:12,y:6,label:'北侧干路'}];
  } else if(meta.id==='mist-harbor-raid') {
    for(let y=1;y<=16;y++)line(y,11,12,4);
    line(6,6,18);line(11,6,18);line(11,11,12,6);
    vertical(14,5,12);vertical(9,5,12);vertical(17,6,11);
    for(let y=8;y<=9;y++){line(y,7,9,2);line(y,14,15,2);}
    bluePositions=[[15,6],[15,11],[16,7],[16,10],[16,8],[16,9],[15,7]];
    redPositions=[[8,6],[8,11],[6,6],[6,11],[7,5],[7,12],[9,7],[9,10],[5,7],[5,10],[6,4],[6,13],[8,4],[8,13]];
    landmarks=[{x:11,y:6,label:'港区公路桥'},{x:11,y:11,label:'南侧浅滩'},...meta.mission.points];
  } else if(meta.id==='twin-relay') {
    for(let y=7;y<=10;y++)line(y,8,14,y%2?2:1);
    line(5,4,18);line(12,4,18);line(12,11,14,5);
    line(14,5,18);vertical(16,5,14);vertical(7,5,14);
    bluePositions=[[15,5],[15,12],[16,5],[16,12],[17,5],[17,12],[15,4],[15,13]];
    redPositions=[[6,5],[6,12],[5,5],[5,12],[6,4],[6,13],[5,4],[5,13],[4,5],[4,12],[4,4],[4,13],[3,5],[3,12]];
    landmarks=[...meta.mission.points,{x:12,y:8,label:'中央阻隔山林'},{x:12,y:14,label:'南缘干路'}];
  } else throw new Error(`Unknown operation scenario: ${meta.id}`);
  const blue=bluePositions.map(([x,y],i)=>({team:'blue',type:meta.id==='grayline-relief'&&i>=5?(i===5?'tank':'heavyTank'):formation.types[i],x,y,...(meta.id==='grayline-relief'&&i>=5?{missionRole:'garrison',initialHpRatio:.6,move:1}:{})}));
  const redTypes=['tank','tank','scout','tank','heavyTank','artillery','tank','scout','rocket','tank','engineer','heavyTank','tank','artillery'];
  const red=redPositions.slice(0,enemyCount).map(([x,y],i)=>({team:'red',type:meta.id==='mist-harbor-raid'&&i<2?['artillery','rocket'][i]:redTypes[i],x,y,...(meta.id==='mist-harbor-raid'&&i<2?{missionRole:'battery',move:0}:{})}));
  const flipX=['northwest','northeast'].includes(meta.approach),flipY=['southeast','northeast'].includes(meta.approach);
  const transform=p=>({...p,x:flipX?cols-1-p.x:p.x,y:flipY?rows-1-p.y:p.y});
  const mission={...meta.mission,...(meta.mission.point?{point:transform(meta.mission.point)}:{}),...(meta.mission.points?{points:meta.mission.points.map(transform)}:{}),...(meta.mission.exits?{exits:meta.mission.exits.map(transform)}:{})};
  return layoutScenario({...meta,mission,cols,rows,terrain:Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>terrain[flipY?rows-1-y:y][flipX?cols-1-x:x])),
    formationId,formationName:formation.name,difficultyId:difficulty.id,difficulty:difficulty.label,enemyCount,
    deployments:[...blue,...red].map(u=>({...transform(u),heading:{x:(u.team==='blue'?-1:1)*(flipX?-1:1),y:0}})),landmarks:landmarks.map(transform)});
}
