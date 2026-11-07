/* =========================================================
   RetroSFX — tiny chiptune sound engine shared by the games.
   Sounds are synthesized with the Web Audio API (no audio files).
   One on/off setting for all games, remembered in the browser;
   changing it fires a "retrosfx:change" event so every game's button can update.
   ========================================================= */
window.RetroSFX = (() => {
  const KEY = 'portfolio95-game-sound';
  let ctx = null;
  let on = true;
  try {
    // fall back to the setting Snake used before the engine was shared
    const saved = localStorage.getItem(KEY) ?? localStorage.getItem('portfolio95-snake-sound');
    on = saved !== 'off';
  } catch (err) { /* no storage */ }

  function audio() {
    if (!on) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One note: frequency (Hz) and length (s); `at` delays it, `slide` bends the pitch
  function note(freq, len, { at = 0, type = 'square', vol = 0.07, slide = 1 } = {}) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  // A burst of fading noise through a low-pass filter (crunches, explosions)
  function noise(len, { at = 0, vol = 0.12, freq = 1200 } = {}) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = freq;
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(t);
  }

  // A run of notes, `step` seconds apart, starting at opts.at
  const seq = (freqs, step, opts = {}) => freqs.forEach((f, i) => note(f, step * 1.1, { ...opts, at: (opts.at || 0) + i * step }));

  return {
    note,
    noise,
    seq,
    get on() { return on; },
    set on(v) {
      on = v;
      try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (err) { /* no storage */ }
      document.dispatchEvent(new CustomEvent('retrosfx:change', { detail: { on: v } }));
    },
  };
})();
