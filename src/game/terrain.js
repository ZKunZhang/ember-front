export const TERRAIN_INFO = Object.freeze({
  0: { label: '平地', cost: 1 },
  1: { label: '山地', cost: Infinity },
  2: { label: '树林', cost: Infinity },
  3: { label: '道路', cost: 1 },
  4: { label: '深水', cost: Infinity },
  5: { label: '泥地', cost: 2 },
  6: { label: '浅水', cost: 2 },
});
export const terrainCost = type => TERRAIN_INFO[type]?.cost ?? Infinity;
export const terrainLabel = type => TERRAIN_INFO[type]?.label ?? '不可通行';
