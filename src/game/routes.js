import { SCENARIOS, FORMATIONS } from './scenarios.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from './difficulty.js';

export function readRoute(url) {
  const match=url.pathname.match(/^\/battle\/([^/]+)\/?$/);
  const scenario=match&&SCENARIOS.find(s=>s.id===match[1]);
  if(!scenario)return null;
  const difficulty=url.searchParams.get('difficulty');
  const formationId=url.searchParams.get('formation');
  return {scenarioId:scenario.id,
    difficulty:Object.hasOwn(DIFFICULTIES,difficulty)?difficulty:DEFAULT_DIFFICULTY,
    formationId:Object.hasOwn(FORMATIONS,formationId)?formationId:scenario.formationId};
}

export function battleUrl({scenarioId,difficulty,formationId}) {
  return `/battle/${scenarioId}?${new URLSearchParams({difficulty,formation:formationId})}`;
}
