import { useBattlefield } from '../hooks/useBattlefield.js';
import FogLayer from './FogLayer.jsx';
import BattleResult from './BattleResult.jsx';

export default function Battlefield({ game, onCell, onReset, onUndo, onExit, onNext, nextScenario }) {
  const {
    canvasRef,
    view,
    hover,
    hoveredUnit,
    dragging,
    pointerHandlers,
  } = useBattlefield(game, onCell);
  const living=game.units.filter(unit=>unit.team==='blue'&&unit.hp>0);
  const lastMove=living.filter(unit=>!unit.moved).length===1;
  const remainingFire=living.filter(unit=>!unit.fired).length;
  return (
    <section className="battlefield">
      <div className="map-top">
        <span className="coordinates">
          {hoveredUnit
            ? `${hoveredUnit.team === 'blue' ? '我方' : '敌方'} ${String(hoveredUnit.id).padStart(2, '0')} · ${hoveredUnit.name}`
            : hover
              ? `GRID ${hover.x + 1} : ${hover.y + 1}`
              : '22 × 18 · 不规则战区'}
        </span>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          id="map"
          style={{
            cursor: dragging ? 'grabbing' : hoveredUnit ? 'pointer' : 'grab',
          }}
          aria-label="桌面俯视沙盘战场，可双指滑动或拖动平移；点击车辆选择，点击高亮地格移动"
          {...pointerHandlers}
        />
        <FogLayer game={game} view={view} />
        <div className="north">
          推进<span>↑</span>
        </div>
        {game.winner && <BattleResult game={game} nextScenario={nextScenario} onNext={onNext} onReset={onReset} onExit={onExit} onUndo={onUndo}/>}
      </div>
      <div className="map-toolbar">
        <button
          id="undo"
          aria-label="撤回"
          className="undo-button"
          disabled={!game.undoHistory?.length}
          onClick={onUndo}
          title="撤回上一次移动、开火、维修或结束回合"
        >
          <span aria-hidden="true">↶</span><small>撤回</small>
        </button>
        <div className="map-command-hint">
          {game.winner ? '行动结束 · 查看战报或撤回最后一步' : game.turn === 'red'
            ? '敌方行动中…'
            : game.mode === 'attack'
              ? '攻击模式 · 点击射程内可见敌军'
            : game.mode === 'repair'
              ? '维修模式 · 点击相邻受损友军；点击敌军开火'
              : lastMove && remainingFire > 0
                ? `最后一次移动将自动结束回合 · 请先完成 ${remainingFire} 次可用开火 / 维修`
              : '点击蓝格移动 · 点击敌军开火并查看情报'}
        </div>
      </div>
      <div className="map-bottom">
        <div className="legend">
          <span>
            <i className="swatch blue" />
            我方
          </span>
          <span>
            <i className="swatch red" />
            敌方
          </span>
          <span>
            <i className="swatch move" />
            移动范围
          </span>
          <span>
            <i className="swatch attack" />
            火力范围
          </span>
          <span>
            <i className="swatch road" />
            道路 / 桥梁
          </span>
          <span>
            <i className="swatch fog" />
            迷雾
          </span>
        </div>
      </div>
    </section>
  );
}
