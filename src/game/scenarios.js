import { BLUE_FORMATION, UNIT_TYPES } from './catalog.js';
import { DEFAULT_DIFFICULTY, enemyCountFor, getDifficulty } from './difficulty.js';
import { hexDistance, hexNeighbors } from './hex.js';

export const FORMATIONS = {
  balanced: { name: '均衡编组', description: '各兵种协同推进，适合初次部署。', types: ['scout','tank','heavyTank','artillery','rocket','engineer','tank','artillery','scout'] },
  mobile: { name: '机动编组', description: '侦察与坦克比例更高，快速抢占路线。', types: ['scout','scout','tank','tank','engineer','artillery','scout','rocket','heavyTank'] },
  armored: { name: '装甲编组', description: '重型单位顶住正面压力，维修车提供续航。', types: ['heavyTank','tank','heavyTank','tank','engineer','scout','tank','artillery','rocket'] },
  artillery: { name: '炮击编组', description: '远程火力密集，依靠侦察车校射。', types: ['scout','artillery','rocket','artillery','engineer','scout','rocket','tank','heavyTank'] },
};

const crossing = required => ({ kind: 'breakthrough', required, points: [
  [3,14],[4,14],[3,15],[4,15],[5,14],[5,15],
].map(([x,y],i)=>({x,y,label:`撤离位 ${String.fromCharCode(65+i)}`})) });

export const SCENARIOS = [
  { id: 'mountain-pass', name: '断脊山隘', subtitle: 'BROKEN RIDGE', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'balanced',
    allyCount: 9, mission: crossing(5),
    briefing: '带领9辆车穿越断脊山脉，至少5辆抵达对侧撤离区。哨兵藏在山隘和林缘，山体会挡住视线；侦察车先探路，不必全歼敌军。', objective: '带9辆车出发，至少5辆抵达撤离区', routes: ['中央隘口：路短，转弯后可能遭遇守军', '山脉外沿：绕行较远，可避开部分哨卡'] },
  { id: 'diagonal-valley', name: '长风峡谷', subtitle: 'WINDWARD VALLEY', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'mobile',
    allyCount: 7, approach: 'northwest', mission: crossing(4),
    briefing: '7辆车从左上方进入峡谷，至少4辆穿过错位山口抵达右下接应区。守军分散在山背和岔路，绕过山体后才能发现。', objective: '带7辆车穿越峡谷，至少4辆安全抵达', routes: ['峡谷缺口：近路，逐段侦察', '侧翼山道：较远，利用山体掩护'] },
  { id: 'twin-bridges', name: '双桥河湾', subtitle: 'TWIN CROSSINGS', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'armored',
    allyCount: 9, approach: 'southeast', mission: crossing(6),
    briefing: '9辆车从右下方出发，至少6辆渡河抵达左上撤离区。两座桥都有可能遇敌，装甲先占桥头，工程车照顾受损车辆。', objective: '带9辆车渡河，至少6辆抵达对岸撤离区', routes: ['第一座桥：尽早渡河，沿对岸行军', '第二座桥：绕行接近终点，注意林后哨卡'] },
  { id: 'forest-corridor', name: '林海走廊', subtitle: 'FOREST CORRIDOR', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'mobile',
    allyCount: 6, approach: 'northeast', mission: crossing(4),
    briefing: '6辆轻装车辆从右上方出发，至少4辆穿过连片森林抵达左下接应区。树林遮挡视线，侦察车在林间转角可能先发现埋伏。', objective: '带6辆车穿越林海，至少4辆抵达接应区', routes: ['林间通道：近路，转角多、视线短', '外围林缘：路程较长，便于绕过伏兵'] },
  { id: 'broken-basin', name: '碎岩盆地', subtitle: 'BROKEN BASIN', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'armored',
    briefing: '碎岩与高地形成天然防线，装甲部队需要在两处缺口集中突破。', objective: '歼灭全部敌军', routes: ['中央裂口：装甲正面突破', '东侧坡道：较慢但便于展开'] },
  { id: 'lake-crossroads', name: '环湖交锋', subtitle: 'LAKE CROSSROADS', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'artillery',
    allyCount: 8, approach: 'northwest', mission: crossing(5),
    briefing: '8辆支援车辆从左上方进入湖区，至少5辆沿堤岸抵达右下出口。敌军扼守沿途林缘，远程火力掩护纵队通过即可。', objective: '带8辆车绕湖转移，至少5辆抵达出口', routes: ['近侧堤岸：短线穿越，注意林缘', '远侧堤岸：展开支援，掩护车队'] },
  { id: 'alamein-breakthrough', name: '阿拉曼突破', subtitle: 'ALAMEIN BREAKTHROUGH', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'balanced',
    briefing: '穿过沙丘防线缺口，夺取两处集结点，为装甲纵队打开通路。', objective: '夺取两处集结点', routes: ['西侧缺口：较短但暴露', '东侧沙丘：绕行后再合流'],
    story: { chapter: '战史改编 · 01', history: '第二次阿拉曼战役于1942年10月23日至11月4日成为北非战局转折。', sourceUrl: 'https://www.nam.ac.uk/explore/battle-alamein', intro: '虚构的前线连队必须穿过沙丘防线，夺取两个集结点并为后续攻势打开缺口。', success: '虚构的装甲纵队在两个集结点会合，沙海中的突破口终于稳住。', failure: '虚构的连队未能完成两处集结点的接应，敌军重新封锁了沙丘通道。' },
    mission: { kind: 'capture', points: [{ x: 10, y: 9, label: '西侧集结点' }, { x: 14, y: 11, label: '东侧集结点' }] } },
  { id: 'bridge-relief', name: '桥头救援', subtitle: 'BRIDGE RELIEF', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'mobile',
    briefing: '工程车护送补给纵队穿过河谷，抵达桥头后才能让后续部队渡河。', objective: '护送工程车抵达桥头', routes: ['西桥：路窄但掩护较多', '东桥：开阔，需快速通过'],
    story: { chapter: '战史改编 · 02', history: '市场花园行动于1944年9月17日至25日试图夺取莱茵渡口但未达全部目标。', sourceUrl: 'https://www.nam.ac.uk/explore/market-garden', intro: '虚构的救援纵队必须护送工程车通过火线，把桥头交到友军手中。', success: '虚构的工程车抵达桥头，救援纵队为渡河部队恢复了通道。', failure: '虚构的桥头救援中断，工程车损毁后河谷再次落入封锁。' },
    mission: { kind: 'escort', point: { x: 11, y: 6, label: '北桥头' } } },
  { id: 'ardennes-watch', name: '阿登守望', subtitle: 'ARDENNES WATCH', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'armored',
    briefing: '敌军在林地发动突袭，坚守高地观察点四个敌方回合，等待援军抵达；歼灭全部敌军也可立即获胜。', objective: '坚守观察点4个敌方回合，或歼灭全部敌军', routes: ['中央林道：最快抵达', '两侧坡线：便于交叉掩护'],
    story: { chapter: '战史改编 · 03', history: '突出部战役于1944年12月由德国在阿登发动进攻。', sourceUrl: 'https://www.nps.gov/places/battle-of-the-bulge.htm', intro: '虚构的守军必须在雪林观察点坚守，直到援军穿过被突破的防线。', success: '虚构的守军击退了林地攻势，阿登防线的威胁已经解除。', failure: '虚构的观察点失守，敌军的突袭撕开了雪林防线。' },
    mission: { kind: 'hold', point: { x: 15, y: 6, label: '林地观察点' }, turns: 4 } },
  { id: 'iron-gorge', name: '铁壁峡口', subtitle: 'IRON GORGE', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'armored',
    allyCount: 9, approach: 'northeast', mission: crossing(6),
    briefing: '9辆重装车辆从右上方穿越三道连绵石岭，至少6辆抵达左下出口。山后的守军只在接敌后出动，保住队形逐段前进。', objective: '带9辆车突破峡口，至少6辆通过封锁', routes: ['错位隘口：逐段前进，侦察转角', '外沿公路：绕过石岭，保存兵力'] },
  { id: 'reed-crossing', name: '苇河渡口', subtitle: 'REED CROSSING', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'mobile',
    allyCount: 7, approach: 'southeast', mission: crossing(4),
    briefing: '7辆车从右下方驶入河洲，至少4辆通过交错桥梁抵达左上接应区。对岸林带遮住守军，渡河前先确认视野。', objective: '带7辆车通过渡口，至少4辆抵达接应区', routes: ['交错桥群：分段渡河，互相掩护', '外围长桥：绕行展开，避开部分守军'] },
  { id: 'pine-highlands', name: '松岭猎场', subtitle: 'PINE HIGHLANDS', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'artillery',
    allyCount: 6, approach: 'northwest', mission: crossing(3),
    briefing: '6辆侦察支援车从左上方出发，至少3辆穿过松林和岩岭抵达右下出口。敌军分队藏在林后的空地，保持侦察车领先。', objective: '带6辆车穿越松岭，至少3辆安全抵达', routes: ['林间道路：快速通过，小心转角', '外围环路：路线较远，便于脱离交火'] },
  { id: 'red-sand-loop', name: '赤沙回廊', subtitle: 'RED SAND LOOP', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'mobile',
    briefing: '两片岩台夹住中央回廊。机动部队可沿中路快速接敌，或借北侧环路绕到守军侧翼；岩台会遮挡直射火力。', objective: '歼灭全部敌军', routes: ['中央回廊：通道宽，快速切入', '北侧环路：绕过岩台，侧翼展开'] },
  { id: 'stone-bay-bridges', name: '石湾三桥', subtitle: 'STONE BAY BRIDGES', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'balanced',
    briefing: '横贯战区的水道仅有三座桥可供通行。选择宽阔的中央桥推进，或分兵两侧桥梁，避免全队挤在同一处桥头。', objective: '歼灭全部敌军', routes: ['中央宽桥：便于双列推进，注意桥头接应', '两翼窄桥：分散渡河，夹击南岸'] },
  { id: 'sawtooth-line', name: '锯齿防线', subtitle: 'SAWTOOTH LINE', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'artillery',
    briefing: '横向石岭的缺口交错分布，直线推进会被山体截断。侦察车寻找目标，炮兵越岭支援；也可沿东缘长路绕过防线。', objective: '歼灭全部敌军', routes: ['交错缺口：逐段转进，炮兵越障掩护', '东缘长路：绕行距离长，可避开中央瓶颈'] },
  { id: 'mistwood-forks', name: '雾林岔路', subtitle: 'MISTWOOD FORKS', direction: '由下向上推进', difficulty: '标准', enemyCount: 14, formationId: 'balanced',
    allyCount: 6, approach: 'northeast', mission: crossing(4),
    briefing: '6辆车从右上方进入雾林，至少4辆抵达左下出口。连片森林隔开岔路，警戒分队在转角后驻守；发现敌军时车队会暂停推进。', objective: '带6辆车通过雾林，至少4辆抵达出口', routes: ['中央林道：穿越连续林区，逐段侦察', '外缘通道：绕过树林，避免连续交火'] },
  { id: 'atoll-causeway', name: '环礁堤道', subtitle: 'ATOLL CAUSEWAY', direction: '由下向上推进', difficulty: '进阶', enemyCount: 16, formationId: 'mobile',
    allyCount: 7, approach: 'southeast', mission: crossing(5),
    briefing: '7辆车从右下方出发，至少5辆跨越环礁抵达左上接应区。可借岛心堤道快速通过，也可沿外岸避开守军，不必夺下所有阵地。', objective: '带7辆车跨越环礁，至少5辆抵达接应区', routes: ['岛心堤道：路线直接，小心前后封锁', '外岸绕行：保存兵力，绕过守军'] },
  { id: 'faultline-fortress', name: '断层要塞', subtitle: 'FAULTLINE FORTRESS', direction: '由下向上推进', difficulty: '挑战', enemyCount: 18, formationId: 'armored',
    briefing: '两道折角岩墙包住敌军阵地，东面与北面各留有缺口。重装部队吸收正面火力，工程车随队维修，再穿过内墙压缩守军空间。', objective: '歼灭全部敌军', routes: ['东侧双隘：距离较短，集中装甲突破', '北侧双隘：迂回进入，形成侧翼火力'] },
  { id: 'silent-transit', name: '静默穿越', subtitle: 'SILENT TRANSIT', direction: '穿越战场抵达撤离区', difficulty: '标准', enemyCount: 12, formationId: 'mobile',
    briefing: '通讯中断后，先遣队必须带着侦察记录穿过林区。敌方哨兵分散守住岔路，选择交火或绕行，让至少三辆车抵达西南撤离区。', objective: '至少3辆存活友军同时抵达撤离区', routes: ['中央林道：路程短，沿途有警戒哨', '北侧迂回：路程长，可避开部分守军'],
    story: { chapter: '穿越行动 · 01', intro: '先遣队截获了敌方调动情报，却与指挥部失去联系。主力交火声从远处传来，你的任务是带着记录穿过战场，在西南接应点会合。没有必要为每一片林地停留。', success: '三辆先遣车辆进入接应区，侦察记录随纵队送回了指挥部。', failure: '能够继续前进的车辆已不足三辆，先遣队无法完成此次接应。' },
    mission: { kind: 'breakthrough', required: 3, points: [{x:3,y:14,label:'撤离位 A'},{x:4,y:14,label:'撤离位 B'},{x:3,y:15,label:'撤离位 C'},{x:4,y:15,label:'撤离位 D'}] } },
  { id: 'river-escape', name: '渡河脱险', subtitle: 'RIVER ESCAPE', direction: '穿越战场抵达撤离区', difficulty: '进阶', enemyCount: 14, formationId: 'balanced',
    briefing: '撤离路线被河流截断，两座桥分别通向沿岸道路。压制桥头守军后迅速通过，让至少三辆车在对岸接应区会合。', objective: '至少3辆存活友军同时抵达撤离区', routes: ['北桥：靠近出发区，过桥后沿西岸南下', '南桥：接近撤离区，东岸推进距离较长'],
    story: { chapter: '穿越行动 · 02', intro: '前线后撤时，一支混编车队落在了河流东岸。接应队仍守在西南河湾，桥头却已出现敌方装甲。集中力量打开一处通路，把至少三辆车带到河湾。', success: '撤离车辆在河湾会合，桥头的交火被甩在身后。', failure: '河岸封锁使车队损失过重，已没有足够车辆抵达接应区。' },
    mission: { kind: 'breakthrough', required: 3, points: [{x:3,y:14,label:'河湾接应 A'},{x:4,y:14,label:'河湾接应 B'},{x:3,y:15,label:'河湾接应 C'},{x:4,y:15,label:'河湾接应 D'}] } },
  { id: 'last-convoy', name: '最后车队', subtitle: 'LAST CONVOY', direction: '穿越战场抵达撤离区', difficulty: '挑战', enemyCount: 16, formationId: 'armored',
    briefing: '车队必须穿过两道山口封锁，敌军沿途分层驻守。用装甲掩护受损车辆，保持工程车的维修能力，至少三辆车抵达出口即可完成任务。', objective: '至少3辆存活友军同时抵达撤离区', routes: ['中央双隘：较短，容易连续遭遇敌军', '南侧山道：绕开首道山口，再向出口集结'],
    story: { chapter: '穿越行动 · 03', intro: '最后一支后撤车队进入山间公路时，远处山口已经亮起敌军炮火。指挥部不再要求夺回阵地，只要求保存车辆穿过封锁。重装车辆断后，能走的车辆继续向出口前进。', success: '至少三辆车驶出山口，最后车队保住了继续作战的力量。', failure: '山口封锁切断了撤离纵队，能够驶向出口的车辆已不足三辆。' },
    mission: { kind: 'breakthrough', required: 3, points: [{x:3,y:14,label:'山口出口 A'},{x:4,y:14,label:'山口出口 B'},{x:3,y:15,label:'山口出口 C'},{x:4,y:15,label:'山口出口 D'}] } },
  { id: 'engineer-relay', name: '工兵接应', subtitle: 'ENGINEER RELAY', direction: '护送工程车穿越战场', difficulty: '进阶', enemyCount: 12, formationId: 'balanced',
    briefing: '接应点急需工程保障力量。侦察车探查林道，坦克掩护工程车通过沿途哨卡，炮兵提供远程支援。工程车抵达西南接应点即胜利，被击毁则失败。', objective: '护送工程车抵达接应点，保护其存活', routes: ['中央道路：侦察开路，坦克先行清障', '南侧绕行：避开部分哨卡，工程车跟随掩护'],
    story: { chapter: '护送行动 · 01', intro: '西南接应点缺少车辆抢修力量，一辆工程保障车被编入护送队。侦察、装甲与炮兵各司其职：先确认道路，再掩护保障车辆通过。任务只要求把工程车送到目的地。', success: '工程车安全抵达接应点，抢修分队终于获得了急需的保障力量。', failure: '工程车在途中被击毁，护送行动失败，接应点仍在等待保障力量。' },
    mission: { kind: 'escort', outposts: true, point: {x:3,y:14,label:'工程保障接应点'} } },
  { id: 'valley-lifeline', name: '峡谷生命线', subtitle: 'VALLEY LIFELINE', direction: '护送工程车穿越战场', difficulty: '挑战', enemyCount: 16, formationId: 'armored',
    briefing: '工程保障车必须穿过河谷到达前方维修站。用装甲车辆掩护过桥，再由侦察单位确认出口；不要让工程车单独接敌。目标车损失立即失败。', objective: '护送工程车抵达维修站，保护其存活', routes: ['北桥通道：较早渡河，沿西岸推进', '南桥通道：依托东岸掩护，靠近终点渡河'],
    story: { chapter: '护送行动 · 02', intro: '前方维修站即将停止运转，最后一辆工程保障车正在赶往河谷。桥头与谷口分别有敌军驻守，护送队必须用装甲部队打开通路，并给工程车留下通过空间。', success: '工程车驶入维修站，河谷中的保障线路重新接通。', failure: '目标工程车被击毁，维修站失去了此次保障接应。' },
    mission: { kind: 'escort', outposts: true, point: {x:3,y:14,label:'河谷维修站'} } },
].map(meta=>({ ...meta, allyCount:meta.allyCount??9, approach:meta.approach??'southwest',
  direction:({southwest:'左下出发 → 右上推进',northwest:'左上出发 → 右下穿越',southeast:'右下出发 → 左上穿越',northeast:'右上出发 → 左下穿越'})[meta.approach??'southwest'],
}));
const BLUE = [[17,3],[18,3],[19,3],[17,4],[18,4],[19,4],[17,5],[18,5],[19,5]];
const RED_SOUTH = [[7,14],[8,14],[9,14],[7,15],[8,15],[9,15],[7,16],[8,16],[9,16],[6,14],[6,15],[6,16],[5,14],[5,15],[5,16],[6,13],[7,13],[8,13]];
const RED_NORTH = [[2,5],[3,5],[4,5],[2,6],[3,6],[4,6],[2,7],[3,7],[4,7],[5,5],[5,6],[5,7],[6,5],[6,6],[6,7],[2,8]];
const TYPES = BLUE_FORMATION;
const RED_TYPES = [...TYPES, 'tank','heavyTank','artillery','rocket','scout','engineer','tank','artillery','heavyTank'];
// Interleave the route's three outposts so easier settings retain encounters throughout the crossing.
const CROSSING_PATROLS = [[14,7],[8,10],[5,13],[15,8],[7,11],[6,14],[13,6],[8,12],[5,15],[15,9],[6,10],[7,14],[13,8],[7,12],[6,15],[14,10],[9,12],[6,13]];
const PATROL_TYPES = ['scout','tank','tank','tank','scout','heavyTank','tank','artillery','engineer','scout','tank','artillery','tank','heavyTank','artillery','tank','tank','rocket'];

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
    for (let y = 4; y <= 13; y++) horizontal(y,8,15,2);
    horizontal(6, 5, 18, 3); horizontal(12, 5, 18, 3);
    vertical(5, 5, 14, 3); vertical(18, 5, 14, 3);
    landmarks = [{x:5,y:6,label:'西侧林道'}, {x:18,y:12,label:'东侧林缘'}];
  } else if (meta.id === 'broken-basin') {
    for (let y = 4; y <= 15; y++) { for (let x = 10; x <= 12; x++) put(x,y,1); put(7,y,1); put(15,y,1); }
    horizontal(8, 5, 18, 3); horizontal(13, 5, 18, 3);
    vertical(18, 5, 13, 3); vertical(5, 8, 14, 3);
    landmarks = [{x:10,y:8,label:'中央裂口'}, {x:12,y:13,label:'东侧坡道'}];
  } else if (meta.id === 'iron-gorge') {
    for (const x of [8, 11, 14]) for (let y = 4; y <= 14; y++) put(x,y,1);
    horizontal(3,5,18); horizontal(15,5,18);
    horizontal(7,11,18); horizontal(10,8,14); horizontal(12,5,11);
    vertical(5,3,15); vertical(18,3,15);
    landmarks = [{x:14,y:7,label:'东隘口'},{x:8,y:12,label:'西隘口'},{x:11,y:3,label:'北缘公路'}];
  } else if (meta.id === 'reed-crossing') {
    for (let y=1;y<=16;y++) { put(10,y,4); put(14,y,4); }
    horizontal(6,12,18); horizontal(9,5,12); horizontal(13,5,18);
    vertical(12,6,13); vertical(5,6,14); vertical(18,5,13);
    landmarks = [{x:14,y:6,label:'东岸桥'},{x:10,y:9,label:'西岸桥'},{x:12,y:13,label:'南侧长桥'}];
  } else if (meta.id === 'pine-highlands') {
    for (let y=5;y<=13;y++) horizontal(y,7,15,2);
    for (let y=6;y<=8;y++) horizontal(y,9,11,1);
    horizontal(4,5,18);horizontal(14,5,18);horizontal(9,5,18);
    vertical(5,4,14);vertical(18,4,14);vertical(12,4,14);
    landmarks = [{x:12,y:9,label:'林间空地'},{x:5,y:4,label:'外围环路'}];
  } else if (meta.id === 'red-sand-loop') {
    for (let y = 5; y <= 7; y++) horizontal(y, 9, 14, 1);
    for (let y = 11; y <= 13; y++) horizontal(y, 9, 14, 1);
    horizontal(3, 5, 18); horizontal(9, 5, 18); horizontal(15, 5, 18);
    vertical(5, 3, 15); vertical(18, 3, 15);
    landmarks = [{x:12,y:9,label:'中央回廊'},{x:12,y:3,label:'北侧环路'}];
  } else if (meta.id === 'stone-bay-bridges') {
    horizontal(9, 1, 20, 4); horizontal(10, 1, 20, 4);
    horizontal(7, 5, 18); horizontal(12, 5, 18);
    for (const x of [5, 11, 12, 18]) vertical(x, 7, 12);
    vertical(18, 5, 7); vertical(5, 12, 14);
    [[8,6],[9,6],[14,12],[15,12],[7,11]].forEach(([x,y])=>put(x,y,1));
    landmarks = [{x:5,y:9,label:'西侧窄桥'},{x:11,y:9,label:'中央宽桥'},{x:18,y:9,label:'东侧窄桥'}];
  } else if (meta.id === 'sawtooth-line') {
    for (const y of [6, 9, 12]) horizontal(y, 1, 17, 1);
    vertical(14, 5, 8); horizontal(8, 8, 14);
    vertical(8, 8, 11); horizontal(11, 8, 13); vertical(13, 11, 14);
    horizontal(4, 5, 19); vertical(19, 4, 14); horizontal(14, 10, 19);
    landmarks = [{x:14,y:6,label:'前沿缺口'},{x:8,y:9,label:'折返隘口'},{x:13,y:12,label:'后沿缺口'},{x:19,y:10,label:'东缘长路'}];
  } else if (meta.id === 'mistwood-forks') {
    for (const x of [8, 11, 14]) for (let y = 4; y <= 12; y++) {
      put(x, y, 2); put(x + 1, y, 2);
    }
    horizontal(7, 5, 18); horizontal(13, 5, 18);
    vertical(5, 5, 14); vertical(18, 5, 13); vertical(10, 7, 13);
    landmarks = [{x:11,y:7,label:'中央林道'},{x:11,y:13,label:'南侧通道'}];
  } else if (meta.id === 'atoll-causeway') {
    for (let y = 5; y <= 13; y++) horizontal(y, 8, 15, 4);
    for (let y = 8; y <= 10; y++) horizontal(y, 11, 12, 0);
    horizontal(9, 6, 18); horizontal(3, 6, 18); horizontal(15, 6, 18);
    vertical(6, 3, 15); vertical(18, 3, 15);
    landmarks = [{x:11,y:9,label:'岛心通路'},{x:12,y:3,label:'北侧环岸'},{x:12,y:15,label:'南侧环岸'}];
  } else if (meta.id === 'faultline-fortress') {
    horizontal(7, 1, 14, 1); vertical(14, 7, 16, 1);
    horizontal(11, 1, 10, 1); vertical(10, 11, 16, 1);
    horizontal(13, 8, 18); vertical(5, 5, 14);
    horizontal(5, 5, 18); vertical(18, 5, 13);
    landmarks = [{x:14,y:13,label:'外墙东隘'},{x:10,y:13,label:'内墙东隘'},{x:5,y:7,label:'北侧外隘'},{x:5,y:11,label:'北侧内隘'}];
  } else if (meta.id === 'silent-transit' || meta.id === 'engineer-relay') {
    for (const x of [7, 11, 15]) for (let y = 5; y <= 13; y++) { put(x,y,2);put(x+1,y,2); }
    horizontal(3, 3, 18); horizontal(8, 3, 18); horizontal(14, 3, 18);
    vertical(3, 3, 15); vertical(18, 3, 14);
    if (meta.id === 'engineer-relay') {
      horizontal(11, 3, 18); horizontal(5, 9, 13, 1); vertical(5, 8, 14);
    }
    landmarks = [{x:11,y:8,label:'林间岔路'},{x:8,y:3,label:'北侧迂回'}];
  } else if (meta.id === 'river-escape' || meta.id === 'valley-lifeline') {
    for (let y = 1; y <= 16; y++) horizontal(y, 10, 11, 4);
    horizontal(6, 3, 18); horizontal(12, 3, 18);
    vertical(3, 6, 15); vertical(18, 4, 12);
    if (meta.id === 'valley-lifeline') {
      for (let y = 4; y <= 13; y++) { put(7,y,1); put(8,y,1); put(14,y,1); put(15,y,1); }
      horizontal(6,3,18); horizontal(12,3,18); horizontal(14,3,18);
    }
    landmarks = [{x:10,y:6,label:'北桥哨卡'},{x:10,y:12,label:'南桥哨卡'}];
  } else if (meta.id === 'last-convoy') {
    for (let y = 1; y <= 13; y++) { put(12,y,1);put(13,y,1);put(8,y,1);put(9,y,1); }
    horizontal(7, 10, 18); vertical(10, 7, 11); horizontal(11, 3, 10);
    horizontal(14, 3, 18); vertical(18, 5, 14); vertical(3, 11, 15);
    landmarks = [{x:12,y:7,label:'第一封锁线'},{x:9,y:11,label:'第二封锁线'},{x:12,y:14,label:'南侧山道'}];
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
    for (let y=4;y<=13;y++) horizontal(y,7,16,2);
    horizontal(7, 5, 18, 3); horizontal(12, 5, 18, 3); vertical(5, 6, 14, 3);
    landmarks = [{ x: 15, y: 6, label: '林地观察点' }, { x: 6, y: 12, label: '西侧坡线' }];
  }
  // Coherent woodland pockets replace the scattered single-tile decorations.
  for(const [left,top,right,bottom] of [[3,8,4,11],[15,9,17,12]])
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(terrain[y][x]===0)put(x,y,2);
  for(const point of meta.mission?.points||(meta.mission?.point?[meta.mission.point]:[])) put(point.x,point.y,3);
  const outposts = meta.mission?.kind === 'breakthrough' || meta.mission?.outposts;
  const flipX=['northwest','northeast'].includes(meta.approach),flipY=['southeast','northeast'].includes(meta.approach);
  const transform=p=>({...p,x:flipX?cols-1-p.x:p.x,y:flipY?rows-1-p.y:p.y});
  const blue=BLUE.slice(0,meta.allyCount).map(([x,y],i)=>({team:'blue',type:formation.types[i],x,y}));
  let red = (outposts ? CROSSING_PATROLS : meta.id === 'diagonal-valley' ? RED_NORTH : RED_SOUTH).slice(0, enemyCount);
  if(outposts) {
    // Place each patrol on connected ground beside cover, never punch isolated
    // deployment holes into the mountain or disclose guards at the spawn point.
    const seen=new Set(),queue=[blue[0]];
    for(let i=0;i<queue.length;i++) {
      const {x,y}=queue[i],key=`${x},${y}`;
      if(seen.has(key)||![0,3].includes(terrain[y]?.[x]))continue;
      seen.add(key);
      // Search after orientation: reflecting one axial axis changes adjacency.
      queue.push(...hexNeighbors(transform({x,y})).map(transform));
    }
    const occupied=new Set([...blue,...(meta.mission.points??[meta.mission.point])].map(p=>`${p.x},${p.y}`));
    const candidates=[...seen].map(key=>{const [x,y]=key.split(',').map(Number);return {x,y};});
    red=red.map(([ax,ay])=>{
      const options=candidates.filter(p=>!occupied.has(`${p.x},${p.y}`)&&blue.every(u=>hexDistance(transform(u),transform(p))>UNIT_TYPES[u.type].vision+1));
      const score=p=>10*hexDistance(transform(p),transform({x:ax,y:ay}))+(hexNeighbors(transform(p)).map(transform).some(({x,y})=>[1,2].includes(terrain[y]?.[x]))?0:8);
      options.sort((a,b)=>score(a)-score(b)||a.x-b.x||a.y-b.y);
      const p=options[0];
      if(!p)throw new Error(`No connected patrol position in ${meta.id}`);
      occupied.add(`${p.x},${p.y}`);return [p.x,p.y];
    });
  }
  const deployments = [...blue,...red.map(([x,y],i)=>({team:'red',type:(outposts ? PATROL_TYPES : RED_TYPES)[i],x,y,...(outposts?{patrolGroup:i%3}: {})}))];
  for (const {x,y} of deployments) put(x,y,0);
  const mission=meta.mission?{...meta.mission,...(meta.mission.points?{points:meta.mission.points.map(transform)}:{point:transform(meta.mission.point)})}:undefined;
  const oriented=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>terrain[flipY?rows-1-y:y][flipX?cols-1-x:x]));
  return { ...meta, mission, formationId: Object.entries(FORMATIONS).find(([,f])=>f===formation)?.[0] ?? meta.formationId, formationName: formation.name, difficultyId: difficulty.id, difficulty: difficulty.label, enemyCount, cols, rows, terrain:oriented, deployments:deployments.map(unit=>({...transform(unit),heading:{x:(unit.team==='blue'?-1:1)*(flipX?-1:1),y:0}})), landmarks:landmarks.map(transform) };
}
