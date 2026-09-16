import { useEffect, useReducer } from 'react';
import { gameReducer, initialGame } from '../game/reducer.js';

export function useGame(active) {
  const [game,dispatch]=useReducer(gameReducer,undefined,()=>initialGame());
  useEffect(()=>{
    if (!active||game.turn!=='red'||game.winner) return;
    const timer=setTimeout(()=>dispatch({type:'ENEMY_STEP',session:game.session}),280);
    return ()=>clearTimeout(timer);
  },[active,game.session,game.turn,game.enemyIndex,game.winner]);
  return {game,dispatch};
}
