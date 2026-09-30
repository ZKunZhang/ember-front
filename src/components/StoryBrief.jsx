import { breakthroughArrivals } from '../game/engine.js';

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
  const completed = crossing ? arrivals.length : mission.kind === 'capture' ? captured : mission.kind === 'hold' ? (eliminated ? mission.turns : heldTurns) : Number(escorted);
  const required = crossing ? mission.required : mission.kind === 'capture' ? points.length : mission.kind === 'hold' ? mission.turns : 1;
  const status = crossing ? `抵达撤离区 ${arrivals.length} / ${required} 辆`
    : mission.kind === 'capture'
    ? `接应进度 ${captured} / ${points.length}`
    : mission.kind === 'hold'
      ? eliminated ? '敌军已全歼 · 任务完成' : `坚守 ${heldTurns} / ${mission.turns} 回合 · ${held ? '驻守中' : '等待部队抵达'}`
      : '护送工程车抵达金色地格';
  const note = crossing ? `至少 ${required} 辆存活友军须同时停在金色撤离格；无需歼灭敌军。存活车辆不足 ${required} 辆则失败。敌军在你进入其视野或受到攻击后出击。`
    : mission.kind === 'hold'
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
            const reached = crossing ? arrivals.some(u=>u.x===point.x&&u.y===point.y) : mission.kind === 'capture' ? progress.captured?.[index] : mission.kind === 'hold' ? held : escorted;
            return <p key={point.label}>{reached ? '✓' : '◇'} {point.label} · GRID {point.x + 1} : {point.y + 1}</p>;
          })}
        </div>
        <small>{note}</small>
      </div>
    </section>
  );
}
