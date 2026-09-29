export default function UnitActions({ game, dispatch }) {
  const unit=game.units.find(u=>u.id===game.selectedId&&u.team==='blue'&&u.hp>0);
  const locked=game.turn!=='blue'||Boolean(game.winner);
  if(!unit)return null;
  return <section className="unit-actions" aria-label="选中单位操作">
    <div className="unit-actions-label">{unit.name} <small>{String(unit.id).padStart(2,'0')}</small></div>
    <div className="unit-action-buttons">
      <button id="move-mode" className={game.mode==='move'?'active':''} aria-pressed={game.mode==='move'} disabled={locked||unit.moved} onClick={()=>dispatch({type:'MODE',mode:'move'})}><span aria-hidden="true">◇</span><small>{unit.moved?'✓ 已移动':'移动'}</small></button>
      <button id="attack-mode" className={game.mode==='attack'?'active':''} aria-pressed={game.mode==='attack'} disabled={locked||unit.fired} onClick={()=>dispatch({type:'MODE',mode:'attack'})}><span aria-hidden="true">⌖</span><small>{unit.fired?'已行动':'攻击'}</small></button>
      {unit.repair>0&&<button id="repair-mode" className={game.mode==='repair'?'active repair-action':'repair-action'} aria-pressed={game.mode==='repair'} disabled={locked||unit.fired} onClick={()=>dispatch(game.mode==='repair'?{type:'CANCEL_REPAIR'}:{type:'MODE',mode:'repair'})}><span aria-hidden="true">✚</span><small>{game.mode==='repair'?'取消维修':unit.fired?'已行动':'维修'}</small></button>}
    </div>
  </section>;
}
