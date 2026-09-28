import { useState } from 'react';
import UnitIcon from './UnitIcon.jsx';

function UnitDetails({ unit, hostile = false }) {
  const stats = [
    ['移动', unit.move],
    ['射程', `${unit.minRange}–${unit.range}`],
    ['火力', unit.attack],
    ['视野', unit.vision],
    ['装甲', unit.armor],
  ];

  return (
    <>
      <div className="unit-header">
        <div className="unit-art"><UnitIcon type={unit.type} team={unit.team} /></div>
        <div>
          <div className="unit-name">{unit.name} <small>{String(unit.id).padStart(2, '0')}</small></div>
          <div className="unit-sub">{hostile ? '敌方 · ' : '我方 · '}{unit.label}</div>
        </div>
      </div>
      <div className="hp-row">
        <span>{hostile ? '当前生命' : '装甲完整度'}</span>
        <span>{unit.hp} / {unit.maxHp}</span>
      </div>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${unit.hp / unit.maxHp * 100}%` }} />
      </div>
      <div className="unit-stats">
        {stats.map(([label, value]) => (
          <div key={label}><small>{label}</small><b>{value}</b></div>
        ))}
      </div>
      <details className="unit-description"><summary>兵种特性</summary><p>{unit.description}</p></details>
    </>
  );
}

export default function CommandPanel({ game, dispatch }) {
  const [expanded, setExpanded] = useState(false);
  const selected = game.units.find(unit => unit.id === game.selectedId && unit.hp > 0);
  const locked = game.turn !== 'blue' || Boolean(game.winner);
  const enemy = game.units.find(unit => (
    unit.id === game.inspectedId && unit.team === 'red' && unit.hp > 0 && !game.fog[unit.y][unit.x]
  ));
  const inspected = enemy || selected;
  const survivors = game.units.filter(unit => unit.team === 'blue' && unit.hp > 0);
  const movable = locked ? 0 : survivors.filter(unit => !unit.moved).length;
  const readyToFire = locked ? 0 : survivors.filter(unit => !unit.fired).length;

  return (
    <aside className={`command-hud ${expanded ? 'is-expanded' : ''}`} aria-label="战场指挥">
      <button className="command-toggle" aria-expanded={expanded} aria-controls="command-panels" onClick={() => setExpanded(value => !value)}>
        <span>战场指挥 · {inspected ? `${enemy ? '敌方' : '我方'} · ${inspected.name}` : '待命'}</span><span>{expanded ? '收起 −' : '单位 / 指令 ＋'}</span>
      </button>
      <div className="command-panels" id="command-panels">
      <section className={`unit-panel ${enemy ? 'hostile-panel' : ''}`} id={enemy ? 'enemy-intel' : undefined} data-unit={inspected?.id} aria-label="当前选中单位">
        <div className="section-title">当前单位 <span>{inspected ? `${enemy ? 'HOSTILE' : 'UNIT'} ${String(inspected.id).padStart(2, '0')}` : '待命'}</span></div>
        {inspected ? (
          <>
            <UnitDetails unit={inspected} hostile={Boolean(enemy)} />
            {!enemy && <div className="modes">
              <button
                id="move-mode"
                className={game.mode === 'move' ? 'active' : ''}
                aria-pressed={game.mode === 'move'}
                disabled={locked || selected.moved}
                onClick={() => dispatch({ type: 'MODE', mode: 'move' })}
              >
                {selected.moved ? '✓ 已移动' : '◇ 移动'}
              </button>
              <span id="attack-status" className="action-status">{selected.fired ? '✓ 已行动' : '⌖ 点击敌军开火'}</span>
              {selected.repair > 0 && (
                <button
                  id="repair-mode"
                  className={game.mode === 'repair' ? 'active' : ''}
                  aria-pressed={game.mode === 'repair'}
                  disabled={locked || (selected.fired && game.mode !== 'repair')}
                  onClick={() => dispatch(game.mode === 'repair'
                    ? { type: 'CANCEL_REPAIR' }
                    : { type: 'MODE', mode: 'repair' })}
                >
                  {game.mode === 'repair' ? '取消维修' : '✚ 维修'}
                </button>
              )}
            </div>}
          </>
        ) : (
          <div className="empty-selection"><span>⌖</span>点击战场中的我方或敌方车辆查看情报</div>
        )}
      </section>

      <section className="phase-panel">
        <div className="eyebrow">回合指挥 <span>{String(game.turnNumber).padStart(2, '0')}</span></div>
        <h2><span className="live-dot" />{game.winner ? '行动结束' : locked ? '敌方行动阶段' : '我方行动阶段'}</h2>
        <div className="phase-readiness" aria-label="我方剩余行动机会">
          <span><b>{String(movable).padStart(2, '0')}</b> 可移动</span>
          <span><b>{String(readyToFire).padStart(2, '0')}</b> 可开火 / 维修</span>
        </div>
        {locked && !game.winner && <p>侦听敌方动向 · {game.enemyIndex} / {game.enemyQueue.length}</p>}
        <details className="turn-note"><summary>回合规则</summary><p>全员移动完自动结束回合；请在最后一次移动前完成开火或维修。</p></details>
        <button className="primary" id="end-turn" disabled={locked} onClick={() => dispatch({ type: 'END_TURN' })}>
          结束回合 <span>→</span>
        </button>
      </section>

      <details className="log-panel">
        <summary className="section-title">战场通讯 <span className="live-label">展开战报 ＋</span></summary>
        <div id="log" aria-live="polite">
          {game.logs.map(log => (
            <div key={log.id} className={`log-entry ${log.kind}`}>
              <time>{String(log.round).padStart(2, '0')} ›</time>{log.message}
            </div>
          ))}
        </div>
      </details>
      </div>
    </aside>
  );
}
