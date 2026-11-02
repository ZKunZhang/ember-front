// All combat statistics and UI descriptions come from this shared catalog.
export const UNIT_TYPES = {
  scout: { name: '侦察车', label: 'RECON', symbol: '◇', description: '快速推进，提供 5 格共享视野；轻装甲不适合正面对抗。', maxHp: 9, move: 6, range: 3, minRange: 1, attack: 3, vision: 5, armor: 0, indirect: false, repair: 0 },
  tank: { name: '主战坦克', label: 'MAIN BATTLE TANK', symbol: '▰', description: '兼顾机动与火力。2 点装甲抵消来袭伤害，适合掩护推进。', maxHp: 18, move: 4, range: 3, minRange: 1, attack: 6, vision: 3, armor: 2, indirect: false, repair: 0 },
  heavyTank: { name: '重型坦克', label: 'HEAVY ARMOR', symbol: '▣', description: '24 点生命与 3 点装甲，守住隘口；每回合只能移动 2 格。', maxHp: 24, move: 2, range: 3, minRange: 1, attack: 8, vision: 3, armor: 3, indirect: false, repair: 0 },
  artillery: { name: '自行火炮', label: 'HOWITZER', symbol: '╱', description: '间接炮火可越过山林，射程 2–6 格；依赖侦察车提供目标视野。', maxHp: 11, move: 3, range: 6, minRange: 2, attack: 7, vision: 3, armor: 0, indirect: true, repair: 0 },
  rocket: { name: '火箭炮', label: 'ROCKET ARTILLERY', symbol: '▥', description: '射程 3–7 格的重火力，可越过山林；贴身目标处于射击盲区。', maxHp: 10, move: 2, range: 7, minRange: 3, attack: 8, vision: 3, armor: 0, indirect: true, repair: 0 },
  engineer: { name: '工程车', label: 'FIELD ENGINEER', symbol: '✚', description: '维修相邻友军 5 点生命，消耗本回合开火机会；不能维修自身或残骸。', maxHp: 12, move: 4, range: 2, minRange: 1, attack: 2, vision: 3, armor: 1, indirect: false, repair: 5 },
  cannon: { name: '加农炮', label: 'FIELD GUN', symbol: '━', description: '远程直射，射程 2–7 格、火力 8；山林会挡住炮线，需沿开阔道路展开。每回合移动 2 格。', maxHp: 10, move: 2, range: 7, minRange: 2, attack: 8, vision: 3, armor: 0, indirect: false, repair: 0 },
  howitzer: { name: '榴弹炮', label: 'FIELD HOWITZER', symbol: '⌒', description: '远距曲射可越过山林，射程 3–8 格；依赖共享视野，不足 3 格无法开火。每回合移动 2 格。', maxHp: 10, move: 2, range: 8, minRange: 3, attack: 7, vision: 2, armor: 0, indirect: true, repair: 0 },
  gunHowitzer: { name: '加榴炮', label: 'GUN HOWITZER', symbol: '╱', description: '兼顾射程与重火力的间接支援，射程 2–7 格、火力 8，1 点装甲；可越过山林，依赖共享视野。每回合移动 2 格。', maxHp: 12, move: 2, range: 7, minRange: 2, attack: 8, vision: 3, armor: 1, indirect: true, repair: 0 },
};
export const BLUE_FORMATION = ['scout','tank','heavyTank','artillery','rocket','engineer','tank','artillery','scout'];
