import { useEffect, useRef } from 'react';

export default function BattleSettings({ open, onClose, onReset, onExit, onHelp }) {
  const ref=useRef(null);
  useEffect(()=>{
    if(open)ref.current.showModal();
    else ref.current.close();
  },[open]);
  const closeBackdrop=event=>{
    if(event.target!==event.currentTarget)return;
    const rect=event.currentTarget.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();
  };
  return <dialog ref={ref} className="battle-settings-dialog" aria-labelledby="settings-title" onCancel={onClose} onClick={closeBackdrop}>
    <div className="manual-header"><div><div className="eyebrow">BATTLE SETTINGS</div><h2 id="settings-title">战斗设置</h2></div><button className="dialog-close" onClick={onClose} aria-label="关闭设置">×</button></div>
    <p>调整部署或返回战区，继续指挥你的部队。</p>
    <div className="settings-actions">
      <button className="primary" onClick={onClose}>继续战斗 <span>→</span></button>
      <button id="reset" aria-label="重新部署" onClick={onReset}>重新部署 <small>重置本场战斗，保留难度与编组</small></button>
      <button id="choose-map" aria-label="退出关卡" onClick={onExit}>退出关卡 <small>返回战区地图，可继续当前战斗</small></button>
      <button id="help" aria-label="作战指南" onClick={onHelp}>作战指南 <small>查看移动、开火与维修规则</small></button>
    </div>
  </dialog>;
}
