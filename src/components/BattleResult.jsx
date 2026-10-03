import { useEffect, useRef } from 'react';
import { movementDuration } from '../game/movement.js';

export default function BattleResult({ game, nextScenario, onNext, onReset, onExit, onUndo }) {
  const ref = useRef(null), victory = game.winner === 'blue';
  useEffect(() => {
    const dialog = ref.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 100 : 650 + (game.movement ? movementDuration(game.movement) : 0);
    const timer = setTimeout(() => dialog.showModal(), delay);
    return () => { clearTimeout(timer); dialog.close(); };
  }, []);
  const allies = game.units.filter(u => u.team === 'blue');
  return <dialog ref={ref} className={`battle-result ${victory ? 'victory' : 'defeat'}`} aria-labelledby="result-title" onCancel={event => event.preventDefault()}>
    <div className="result-insignia" aria-hidden="true">{victory ? '✦' : '◇'}</div>
    <div className="eyebrow">{victory ? 'MISSION ACCOMPLISHED' : 'OPERATION ENDED'}</div>
    <h2 id="result-title">{victory ? game.mission ? '任务目标达成' : '战区已肃清' : '行动失败'}</h2>
    <p className="result-mission">{game.name} · {game.difficulty}</p>
    <div className="result-stats" aria-label="本场战报">
      <div><strong>{String(game.turnNumber).padStart(2, '0')}</strong><span>作战回合</span></div>
      <div><strong>{allies.filter(u => u.hp > 0).length}<small> / {allies.length}</small></strong><span>存活车辆</span></div>
      <div><strong>{game.units.filter(u => u.team === 'red' && u.hp <= 0).length}</strong><span>击毁敌军</span></div>
    </div>
    <p className="result-story">{game.story ? victory ? game.story.success : game.story.failure : victory ? '本区域行动结束。整备部队，前往下一个战区。' : '调整推进路线与火力配置，再次尝试突破。'}</p>
    {victory && nextScenario && <button className="primary result-next" autoFocus onClick={onNext}>下一关：{nextScenario.name} <span>→</span><small>沿用当前难度 · 使用关卡推荐编组</small></button>}
    <div className="result-actions">
      <button autoFocus={!victory} onClick={onReset}>重新部署</button>
      <button autoFocus={victory && !nextScenario} onClick={onExit}>退出游戏</button>
    </div>
    {game.undoHistory.length > 0 && <button className="result-undo text-button" onClick={onUndo}>↶ 撤回最后一步，继续指挥</button>}
  </dialog>;
}
