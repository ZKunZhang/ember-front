import { layoutScenario } from './layout.js';

export const ADVANCE_SCENARIO = {
  id: 'long-road-contact', name: '长路接敌', subtitle: 'CONTACT ON THE MARCH',
  allyCount: 9, enemyCount: 18, formationId: 'fireSupport', difficulty: '进阶', advance: 'right',
  briefing: '我部在前进途中陆续接敌。9辆车穿越山区与连片树林，沿林间空地通过三道山口；每处只部署一支警戒小队，哨兵看见我方或受到攻击，才会带动本队出击。山口和侧翼林隙都能展开队形，侦察先行，加农炮沿谷地直射，榴弹炮与加榴炮越岭支援，至少5辆车同时抵达终点接应区即可完成任务。',
  objective: '逐段接敌，至少5辆存活友军同时抵达接应区',
  routes: ['山间谷地：穿过宽阔山口，利用空地展开火力', '林缘迂回：沿侧翼林隙绕过山脊，侦察后分队接敌'],
  story: {
    chapter: '行军遭遇 · 长路接敌',
    intro: '我部奉命穿越山地与森林，赶往前方接应区。这里没有贯通的公路，山脊和林带将谷地分成数片开阔地，敌军分散驻守沿途三道山口。侦察车先确认林间空地，装甲沿谷地展开，炮兵在山后跟进；也可从侧翼林隙迂回，逐段接敌后继续前进。',
    success: '至少五辆车驶入终点接应区，行军纵队穿过了沿途封锁。',
    failure: '能够继续前进的车辆已不足五辆，纵队无法完成接应任务。',
  },
  mission: { kind: 'breakthrough', required: 5, points: [8,9,10,11,12,13].map((y,i)=>({x:2,y,label:`终点接应 ${i+1}`})) },
};

// Mountain belts and connected woodland hide three local patrols. Each belt
// leaves a broad valley passage and a separate flank clearing; no road is carved.
export function buildAdvanceScenario(meta, { formation, formationId, difficulty, enemyCount }) {
  const cols = 36, rows = 26;
  const terrain = Array.from({length: rows}, (_,y)=>Array.from({length: cols}, (_,x)=>
    x < 1 || x > 34 || y < 2 || y > 23 ? -1 : 0));
  const put = (x,y,value)=>{ if (terrain[y]?.[x] >= 0) terrain[y][x] = value; };
  for (const [base,main,flank] of [[27,6,17],[18,14,5],[9,8,18]]) {
    for (let y=2;y<=23;y++) {
      if ((y>=main&&y<main+4)||(y>=flank&&y<flank+4)) continue;
      const x=base+(y<6?1:y>20?-1:0);
      put(x,y,1);put(x+1,y,1);
    }
  }
  for (const [left,top,right,bottom] of [
    [30,3,33,5],[29,14,32,17],[22,3,25,5],[21,12,24,14],[20,20,24,22],
    [12,3,15,5],[11,10,14,12],[11,20,15,22],[3,3,6,5],[2,15,6,17],[3,21,6,23],
  ]) for (let y=top;y<=bottom;y++) for (let x=left;x<=right;x++)
    if (terrain[y][x]===0) put(x,y,2);
  const blue = [[31,8],[32,8],[33,8],[31,9],[32,9],[33,9],[31,10],[32,10],[33,10]]
    .map(([x,y],i)=>({team:'blue',type:formation.types[i],x,y,heading:{x:-1,y:0}}));
  const patrols = [
    {x:23,y:8,types:['tank','cannon','scout','tank','engineer','heavyTank']},
    {x:14,y:15,types:['tank','howitzer','tank','scout','engineer','heavyTank']},
    {x:5,y:9,types:['heavyTank','gunHowitzer','tank','scout','engineer','rocket']},
  ];
  const positions = [[0,0],[-1,1],[0,2],[-2,0],[-2,2],[-1,3]];
  // Interleave the three groups so simple/easy keep enemies in every road segment.
  const red = Array.from({length:enemyCount},(_,i)=>{
    const group=i%3,slot=Math.floor(i/3),patrol=patrols[group];
    const [dx,dy]=positions[slot];
    return {team:'red',type:patrol.types[slot],x:patrol.x+dx,y:patrol.y+dy,patrolGroup:group,heading:{x:1,y:0}};
  });
  return layoutScenario({...meta,cols,rows,terrain,formationId,formationName:formation.name,
    difficultyId:difficulty.id,difficulty:difficulty.label,enemyCount,deployments:[...blue,...red],
    landmarks:[{x:27,y:8,label:'第一林间谷口'},{x:18,y:15,label:'第二山口'},{x:9,y:9,label:'第三山口'},{x:2,y:11,label:'终点接应区'}]});
}
