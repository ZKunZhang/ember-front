import { useState } from 'react';
import { SCENARIOS, FORMATIONS } from '../game/scenarios.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, enemyCountFor } from '../game/difficulty.js';
import ScenarioPreview from './ScenarioPreview.jsx';
import { progressKey } from '../game/progress.js';

const POSITIONS = [[15,23],[38,8],[61,23],[15,53],[38,38],[84,38],[15,68],[61,53],[84,68],[61,8],[84,8],[38,68],[15,8],[38,53],[84,53],[15,38],[84,23],[61,38],[61,68],[15,83],[38,83],[61,83],[84,83]];
const FILTERS = [['all','全部战区'],['standard','常规作战'],['story','战史行动'],['crossing','穿越与护送']];
const isCrossing=s=>!s.story?.sourceUrl&&(s.mission?.kind==='breakthrough'||s.mission?.outposts);

function CampaignTerrain() {
  return <svg className="campaign-terrain" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#b8c7a6" strokeOpacity=".08"/></pattern>
      <pattern id="map-forest" width="28" height="32" patternUnits="userSpaceOnUse"><path d="m14 3-7 14h4l-7 9h20l-7-9h4Z" fill="#71876b" fillOpacity=".25" stroke="#a1b493" strokeOpacity=".17"/></pattern>
      <radialGradient id="map-ground"><stop stopColor="#415844"/><stop offset="1" stopColor="#24372e"/></radialGradient>
      <linearGradient id="map-river" x2="1" y2="1"><stop stopColor="#779b98"/><stop offset="1" stopColor="#385f64"/></linearGradient>
    </defs>
    <rect width="1000" height="700" fill="url(#map-ground)"/>
    <path d="M0 50 80 10 230 40 280 125 240 200 330 270 250 360 80 330 0 240Z" fill="#5d6d4a" opacity=".18"/>
    <path d="m0 560 100-130 175 15 130 135-30 120H0Z" fill="#a4915c" opacity=".12"/>
    {[0,1,2,3,4,5].map(i=><path key={i} d={`M${90-i*24} 0 C${280-i*21} 100 ${80-i*20} 200 ${300-i*20} 300 S${450-i*26} 540 ${350-i*30} 700 M${680+i*26} 0 C${550+i*30} 130 ${850+i*20} 190 ${780+i*27} 360 S${590+i*32} 580 ${800+i*25} 700`} fill="none" stroke="#afbe91" strokeOpacity=".10"/>)}
    <path d="M640-20C520 95 750 166 651 263S440 323 552 438 669 525 590 720" fill="none" stroke="#172e31" strokeWidth="35"/>
    <path d="M640-20C520 95 750 166 651 263S440 323 552 438 669 525 590 720" fill="none" stroke="url(#map-river)" strokeWidth="24"/>
    <path d="M651 263C790 315 775 404 1030 382" fill="none" stroke="#567e7d" strokeWidth="13"/>
    <path d="M690 310q115-60 155 35t-78 66q-106-5-77-101" fill="#4c7472" stroke="#8da69a" strokeOpacity=".25"/>
    <path d="M40 235q170-50 290 90l-50 120-200 35-50-150M710 470l185-40 105 160-95 110-200-80Z" fill="url(#map-forest)"/>
    <g fill="#6f7c60" stroke="#a1ac85" strokeOpacity=".4" strokeLinejoin="round">
      {[[280,75],[310,90],[340,65],[350,220],[375,243],[420,210],[460,240],[820,90],[855,105]].map(([x,y])=><g key={`${x}-${y}`}><path d={`m${x-23} ${y+30} 23-51 29 51-25-10Z`}/><path d={`m${x} ${y-21} 4 40 25 11`} fill="#344536"/></g>)}
    </g>
    <g fill="none" stroke="#c0b387" strokeOpacity=".43" strokeWidth="2" strokeDasharray="5 7">
      <path d="M200 168 390 105 600 70 810 140 620 196 790 308 760 546 570 441 390 574 190 525 210 336 430 280 620 196"/>
      <path d="M210 336 200 168M430 280 390 105M430 280 570 441M190 525 430 280"/>
    </g>
    <g stroke="#d7c69c" strokeWidth="5"><path d="m603 193 43 17M557 420l27 28M744 285l-2 37"/></g>
    <rect width="1000" height="700" fill="url(#map-grid)"/>
    <g fill="#bdc4a6" opacity=".3" fontFamily="serif" fontSize="17" letterSpacing="9"><text x="92" y="100">北 境 山 脉</text><text x="68" y="423">西 部 林 地</text><text x="745" y="620">雪 林 防 线</text><text x="675" y="365" fontSize="12">苇 河 水 系</text><text x="60" y="627">南 部 荒 原</text></g>
    <g transform="translate(929 575)" stroke="#b5bd9b" opacity=".6"><path d="M0-32v64M-23 0h46M0-25l-7 23L0-7l7 5Z" fill="#b5bd9b"/><text y="-43" textAnchor="middle" fill="#b5bd9b" stroke="none" fontSize="12">N</text><circle r="18" fill="none"/></g>
  </svg>;
}

export default function ScenarioSelect({ onDeploy, onResume, hasBattle, onHome, progress = {} }) {
  const [difficulty,setDifficulty]=useState(DEFAULT_DIFFICULTY);
  const [formation,setFormation]=useState('recommended');
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [inspected,setInspected]=useState(SCENARIOS[0].id);
  const scenarios=SCENARIOS.filter(s=>(filter==='all'||(filter==='standard'?!s.story&&!isCrossing(s):filter==='crossing'?isCrossing(s):Boolean(s.story?.sourceUrl)))&&`${s.name} ${s.subtitle} ${s.briefing}`.toLowerCase().includes(search.trim().toLowerCase()));
  const current=scenarios.find(s=>s.id===inspected)||scenarios[0];
  const completed=SCENARIOS.filter(s=>progress[progressKey(s.id,difficulty)]).length;
  const record=current&&progress[progressKey(current.id,difficulty)];
  const formationFor=s=>formation==='recommended'?s.formationId:formation;
  return <main className="campaign-screen">
    <div className="campaign-topbar">
      <div><button className="campaign-back" onClick={onHome}>← 主菜单</button><span className="campaign-overline">CAMPAIGN MAP / 战区总览</span><h1>选择作战区域<span>{String(SCENARIOS.length).padStart(2,'0')} 个战区已就绪</span></h1><p className="campaign-progress">{DIFFICULTIES[difficulty].label}难度 <span>{String(completed).padStart(2,'0')} / {SCENARIOS.length}</span> 已完成<i style={{'--progress':`${completed/SCENARIOS.length*100}%`}}/></p></div>
      {hasBattle&&<button className="text-button" onClick={onResume}>返回当前战场 →</button>}
    </div>
    <div className="campaign-layout">
      <section className="campaign-map-panel" aria-label="战区地图">
        <div className="campaign-tools">
          <div className="scenario-filters" role="group" aria-label="战区分类">{FILTERS.map(([value,label])=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
          <label className="scenario-search"><input type="search" aria-label="搜索战区" placeholder="搜索战区…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        </div>
        <div className="campaign-map-scroll">
          <div className="campaign-map">
            <CampaignTerrain/>
            <div className="campaign-map-caption">第七装甲旅 <span> / </span> 联合作战态势图</div>
            {scenarios.map(s=>{
              const index=SCENARIOS.findIndex(item=>item.id===s.id),[x,y]=POSITIONS[index];
              const cleared=Boolean(progress[progressKey(s.id,difficulty)]);
              return <button key={s.id} className={`campaign-node ${s.story?'story-node':''} ${current?.id===s.id?'is-inspected':''} ${cleared?'is-completed':''}`} style={{left:`${x}%`,top:`${y}%`}} data-testid={`deploy-${s.id}`} aria-label={`进入${s.name}${cleared?'，已通关':''}`} onMouseEnter={()=>setInspected(s.id)} onFocus={()=>setInspected(s.id)} onClick={()=>onDeploy(s.id,difficulty,formationFor(s))}>
                <span className="node-marker">{String(index+1).padStart(2,'0')}{cleared&&<i aria-hidden="true">✓</i>}</span><span className="node-label">{s.name}<small>{s.mission?.kind==='breakthrough'?`${s.allyCount}车穿越 · 保住${s.mission.required}辆`:s.mission?.outposts?'护送行动':s.story?'战史行动':'常规作战'}{cleared?' · ✓':''}</small></span>
              </button>;
            })}
          </div>
        </div>
        {scenarios.length===0&&<div className="campaign-empty" role="status"><h2>未找到匹配的战区</h2><button onClick={()=>{setFilter('all');setSearch('');}}>重置筛选 →</button></div>}
        <div className="campaign-map-footer"><span><i/> 常规作战 <i className="gold"/> 剧情行动</span><span aria-live="polite">显示 {scenarios.length} 个战区 · 点击据点部署 · 窄屏可横向滑动</span></div>
      </section>
      <aside className="campaign-brief" aria-label="部署与战区情报">
        <div className="campaign-settings"><div className="eyebrow">DEPLOYMENT / 部署设置</div><div className="deployment-options">
          <label><span>作战难度</span><select aria-label="作战难度" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{Object.values(DIFFICULTIES).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
          <label><span>我方组合</span><select aria-label="我方组合" value={formation} onChange={e=>setFormation(e.target.value)}><option value="recommended">关卡推荐</option>{Object.entries(FORMATIONS).map(([id,f])=><option key={id} value={id}>{f.name}</option>)}</select></label>
        </div></div>
        {current&&<div className="campaign-intel" key={current.id}>
          <div className="campaign-preview"><ScenarioPreview id={current.id} difficulty={difficulty} formationId={formationFor(current)}/><span>地形侦察 / TERRAIN RECON</span></div>
          <div className="eyebrow">{current.subtitle}</div><h2>{current.name}</h2><p className="campaign-description">{current.briefing}</p>
          <p className="campaign-objective"><span>行动目标</span>{current.objective}</p>
          <p className="campaign-direction">{current.direction}{isCrossing(current)&&' · 山林遮蔽 · 沿途遭遇'}</p>
          {record&&<p className="campaign-record">✓ 本难度已通关 <span>最佳 {record.rounds} 回合 · 存活 {record.survivors} / {current.allyCount}</span></p>}
          <div className="campaign-forces"><span>我方 <b>{String(current.allyCount).padStart(2,'0')}</b></span><span>敌方 <b>{String(enemyCountFor(current.enemyCount,difficulty)).padStart(2,'0')}</b></span><span>{FORMATIONS[formationFor(current)].name}</span></div>
          <button className="primary" onClick={()=>onDeploy(current.id,difficulty,formationFor(current))}>进入{current.name} <span>↗</span></button>
          <small className="campaign-hint">悬停或聚焦据点查看情报，点击即可部署。</small>
        </div>}
      </aside>
    </div>
  </main>;
}
