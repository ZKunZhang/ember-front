export default function StoryBrief({ game }) {
  const { story, mission, missionProgress: progress = {} } = game;
  const points = mission.points || [mission.point];
  const allies = game.units.filter(unit => unit.team === 'blue' && unit.hp > 0);
  const atDestination = unit => unit.x === mission.point?.x && unit.y === mission.point?.y;
  const held = allies.some(atDestination);
  const escorted = allies.some(unit => unit.type === 'engineer' && atDestination(unit));
  const captured = progress.captured?.filter(Boolean).length || 0;
  const heldTurns = progress.heldTurns || 0;
  const completed = mission.kind === 'capture' ? captured : mission.kind === 'hold' ? heldTurns : Number(escorted);
  const required = mission.kind === 'capture' ? points.length : mission.kind === 'hold' ? mission.turns : 1;
  const status = mission.kind === 'capture'
    ? `接应进度 ${captured} / ${points.length}`
    : mission.kind === 'hold'
      ? `坚守 ${heldTurns} / ${mission.turns} 回合 · ${held ? '驻守中' : '等待部队抵达'}`
      : '护送工程车抵达金色地格';
  const note = mission.kind === 'hold'
    ? '敌方回合结束时结算；无人驻守则重新计数。'
    : mission.kind === 'escort'
      ? '保护工程车；工程车全部损失则任务失败。'
      : '友军抵达后保留接应进度，无需同时占领。';

  return (
    <section className="story-brief" aria-label="剧情任务">
      <div className="story-copy">
        <div className="eyebrow">{story.chapter} · 地图与兵种为游戏改编</div>
        <h2>{game.objective}</h2>
        <details>
          <summary>历史背景与参考</summary>
          <p>{story.intro}</p>
          <p>{story.history} <a href={story.sourceUrl} target="_blank" rel="noreferrer">阅读史料 ↗</a></p>
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
            const reached = mission.kind === 'capture' ? progress.captured?.[index] : mission.kind === 'hold' ? held : escorted;
            return <p key={point.label}>{reached ? '✓' : '◇'} {point.label} · GRID {point.x + 1} : {point.y + 1}</p>;
          })}
        </div>
        <small>{note}</small>
      </div>
    </section>
  );
}
