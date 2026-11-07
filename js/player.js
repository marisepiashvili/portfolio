/* =========================================================
   winplayer.exe — an interactive retro music player.
   The three built-in tracks are synthesized live with the Web Audio API
   (no audio files needed); Eject opens your own audio file.
   ========================================================= */
(() => {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- Built-in songs ----------
     Each song is a 4-chord loop arranged in sections. Chords: [bass root, ...pad/arp tones] */
  const SONGS = [
    {
      title: 'synthwave_1996.mp3',
      bpm: 100,
      seed: 7,
      lead: 'square',
      chords: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]], // Am F C G
      scale: [57, 60, 62, 64, 67, 69, 72, 74, 76, 79],
      sections: ['intro', 'intro', 'groove', 'groove', 'full', 'full', 'break', 'full2', 'full2', 'outro'],
      drums: 'four',
    },
    {
      title: 'dial_up_dreams.mp3',
      bpm: 120,
      seed: 21,
      lead: 'square',
      chords: [[38, 62, 65, 69], [46, 58, 62, 65], [41, 60, 65, 69], [48, 60, 64, 67]], // Dm Bb F C
      scale: [62, 64, 65, 67, 69, 72, 74, 76, 77, 81],
      sections: ['intro', 'groove', 'groove', 'full', 'full', 'break', 'full2', 'full2', 'full2', 'outro'],
      drums: 'four',
    },
    {
      title: 'floppy_disk_blues.mp3',
      bpm: 84,
      seed: 3,
      swing: 0.18,
      lead: 'triangle',
      chords: [[36, 60, 64, 67, 71], [45, 57, 60, 64, 67], [38, 62, 65, 69, 72], [43, 55, 59, 62, 65]], // Cmaj7 Am7 Dm7 G7
      scale: [60, 62, 64, 67, 69, 72, 74, 76, 79],
      sections: ['intro', 'groove', 'full', 'full', 'break', 'full2', 'full2', 'outro'],
      drums: 'lofi',
    },
  ];

  // Each section is 4 bars (one pass of the chord loop)
  const PARTS = {
    intro: { pad: 1, hat: 1 },
    groove: { pad: 1, hat: 1, kick: 1, bass: 1, arp: 1 },
    full: { pad: 1, hat: 1, kick: 1, snare: 1, bass: 1, arp: 1, lead: 1 },
    break: { pad: 1, arp: 1, lead: 1 },
    full2: { pad: 1, hat: 1, kick: 1, snare: 1, bass: 1, arp: 1, lead: 2 },
    outro: { pad: 1, bass: 1, fade: 1 },
  };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // A deterministic 8-bar melody per song, built from chord tones and the scale
  function makeMelody(song) {
    const rand = rng(song.seed);
    const mel = [];
    let prev = song.scale[4];
    for (let bar = 0; bar < 8; bar++) {
      const chord = song.chords[bar % 4].slice(1).map((n) => n + 12);
      const row = new Array(16).fill(null);
      for (let st = 0; st < 16; st += 2) {
        if (rand() < (st % 4 ? 0.45 : 0.2)) continue;
        const pool = rand() < 0.65 ? chord : song.scale.map((n) => n + 12);
        // prefer notes close to the previous one
        const sorted = [...pool].sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
        const note = sorted[Math.floor(rand() * Math.min(3, sorted.length))];
        row[st] = { note, len: rand() < 0.3 ? 4 : 2 };
        prev = note;
      }
      mel.push(row);
    }
    return mel;
  }

  SONGS.forEach((s) => {
    s.bars = s.sections.length * 4;
    s.step = 60 / s.bpm / 4;               // one 16th note, in seconds
    s.steps = s.bars * 16;
    s.duration = s.steps * s.step;
    s.melody = makeMelody(s);
  });

  /* ---------- Synth voices ---------- */
  class Synth {
    constructor(ctx) {
      this.ctx = ctx;
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    env(g, t, vol, a, dur, rel = 0.05) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.setValueAtTime(vol, t + Math.max(a, dur - rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    }

    tone(out, type, freq, t, dur, vol, { attack = 0.005, cutoff = 0, detune = 0, release = 0.06 } = {}) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      let node = o;
      if (cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        o.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(out);
      this.env(g, t, vol, attack, dur, release);
      o.start(t);
      o.stop(t + dur + release + 0.05);
    }

    kick(out, t, vol) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.3);
    }

    noiseHit(out, t, vol, type, freq, dur) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    }

    snare(out, t, vol) {
      this.noiseHit(out, t, vol, 'bandpass', 1800, 0.18);
      this.tone(out, 'triangle', 185, t, 0.05, vol * 0.5);
    }

    hat(out, t, vol) { this.noiseHit(out, t, vol, 'highpass', 7000, 0.045); }
  }

  // Schedule everything that sounds on one 16th step
  function renderStep(synth, out, song, step, t) {
    const bar = Math.floor(step / 16);
    const st = step % 16;
    const part = PARTS[song.sections[Math.floor(bar / 4)]];
    const chord = song.chords[bar % 4];
    const [root, ...tones] = chord;
    let fade = 1;
    if (part.fade) fade = Math.max(0.05, 1 - ((bar % 4) * 16 + st) / 64);
    const S = song.step;

    if (part.pad && st === 0) {
      tones.slice(0, 3).forEach((n, i) => {
        synth.tone(out, 'sawtooth', midi(n), t, S * 15, 0.035 * fade, { attack: 0.25, cutoff: 1100, detune: i % 2 ? 7 : -7, release: 0.4 });
      });
    }
    if (part.bass && st % 2 === 0) {
      const pat = song.drums === 'lofi' ? [0, null, 0, 7, 0, null, 12, 7] : [0, 0, 12, 0, 0, 12, 0, 7];
      const iv = pat[st / 2];
      if (iv !== null) synth.tone(out, 'sawtooth', midi(root + iv), t, S * 1.6, 0.13 * fade, { cutoff: 600 });
    }
    if (part.arp && (song.drums === 'lofi' ? st % 2 === 0 : true)) {
      const i = st % tones.length;
      const up = Math.floor(st / tones.length) % 2 ? 12 : 0;
      synth.tone(out, 'square', midi(tones[i] + up), t, S * 0.7, 0.028, { cutoff: 2600 });
    }
    if (part.lead) {
      const m = song.melody[bar % 8][st];
      if (m) synth.tone(out, song.lead, midi(m.note + (part.lead === 2 ? 12 : 0)), t, S * m.len * 0.9, song.lead === 'triangle' ? 0.12 : 0.055, { attack: 0.01, cutoff: 3200 });
    }
    if (song.drums === 'four') {
      if (part.kick && st % 4 === 0) synth.kick(out, t, 0.55);
      if (part.snare && (st === 4 || st === 12)) synth.snare(out, t, 0.22);
      if (part.hat && st % 2 === 0) synth.hat(out, t, st % 4 === 2 ? 0.07 : 0.03);
    } else {
      if (part.kick && (st === 0 || st === 10)) synth.kick(out, t, 0.45);
      if (part.snare && (st === 4 || st === 12)) synth.snare(out, t, 0.14);
      if (part.hat && st % 2 === 0) synth.hat(out, t, 0.035);
    }
  }

  /* ---------- Small helpers ---------- */
  const fmt = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const spoken = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)} min ${s % 60} sec`;
  };

  /* ---------- 7-segment digits for the LCD ---------- */
  const SEGS = {
    0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
    6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g', ' ': '',
  };
  function drawDigit(ctx, ch, x, y, w, h, t, on, off) {
    const r = {
      a: [x + t, y, w - 2 * t, t],
      b: [x + w - t, y + t, t, h / 2 - 1.5 * t],
      c: [x + w - t, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t],
      d: [x + t, y + h - t, w - 2 * t, t],
      e: [x, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t],
      f: [x, y + t, t, h / 2 - 1.5 * t],
      g: [x + t, y + h / 2 - t / 2, w - 2 * t, t],
    };
    const lit = SEGS[ch] || '';
    Object.entries(r).forEach(([k, rect]) => {
      ctx.fillStyle = lit.includes(k) ? on : off;
      ctx.fillRect(...rect);
    });
  }

  /* ---------- Player ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const win = document.querySelector('[data-window="player"]');
    if (!win) return;

    const $ = (sel) => win.querySelector(sel);
    const canvas = $('#pl-lcd');
    const lcd = canvas.getContext('2d');
    const seek = $('#pl-seek');
    const volume = $('#pl-volume');
    const balance = $('#pl-balance');
    const listEl = $('#pl-playlist');
    const fileInput = $('#pl-file');
    const live = $('#pl-live');
    const timeBtn = $('.pl-timebtn');
    const btn = (name) => $(`[data-pl="${name}"]`);
    const trayMusic = document.getElementById('tray-music');
    const stage = document.querySelector('.stage');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const LW = 480;   // LCD logical size, same 2.5:1 shape as the asset's display window
    const LH = 192;   // (the canvas is drawn at 2×)
    canvas.width = LW * 2;
    canvas.height = LH * 2;

    const tracks = SONGS.map((s) => ({ kind: 'synth', title: s.title, song: s, duration: s.duration }));
    let index = 0;
    let state = 'stopped';   // stopped | playing | paused
    let pos = 0;             // seconds, while not playing
    let shuffle = false;
    let repeat = false;
    let showRemaining = false;
    let dragging = false;

    // Audio graph (created on the first Play, as browsers require)
    let ctx = null;
    let synth = null;
    let master = null;
    let panner = null;
    let analyser = null;
    let freq = null;
    let bus = null;          // per-playback gain, so Stop can silence ringing notes
    let timer = 0;
    let startCtx = 0;
    let startPos = 0;
    let nextStep = 0;
    let audioEl = null;      // for files opened with Eject
    let mediaSrc = null;

    function ensureAudio() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      synth = new Synth(ctx);
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      freq = new Uint8Array(analyser.frequencyBinCount);
      comp.connect(master);
      master.connect(panner);
      panner.connect(analyser);
      analyser.connect(ctx.destination);
      master.input = comp;
      applyVolume();
      applyBalance();
    }

    function applyVolume() {
      const v = volume.value / 100;
      if (master) master.gain.value = v * v;
      volume.setAttribute('aria-valuetext', `${volume.value}%`);
    }

    function applyBalance() {
      const b = balance.value / 100;
      if (panner && panner.pan) panner.pan.value = b;
      balance.setAttribute('aria-valuetext', b === 0 ? 'Center' : `${Math.abs(balance.value)}% ${b < 0 ? 'left' : 'right'}`);
    }

    const cur = () => tracks[index];

    function position() {
      if (state !== 'playing') return pos;
      if (cur().kind === 'file') return audioEl.currentTime;
      return Math.max(startPos, startPos + (ctx.currentTime - startCtx));
    }

    function duration() {
      const tr = cur();
      return tr.kind === 'file' ? (audioEl && isFinite(audioEl.duration) ? audioEl.duration : 0) : tr.duration;
    }

    /* --- synth scheduling --- */
    function stepTime(song, step) {
      let t = startCtx + (step * song.step - startPos);
      if (song.swing && step % 2) t += song.step * song.swing;
      return t;
    }

    function pump() {
      const song = cur().song;
      while (nextStep < song.steps && stepTime(song, nextStep) < ctx.currentTime + 0.12) {
        renderStep(synth, bus, song, nextStep, Math.max(ctx.currentTime, stepTime(song, nextStep)));
        nextStep += 1;
      }
      if (position() >= song.duration) ended();
    }

    function startSynth(from) {
      bus = ctx.createGain();
      bus.connect(master.input);
      startCtx = ctx.currentTime + 0.06;
      startPos = from;
      nextStep = Math.ceil(from / cur().song.step - 1e-6);
      pump();
      timer = setInterval(pump, 25);
    }

    function silence() {
      clearInterval(timer);
      timer = 0;
      if (bus) {
        const b = bus;
        const t = ctx.currentTime;
        b.gain.setValueAtTime(b.gain.value, t);
        b.gain.linearRampToValueAtTime(0, t + 0.04);
        setTimeout(() => b.disconnect(), 120);
        bus = null;
      }
      if (audioEl && !audioEl.paused) audioEl.pause();
    }

    /* --- transport --- */
    function play() {
      ensureAudio();
      if (ctx.state === 'suspended') ctx.resume();
      if (state === 'playing') return;
      const from = pos >= duration() && duration() ? 0 : pos;
      if (cur().kind === 'file') {
        audioEl.currentTime = from;
        audioEl.play();
      } else {
        startSynth(from);
      }
      state = 'playing';
      announce(`Playing ${cur().title}`);
      sync();
    }

    function pause() {
      if (state === 'playing') {
        pos = position();
        silence();
        state = 'paused';
      } else if (state === 'paused') {
        play();
        return;
      }
      sync();
    }

    function stop() {
      if (state === 'playing') silence();
      state = 'stopped';
      pos = 0;
      sync();
    }

    function select(i, autoplay) {
      const wasPlaying = state === 'playing';
      if (state === 'playing') silence();
      index = (i + tracks.length) % tracks.length;
      pos = 0;
      state = 'stopped';
      marquee = 0;
      if (cur().kind === 'file') audioEl.src = cur().url;
      renderList();
      if (autoplay ?? wasPlaying) play();
      else sync();
    }

    function next() {
      if (shuffle && tracks.length > 1) {
        let i;
        do { i = Math.floor(Math.random() * tracks.length); } while (i === index);
        select(i);
      } else {
        select(index + 1);
      }
    }

    function prev() {
      if (position() > 3) {
        const playing = state === 'playing';
        if (playing) silence();
        state = 'stopped';
        pos = 0;
        if (playing) play(); else sync();
      } else {
        select(index - 1);
      }
    }

    // End of a track: REP replays it; otherwise go on (shuffled or in order),
    // and stop after the last track
    function ended() {
      silence();
      state = 'stopped';
      pos = 0;
      if (repeat) {
        play();
      } else if (shuffle && tracks.length > 1) {
        let i;
        do { i = Math.floor(Math.random() * tracks.length); } while (i === index);
        select(i, true);
      } else if (index < tracks.length - 1) {
        select(index + 1, true);
      } else {
        select(0, false);
      }
    }

    function seekTo(sec) {
      const d = duration();
      if (!d) return;
      const target = Math.min(Math.max(0, sec), d - 0.05);
      if (state === 'playing') {
        if (cur().kind === 'file') {
          audioEl.currentTime = target;
        } else {
          silence();
          startSynth(target);
        }
      } else {
        pos = target;
      }
      sync();
    }

    /* --- files from Eject --- */
    function openFile(file) {
      ensureAudio();
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.preload = 'metadata';
        mediaSrc = ctx.createMediaElementSource(audioEl);
        mediaSrc.connect(master.input);
        audioEl.addEventListener('ended', () => { if (cur().kind === 'file') ended(); });
        audioEl.addEventListener('loadedmetadata', () => {
          const tr = cur();
          if (tr.kind === 'file' && tr.size) tr.kbps = Math.round((tr.size * 8) / audioEl.duration / 1000);
          sync();
        });
      }
      const tr = { kind: 'file', title: file.name, url: URL.createObjectURL(file), size: file.size };
      tracks.push(tr);
      select(tracks.length - 1, true);
    }

    /* --- UI sync --- */
    function announce(text) { live.textContent = text; }

    function renderList() {
      listEl.textContent = '';
      tracks.forEach((tr, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = `${i + 1}. ${tr.title}`;
        if (i === index) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => select(i, true));
        li.append(b);
        listEl.append(li);
      });
    }

    function sync() {
      win.dataset.state = state;
      btn('play').classList.toggle('is-on', state === 'playing');
      btn('pause').classList.toggle('is-on', state === 'paused');
      btn('shuffle').setAttribute('aria-pressed', String(shuffle));
      btn('repeat').setAttribute('aria-pressed', String(repeat));
      if (trayMusic) trayMusic.hidden = state !== 'playing';
      updateSeek();
    }

    function updateSeek() {
      const d = duration();
      const p = position();
      if (!dragging) seek.value = d ? Math.round((p / d) * 1000) : 0;
      seek.setAttribute('aria-valuetext', `${spoken(p)} of ${spoken(d)}`);
    }

    /* --- LCD rendering --- */
    const GREEN = '#39FF5A';
    const DIM = '#0F3D1C';
    const GHOST = '#0A2414';
    const bars = new Array(16).fill(0);
    const peaks = new Array(16).fill(0);
    const hold = new Array(16).fill(0);
    let marquee = 0;
    let last = 0;

    function drawLCD(t) {
      const dt = Math.min(0.1, (t - (last || t)) / 1000);
      last = t;
      const c = lcd;
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.clearRect(0, 0, LW, LH); // the asset's dark glass shows through

      const d = duration();
      const p = position();

      // time (7-segment), click toggles remaining
      const shown = showRemaining ? Math.max(0, d - p) : p;
      const txt = fmt(shown);
      c.shadowColor = 'rgba(57,255,90,0.55)';
      let x = 16;
      if (showRemaining) {
        drawDigit(c, '-', x, 16, 14, 56, 5, GREEN, 'transparent');
        x += 18;
      } else {
        x += 18;
      }
      const blink = state === 'paused' && Math.floor(t / 500) % 2;
      for (const ch of txt) {
        if (ch === ':') {
          c.fillStyle = blink ? GHOST : GREEN;
          c.fillRect(x + 1, 30, 6, 6);
          c.fillRect(x + 1, 52, 6, 6);
          x += 12;
        } else {
          c.shadowBlur = blink ? 0 : 6;
          drawDigit(c, ch, x, 16, 30, 56, 6, blink ? GHOST : GREEN, GHOST);
          c.shadowBlur = 0;
          x += 38;
        }
      }

      // title marquee
      const tx = 214;
      const tw = LW - tx - 16;
      c.save();
      c.beginPath();
      c.rect(tx, 14, tw, 26);
      c.clip();
      c.font = '24px VT323, monospace';
      c.fillStyle = GREEN;
      c.shadowBlur = 5;
      const title = `${index + 1}. ${cur().title}`;
      const titleW = c.measureText(title).width;
      if (titleW > tw && state === 'playing' && !reduceMotion.matches) {
        marquee = (marquee + dt * 32) % (titleW + 40);
        c.fillText(title, tx - marquee, 34);
        c.fillText(title, tx - marquee + titleW + 40, 34);
      } else {
        c.fillText(title, tx, 34);
      }
      c.restore();
      c.shadowBlur = 0;

      // dithered progress strip
      const py = 46;
      const ph = 22;
      const done = d ? (p / d) * tw : 0;
      for (let yy = 0; yy < ph; yy += 2) {
        for (let xx = 0; xx < tw; xx += 2) {
          if (((xx + yy) / 2) % 2) continue;
          c.fillStyle = xx < done ? '#2BD94B' : DIM;
          c.fillRect(tx + xx, py + yy, 2, 2);
        }
      }

      // dashed separator
      c.fillStyle = DIM;
      for (let xx = 16; xx < LW - 16; xx += 14) c.fillRect(xx, 86, 8, 2);

      // equalizer
      let levels = null;
      if (analyser && state === 'playing') {
        analyser.getByteFrequencyData(freq);
        levels = [];
        for (let i = 0; i < 16; i++) {
          const a = Math.floor(Math.pow(i / 16, 1.6) * 90) + 1;
          const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / 16, 1.6) * 90) + 1);
          let sum = 0;
          for (let k = a; k < b; k++) sum += freq[k];
          levels.push(sum / (b - a) / 255);
        }
      }
      const ex = 16;
      const ew = LW - 32;
      const gap = 6;
      const bw = (ew - gap * 15) / 16;
      const top = 96;
      const eh = 68;
      for (let i = 0; i < 16; i++) {
        const target = levels ? Math.min(1, Math.pow(levels[i], 0.7) * 1.5) : 0;
        bars[i] = target > bars[i] ? target : Math.max(0, bars[i] - dt * 1.6);
        if (bars[i] >= peaks[i]) { peaks[i] = bars[i]; hold[i] = 0.5; } else if ((hold[i] -= dt) < 0) peaks[i] = Math.max(0, peaks[i] - dt * 0.6);
        const bx = ex + i * (bw + gap);
        // unlit segments
        for (let sy = 0; sy < eh; sy += 4) {
          c.fillStyle = GHOST;
          c.fillRect(bx, top + sy, bw, 3);
        }
        const hpx = Math.round((bars[i] * eh) / 4) * 4;
        c.fillStyle = GREEN;
        c.shadowBlur = 6;
        for (let sy = 0; sy < hpx; sy += 4) c.fillRect(bx, top + eh - sy - 3, bw, 3);
        const pk = Math.round((peaks[i] * eh) / 4) * 4;
        if (pk > 0) {
          c.fillStyle = '#7DFF94';
          c.fillRect(bx, top + eh - pk - 7, bw, 2);
        }
        c.shadowBlur = 0;
      }

      // info line
      c.font = '10px "Press Start 2P", monospace';
      c.fillStyle = GREEN;
      c.shadowBlur = 4;
      c.fillText('STEREO', 16, 184);
      const kbps = cur().kind === 'file' ? (cur().kbps ? `${cur().kbps} KBPS` : '--- KBPS') : '128 KBPS';
      c.fillText(kbps, 150, 184);
      const khz = `${Math.round((ctx ? ctx.sampleRate : 44100) / 1000)} KHZ`;
      c.textAlign = 'right';
      c.fillText(khz, LW - 16, 184);
      c.textAlign = 'left';
      c.shadowBlur = 0;
    }

    let raf = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      drawLCD(t);
      if (state === 'playing') updateSeek();
    }
    const startLoop = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
    new MutationObserver(() => (win.hidden ? stopLoop() : startLoop()))
      .observe(win, { attributes: true, attributeFilter: ['hidden'] });

    /* --- events --- */
    btn('play').addEventListener('click', play);
    btn('pause').addEventListener('click', pause);
    btn('stop').addEventListener('click', stop);
    btn('next').addEventListener('click', next);
    btn('prev').addEventListener('click', prev);
    btn('eject').addEventListener('click', () => fileInput.click());
    btn('shuffle').addEventListener('click', () => { shuffle = !shuffle; sync(); });
    btn('repeat').addEventListener('click', () => { repeat = !repeat; sync(); });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) openFile(fileInput.files[0]);
      fileInput.value = '';
    });

    timeBtn.addEventListener('click', () => {
      showRemaining = !showRemaining;
      timeBtn.setAttribute('aria-label', showRemaining ? 'Show elapsed time' : 'Show remaining time');
    });

    seek.addEventListener('pointerdown', () => { dragging = true; });
    seek.addEventListener('input', () => {
      if (state !== 'playing') pos = (seek.value / 1000) * duration();
    });
    seek.addEventListener('change', () => {
      dragging = false;
      seekTo((seek.value / 1000) * duration());
    });
    volume.addEventListener('input', applyVolume);
    balance.addEventListener('input', applyBalance);
    balance.addEventListener('dblclick', () => { balance.value = 0; applyBalance(); });

    // Space / arrow shortcuts while the player has focus (sliders keep their own arrows)
    win.addEventListener('keydown', (e) => {
      if (e.target.matches('input, button') && e.key !== 'Escape') return;
      if (e.key === ' ') { e.preventDefault(); if (state === 'playing') pause(); else play(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(position() + 5); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(position() - 5); }
    });

    // Closing the window (×) stops the music; just leaving it keeps it playing
    document.addEventListener('portfolio:close', (e) => {
      if (e.detail && e.detail.view === 'player') stop();
    });

    // Monitor switched off: stop
    new MutationObserver(() => { if (stage.dataset.power !== 'on' && state === 'playing') pause(); })
      .observe(stage, { attributes: true, attributeFilter: ['data-power'] });

    /* --- resizing (desktop layout only): the player keeps the asset's shape --- */
    const RATIO = 584 / 982;        // body.png height / width
    const DEFAULT_W = 760;
    const MIN_W = 420;
    const SIZE_KEY = 'portfolio95-player-width';
    const area = win.parentElement; // the desktop area the window is centred in
    const grip = $('.pl-grip');
    const sizeBtn = btn('size');
    const desktopLayout = window.matchMedia('(min-width: 1000px) and (min-height: 601px)');
    let preferred = DEFAULT_W;      // the width the viewer chose
    let width = DEFAULT_W;          // the width shown (preferred, clamped to the desktop)
    let restoreW = DEFAULT_W;
    try { preferred = Number(localStorage.getItem(SIZE_KEY)) || DEFAULT_W; } catch (err) { /* no storage */ }

    function maxWidth() {
      const cs = getComputedStyle(area);
      const w = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      return Math.max(MIN_W, Math.floor(Math.min(w, h / RATIO)));
    }

    function setWidth(w, save) {
      const max = maxWidth();
      width = Math.round(Math.min(Math.max(w, MIN_W), max));
      win.style.width = `${width}px`;
      sizeBtn.setAttribute('aria-label', width >= max - 1 ? 'Restore player size' : 'Maximize player');
      if (save) {
        preferred = width;
        try { localStorage.setItem(SIZE_KEY, String(width)); } catch (err) { /* no storage */ }
      }
    }

    function toggleSize() {
      if (width >= maxWidth() - 1) {
        setWidth(restoreW, true);
      } else {
        restoreW = width;
        setWidth(maxWidth(), true);
      }
    }

    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (!desktopLayout.matches) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      // the screen may be scaled (see .screen), so convert pointer moves to layout px
      const scale = win.getBoundingClientRect().width / win.offsetWidth || 1;
      drag = { x: e.clientX, y: e.clientY, w: width, scale };
      win.classList.add('is-resizing');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) / drag.scale;
      const dy = (e.clientY - drag.y) / drag.scale;
      // the window stays centred, so its corner moves half as far as its size changes
      setWidth(drag.w + dx + dy / RATIO, false);
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      win.classList.remove('is-resizing');
      setWidth(width, true);
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);

    grip.addEventListener('keydown', (e) => {
      const steps = { ArrowRight: 20, ArrowUp: 20, ArrowLeft: -20, ArrowDown: -20 };
      if (e.key in steps) setWidth(width + steps[e.key], true);
      else if (e.key === 'Home') setWidth(MIN_W, true);
      else if (e.key === 'End') setWidth(maxWidth(), true);
      else return;
      e.preventDefault();
    });

    sizeBtn.addEventListener('click', toggleSize);
    $('.pl-titlebar').addEventListener('dblclick', (e) => {
      if (!e.target.closest('button') && desktopLayout.matches) toggleSize();
    });

    // Keep the chosen size when the browser window changes, as far as it fits
    new ResizeObserver(() => setWidth(preferred, false)).observe(area);

    applyVolume();
    applyBalance();
    renderList();
    sync();
    if (document.fonts) {
      Promise.all([document.fonts.load('24px VT323'), document.fonts.load('10px "Press Start 2P"')])
        .then(() => drawLCD(performance.now()));
    }
    drawLCD(performance.now());
    if (!win.hidden) startLoop();
  });
})();
