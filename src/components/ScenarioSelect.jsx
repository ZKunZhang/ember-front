import { useState } from 'react';
import { SCENARIOS, FORMATIONS } from '../game/scenarios.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, enemyCountFor } from '../game/difficulty.js';
import { UNIT_TYPES } from '../game/catalog.js';
import ScenarioPreview from './ScenarioPreview.jsx';
import UnitIcon from './UnitIcon.jsx';

const FILTERS = [['all', '全部战区'], ['standard', '常规作战'], ['story', '战史行动']];
const BEHAVIORS = {
  simple: '直接推进，在可行路线中变化选择',
  easy: '寻找射击位置，优先攻击薄弱目标',
  hard: '集中火力、主动维修，低血时撤离威胁',
};

export default function ScenarioSelect({ onDeploy, onResume, hasBattle }) {
  const [difficultyByScenario, setDifficultyByScenario] = useState({});
  const [formationByScenario, setFormationByScenario] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const matchesFilter = (scenario, value) => value === 'all' || Boolean(scenario.story) === (value === 'story');
  const scenarios = SCENARIOS.filter(s => matchesFilter(s, filter) && `${s.name} ${s.subtitle} ${s.briefing}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <main className="operation-library">
    <section className="library-hero" aria-labelledby="library-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-dot" /> 第七装甲旅 · 作战指挥中心</div>
        <h1 id="library-title">战局，由你<span>掌控。</span></h1>
        <p>侦察先行，装甲推进，炮火掩护。<br />在立体沙盘上部署你的编队，找到通往胜利的路线。</p>
        <div className="hero-actions">
          <a className="primary hero-link" href="#operations">选择作战区域 <span>↓</span></a>
          {hasBattle && <button className="text-button" onClick={onResume}>返回当前战场 →</button>}
        </div>
        <div className="hero-stats"><div><strong>09</strong><span>独立战区</span></div><div><strong>06</strong><span>车辆类型</span></div><div><strong>04</strong><span>战术编组</span></div></div>
      </div>
      <div className="hero-table" aria-hidden="true">
        <div className="hero-table-label"><span>TACTICAL SANDBOX</span><span>01 / 09</span></div>
        <ScenarioPreview id={SCENARIOS[0].id} difficulty={DEFAULT_DIFFICULTY} />
        <div className="hero-table-foot"><span><i className="live-dot" /> 断脊山隘 <small> / BROKEN RIDGE</small></span><span>地形侦察已就绪</span></div>
      </div>
    </section>

    <section id="operations" className="operations-section" aria-labelledby="operations-title">
      <div className="library-heading"><div><div className="eyebrow">OPERATIONS ARCHIVE</div><h2 id="operations-title">选择你的战场</h2></div><p>选择地形与编队，开始一次新的行动。</p></div>
      <div className="library-toolbar">
        <div className="scenario-filters" role="group" aria-label="战区分类">{FILTERS.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{SCENARIOS.filter(s => matchesFilter(s, value)).length.toString().padStart(2, '0')}</span></button>)}</div>
        <label className="scenario-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索战区…" aria-label="搜索战区" /></label>
      </div>
      <div className="scenario-grid">{scenarios.map(s => {
        const index = SCENARIOS.findIndex(item => item.id === s.id);
        const difficulty = difficultyByScenario[s.id] || DEFAULT_DIFFICULTY;
        const setting = DIFFICULTIES[difficulty];
        const formationId = formationByScenario[s.id] || s.formationId;
        const formation = FORMATIONS[formationId];
        const enemyCount = enemyCountFor(s.enemyCount, difficulty);
        return <article className={`scenario-card ${s.story ? 'has-story' : ''}`} key={s.id}>
          <div className="scenario-visual">
            <div className="card-top"><span>OP / {String(index + 1).padStart(2, '0')}</span><span className={`scenario-kind ${s.story ? 'story-kind' : ''}`}>{s.story ? '战史行动' : '常规作战'}</span></div>
            <ScenarioPreview id={s.id} difficulty={difficulty} formationId={formationId} />
            <div className="preview-caption"><span>22 × 18 <small>战术沙盘</small></span><span>↑ 由下向上推进</span></div>
          </div>
          <div className="scenario-content">
            <div className="eyebrow">{s.subtitle}</div>
            <h2>{s.name}<span className={`difficulty difficulty-${difficulty}`}>{setting.label}</span></h2>
            <p className="scenario-description">{s.briefing}</p>
            {s.story && <div className="story-card"><strong>{s.story.chapter}</strong><p>{s.objective}</p><small>历史背景改编 · 地图与兵种非史实复原</small></div>}
            <div className="deployment-options">
              <label><span>作战难度</span><select value={difficulty} onChange={event => setDifficultyByScenario(current => ({ ...current, [s.id]: event.target.value }))} aria-label={`${s.name}难度`}>{Object.values(DIFFICULTIES).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label><span>我方组合</span><select value={formationId} onChange={event => setFormationByScenario(current => ({ ...current, [s.id]: event.target.value }))} aria-label={`${s.name}我方组合`}>{Object.entries(FORMATIONS).map(([id, f]) => <option key={id} value={id}>{f.name}{id === s.formationId ? ' · 推荐' : ''}</option>)}</select></label>
            </div>
            <details className="scenario-intelligence"><summary>编队配置与战术情报 <span>＋</span></summary><div className="formation-summary"><p>{formation.description}</p><div>{Object.entries(UNIT_TYPES).map(([type, u]) => { const count = formation.types.filter(t => t === type).length; return count ? <span key={type}><UnitIcon type={type} />{u.name} × {count}</span> : null; })}</div></div><div className="route-list">{s.routes.map(r => <div key={r}><span>↳</span>{r}</div>)}</div><p className="enemy-behavior">敌军战术 · {BEHAVIORS[difficulty]}</p>{s.story && <p className="story-intro">{s.story.intro}</p>}</details>
            <div className="scenario-forces"><span><i className="swatch blue" /> 我方 <b>09</b></span><span><i className="swatch red" /> 敌方 <b>{String(enemyCount).padStart(2, '0')}</b></span><span>独立战局</span></div>
            <button className="primary deploy-button" onClick={() => onDeploy(s.id, difficulty, formationId)} data-testid={`deploy-${s.id}`}>部署部队 <span>↗</span></button>
          </div>
        </article>;
      })}</div>
      {scenarios.length === 0 && <div className="empty-search" role="status"><span>⌕</span><h3>未找到匹配的战区</h3><p>试试其他名称，或查看全部作战区域。</p><button onClick={() => { setFilter('all'); setSearch(''); }}>重置筛选 →</button></div>}
    </section>
    <section className="roster-guide"><div className="section-title">联合作战，协同推进 <span>YOUR ARMORED DIVISION</span></div><div className="vehicle-catalog">{Object.entries(UNIT_TYPES).map(([type, u]) => <div key={type}><UnitIcon type={type} /><div><strong>{u.name}</strong><small>{u.label}</small></div></div>)}</div></section>
    <div className="library-foot"><span><i className="tiny-square" /> 每张地图独立开局；切换部署会重置当前战斗。</span><span>EMBER FRONT · 联合作战</span></div>
  </main>;
}
