import { useBattlefield } from '../hooks/useBattlefield.js';
import FogLayer from './FogLayer.jsx';
import BattleResult from './BattleResult.jsx';
import { terrainCost,terrainLabel } from '../game/terrain.js';
import { routeCost } from '../game/engine.js';
import { hexToSource } from '../game/layout.js';

export default function Battlefield({ game, onCell, onReset, onUndo, onExit, onNext, nextScenario, focusTarget }) {
  const {
    canvasRef,
    view,
    hover,
    hoveredUnit,
    dragging,
    pointerHandlers,
    camera,
    zoom,
    rotate,
    tilt,
    resetCamera,
    destinations,
  } = useBattlefield(game, onCell, focusTarget);
  const living=game.units.filter(unit=>unit.team==='blue'&&unit.hp>0);
  const lastMove=living.filter(unit=>!unit.moved).length===1;
  const remainingFire=living.filter(unit=>!unit.fired).length;
  const terrain=hover?game.terrain[hover.y]?.[hover.x]:null;
  const cost=terrainCost(terrain);
  const route=hover?destinations.get(`${hover.x},${hover.y}`):null;
  const coordinate=hover&&hexToSource(game,hover);
  const defending=game.mission?.kind==='defend';
  const selected=living.find(unit=>unit.id===game.selectedId);
  return (
    <section className="battlefield">
      <div className="map-top">
        <span className="coordinates">
          {hoveredUnit
            ? `${hoveredUnit.team === 'blue' ? '我方' : '敌方'} ${String(hoveredUnit.id).padStart(2, '0')} · ${hoveredUnit.name}`
            : hover
              ? `GRID ${coordinate.x + 1} : ${coordinate.y + 1}`
              : `${game.cols} × ${game.rows} · 六角战区`}
        </span>
        {hover&&<small className="terrain-status">{terrainLabel(terrain)} · {Number.isFinite(cost)?`每格 ${cost} 移动点${route?` · 此路线 ${routeCost(game,route)} 点`:''}`:[1,2].includes(terrain)?'不可通行 · 遮挡视线与直射':'不可通行'}</small>}
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          id="map"
          data-camera-rotation={camera.rotation}
          data-camera-tilt={camera.tilt}
          data-camera-zoom={camera.zoom}
          data-camera-detail={view.interactive?'interactive':'full'}
          data-camera-pan-x={camera.pan.x}
          data-camera-pan-y={camera.pan.y}
          style={{
            cursor: dragging ? 'grabbing' : hoveredUnit ? 'pointer' : 'grab',
          }}
          aria-label="六角格沙盘战场：拖动平移，右键或按住 Shift 拖动旋转及调整俯视角；双指缩放旋转；点击车辆选择，点击高亮地格移动"
          {...pointerHandlers}
        />
        <FogLayer game={game} view={view} />
        <details className="sandtable-controls">
          <summary title="调整沙盘视角"><span aria-hidden="true">⌖</span><span>沙盘视角</span></summary>
          <div className="sandtable-buttons" role="group" aria-label="沙盘视角控制">
            <button onClick={()=>rotate(-Math.PI/6)} aria-label="向左旋转沙盘" title="向左旋转">↶</button>
            <button onClick={()=>rotate(Math.PI/6)} aria-label="向右旋转沙盘" title="向右旋转">↷</button>
            <button onClick={()=>zoom(-.15)} aria-label="缩小沙盘" title="缩小">−</button>
            <button onClick={()=>zoom(.15)} aria-label="放大沙盘" title="放大">+</button>
            <button onClick={resetCamera} aria-label="复位沙盘视角" title="复位视角">⌂</button>
          </div>
          <label>俯视角度<input aria-label="沙盘俯视角度" type="range" min=".65" max="1.35" step=".05" value={camera.tilt} onChange={e=>tilt(Number(e.target.value))}/></label>
          <p>拖动平移 · 右键拖动旋转<br/>上下拖动调角度 · 双指缩放旋转</p>
        </details>
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
              : defending
                ? !selected?'先点击我方车辆或编队列表选车':selected.moved
                  ? selected.fired?'本车行动已用完 · 选择另一辆车，或结束回合':'本车已移动 · 可点击可见敌军开火，或选择其他车辆'
                  : '先布防：点击浅蓝范围移动 · 点击可见敌军开火 · 完成后结束回合'
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
