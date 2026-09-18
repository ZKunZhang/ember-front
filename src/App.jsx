import { useEffect, useState } from 'react';
import { useGame } from './hooks/useGame.js';
import { readRoute, battleUrl } from './game/routes.js';
import ScenarioSelect from './components/ScenarioSelect.jsx';
import Battlefield from './components/Battlefield.jsx';
import CommandPanel from './components/CommandPanel.jsx';
import FieldManual from './components/FieldManual.jsx';
import StoryBrief from './components/StoryBrief.jsx';

export default function App() {
  const [route,setRoute]=useState(()=>readRoute(new URL(window.location.href)));
  const screen=route?'battle':'library';
  const [hasBattle,setHasBattle]=useState(()=>Boolean(route)),[help,setHelp]=useState(false);
  const {game,dispatch}=useGame(screen==='battle',route);
  const navigate=next=>{
    const path=next?battleUrl(next):'/';
    if(window.location.pathname+window.location.search!==path)window.history.pushState(null,'',path);
    setRoute(next);
  };
  useEffect(()=>{
    const path=route?battleUrl(route):'/';
    if(window.location.pathname+window.location.search!==path)window.history.replaceState(null,'',path);
  },[route]);
  useEffect(()=>{
    const onPop=()=>{
      const next=readRoute(new URL(window.location.href));
      if(next){
        if(game.id!==next.scenarioId||game.difficultyId!==next.difficulty||game.formationId!==next.formationId)dispatch({type:'RESET',...next});
        setHasBattle(true);
      }
      setRoute(next);
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[game.id,game.difficultyId,game.formationId,dispatch]);
  const deploy=(scenarioId,difficulty,formationId)=>{
    const next={scenarioId,difficulty,formationId};
    dispatch({type:'RESET',...next});setHasBattle(true);navigate(next);
  };
  const resume=()=>navigate({scenarioId:game.id,difficulty:game.difficultyId,formationId:game.formationId});
  const allies=game.units.filter(u=>u.team==='blue'),enemies=game.units.filter(u=>u.team==='red');
  return <>
    <header><button className="brand" onClick={()=>navigate(null)} aria-label="返回战区选择"><span className="brand-mark">✣</span><span>烬土前线<small>EMBER FRONT / ARMORED OPERATIONS</small></span></button><div className="header-middle"><span className="live-dot"/> 联合作战指挥终端 <span className="divider">/</span> 第七装甲旅</div><div className="header-actions">{screen==='battle'&&<button className="icon-button" id="choose-map" onClick={()=>navigate(null)}>▦ <span>战区选择</span></button>}<button className="icon-button" id="help" onClick={()=>setHelp(true)}>? <span>作战指南</span></button></div></header>
    {screen==='library'?<ScenarioSelect onDeploy={deploy} hasBattle={hasBattle} onResume={resume}/>:<main>
      <section className="mission-head"><div><div className="eyebrow">{game.subtitle} <span>/</span> {game.direction}</div><h1>{game.name}<span>{game.difficulty} · {game.formationName}</span></h1><p>{game.briefing}</p></div><div className="mission-stats"><div><small>我方编队</small><strong id="ally-count">{String(allies.filter(u=>u.hp>0).length).padStart(2,'0')} <em>/ 09</em></strong></div><div><small>歼敌进度</small><strong id="kill-count">{String(enemies.filter(u=>u.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div><div><small>当前回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div></div></section>
      {game.story&&<StoryBrief game={game}/>}
      <div className="command-layout"><div className="battle-column"><Battlefield game={game} onCell={(x,y)=>dispatch({type:'CELL',x,y})} onReset={()=>dispatch({type:'RESET'})} onUndo={()=>dispatch({type:'UNDO'})}/><div className="route-brief"><span>⌁ 战术路线</span>{game.routes.map(r=><p key={r}>{r}</p>)}</div></div><CommandPanel game={game} dispatch={dispatch}/></div>
      <footer><span><i className="tiny-square"/>作战目标：{game.objective}</span><span>侦察 · 装甲 · 炮火 · 维修</span><button id="reset" onClick={()=>dispatch({type:'RESET'})}>↻ 重新部署本关</button></footer>
    </main>}
    <FieldManual open={help} onClose={()=>setHelp(false)}/>
  </>;
}
