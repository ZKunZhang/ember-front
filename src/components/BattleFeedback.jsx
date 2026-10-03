import { useEffect, useState } from 'react';

export default function BattleFeedback({ game, active }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!game.notice) { setVisible(false); return; }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), game.notice.kind === 'warn' ? 3600 : 2600);
    return () => clearTimeout(timer);
  }, [game.session, game.notice?.id]);
  return <div className="battle-feedback" role="status" aria-live="polite" aria-atomic="true">
    {visible && active && !game.winner && <div key={`${game.session}:${game.notice.id}`} className={`feedback-message ${game.notice.kind}`}>
      <span aria-hidden="true">{game.notice.kind === 'warn' ? '!' : game.notice.kind === 'enemy' ? '⌖' : '✓'}</span>
      <p>{game.notice.message}</p>
    </div>}
  </div>;
}
