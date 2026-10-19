import { hexDistance } from './hex.js';

// Visible intelligence is always derived from the current fog, even after defeat.
export function defenseSummary(game) {
  if (game.mission?.kind !== 'defend') return null;
  const { points, turns: required } = game.mission;
  const completed = Math.max(0, Math.min(required, game.missionProgress?.defendedTurns ?? 0));
  const enemies = game.units.filter(unit => unit.team === 'red' && unit.hp > 0);
  const visibleEnemies = enemies.filter(unit => game.fog[unit.y]?.[unit.x] === false);
  let outcome = 'ongoing';
  if (game.winner === 'blue') outcome = completed >= required ? 'held' : 'eliminated';
  else if (game.winner === 'red') outcome = game.units.some(unit=>unit.team==='blue'&&unit.hp>0)
    && enemies.some(unit => points.some(point => point.x === unit.x && point.y === unit.y)) ? 'overrun' : 'lost';
  return {
    completed, required, remaining: Math.max(required - completed, 0), visibleEnemies,
    nearbyEnemies: visibleEnemies.filter(unit => points.some(point => hexDistance(unit, point) <= 3)),
    unobservedPoints: points.filter(point => game.fog[point.y]?.[point.x] !== false),
    outcome,
  };
}
