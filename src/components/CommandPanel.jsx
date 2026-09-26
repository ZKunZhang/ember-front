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
      <p className="unit-description">{unit.description}</p>
    </>
  );
}

function unitStatus(unit) {
  if (unit.hp <= 0) return '已损失';
  if (unit.moved && unit.fired) return '行动完毕';
  if (unit.moved) return '已移动';
  if (unit.fired) return '已行动';
  return '待命';
}

export default function CommandPanel({ game, dispatch }) {
  const selected = game.units.find(unit => unit.id === game.selectedId && unit.hp > 0);
  const locked = game.turn !== 'blue' || Boolean(game.winner);
  const enemy = game.units.find(unit => (
    unit.id === game.inspectedId && unit.team === 'red' && unit.hp > 0 && !game.fog[unit.y][unit.x]
  ));
  const squad = game.units.filter(unit => unit.team === 'blue');
  const survivors = squad.filter(unit => unit.hp > 0);
  const movable = locked ? 0 : survivors.filter(unit => !unit.moved).length;
  const readyToFire = locked ? 0 : survivors.filter(unit => !unit.fired).length;

  return (
    <aside aria-label="战场指挥">
      <section className="phase-panel">
        <div className="eyebrow">COMMAND PHASE <span>{String(game.turnNumber).padStart(2, '0')}</span></div>
        <h2><span className="live-dot" />{game.winner ? '行动结束' : locked ? '敌方行动阶段' : '我方行动阶段'}</h2>
        <div className="phase-readiness" aria-label="我方剩余行动机会">
          <span><b>{String(movable).padStart(2, '0')}</b> 可移动</span>
          <span><b>{String(readyToFire).padStart(2, '0')}</b> 可开火 / 维修</span>
        </div>
        <p>{locked && !game.winner
          ? `侦听敌方动向 · ${game.enemyIndex} / ${game.enemyQueue.length}`
          : '全员移动完自动结束回合；请在最后一次移动前完成开火或维修。'}</p>
        <button className="primary" id="end-turn" disabled={locked} onClick={() => dispatch({ type: 'END_TURN' })}>
          结束回合 <span>→</span>
        </button>
      </section>

      <section className="unit-panel">
        <div className="section-title">车辆情报 <span>{selected ? `UNIT ${String(selected.id).padStart(2, '0')}` : '待命'}</span></div>
        {selected ? (
          <>
            <UnitDetails unit={selected} />
            <div className="modes">
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
            </div>
          </>
        ) : (
          <div className="empty-selection"><span>⌖</span>选择我方车辆以查看情报</div>
        )}
      </section>

      <section className="squad-panel">
        <div className="section-title">作战编队 <span>{survivors.length} / {squad.length} 在役</span></div>
        <div id="squad">
          {squad.map(unit => (
            <button
              key={unit.id}
              className={`squad-row ${unit.id === selected?.id ? 'active' : ''} ${unit.hp <= 0 ? 'dead' : ''}`}
              disabled={unit.hp <= 0 || locked}
              aria-pressed={unit.id === selected?.id}
              onClick={() => dispatch({ type: 'SELECT', id: unit.id })}
              data-unit={unit.id}
            >
              <UnitIcon type={unit.type} team={unit.team} />
              <span className="squad-identity">
                <span className="squad-name">{String(unit.id).padStart(2, '0')} &nbsp; {unit.name}</span>
                <span className="squad-health" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, unit.hp) / unit.maxHp * 100}%` }} />
                </span>
              </span>
              <small className="squad-status">{unitStatus(unit)} · {Math.max(0, unit.hp)}</small>
            </button>
          ))}
        </div>
      </section>

      {enemy && (
        <section className="unit-panel hostile-panel" id="enemy-intel">
          <div className="section-title">敌方车辆情报 <span>HOSTILE {String(enemy.id).padStart(2, '0')}</span></div>
          <UnitDetails unit={enemy} hostile />
        </section>
      )}

      <section className="log-panel">
        <div className="section-title">战场通讯 <span className="live-label">● LIVE</span></div>
        <div id="log" aria-live="polite">
          {game.logs.map(log => (
            <div key={log.id} className={`log-entry ${log.kind}`}>
              <time>{String(log.round).padStart(2, '0')} ›</time>{log.message}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
