import { useBattlefield } from '../hooks/useBattlefield.js';
import FogLayer from './FogLayer.jsx';

export default function Battlefield({ game, onCell, onReset, onUndo }) {
  const {
    canvasRef,
    view,
    hover,
    hoveredUnit,
    dragging,
    pointerHandlers,
  } = useBattlefield(game, onCell);
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
        {game.winner && (
          <div className="result" role="status">
            <span>
              {game.winner === 'blue'
                ? 'MISSION ACCOMPLISHED'
                : 'OPERATION ENDED'}
            </span>
            <h2>
              {game.winner === 'blue'
                ? game.mission
                  ? '任务目标达成'
                  : '战区已肃清'
                : '行动失败'}
            </h2>
            <p>
              {game.winner === 'blue'
                ? `第 ${game.turnNumber} 回合 · ${game.mission ? '任务目标达成' : '敌军全部歼灭'}`
                : '行动目标未能达成，请调整部署战术。'}
            </p>
            {game.story && (
              <p>
                {game.winner === 'blue'
                  ? game.story.success
                  : game.story.failure}
              </p>
            )}
            <button onClick={onReset}>重新部署</button>
          </div>
        )}
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
          {game.turn === 'red'
            ? '敌方行动中…'
            : game.mode === 'attack'
              ? '攻击模式 · 点击射程内可见敌军'
            : game.mode === 'repair'
              ? '维修模式 · 点击相邻受损友军；点击敌军开火'
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
