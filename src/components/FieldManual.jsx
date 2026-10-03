import { useEffect, useRef } from 'react';
import { UNIT_TYPES } from '../game/catalog.js';
import UnitIcon from './UnitIcon.jsx';

export default function FieldManual({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) ref.current.showModal();
    else ref.current.close();
  }, [open]);

  function closeOnBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }

  return (
    <dialog ref={ref} id="help-dialog" aria-labelledby="manual-title" onCancel={onClose} onClick={closeOnBackdrop}>
      <div className="manual-header">
        <div>
          <div className="eyebrow">FIELD MANUAL / 作战手册</div>
          <h2 id="manual-title">装甲联合作战</h2>
        </div>
        <button className="dialog-close" onClick={onClose} aria-label="关闭作战手册">×</button>
      </div>

      <div className="manual-quickstart" aria-label="快速操作">
        <div className="manual-step">
          <span>01</span>
          <h3>选择车辆</h3>
          <p>点击战场中的车辆，查看当前单位的情报；选中我方车辆后可执行行动。</p>
        </div>
        <div className="manual-step">
          <span>02</span>
          <h3>移动与开火</h3>
          <p>点击蓝格移动；点击可见敌军直接开火并查看情报，无需切换开火模式。</p>
        </div>
        <div className="manual-step">
          <span>03</span>
          <h3>安排回合</h3>
          <p>每车每回合可移动一次、开火或维修一次，顺序不限。完成部署后点击「结束回合」。</p>
        </div>
      </div>

      <section className="manual-section">
        <h3>行动顺序与范围</h3>
        <p>浅蓝实线外沿表示可移动范围，浅橙虚线外沿表示火力范围。超出射程或已行动时，点击可见敌军仍可查看情报。</p>
        <p className="manual-callout">所有存活车辆移动完后自动结束回合，剩余开火／维修机会会跳过，请在最后一辆车移动前完成。途中首次发现敌军会立即停下，并暂停自动结束回合；可以安排开火、让其他车辆掩护或撤回，再手动结束回合。</p>
      </section>

      <section className="manual-section">
        <h3>地形、视野与火力</h3>
        <p>山地、树林、河流与地图外区域不可通行，道路和桥梁可通行。直射火力会被山林挡住；火炮和火箭炮可越过山林，但存在近距离射击盲区。</p>
        <p>山体和树林会挡住视线，绕过山背、林间转角后才能发现敌军。我方共享实时视野，火炮越障开火也需要友军发现目标。敌方警戒哨只有看见我方或受到攻击后才会带动所在小队出击，远处哨队继续警戒。</p>
        <p>敌军仍可从迷雾中开火，不会显示隐藏射手的位置。装甲抵消伤害，命中至少造成 1 点伤害。</p>
      </section>

      <section className="manual-section">
        <h3>维修与兵种协同</h3>
        <p>工程车点击「维修」后指定相邻受损友军，维修占用开火机会；可点「取消维修」退出，维修成功后也会自动退出。</p>
        <div className="manual-units">
          {Object.entries(UNIT_TYPES).map(([type, unit]) => (
            <div key={type}>
              <UnitIcon type={type} />
              <div><strong>{unit.name}</strong><p>{unit.description}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <h3>撤回与调整视角</h3>
        <p>误触后可点击棋盘下方「撤回」，逐步恢复移动、开火、维修或结束回合前的战局；敌方已行动也可撤回，最多保留最近 50 步，重新部署会清空记录。</p>
        <p>沙盘从己方底部向前呈现，从桌边斜俯视战场。地图支持鼠标拖动、手机滑动和触控板双指平移；触控板捏合或 Ctrl+滚轮可缩放。左下角撤回上一步或结束回合，右下角切换单位行动；重新部署与退出位于左上角设置中。</p>
        <p>按 Esc 打开战斗设置，按 M 切换音效；音量和静音会自动记住。打开设置或作战指南时敌方行动暂停。系统开启「减少动态效果」时会减弱动画。</p>
      </section>

      <section className="manual-section">
        <h3>任务目标与重新部署</h3>
        <p>关卡从不同角落出发，编队按任务为6至9辆。穿越任务要求指定数量存活友军同时抵达金色撤离区，无需全歼；存活车辆少于要求立即失败。其余任务包括歼灭、夺点、护送工程车与坚守观察点，以任务栏为准。</p>
        <p>切换部署会重置战局；刷新会保留地址中的关卡、难度与编队并重新开局。</p>
        <p>战斗结束会弹出战报，可以重新部署，或退出游戏返回主菜单；胜利后还可前往下一关。各难度的通关标记与最佳回合数保存在当前浏览器；通关记录不包含战斗存档。</p>
      </section>

      <button className="primary" id="close-help" onClick={onClose}>返回指挥 →</button>
    </dialog>
  );
}
