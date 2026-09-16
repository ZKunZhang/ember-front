import { useState } from 'react';
import { useGame } from './hooks/useGame.js';
import ScenarioSelect from './components/ScenarioSelect.jsx';
import Battlefield from './components/Battlefield.jsx';
import CommandPanel from './components/CommandPanel.jsx';
import FieldManual from './components/FieldManual.jsx';

export default function App() {
  const [screen,setScreen]=useState('library'),[hasBattle,setHasBattle]=useState(false),[help,setHelp]=useState(false);
  const {game,dispatch}=useGame(screen==='battle');
  const deploy=(id,difficulty)=>{dispatch({type:'RESET',scenarioId:id,difficulty});setHasBattle(true);setScreen('battle');};
  const allies=game.units.filter(u=>u.team==='blue'),enemies=game.units.filter(u=>u.team==='red');
  return <>
    <header><button className="brand" onClick={()=>setScreen('library')} aria-label="返回战区选择"><span className="brand-mark">✣</span><span>烬土前线<small>EMBER FRONT / ARMORED OPERATIONS</small></span></button><div className="header-middle"><span className="live-dot"/> 联合作战指挥终端 <span className="divider">/</span> 第七装甲旅</div><div className="header-actions">{screen==='battle'&&<button className="icon-button" id="choose-map" onClick={()=>setScreen('library')}>▦ <span>战区选择</span></button>}<button className="icon-button" id="help" onClick={()=>setHelp(true)}>? <span>作战指南</span></button></div></header>
    {screen==='library'?<ScenarioSelect onDeploy={deploy} hasBattle={hasBattle} onResume={()=>setScreen('battle')}/>:<main>
      <section className="mission-head"><div><div className="eyebrow">{game.subtitle} <span>/</span> {game.direction}</div><h1>{game.name}<span>{game.difficulty} · 歼灭行动</span></h1><p>{game.briefing}</p></div><div className="mission-stats"><div><small>我方编队</small><strong id="ally-count">{String(allies.filter(u=>u.hp>0).length).padStart(2,'0')} <em>/ 09</em></strong></div><div><small>歼敌进度</small><strong id="kill-count">{String(enemies.filter(u=>u.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div><div><small>当前回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div></div></section>
      <div className="command-layout"><div className="battle-column"><Battlefield game={game} onCell={(x,y)=>dispatch({type:'CELL',x,y})} onReset={()=>dispatch({type:'RESET'})}/><div className="route-brief"><span>⌁ 战术路线</span>{game.routes.map(r=><p key={r}>{r}</p>)}</div></div><CommandPanel game={game} dispatch={dispatch}/></div>
      <footer><span><i className="tiny-square"/>作战目标：{game.objective}</span><span>侦察 · 装甲 · 炮火 · 维修</span><button id="reset" onClick={()=>dispatch({type:'RESET'})}>↻ 重新部署本关</button></footer>
    </main>}
    <FieldManual open={help} onClose={()=>setHelp(false)}/>
  </>;
}
