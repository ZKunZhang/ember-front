import { useEffect, useRef } from 'react';
import { UNIT_TYPES } from '../game/catalog.js';
import UnitIcon from './UnitIcon.jsx';
export default function FieldManual({open,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{if(open)ref.current.showModal();else ref.current.close();},[open]);
  return <dialog ref={ref} id="help-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="eyebrow">FIELD MANUAL</div><h2>装甲联合作战</h2><p>点击我方车辆或右侧编队选择。浅蓝实线外沿表示可移动范围，浅橙虚线外沿表示火力范围。点击蓝格移动，点击可见敌军直接开火并查看情报，无需切换开火模式；超出射程或已行动时仍可查看情报。每车每回合可移动一次、开火或维修一次，顺序不限。所有存活车辆移动完后自动结束回合，剩余开火／维修机会会跳过，请在最后一辆车移动前完成；点击「结束回合」可跳过剩余行动。</p><p>山地、树林、河流与地图外区域不可通行。直射火力会被山林挡住，火炮和火箭炮可越过山林，但存在近距离射击盲区。道路和桥梁可通行。</p><p>我方共享实时视野，敌军仍可在迷雾中开火；不会显示隐藏射手的位置。装甲抵消伤害，命中至少造成 1 点伤害。工程车点击「维修」后指定相邻受损友军，维修占用开火机会；可点「取消维修」退出，维修成功后也会自动退出。</p><div className="manual-units">{Object.entries(UNIT_TYPES).map(([type,u])=><div key={type}><UnitIcon type={type}/><div><strong>{u.name}</strong><p>{u.description}</p></div></div>)}</div><p>地图支持鼠标拖动、手机滑动和触控板双指横滑；也可用左右箭头平移，点击「重置视图」回到中心。每张地图独立开局，歼灭全部敌军获胜。切换部署或刷新会重置战局。</p><button className="primary" id="close-help" onClick={onClose}>返回指挥 →</button></dialog>;
}
