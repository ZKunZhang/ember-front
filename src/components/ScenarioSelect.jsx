import { SCENARIOS, FORMATIONS } from '../game/scenarios.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, enemyCountFor } from '../game/difficulty.js';
import { UNIT_TYPES } from '../game/catalog.js';
import ScenarioPreview from './ScenarioPreview.jsx';
import UnitIcon from './UnitIcon.jsx';
import { useState } from 'react';

export default function ScenarioSelect({onDeploy,onResume,hasBattle}) {
  const [difficultyByScenario,setDifficultyByScenario]=useState({});
  const [formationByScenario,setFormationByScenario]=useState({});
  return <main className="operation-library">
    <section className="library-heading"><div><div className="eyebrow">OPERATIONS / 作战档案</div><h1>选择你的战场<span>联合作战</span></h1><p>六种战车，四套编队，三篇战史改编。选择地形、难度与我方组合，制定不同的推进战术。</p></div><div className="library-summary"><strong>{String(SCENARIOS.length).padStart(2,'0')}</strong><span>独立战区<br/>自由选择部署</span></div></section>
    <div className="scenario-grid">{SCENARIOS.map((s,i)=>{const difficulty=difficultyByScenario[s.id]||DEFAULT_DIFFICULTY;const setting=DIFFICULTIES[difficulty];const behavior={simple:"直接推进，在可行路线中变化选择",easy:"寻找射击位置，优先攻击薄弱目标",hard:"集中火力、主动维修，低血时撤离威胁"}[difficulty];const formationId=formationByScenario[s.id]||s.formationId;const formation=FORMATIONS[formationId];const enemyCount=enemyCountFor(s.enemyCount,difficulty);return <article className="scenario-card" key={s.id}>
      <div className="card-top"><span>OPERATION {String(i+1).padStart(2,'0')}</span><span className={`difficulty level-${i}`}>{setting.label}</span></div>
      <ScenarioPreview id={s.id} difficulty={difficulty}/>
      <div className="scenario-content"><div className="eyebrow">{s.subtitle}</div><h2>{s.name}<span>{s.direction}</span></h2><p>{s.briefing}</p>
        {s.story&&<div className="story-card"><strong>{s.story.chapter}</strong><p>{s.story.intro}</p><small>目标：{s.objective} · 地图与兵种为游戏改编</small></div>}
        <div className="route-list">{s.routes.map(r=><div key={r}><span>↳</span>{r}</div>)}</div>
        <div className="deployment-options"><label>难度 <select value={difficulty} onChange={event=>setDifficultyByScenario(current=>({...current,[s.id]:event.target.value}))} aria-label={`${s.name}难度`}>
          {Object.values(DIFFICULTIES).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        <label>我方组合 <select value={formationId} onChange={event=>setFormationByScenario(current=>({...current,[s.id]:event.target.value}))} aria-label={`${s.name}我方组合`}>{Object.entries(FORMATIONS).map(([id,f])=><option key={id} value={id}>{f.name}{id===s.formationId?' · 推荐':''}</option>)}</select></label></div>
        <p className="enemy-behavior">敌军战术 · {behavior}</p>
        <div className="formation-summary"><p>{formation.description}</p><div>{Object.entries(UNIT_TYPES).map(([type,u])=>{const count=formation.types.filter(t=>t===type).length;return count?<span key={type}><UnitIcon type={type}/>{u.name} × {count}</span>:null;})}</div></div>
        <div className="scenario-forces"><span>我方 <b>09</b></span><span>敌方 <b>{enemyCount}</b></span><span>难度 <b>{setting.label}</b></span><span>22 × 18 <small>不规则战区</small></span></div>
        <button className="primary" onClick={()=>onDeploy(s.id,difficulty,formationId)} data-testid={`deploy-${s.id}`}>部署部队 <span>↗</span></button>
      </div></article>})}</div>
    <section className="roster-guide"><div className="section-title">联合装甲编队 <span>6 类车辆 · 9 支部队</span></div><div className="vehicle-catalog">{Object.entries(UNIT_TYPES).map(([type,u])=><div key={type}><UnitIcon type={type}/><div><strong>{u.name}</strong><small>{u.label}</small></div></div>)}</div></section>
    <div className="library-foot"><span>每张地图独立开局；切换部署会重置当前战斗。</span>{hasBattle&&<button className="text-button" onClick={onResume}>返回当前战场 →</button>}</div>
  </main>;
}
