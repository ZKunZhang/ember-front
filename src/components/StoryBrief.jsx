export default function StoryBrief({game}) {
  const {story,mission,missionProgress:progress={}}=game;
  const points=mission.points||[mission.point];
  const held=game.units.some(u=>u.team==='blue'&&u.hp>0&&u.x===mission.point?.x&&u.y===mission.point?.y);
  return <section className="story-brief" aria-label="剧情任务">
    <div><div className="eyebrow">{story.chapter} · 地图与兵种为游戏改编</div><h2>{game.objective}</h2><p>{story.intro}</p>
      <details><summary>历史背景与参考</summary><p>{story.history} <a href={story.sourceUrl} target="_blank" rel="noreferrer">阅读史料 ↗</a></p></details>
    </div>
    <div className="mission-progress" aria-live="polite">{points.map((point,index)=><p key={point.label}>
      {progress.captured?.[index]?'✓':'◇'} {point.label} · GRID {point.x+1} : {point.y+1}
    </p>)}<strong>{mission.kind==='capture'?`接应进度 ${progress.captured?.filter(Boolean).length||0} / ${points.length}`:mission.kind==='hold'?`坚守 ${progress.heldTurns||0} / ${mission.turns} 回合 · ${held?'驻守中':'等待部队抵达'}`:'护送工程车抵达金色地格'}</strong>
      <small>{mission.kind==='hold'?'敌方回合结束时结算；无人驻守则重新计数。':mission.kind==='escort'?'保护工程车；工程车全部损失则任务失败。':'友军抵达后保留接应进度，无需同时占领。'}</small>
    </div>
  </section>;
}
