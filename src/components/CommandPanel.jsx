import { useState } from 'react';
import UnitIcon from './UnitIcon.jsx';
import { terrainLabel,terrainCost } from '../game/terrain.js';

function UnitDetails({ unit, hostile = false }) {
  const stats = [
    ['移动点', unit.move],
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
        <span>当前生命</span>
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

export default function CommandPanel({ game, onSelect, onLocate }) {
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
  const defending=game.mission?.kind==='defend';
  const locked=game.turn!=='blue'||Boolean(game.winner);
  const living=game.units.filter(unit=>unit.team==='blue'&&unit.hp>0);
  const roleHints={scout:'绕到林缘观察，让后方火炮获得共享视野。',tank:'守住进场路，掩护侦察车和火炮。',heavyTank:'适合守住入口，留意敌军绕行路线。',artillery:'保持在后方，利用共享视野越过山林射击。',rocket:'保持远距离支援，近处敌车处于射击盲区。',engineer:'随队维修相邻友军，维修会占用开火机会。'};

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
              <p className="unit-terrain">{terrainLabel(game.terrain[inspected.y][inspected.x])} · 每格消耗 {terrainCost(game.terrain[inspected.y][inspected.x])} 移动点</p>
              {defending&&<>
                {!enemy&&<div className="unit-readiness" aria-label="本车行动机会"><span className={!locked&&!inspected.moved?'available':''}>{game.winner?'行动结束':locked?'等待我方回合':inspected.moved?'移动已使用':'可移动 1 次'}</span><span className={!locked&&!inspected.fired?'available':''}>{locked?'当前不可行动':inspected.fired?`${inspected.repair>0?'开火 / 维修':'开火'}已使用`:`可${inspected.repair>0?'开火 / 维修':'开火'} 1 次`}</span></div>}
                <p className="defense-unit-role">{enemy?'点击战场中的敌车会尝试开火；查看情报不代表已造成伤害。':roleHints[inspected.type]}</p>
                <button className="locate-unit" onClick={()=>onLocate(inspected)}>⌖ 定位{enemy?'敌军':'本车'}</button>
              </>}
            </>
          ) : (
            <div className="empty-selection">
              <span>⌖</span>点击战场中的我方或敌方车辆查看情报
            </div>
          )}
        </section>

        {defending&&<details className="unit-roster">
          <summary>我方编队 <span>{living.length} 辆 · 快捷选车</span></summary>
          <div className="unit-roster-list" role="group" aria-label="我方车辆列表">
            {living.map(unit=><button key={unit.id} disabled={locked} aria-label={`选择我方${String(unit.id).padStart(2,'0')}号${unit.name}`} aria-pressed={unit.id===game.selectedId&&!enemy} onClick={()=>onSelect(unit.id)}>
              <UnitIcon type={unit.type}/><span><b>{String(unit.id).padStart(2,'0')} {unit.name}</b><small>{unit.hp}/{unit.maxHp} 生命 · {locked?(game.winner?'行动结束':'等待我方回合'):`${unit.moved?'已移动':'可移动'} · ${unit.fired?'已行动':'可开火'}`}</small></span>
            </button>)}
          </div>
        </details>}

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
