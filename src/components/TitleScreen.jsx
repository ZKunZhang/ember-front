export default function TitleScreen({ onStart }) {
  return <main className="title-screen" aria-label="烬土前线主菜单">
    <div className="title-screen-heading">
      <p className="title-kicker"><span/> 装甲战术 · 回合策略 <span/></p>
      <h1>烬土前线</h1>
      <p className="title-english">EMBER FRONT</p>
      <div className="title-rule" aria-hidden="true"><span/>◆<span/></div>
      <p className="title-tagline">于烬土之上，重塑战局。</p>
    </div>
    <div className="title-start">
      <button onClick={onStart} className="start-game">开始游戏 <span aria-hidden="true">⟶</span></button>
      <p>选择你的战场</p>
    </div>
    <p className="title-footer">EMBER FRONT <span> / </span> 联合作战</p>
  </main>;
}
