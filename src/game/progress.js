import { SCENARIOS } from './scenarios.js';
import { DIFFICULTIES } from './difficulty.js';

// Changed objectives have their own record; keep the old campaign key intact.
export const PROGRESS_STORAGE_KEY = 'ember-front.campaign.v2';
export const progressKey = (id, difficulty) => `${id}:${difficulty}`;

export function readProgress() {
  const records = {};
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY));
    for (const scenario of SCENARIOS) for (const difficulty of Object.keys(DIFFICULTIES)) {
      const key = progressKey(scenario.id, difficulty), entry = saved?.[key];
      if (Number.isInteger(entry?.rounds) && entry.rounds > 0
        && Number.isInteger(entry?.survivors) && entry.survivors >= 1 && entry.survivors <= scenario.allyCount) {
        records[key] = { rounds: entry.rounds, survivors: entry.survivors };
      }
    }
  } catch { /* Unavailable or corrupt storage starts a fresh campaign record. */ }
  return records;
}

export function recordVictory(records, game) {
  if (game.winner !== 'blue') return records;
  const key = progressKey(game.id, game.difficultyId);
  const entry = { rounds: game.turnNumber, survivors: game.units.filter(u => u.team === 'blue' && u.hp > 0).length };
  const best = records[key];
  if (best && (best.rounds < entry.rounds || best.rounds === entry.rounds && best.survivors >= entry.survivors)) return records;
  return { ...records, [key]: entry };
}
