import { useEffect, useLayoutEffect, useState } from 'react';
import { useGame } from './hooks/useGame.js';
import { readRoute, battleUrl } from './game/routes.js';
import ScenarioSelect from './components/ScenarioSelect.jsx';
import Battlefield from './components/Battlefield.jsx';
import UnitActions from './components/UnitActions.jsx';
import CommandPanel from './components/CommandPanel.jsx';
import FieldManual from './components/FieldManual.jsx';
import StoryBrief from './components/StoryBrief.jsx';
import BattleSettings from './components/BattleSettings.jsx';
import TitleScreen from './components/TitleScreen.jsx';

export default function App() {
  const [route,setRoute]=useState(()=>readRoute(new URL(window.location.href)));
  const [screen,setScreen]=useState(()=>route?'battle':window.location.pathname==='/operations'?'library':'home');
  const [hasBattle,setHasBattle]=useState(()=>Boolean(route)),[help,setHelp]=useState(false);
  const [settings,setSettings]=useState(false);
  const {game,dispatch}=useGame(screen==='battle'&&!settings,route);
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});},[screen,route?.scenarioId]);
  const navigate=(next,destination='library')=>{
    const path=next?battleUrl(next):destination==='home'?'/':'/operations';
    if(window.location.pathname+window.location.search!==path)window.history.pushState(null,'',path);
    setSettings(false);
    setRoute(next);
    setScreen(next?'battle':destination);
  };
  useEffect(()=>{
    const path=route?battleUrl(route):screen==='library'?'/operations':'/';
    if(window.location.pathname+window.location.search!==path)window.history.replaceState(null,'',path);
  },[route,screen]);
  useEffect(()=>{
    const onPop=()=>{
      const next=readRoute(new URL(window.location.href));
      if(next){
        if(game.id!==next.scenarioId||game.difficultyId!==next.difficulty||game.formationId!==next.formationId)dispatch({type:'RESET',...next});
        setHasBattle(true);
      }
      setSettings(false);
      setRoute(next);
      setScreen(next?'battle':window.location.pathname==='/operations'?'library':'home');
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[game.id,game.difficultyId,game.formationId,dispatch]);
  const deploy=(scenarioId,difficulty,formationId)=>{
    const next={scenarioId,difficulty,formationId};
    dispatch({type:'RESET',...next});setHasBattle(true);navigate(next);
  };
  const resume=()=>navigate({scenarioId:game.id,difficulty:game.difficultyId,formationId:game.formationId});
  if(screen==='home')return <TitleScreen onStart={()=>navigate(null)}/>;
  const allies=game.units.filter(u=>u.team==='blue'),enemies=game.units.filter(u=>u.team==='red');
  const locked=game.turn!=='blue'||Boolean(game.winner);
  const living=allies.filter(u=>u.hp>0);
  return <div className={screen==='battle'?'game-shell':'library-shell'}>
    <header><div className="header-actions"><button className="icon-button" id="battle-settings" onClick={()=>setSettings(true)} aria-label="战斗设置" title="战斗设置">⚙</button></div></header>
    {screen==='library'?<ScenarioSelect onHome={()=>navigate(null,'home')} onDeploy={deploy} hasBattle={hasBattle} onResume={resume}/>:<main className="battle-screen">
      <section className="mission-overview" aria-label="任务与进度">
      <section className="mission-head">
        <div><div className="eyebrow">{game.subtitle} <span>/</span> {game.direction}</div><h1>{game.name}<span>{game.difficulty} · {game.formationName}</span></h1></div>
      </section>
      <section className="mission-stats battle-status" aria-label="战况概览">
        <div><small>我方编队</small><strong id="ally-count">{String(allies.filter(u=>u.hp>0).length).padStart(2,'0')} <em>/ {String(allies.length).padStart(2,'0')}</em></strong></div>
        <div><small>歼敌进度</small><strong id="kill-count">{String(enemies.filter(u=>u.hp<=0).length).padStart(2,'0')} <em>/ {enemies.length}</em></strong></div>
        <div><small>当前回合</small><strong id="round">{String(game.turnNumber).padStart(2,'0')}</strong></div>
        <div className="phase-readiness" aria-label="我方剩余行动机会"><span><b>{String(locked?0:living.filter(u=>!u.moved).length).padStart(2,'0')}</b> 可移动</span><span><b>{String(locked?0:living.filter(u=>!u.fired).length).padStart(2,'0')}</b> 可开火 / 维修</span></div>
        <p className="turn-phase" aria-live="polite">{game.winner?'行动结束':locked?`敌方行动 · ${game.enemyIndex} / ${game.enemyQueue.length}`:'我方行动阶段'}</p>
      </section>
      <section className="objective-hud" aria-label="作战目标">
        <p className="objective-text"><span>任务</span>{game.objective}</p>
        {game.mission&&<p className="objective-progress" aria-live="polite">{game.winner==='blue'?'任务已完成':game.winner==='red'?'任务失败':game.mission.kind==='hold'?`坚守进度 ${game.missionProgress?.heldTurns||0} / ${game.mission.turns} 回合`:game.mission.kind==='capture'?`占领进度 ${game.missionProgress?.captured?.filter(Boolean).length||0} / ${game.mission.points.length}`:'护送进度：等待工程车抵达目标'}</p>}
        <details className="mission-intel">
          <summary>任务简报与战术路线</summary>
          <p>{game.briefing}</p>
          {game.story&&<StoryBrief game={game}/>}
          <div className="route-brief">{game.routes.map(r=><p key={r}>{r}</p>)}</div>
        </details>
      </section>
      </section>
      <Battlefield game={game} onCell={(x,y)=>dispatch({type:'CELL',x,y})} onReset={()=>dispatch({type:'RESET'})} onUndo={()=>dispatch({type:'UNDO'})}/>
      <CommandPanel game={game}/>
      <UnitActions game={game} dispatch={dispatch}/>
      <button className="round-command end-turn-button" id="end-turn" disabled={locked} onClick={()=>dispatch({type:'END_TURN'})} aria-label="结束回合"><span aria-hidden="true">→</span><small>{game.winner?'已结束':locked?'敌方行动':'结束回合'}</small></button>
    </main>}
    <BattleSettings open={settings&&screen==='battle'} onClose={()=>setSettings(false)} onReset={()=>{dispatch({type:'RESET'});setSettings(false);}} onExit={()=>navigate(null)} onHelp={()=>{setSettings(false);setHelp(true);}}/>
    <FieldManual open={help} onClose={()=>setHelp(false)}/>
  </div>;
}
