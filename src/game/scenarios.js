import { BLUE_FORMATION } from './catalog.js';

export const SCENARIOS = [
  { id: 'mountain-pass', name: '断脊山隘', subtitle: 'BROKEN RIDGE', direction: '左下 → 右下', difficulty: '标准', enemyCount: 14,
    briefing: '中央山脉挡住正面推进。选择穿越一格宽的山隘，或沿北侧公路迂回包抄。', objective: '歼灭全部敌军', routes: ['中央隘口：路短，易遭集火', '北侧公路：路长，适合机动部队'] },
  { id: 'diagonal-valley', name: '长风峡谷', subtitle: 'WINDWARD VALLEY', direction: '左下 → 右上', difficulty: '进阶', enemyCount: 16,
    briefing: '沿斜向峡谷向东北推进。两道山岭之间留有中部缺口，侧翼道路可以绕开狭窄地带。', objective: '歼灭全部敌军', routes: ['中部缺口：直达敌军前沿', '侧翼山道：绕开中央山岭'] },
  { id: 'twin-bridges', name: '双桥河湾', subtitle: 'TWIN CROSSINGS', direction: '左下 → 右下', difficulty: '挑战', enemyCount: 18,
    briefing: '河流将战区分成两岸，地面部队只能通过两座桥。侦察车寻找突破口，工程车为桥头装甲部队提供维修。', objective: '歼灭全部敌军', routes: ['北桥：宽阔入口，利于展开', '南桥：狭窄捷径，争夺激烈'] },
];
const BLUE = [[17,3],[18,3],[19,3],[17,4],[18,4],[19,4],[17,5],[18,5],[19,5]];
const RED_SOUTH = [[7,14],[8,14],[9,14],[7,15],[8,15],[9,15],[7,16],[8,16],[9,16],[6,14],[6,15],[6,16],[5,14],[5,15],[5,16],[6,13],[7,13],[8,13]];
const RED_NORTH = [[2,5],[3,5],[4,5],[2,6],[3,6],[4,6],[2,7],[3,7],[4,7],[5,5],[5,6],[5,7],[6,5],[6,6],[6,7],[2,8]];
const TYPES = BLUE_FORMATION;
const RED_TYPES = [...TYPES, 'tank','heavyTank','artillery','rocket','scout','engineer','tank','artillery','heavyTank'];

export function createScenario(id = SCENARIOS[0].id) {
  const meta = SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
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
  } else {
    for (let y = 1; y <= 16; y++) horizontal(y, 10, 12, 4);
    horizontal(5, 5, 18); horizontal(12, 5, 18); vertical(5, 5, 14); vertical(18, 5, 13);
    [[8,8],[8,9],[14,9],[14,10],[15,10],[7,10]].forEach(([x,y])=>put(x,y,1));
    landmarks = [{ x: 11, y: 5, label: '北桥' }, { x: 11, y: 12, label: '南桥' }];
  }
  [[7,7],[6,10],[14,7],[15,7],[8,13],[14,13],[16,14],[3,10],[16,2]].forEach(([x,y]) => {
    if (terrain[y]?.[x] === 0) put(x, y, 2);
  });
  const red = (meta.id === 'diagonal-valley' ? RED_NORTH : RED_SOUTH).slice(0, meta.enemyCount);
  const deployments = [...BLUE.map(([x,y],i)=>({team:'blue',type:TYPES[i],x,y})),
    ...red.map(([x,y],i)=>({team:'red',type:RED_TYPES[i],x,y}))];
  for (const {x,y} of deployments) put(x,y,0);
  return { ...meta, cols, rows, terrain, deployments, landmarks };
}
