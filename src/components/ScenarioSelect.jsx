import { SCENARIOS } from '../game/scenarios.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, enemyCountFor } from '../game/difficulty.js';
import { UNIT_TYPES } from '../game/catalog.js';
import ScenarioPreview from './ScenarioPreview.jsx';
import UnitIcon from './UnitIcon.jsx';
import { useState } from 'react';

export default function ScenarioSelect({onDeploy,onResume,hasBattle}) {
  const [difficultyByScenario,setDifficultyByScenario]=useState({});
  return <main className="operation-library">
    <section className="library-heading"><div><div className="eyebrow">OPERATIONS / 作战档案</div><h1>选择你的战场<span>联合作战</span></h1><p>六种战车，九支部队。不同的地形，需要不同的进攻路线。</p></div><div className="library-summary"><strong>03</strong><span>独立战区<br/>自由选择部署</span></div></section>
    <div className="scenario-grid">{SCENARIOS.map((s,i)=>{const difficulty=difficultyByScenario[s.id]||DEFAULT_DIFFICULTY;const setting=DIFFICULTIES[difficulty];const enemyCount=enemyCountFor(s.enemyCount,difficulty);return <article className="scenario-card" key={s.id}>
      <div className="card-top"><span>OPERATION {String(i+1).padStart(2,'0')}</span><span className={`difficulty level-${i}`}>{setting.label}</span></div>
      <ScenarioPreview id={s.id} difficulty={difficulty}/>
      <div className="scenario-content"><div className="eyebrow">{s.subtitle}</div><h2>{s.name}<span>{s.direction}</span></h2><p>{s.briefing}</p>
        <div className="route-list">{s.routes.map(r=><div key={r}><span>↳</span>{r}</div>)}</div>
        <label>难度 <select value={difficulty} onChange={event=>setDifficultyByScenario(current=>({...current,[s.id]:event.target.value}))} aria-label={`${s.name}难度`}>
          {Object.values(DIFFICULTIES).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        <div className="scenario-forces"><span>我方 <b>09</b></span><span>敌方 <b>{enemyCount}</b></span><span>难度 <b>{setting.label}</b></span><span>22 × 18 <small>不规则战区</small></span></div>
        <button className="primary" onClick={()=>onDeploy(s.id,difficulty)} data-testid={`deploy-${s.id}`}>部署部队 <span>↗</span></button>
      </div></article>})}</div>
    <section className="roster-guide"><div className="section-title">联合装甲编队 <span>6 类车辆 · 9 支部队</span></div><div className="vehicle-catalog">{Object.entries(UNIT_TYPES).map(([type,u])=><div key={type}><UnitIcon type={type}/><div><strong>{u.name}</strong><small>{u.label}</small></div></div>)}</div></section>
    <div className="library-foot"><span>每张地图独立开局；切换部署会重置当前战斗。</span>{hasBattle&&<button className="text-button" onClick={onResume}>返回当前战场 →</button>}</div>
  </main>;
}
