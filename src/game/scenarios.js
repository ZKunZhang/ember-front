import { BLUE_FORMATION } from './catalog.js';
import { DEFAULT_DIFFICULTY, enemyCountFor, getDifficulty } from './difficulty.js';

export const FORMATIONS = {
  balanced: { name: '均衡编组', description: '各兵种协同推进，适合初次部署。', types: ['scout','tank','heavyTank','artillery','rocket','engineer','tank','artillery','scout'] },
  mobile: { name: '机动编组', description: '侦察与坦克比例更高，快速抢占路线。', types: ['scout','scout','tank','tank','engineer','artillery','scout','rocket','heavyTank'] },
  armored: { name: '装甲编组', description: '重型单位顶住正面压力，维修车提供续航。', types: ['heavyTank','tank','heavyTank','tank','engineer','scout','tank','artillery','rocket'] },
  artillery: { name: '炮击编组', description: '远程火力密集，依靠侦察车校射。', types: ['scout','artillery','rocket','artillery','engineer','scout','rocket','tank','heavyTank'] },
};

export const SCENARIOS = [
  { id: 'mountain-pass', name: '断脊山隘', subtitle: 'BROKEN RIDGE', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'balanced',
    briefing: '中央山脉挡住正面推进。选择穿越一格宽的山隘，或沿北侧公路迂回包抄。', objective: '歼灭全部敌军', routes: ['中央隘口：路短，易遭集火', '北侧公路：路长，适合机动部队'] },
  { id: 'diagonal-valley', name: '长风峡谷', subtitle: 'WINDWARD VALLEY', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'mobile',
    briefing: '沿斜向峡谷向东北推进。两道山岭之间留有中部缺口，侧翼道路可以绕开狭窄地带。', objective: '歼灭全部敌军', routes: ['中部缺口：直达敌军前沿', '侧翼山道：绕开中央山岭'] },
  { id: 'twin-bridges', name: '双桥河湾', subtitle: 'TWIN CROSSINGS', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'armored',
    briefing: '河流将战区分成两岸，地面部队只能通过两座桥。侦察车寻找突破口，工程车为桥头装甲部队提供维修。', objective: '歼灭全部敌军', routes: ['北桥：宽阔入口，利于展开', '南桥：狭窄捷径，争夺激烈'] },
  { id: 'forest-corridor', name: '林海走廊', subtitle: 'FOREST CORRIDOR', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'mobile',
    briefing: '密林切割战场，侦察车必须先行发现敌情；两条林间通道适合快速穿插。', objective: '歼灭全部敌军', routes: ['西侧林道：机动快捷', '东侧林缘：视野开阔，适合迂回'] },
  { id: 'broken-basin', name: '碎岩盆地', subtitle: 'BROKEN BASIN', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'armored',
    briefing: '碎岩与高地形成天然防线，装甲部队需要在两处缺口集中突破。', objective: '歼灭全部敌军', routes: ['中央裂口：装甲正面突破', '东侧坡道：较慢但便于展开'] },
  { id: 'lake-crossroads', name: '环湖交锋', subtitle: 'LAKE CROSSROADS', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'artillery',
    briefing: '湖岸限制地面机动，炮兵可从两条堤岸路线支援前线。', objective: '歼灭全部敌军', routes: ['西堤：短线接敌，适合坦克', '东堤：开阔射界，适合炮兵'] },
  { id: 'alamein-breakthrough', name: '阿拉曼突破', subtitle: 'ALAMEIN BREAKTHROUGH', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'balanced',
    briefing: '穿过沙丘防线缺口，夺取两处集结点，为装甲纵队打开通路。', objective: '夺取两处集结点', routes: ['西侧缺口：较短但暴露', '东侧沙丘：绕行后再合流'],
    story: { chapter: '战史改编 · 01', history: '第二次阿拉曼战役于1942年10月23日至11月4日成为北非战局转折。', sourceUrl: 'https://www.nam.ac.uk/explore/battle-alamein', intro: '虚构的前线连队必须穿过沙丘防线，夺取两个集结点并为后续攻势打开缺口。', success: '虚构的装甲纵队在两个集结点会合，沙海中的突破口终于稳住。', failure: '虚构的连队未能完成两处集结点的接应，敌军重新封锁了沙丘通道。' },
    mission: { kind: 'capture', points: [{ x: 10, y: 9, label: '西侧集结点' }, { x: 14, y: 11, label: '东侧集结点' }] } },
  { id: 'bridge-relief', name: '桥头救援', subtitle: 'BRIDGE RELIEF', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'mobile',
    briefing: '工程车护送补给纵队穿过河谷，抵达桥头后才能让后续部队渡河。', objective: '护送工程车抵达桥头', routes: ['西桥：路窄但掩护较多', '东桥：开阔，需快速通过'],
    story: { chapter: '战史改编 · 02', history: '市场花园行动于1944年9月17日至25日试图夺取莱茵渡口但未达全部目标。', sourceUrl: 'https://www.nam.ac.uk/explore/market-garden', intro: '虚构的救援纵队必须护送工程车通过火线，把桥头交到友军手中。', success: '虚构的工程车抵达桥头，救援纵队为渡河部队恢复了通道。', failure: '虚构的桥头救援中断，工程车损毁后河谷再次落入封锁。' },
    mission: { kind: 'escort', point: { x: 11, y: 6, label: '北桥头' } } },
  { id: 'ardennes-watch', name: '阿登守望', subtitle: 'ARDENNES WATCH', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'armored',
    briefing: '敌军在林地发动突袭，坚守高地观察点四个敌方回合，等待援军抵达。', objective: '坚守观察点4个敌方回合', routes: ['中央林道：最快抵达', '两侧坡线：便于交叉掩护'],
    story: { chapter: '战史改编 · 03', history: '突出部战役于1944年12月由德国在阿登发动进攻。', sourceUrl: 'https://www.nps.gov/places/battle-of-the-bulge.htm', intro: '虚构的守军必须在雪林观察点坚守，直到援军穿过被突破的防线。', success: '虚构的守军守住观察点四个敌方回合，阿登防线等来了援军。', failure: '虚构的观察点失守，敌军的突袭撕开了雪林防线。' },
    mission: { kind: 'hold', point: { x: 15, y: 6, label: '林地观察点' }, turns: 4 } },
];
const BLUE = [[17,3],[18,3],[19,3],[17,4],[18,4],[19,4],[17,5],[18,5],[19,5]];
const RED_SOUTH = [[7,14],[8,14],[9,14],[7,15],[8,15],[9,15],[7,16],[8,16],[9,16],[6,14],[6,15],[6,16],[5,14],[5,15],[5,16],[6,13],[7,13],[8,13]];
const RED_NORTH = [[2,5],[3,5],[4,5],[2,6],[3,6],[4,6],[2,7],[3,7],[4,7],[5,5],[5,6],[5,7],[6,5],[6,6],[6,7],[2,8]];
const TYPES = BLUE_FORMATION;
const RED_TYPES = [...TYPES, 'tank','heavyTank','artillery','rocket','scout','engineer','tank','artillery','heavyTank'];

export function createScenario(id = SCENARIOS[0].id, difficultyId = DEFAULT_DIFFICULTY, formationId) {
  const meta = SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
  const formation = FORMATIONS[formationId] || FORMATIONS[meta.formationId] || FORMATIONS.balanced;
  const difficulty = getDifficulty(difficultyId);
  const enemyCount = enemyCountFor(meta.enemyCount, difficulty.id);
  const cols = 22, rows = 18;
  const terrain = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) =>
    x < 1 || y < 1 || x > 20 || y > 16 || x + y < 5 || x + y > 33 ? -1 : 0));
  const put = (x, y, value) => { if (terrain[y]?.[x] >= 0) terrain[y][x] = value; };
  const horizontal = (y, start, end, value = 3) => { for (let x = start; x <= end; x++) put(x, y, value); };
  const vertical = (x, start, end, value = 3) => { for (let y = start; y <= end; y++) put(x, y, value); };
  let landmarks;
  if (meta.id === 'mountain-pass') {
    for (let y = 6; y <= 16; y++) horizontal(y, 10, 12, 1);
    horizontal(5, 5, 18); horizontal(11, 5, 18);
    vertical(5, 5, 14); vertical(18, 5, 14);
    landmarks = [{ x: 11, y: 5, label: '北侧绕行' }, { x: 11, y: 11, label: '一线山隘' }];
  } else if (meta.id === 'diagonal-valley') {
    // Two vertical ridges with staggered gaps force route choices and detours.
    for (let y = 3; y <= 13; y++) { put(12, y, 1); put(13, y, 1); }
    for (let y = 5; y <= 16; y++) put(8, y, 1);
    horizontal(8, 5, 18); horizontal(2, 5, 18); vertical(5, 2, 9); vertical(18, 2, 9);
    landmarks = [{ x: 12, y: 8, label: '峡谷缺口' }, { x: 11, y: 2, label: '侧翼山道' }];
  } else if (meta.id === 'twin-bridges') {
    for (let y = 1; y <= 16; y++) horizontal(y, 10, 12, 4);
    horizontal(5, 5, 18); horizontal(12, 5, 18); vertical(5, 5, 14); vertical(18, 5, 13);
    [[8,8],[8,9],[14,9],[14,10],[15,10],[7,10]].forEach(([x,y])=>put(x,y,1));
    landmarks = [{ x: 11, y: 5, label: '北桥' }, { x: 11, y: 12, label: '南桥' }];
  } else if (meta.id === 'forest-corridor') {
    for (let y = 4; y <= 13; y += 2) for (let x = 8; x <= 14; x += 2) {
      if ((x + y) % 4 === 0) { put(x,y,2); put(x+1,y,2); put(x,y+1,2); put(x+1,y+1,2); }
    }
    horizontal(6, 5, 18, 3); horizontal(12, 5, 18, 3);
    vertical(5, 5, 14, 3); vertical(18, 5, 14, 3);
    landmarks = [{x:5,y:6,label:'西侧林道'}, {x:18,y:12,label:'东侧林缘'}];
  } else if (meta.id === 'broken-basin') {
    for (let y = 4; y <= 15; y++) { for (let x = 10; x <= 12; x++) put(x,y,1); put(7,y,1); put(15,y,1); }
    horizontal(8, 5, 18, 3); horizontal(13, 5, 18, 3);
    vertical(18, 5, 13, 3); vertical(5, 8, 14, 3);
    landmarks = [{x:10,y:8,label:'中央裂口'}, {x:12,y:13,label:'东侧坡道'}];
  } else {
    for (let y = 6; y <= 12; y++) for (let x = 9; x <= 14; x++) {
      if ((x===9||x===14) && (y===6||y===12)) continue;
      put(x,y,4);
    }
    horizontal(4, 6, 18, 3); horizontal(14, 6, 18, 3);
    vertical(6, 4, 14, 3); vertical(18, 4, 14, 3);
    landmarks = [{x:8,y:4,label:'西堤入口'}, {x:16,y:14,label:'东堤出口'}];
  }
  if (meta.id === 'alamein-breakthrough') {
    for (let y = 4; y <= 14; y++) { if (y !== 8 && y !== 11) { put(8, y, 1); put(15, y, 1); } }
    horizontal(8, 5, 18, 3); horizontal(11, 5, 18, 3); vertical(5, 5, 14, 3);
    landmarks = [{ x: 10, y: 9, label: '西侧集结点' }, { x: 14, y: 11, label: '东侧集结点' }];
  } else if (meta.id === 'bridge-relief') {
    for (let y = 1; y <= 16; y++) { if (y !== 6 && y !== 10) put(11, y, 4); }
    horizontal(6, 5, 18, 3); horizontal(10, 5, 18, 3); vertical(5, 6, 14, 3); vertical(18, 4, 12, 3);
    landmarks = [{ x: 11, y: 6, label: '北桥头' }, { x: 11, y: 10, label: '南桥' }];
  } else if (meta.id === 'ardennes-watch') {
    for (let y = 4; y <= 13; y += 2) for (let x = 7; x <= 16; x += 3) { put(x, y, 2); if (y < 13) put(x, y + 1, 2); }
    horizontal(7, 5, 18, 3); horizontal(12, 5, 18, 3); vertical(5, 6, 14, 3);
    landmarks = [{ x: 15, y: 6, label: '林地观察点' }, { x: 6, y: 12, label: '西侧坡线' }];
  }
  [[7,7],[6,10],[14,7],[15,7],[8,13],[14,13],[16,14],[3,10],[16,2]].forEach(([x,y]) => {
    if (terrain[y]?.[x] === 0) put(x, y, 2);
  });
  for(const point of meta.mission?.points||(meta.mission?.point?[meta.mission.point]:[])) put(point.x,point.y,3);
  const red = (meta.id === 'diagonal-valley' ? RED_NORTH : RED_SOUTH).slice(0, enemyCount);
  const deployments = [...BLUE.map(([x,y],i)=>({team:'blue',type:formation.types[i],x,y})),
    ...red.map(([x,y],i)=>({team:'red',type:RED_TYPES[i],x,y}))];
  for (const {x,y} of deployments) put(x,y,0);
  return { ...meta, formationId: Object.entries(FORMATIONS).find(([,f])=>f===formation)?.[0] ?? meta.formationId, formationName: formation.name, difficultyId: difficulty.id, difficulty: difficulty.label, enemyCount, cols, rows, terrain, deployments, landmarks };
}
