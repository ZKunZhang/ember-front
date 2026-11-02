import StoryBrief from './StoryBrief.jsx';
import { operationPresentation } from '../game/operation-display.js';

export default function OperationOverview({game,guideOpen,onGuideChange,onLocate}) {
  const plan=operationPresentation(game);
  const allies=game.units.filter(unit=>unit.team==='blue'),living=allies.filter(unit=>unit.hp>0);
  const enemies=game.units.filter(unit=>unit.team==='red');
  const locked=game.turn!=='blue'||Boolean(game.winner);
  return <>
    <section className="mission-overview defense-overview" aria-label="任务与进度">
      <section className="mission-head"><div><div className="eyebrow">{game.subtitle} / 战术行动</div><h1>{game.name}<span>{game.difficulty} · {game.formationName}</span></h1></div></section>
      <section className="mission-stats battle-status" aria-label="战况概览">
        <div><small>我方存活</small><strong id="ally-count">{String(living.length).padStart(2,'0')} <em>/ {String(allies.length).padStart(2,'0')}</em></strong></div>
        <div><small>已击毁敌军</small><strong id="kill-count">{String(enemies.filter(unit=>unit.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div>
        <div><small>作战回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div>
        <div className="phase-readiness" aria-label="我方剩余行动机会"><span><b>{locked?0:living.filter(unit=>!unit.moved).length}</b> 可移动</span><span><b>{locked?0:living.filter(unit=>!unit.fired).length}</b> 可开火 / 维修</span></div>
        <p className="turn-phase" aria-live="polite">{game.winner?'行动结束':locked?'敌方行动中 · 观察战场变化':'我方行动 · 按阶段完成目标'}</p>
      </section>
    </section>
    <aside className="objective-hud defense-objective operation-objective" aria-label="战术行动指挥">
      <div className="defense-objective-heading"><span className="defense-shield" aria-hidden="true">◇</span><div><small>{String(plan.stage+1).padStart(2,'0')} / {plan.stageLabel}</small><h2>{plan.title}</h2></div><button className="defense-locate" onClick={onLocate} aria-label="定位当前任务目标">⌖ 定位</button></div>
      <div className="defense-progress" aria-live="polite">
        <p className="objective-progress">{plan.label} <strong>{plan.value} / {plan.max}</strong></p>
        <div className="operation-meter" role="progressbar" aria-label="当前任务阶段进度" aria-valuemin={0} aria-valuemax={plan.max} aria-valuenow={plan.value} aria-valuetext={plan.summary}><span style={{width:`${Math.min(1,plan.value/plan.max)*100}%`}}/></div>
        <p className="defense-count-note">{plan.detail}</p>
      </div>
      <p className="defense-critical-rule"><b>{plan.rule}</b><span>我方全灭或超过行动期限也会失败。</span></p>
      <p className={`defense-threat operation-deadline ${plan.turnsLeft<=2&&!game.winner?'is-warning':''}`} role="status"><i/>{game.winner?plan.summary:`剩余 ${plan.turnsLeft} 个敌方回合 · 已过 ${plan.elapsed} / ${plan.deadline} 轮`}</p>
      <small className="defense-visibility">仅在完整敌方回合结束时计时 · 金色目标 / 青色撤离区</small>
      <details className="defense-guide" open={guideOpen} onToggle={event=>onGuideChange(event.currentTarget.open)}>
        <summary>行动计划 · 三步开始 <span>{guideOpen?'收起 −':'展开 ＋'}</span></summary>
        <div className="defense-guide-body"><ol>{plan.steps.map(([title,text])=><li key={title}><b>{title}</b><span>{text}</span></li>)}</ol><p>每车可移动一次、开火或维修一次。所有车辆移动完会自动结束回合，请先安排需要的火力。</p><button className="primary" onClick={()=>onGuideChange(false)}>开始行动 →</button></div>
      </details>
      <details className="mission-intel"><summary>任务简报与战术路线</summary><p>{game.briefing}</p>{game.story&&<StoryBrief game={game}/>}<div className="route-brief">{game.routes.map(route=><p key={route}>{route}</p>)}</div></details>
    </aside>
  </>;
}
