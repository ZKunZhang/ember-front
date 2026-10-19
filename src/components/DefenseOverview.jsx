import StoryBrief from './StoryBrief.jsx';
import { defenseSummary } from '../game/defense.js';

export default function DefenseOverview({ game, guideOpen, onGuideChange, onLocateRunway }) {
  const defense=defenseSummary(game);
  const allies=game.units.filter(unit=>unit.team==='blue');
  const living=allies.filter(unit=>unit.hp>0);
  const enemies=game.units.filter(unit=>unit.team==='red');
  const locked=game.turn!=='blue'||Boolean(game.winner);
  const won=game.winner==='blue';
  const status=defense.outcome==='eliminated'?'全歼敌军，提前完成':won?'五轮守备完成':game.winner?'守备失败':`还需守备 ${defense.remaining} 个敌方回合`;
  const threat=game.winner?status:defense.nearbyEnemies.length?`跑道周边 3 格内发现 ${defense.nearbyEnemies.length} 辆敌车`:defense.visibleEnemies.length?`当前发现 ${defense.visibleEnemies.length} 辆敌车，留意接近路线`:'当前视野内未发现敌军，留意迷雾';
  return <>
    <section className="mission-overview defense-overview" aria-label="任务与进度">
      <section className="mission-head">
        <div><div className="eyebrow">AIRFIELD DEFENSE / 守备行动</div><h1>{game.name}<span>{game.difficulty} · {game.formationName}</span></h1></div>
      </section>
      <section className="mission-stats battle-status" aria-label="战况概览">
        <div><small>我方存活</small><strong id="ally-count">{String(living.length).padStart(2,'0')} <em>/ {String(allies.length).padStart(2,'0')}</em></strong></div>
        <div><small>已击毁敌军</small><strong id="kill-count">{String(enemies.filter(unit=>unit.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div>
        <div><small>作战回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div>
        <div className="phase-readiness" aria-label="我方剩余行动机会"><span><b>{locked?0:living.filter(unit=>!unit.moved).length}</b> 可移动</span><span><b>{locked?0:living.filter(unit=>!unit.fired).length}</b> 可开火 / 维修</span></div>
        <p className="turn-phase" aria-live="polite">{game.winner?'行动结束':locked?'敌方行动中 · 请观察防线':'我方行动 · 完成布防后结束回合'}</p>
      </section>
    </section>
    <aside className="objective-hud defense-objective" aria-label="机场守备指挥">
      <div className="defense-objective-heading"><span className="defense-shield" aria-hidden="true">◇</span><div><small>本关目标</small><h2>守住跑道</h2></div><button onClick={onLocateRunway} className="defense-locate" aria-label="定位跑道保护区">⌖ 定位</button></div>
      <div className="defense-progress" aria-live="polite">
        <p className="objective-progress">机场守备 <strong>{defense.completed} / {defense.required}</strong> 回合</p>
        <div className="defense-segments" role="progressbar" aria-label="已完成的机场守备回合" aria-valuemin={0} aria-valuemax={defense.required} aria-valuenow={defense.completed} aria-valuetext={`${defense.completed} / ${defense.required} 个完整敌方回合 · ${status}`}>
          {Array.from({length:defense.required},(_,index)=><i key={index} className={index<defense.completed?'completed':''}/>) }
        </div>
        <p className="defense-count-note">{status}<span>敌方行动全部结束后才计数</span></p>
      </div>
      <p className="defense-critical-rule"><b>金色区域是 {game.mission.points.length} 格跑道保护区</b><span>任一敌车进入即失败；我方全灭也会失败。</span></p>
      <p className={`defense-threat ${defense.nearbyEnemies.length&&!game.winner?'is-warning':''}`} role="status"><i/>{threat}</p>
      <small className="defense-visibility">{defense.unobservedPoints.length?`${defense.unobservedPoints.length} 格跑道不在当前视野内`:'跑道保护区在当前视野内'} · 仅报告可见敌情</small>
      <details className="defense-guide" open={guideOpen} onToggle={event=>onGuideChange(event.currentTarget.open)}>
        <summary>怎么守？三步开始 <span>{guideOpen?'收起 −':'展开 ＋'}</span></summary>
        <div className="defense-guide-body">
          <ol>
            <li><b>选择车辆</b><span>点击我方模型，或从编队列表选车。</span></li>
            <li><b>布置防线</b><span>点击浅蓝范围移动；点击可见敌军直接开火。重坦守入口，火炮在后方支援。</span></li>
            <li><b>交给敌方行动</b><span>完成布防后点左下角「结束回合」。守过一轮，进度增加 1。</span></li>
          </ol>
          <p>无需把车停在跑道上；歼灭全部敌军可提前获胜。所有车辆移动完会自动结束回合，请先用完需要的开火／维修机会。</p>
          <button className="primary" onClick={()=>onGuideChange(false)}>开始守备 →</button>
        </div>
      </details>
      <details className="mission-intel">
        <summary>任务简报与战术路线</summary>
        <p>{game.briefing}</p>
        {game.story&&<StoryBrief game={game}/>}
        <div className="route-brief">{game.routes.map(route=><p key={route}>{route}</p>)}</div>
      </details>
    </aside>
  </>;
}
