import { breakthroughArrivals } from '../game/engine.js';
import { hexToSource } from '../game/layout.js';
import { defenseSummary } from '../game/defense.js';

export default function StoryBrief({ game }) {
  const { story, mission, missionProgress: progress = {} } = game;
  const points = mission.points || [mission.point];
  const allies = game.units.filter(unit => unit.team === 'blue' && unit.hp > 0);
  const atDestination = unit => unit.x === mission.point?.x && unit.y === mission.point?.y;
  const held = allies.some(atDestination);
  const escorted = allies.some(unit => unit.type === 'engineer' && atDestination(unit));
  const captured = progress.captured?.filter(Boolean).length || 0;
  const heldTurns = progress.heldTurns || 0;
  const crossing = mission.kind === 'breakthrough';
  const arrivals = breakthroughArrivals(game);
  const eliminated = mission.kind === 'hold' && game.winner === 'blue' && !game.units.some(unit => unit.team === 'red' && unit.hp > 0);
  const defending=mission.kind==='defend';
  const defense=defenseSummary(game);
  const defendedTurns=progress.defendedTurns||0;
  const completed = defending?defense.completed:crossing ? arrivals.length : mission.kind === 'capture' ? captured : mission.kind === 'hold' ? (eliminated ? mission.turns : heldTurns) : Number(escorted);
  const required = crossing ? mission.required : mission.kind === 'capture' ? points.length : mission.kind === 'hold'||defending ? mission.turns : 1;
  const status = crossing ? `抵达撤离区 ${arrivals.length} / ${required} 辆`
    : defending?`机场守备 ${defendedTurns} / ${mission.turns} 回合 · ${defense.outcome==='eliminated'?'全歼敌军，提前完成':game.winner==='red'?'守备失败':game.winner==='blue'?'守备完成':'跑道保护中'}`:mission.kind === 'capture'
    ? `接应进度 ${captured} / ${points.length}`
    : mission.kind === 'hold'
      ? eliminated ? '敌军已全歼 · 任务完成' : `坚守 ${heldTurns} / ${mission.turns} 回合 · ${held ? '驻守中' : '等待部队抵达'}`
      : '护送工程车抵达金色地格';
  const note = crossing ? `至少 ${required} 辆存活友军须同时停在金色撤离格；无需歼灭敌军。存活车辆不足 ${required} 辆则失败。敌军在你进入其视野或受到攻击后出击。`
    : defending?'守过完整敌方回合即可计数，不必把车辆停在跑道上；任何敌军踏入保护格立即失败，我方全灭也会失败，歼灭全部敌军可提前获胜。':mission.kind === 'hold'
    ? '敌方回合结束时计数；无人驻守则重置。歼灭全部敌军可立即获胜。'
    : mission.kind === 'escort'
      ? '保护工程车；工程车全部损失则任务失败。'
      : '友军抵达后保留接应进度，无需同时占领。';

  return (
    <section className="story-brief" aria-label="剧情任务">
      <div className="story-copy">
        <div className="eyebrow">{story.chapter} · {story.sourceUrl ? '地图与兵种为游戏改编' : '原创虚构剧情'}</div>
        <h2>{game.objective}</h2>
        <details>
          <summary>{story.sourceUrl ? '历史背景与参考' : '行动背景'}</summary>
          <p>{story.intro}</p>
          {story.sourceUrl && <p>{story.history} <a href={story.sourceUrl} target="_blank" rel="noreferrer">阅读史料 ↗</a></p>}
        </details>
      </div>

      <div className="mission-progress" aria-live="polite">
        <strong>{status}</strong>
        <div
          className="mission-meter"
          role="progressbar"
          aria-label={mission.kind === 'escort' ? '工程车抵达目标' : '剧情任务完成进度'}
          aria-valuemin={0}
          aria-valuemax={required}
          aria-valuenow={Math.min(completed, required)}
          aria-valuetext={mission.kind === 'escort' ? (escorted ? '已抵达' : '尚未抵达') : status}
        >
          <span style={{ width: `${Math.min(completed / required, 1) * 100}%` }} />
        </div>
        <div className="mission-points">
          {points.map((point, index) => {
            const observed=game.fog[point.y]?.[point.x]===false;
            const breached=defending&&defense.visibleEnemies.some(unit=>unit.x===point.x&&unit.y===point.y);
            const reached = defending?observed&&!breached:crossing ? arrivals.some(u=>u.x===point.x&&u.y===point.y) : mission.kind === 'capture' ? progress.captured?.[index] : mission.kind === 'hold' ? held : escorted;
            const coordinate=hexToSource(game,point);
            return <p key={point.label}>{reached ? '✓' : '◇'} {point.label} · GRID {coordinate.x + 1} : {coordinate.y + 1}{defending?` · ${!observed?'未观察':breached?'已被突破':'视野内未见敌车'}`:''}</p>;
          })}
        </div>
        <small>{note}</small>
      </div>
    </section>
  );
}
