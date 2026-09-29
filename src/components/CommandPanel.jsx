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
        <div className="unit-art">
          <UnitIcon type={unit.type} team={unit.team} />
        </div>
        <div>
          <div className="unit-name">
            {unit.name} <small>{String(unit.id).padStart(2, '0')}</small>
          </div>
          <div className="unit-sub">
            {hostile ? '敌方 · ' : '我方 · '}
            {unit.label}
          </div>
        </div>
      </div>
      <div className="hp-row">
        <span>{hostile ? '当前生命' : '装甲完整度'}</span>
        <span>
          {unit.hp} / {unit.maxHp}
        </span>
      </div>
      <div className="hp-track">
        <div
          className="hp-fill"
          style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
        />
      </div>
      <div className="unit-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </>
  );
}

export default function CommandPanel({ game }) {
  const [expanded, setExpanded] = useState(false);
  const selected = game.units.find(
    (unit) => unit.id === game.selectedId && unit.hp > 0,
  );
  const enemy = game.units.find(
    (unit) =>
      unit.id === game.inspectedId &&
      unit.team === 'red' &&
      unit.hp > 0 &&
      !game.fog[unit.y][unit.x],
  );
  const inspected = enemy || selected;

  return (
    <aside
      className={`command-hud ${expanded ? 'is-expanded' : ''}`}
      aria-label="战场指挥"
    >
      <button
        className="command-toggle"
        aria-expanded={expanded}
        aria-controls="command-panels"
        onClick={() => setExpanded((value) => !value)}
      >
        <span>
          战场指挥 ·{' '}
          {inspected
            ? `${enemy ? '敌方' : '我方'} · ${inspected.name}`
            : '待命'}
        </span>
        <span>{expanded ? '收起 −' : '单位 / 指令 ＋'}</span>
      </button>
      <div className="command-panels" id="command-panels">
        <section
          className={`unit-panel ${enemy ? 'hostile-panel' : ''}`}
          id={enemy ? 'enemy-intel' : undefined}
          data-unit={inspected?.id}
          aria-label="当前选中单位"
        >
          <div className="section-title">
            当前单位{' '}
            <span>
              {inspected
                ? `${enemy ? 'HOSTILE' : 'UNIT'} ${String(inspected.id).padStart(2, '0')}`
                : '待命'}
            </span>
          </div>
          {inspected ? (
            <>
              <UnitDetails unit={inspected} hostile={Boolean(enemy)} />

            </>
          ) : (
            <div className="empty-selection">
              <span>⌖</span>点击战场中的我方或敌方车辆查看情报
            </div>
          )}
        </section>

        <details className="log-panel">
          <summary className="section-title">
            战场通讯 <span className="live-label">展开战报 ＋</span>
          </summary>
          <div id="log" aria-live="polite">
            {game.logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.kind}`}>
                <time>{String(log.round).padStart(2, '0')} ›</time>
                {log.message}
              </div>
            ))}
          </div>
        </details>
      </div>
    </aside>
  );
}
