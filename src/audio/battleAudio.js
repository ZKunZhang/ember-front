export const AUDIO_STORAGE_KEY = 'ember-front.audio.v1';
export const DEFAULT_AUDIO = { muted: false, volume: 0.45 };

export function readAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY));
    return {
      muted: saved?.muted === true,
      volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(1, saved.volume)) : DEFAULT_AUDIO.volume,
    };
  } catch { return { ...DEFAULT_AUDIO }; }
}

// A single, gesture-unlocked context. Every voice has a finite envelope, including
// queued impacts, so leaving a battle can stop all of its sound immediately.
export function createBattleAudio() {
  let context, master, noise, settings = readAudioSettings(), lastUi = -Infinity;
  const voices = new Set();
  const stop = () => {
    for (const voice of voices) {
      try { voice.stop(); } catch { /* Already ended. */ }
    }
    voices.clear();
  };
  const configure = next => {
    settings = next;
    if (settings.muted || !settings.volume) stop();
    if (master) master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume * 0.45, context.currentTime, 0.015);
  };
  const unlock = () => {
    if (settings.muted || !settings.volume) return;
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        master = context.createGain();
        master.connect(context.destination);
        configure(settings);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Audio is optional; commands must still work. */ }
  };
  const play = (cue, { delay = 0, duration = 0.55 } = {}) => {
    if (!context || context.state !== 'running' || settings.muted || !settings.volume || document.hidden) return;
    const start = context.currentTime + delay;
    if (cue === 'select' && start - lastUi < 0.055) return;
    if (cue === 'select') lastUi = start;
    const voice = (node, time, length, gain, filter) => {
      if (voices.size >= 48) return;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
      if (filter) { node.connect(filter); filter.connect(envelope); }
      else node.connect(envelope);
      envelope.connect(master);
      voices.add(node);
      node.onended = () => { voices.delete(node); node.disconnect(); filter?.disconnect(); envelope.disconnect(); };
      node.start(time); node.stop(time + length + 0.02);
    };
    const tone = (hz, end, length, gain = 0.2, offset = 0, type = 'sine') => {
      const node = context.createOscillator();
      node.type = type;
      node.frequency.setValueAtTime(hz, start + offset);
      node.frequency.exponentialRampToValueAtTime(end, start + offset + length);
      voice(node, start + offset, length, gain);
    };
    const burst = (length, gain, cutoff, offset = 0) => {
      if (!noise) {
        noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const node = context.createBufferSource(), filter = context.createBiquadFilter();
      node.buffer = noise;
      filter.type = 'lowpass'; filter.frequency.value = cutoff;
      voice(node, start + offset, length, gain, filter);
    };
    try {
      switch (cue) {
        case 'select': tone(650, 900, 0.07, 0.12, 0, 'triangle'); break;
        case 'reject': tone(180, 110, 0.14, 0.18, 0, 'triangle'); break;
        case 'undo': tone(620, 280, 0.17, 0.16); break;
        case 'move':
          tone(65, 42, duration, 0.12, 0, 'triangle'); burst(duration, 0.18, 300); break;
        case 'fire':
          tone(150, 38, 0.18, 0.4); burst(0.13, 0.6, 1600); break;
        case 'impact':
          tone(85, 32, 0.22, 0.32); burst(0.23, 0.38, 900); break;
        case 'destroy':
          tone(100, 25, 0.5, 0.42); burst(0.65, 0.55, 700); break;
        case 'repair':
          [440, 554, 660].forEach((hz, i) => tone(hz, hz, 0.19, 0.15, i * 0.09)); break;
        case 'enemyTurn':
          [330, 247].forEach((hz, i) => tone(hz, hz, 0.17, 0.16, i * 0.13)); break;
        case 'deploy': case 'turn': case 'objective':
          [392, 523, 659].forEach((hz, i) => tone(hz, hz, 0.22, 0.17, i * 0.11)); break;
        case 'victory':
          [392, 523, 659, 784].forEach((hz, i) => tone(hz, hz, 0.45, 0.2, i * 0.16)); break;
        case 'defeat':
          [294, 247, 196].forEach((hz, i) => tone(hz, hz, 0.45, 0.17, i * 0.2)); break;
      }
    } catch { /* A suspended or unavailable device never blocks the game. */ }
  };
  return {
    unlock, configure, play, stop,
    dispose() { stop(); context?.close().catch(() => {}); context = null; master = null; noise = null; },
  };
}
