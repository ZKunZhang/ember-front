export const DIFFICULTIES = {
  simple: { id: 'simple', label: '简单', enemyCountMultiplier: 0.5, enemyStatMultiplier: 0.7 },
  easy: { id: 'easy', label: '容易', enemyCountMultiplier: 0.75, enemyStatMultiplier: 0.85 },
  hard: { id: 'hard', label: '困难', enemyCountMultiplier: 1, enemyStatMultiplier: 1 },
};

export const DEFAULT_DIFFICULTY = 'simple';

export function getDifficulty(id = DEFAULT_DIFFICULTY) {
  return DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
}

export function enemyCountFor(baseCount, difficultyId) {
  return Math.ceil(baseCount * getDifficulty(difficultyId).enemyCountMultiplier);
}

export function applyEnemyDifficulty(unit, difficultyId) {
  const { enemyStatMultiplier } = getDifficulty(difficultyId);
  return {
    ...unit,
    maxHp: Math.ceil(unit.maxHp * enemyStatMultiplier),
    attack: Math.max(1, Math.round(unit.attack * enemyStatMultiplier)),
  };
}
