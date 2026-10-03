import { useEffect, useRef, useState } from 'react';
import { AUDIO_STORAGE_KEY, createBattleAudio, readAudioSettings } from '../audio/battleAudio.js';
import { movementDuration } from '../game/movement.js';
import { IMPACT_DELAY } from '../rendering/combat.js';

export function useBattleAudio(game, active, screen) {
  const [settings, setSettings] = useState(readAudioSettings);
  const audioRef = useRef(null), previous = useRef(game), moving = useRef(new Map());
  if (!audioRef.current) audioRef.current = createBattleAudio();
  const audio = audioRef.current;
  useEffect(() => {
    const unlock = () => audio.unlock();
    const click = event => {
      const button = event.target.closest?.('button');
      if (button && !button.disabled && !button.hasAttribute('data-quiet')) audio.play('select');
    };
    const hide = () => { if (document.hidden) audio.stop(); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('click', click);
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', hide);
      audio.dispose();
    };
  }, [audio]);
  useEffect(() => {
    audio.configure(settings);
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings)); } catch { /* Session-only settings. */ }
  }, [audio, settings]);
  useEffect(() => {
    audio.stop();
    moving.current.clear();
  }, [audio, active, screen, game.session]);
  useEffect(() => {
    const before = previous.current;
    previous.current = game;
    if (!active) return;
    const changedSession = before.session !== game.session;
    if (changedSession || before.notice?.id !== game.notice?.id) {
      if (game.notice?.cue) audio.play(game.notice.cue);
    }
    if (changedSession) return;
    if ((game.selectedId !== before.selectedId && game.selectedId) || game.mode !== before.mode) audio.play('select');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now = performance.now();
    for (const [id, end] of moving.current) if (end <= now) moving.current.delete(id);
    if (game.movement && game.movement.id !== before.movement?.id) {
      const duration = reduced ? 0.16 : movementDuration(game.movement) / 1000;
      moving.current.set(game.movement.unitId, now + (reduced ? 0 : duration * 1000));
      audio.play('move', { duration });
    }
    let impact = 0;
    if (game.effect && game.effect.id !== before.effect?.id) {
      const effect = game.effect;
      const delay = Math.max(0, ((moving.current.get(effect.source?.id) || now) - now) / 1000);
      impact = delay + IMPACT_DELAY / 1000;
      if (effect.amount > 0) audio.play('repair', { delay });
      else {
        if (effect.source) audio.play('fire', { delay });
        audio.play(effect.destroyed ? 'destroy' : 'impact', { delay: impact });
      }
    }
    if (game.winner && !before.winner) audio.play(game.winner === 'blue' ? 'victory' : 'defeat', { delay: impact + 0.25 });
  }, [audio, game, active]);
  const update = patch => {
    const next = { ...settings, ...patch };
    audio.configure(next);
    audio.unlock();
    setSettings(next);
  };
  return { settings, update };
}
