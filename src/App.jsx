import { useEffect, useLayoutEffect, useState } from 'react';
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
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});},[screen,route?.scenarioId]);
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
  return <div className={screen==='battle'?'game-shell':'library-shell'}>
    <header><button className="brand" onClick={()=>navigate(null)} aria-label="返回战区选择"><span className="brand-mark"><svg viewBox="0 0 44 48" fill="none" aria-hidden="true"><path d="M22 2 40 11v19L22 46 4 30V11z" stroke="currentColor" strokeWidth="1.5"/><path d="m22 8 12 6v13L22 38 10 27V14z" fill="currentColor" opacity=".13"/><path d="m13 28 9-15 9 15H13Z" stroke="currentColor" strokeWidth="2"/><path d="M22 20v13M16 32h12" stroke="currentColor" strokeWidth="2"/></svg></span><span>烬土前线<small>EMBER FRONT / ARMORED OPERATIONS</small></span></button><div className="header-middle"><span className="live-dot"/> 联合作战指挥终端 <span className="divider">/</span> 第七装甲旅</div><div className="header-actions">{screen==='battle'&&<button className="icon-button" id="choose-map" onClick={()=>navigate(null)} aria-label="退出关卡" title="退出关卡，返回战区选择">↩ <span>退出关卡</span></button>}<button className="icon-button" id="help" onClick={()=>setHelp(true)} aria-label="作战指南">? <span>作战指南</span></button></div></header>
    {screen==='library'?<ScenarioSelect onDeploy={deploy} hasBattle={hasBattle} onResume={resume}/>:<main className="battle-screen">
      <section className="mission-head">
        <div><div className="eyebrow">{game.subtitle} <span>/</span> {game.direction}</div><h1>{game.name}<span>{game.difficulty} · {game.formationName}</span></h1></div>
      </section>
      <section className="mission-stats battle-status" aria-label="战况概览">
        <div><small>我方编队</small><strong id="ally-count">{String(allies.filter(u=>u.hp>0).length).padStart(2,'0')} <em>/ {String(allies.length).padStart(2,'0')}</em></strong></div>
        <div><small>歼敌进度</small><strong id="kill-count">{String(enemies.filter(u=>u.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div>
        <div><small>当前回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div>
      </section>
      <Battlefield game={game} onCell={(x,y)=>dispatch({type:'CELL',x,y})} onReset={()=>dispatch({type:'RESET'})} onUndo={()=>dispatch({type:'UNDO'})}/>
      <section className="objective-hud" aria-label="作战目标">
        <div className="eyebrow"><i className="live-dot"/>当前任务 / OBJECTIVE</div>
        <p className="objective-text">{game.objective}</p>
        <details className="mission-intel">
          <summary>任务简报与战术路线</summary>
          <p>{game.briefing}</p>
          <div className="route-brief">{game.routes.map(r=><p key={r}>{r}</p>)}</div>
        </details>
        {game.story&&<StoryBrief game={game}/>}
      </section>
      <CommandPanel game={game} dispatch={dispatch}/>
      <button className="redeploy-hud" id="reset" onClick={()=>dispatch({type:'RESET'})}>↻ 重新部署</button>
    </main>}
    <FieldManual open={help} onClose={()=>setHelp(false)}/>
  </div>;
}
