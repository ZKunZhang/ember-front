import { useEffect, useReducer } from 'react';
import { gameReducer, initialGame } from '../game/reducer.js';

export function useGame(active,route) {
  const [game,dispatch]=useReducer(gameReducer,route,initial=>initialGame(initial?.scenarioId,1,initial?.difficulty,initial?.formationId));
  useEffect(()=>{
    if (!active||game.turn!=='red'||game.winner) return;
    const timer=setTimeout(()=>dispatch({type:'ENEMY_STEP',session:game.session}),280);
    return ()=>clearTimeout(timer);
  },[active,game.session,game.turn,game.enemyIndex,game.winner]);
  return {game,dispatch};
}
