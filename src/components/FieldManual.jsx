import { useEffect, useRef } from 'react';
import { UNIT_TYPES } from '../game/catalog.js';
import UnitIcon from './UnitIcon.jsx';
export default function FieldManual({open,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{if(open)ref.current.showModal();else ref.current.close();},[open]);
  return <dialog ref={ref} id="help-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="eyebrow">FIELD MANUAL</div><h2>装甲联合作战</h2><p>点击我方车辆或右侧编队选择。绿色地格可移动；切换「开火」查看射程，点击视野内敌军攻击。每回合移动、开火各一次，顺序不限。</p><p>山地、树林、河流与地图外区域不可通行。直射火力会被山林挡住，火炮和火箭炮可越过山林，但存在近距离射击盲区。道路和桥梁可通行。</p><p>我方共享实时视野，敌军仍可在迷雾中开火；不会显示隐藏射手的位置。装甲抵消伤害，命中至少造成 1 点伤害。工程车维修相邻友军，维修和开火只能选一个。</p><div className="manual-units">{Object.entries(UNIT_TYPES).map(([type,u])=><div key={type}><UnitIcon type={type}/><div><strong>{u.name}</strong><p>{u.description}</p></div></div>)}</div><p>每张地图独立开局，歼灭全部敌军获胜。切换部署或刷新会重置战局。</p><button className="primary" id="close-help" onClick={onClose}>返回指挥 →</button></dialog>;
}
