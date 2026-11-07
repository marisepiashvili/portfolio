/* =========================================================
   minesweeper.exe — classic mine-clearing game for Portfolio 95.
   Tiles, faces and the face button are sprites cut from the asset sheets
   (assets/minesweeper); the red counters are drawn as 7-segment LEDs.
   ========================================================= */
(() => {
  const LEVELS = {
    beginner: { cols: 9, rows: 9, mines: 10, label: 'Beginner' },
    intermediate: { cols: 16, rows: 16, mines: 40, label: 'Intermediate' },
    expert: { cols: 30, rows: 16, mines: 99, label: 'Expert' },
  };
  const BEST_KEY = 'portfolio95-mines-best';
  const LOSE_QUIPS = [
    "Boom! Let's pretend that didn't happen.",
    'Plot twist: it was a mine.',
    'Minesweeper 1, you 0.',
    'That tile looked so innocent.',
  ];
  const WIN_QUIPS = [
    'Mine-blowing!',
    'Flawless. The mines never stood a chance.',
    'Not a single boom. Impressive.',
  ];
  const quip = (list) => list[Math.floor(Math.random() * list.length)];

  /* ---------- Sound effects (the shared engine is js/sfx.js) ---------- */
  const { note, noise, seq } = window.RetroSFX;
  const sfx = {
    open: () => note(880, 0.03, { vol: 0.04 }),
    // a bigger cleared area plays a longer rising run
    cascade: (n) => seq([523, 659, 784, 1047, 1319].slice(0, Math.min(5, 2 + Math.floor(n / 10))), 0.035, { type: 'triangle', vol: 0.07 }),
    flag: () => { note(660, 0.04, { type: 'triangle', vol: 0.08 }); note(990, 0.05, { at: 0.04, type: 'triangle', vol: 0.08 }); },
    question: () => note(740, 0.05, { type: 'triangle', vol: 0.07 }),
    unflag: () => note(520, 0.06, { type: 'triangle', vol: 0.07, slide: 0.75 }),
    boom: () => {
      noise(0.7, { vol: 0.4, freq: 900 });
      note(140, 0.55, { type: 'sine', vol: 0.3, slide: 0.3 });
      note(90, 0.4, { at: 0.05, type: 'square', vol: 0.05, slide: 0.5 });
    },
    win: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 0.08, { type: 'triangle', vol: 0.1 }),
    record: () => seq([1047, 1319, 1568, 2093], 0.07, { vol: 0.05, at: 0.7 }),
    newGame: () => { note(392, 0.04, { vol: 0.05 }); note(523, 0.05, { at: 0.05, vol: 0.05 }); },
  };
  const LONG_PRESS = 450; // ms, flags a tile on touch screens

  /* ---------- Red 7-segment counters ---------- */
  const SEGS = {
    0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
    6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g',
  };
  function drawLED(canvas, value) {
    const ctx = canvas.getContext('2d');
    const W = 78;
    const H = 46;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const v = Math.max(-99, Math.min(999, value));
    const text = v < 0 ? `-${String(-v).padStart(2, '0')}` : String(v).padStart(3, '0');
    [...text].forEach((ch, i) => {
      const x = 4 + i * 25;
      const y = 4;
      const w = 20;
      const h = 38;
      const t = 4;
      const r = {
        a: [x + t, y, w - 2 * t, t],
        b: [x + w - t, y + t, t, h / 2 - 1.5 * t],
        c: [x + w - t, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t],
        d: [x + t, y + h - t, w - 2 * t, t],
        e: [x, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t],
        f: [x, y + t, t, h / 2 - 1.5 * t],
        g: [x + t, y + h / 2 - t / 2, w - 2 * t, t],
      };
      Object.entries(r).forEach(([k, rect]) => {
        ctx.fillStyle = (SEGS[ch] || '').includes(k) ? '#FF1A1A' : '#3A0000';
        ctx.fillRect(...rect);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const win = document.querySelector('[data-window="mines"]');
    if (!win) return;

    const boardEl = win.querySelector('#ms-board');
    const faceBtn = win.querySelector('#ms-face');
    const faceImg = faceBtn.querySelector('img');
    const minesLED = win.querySelector('#ms-mines');
    const timeLED = win.querySelector('#ms-time');
    const statusEl = win.querySelector('#ms-status');
    const liveEl = win.querySelector('#ms-live');
    const flagModeBtn = win.querySelector('#ms-flagmode');
    const levelBtns = [...win.querySelectorAll('[data-level]')];
    const fullLayout = window.matchMedia('(min-width: 1000px) and (min-height: 601px)');

    let level = 'beginner';
    let L = LEVELS[level];
    let cells = [];          // { mine, n, s: 'hidden' | 'flag' | 'question' | 'open', btn }
    let state = 'ready';     // ready | playing | won | lost
    let flags = 0;
    let opened = 0;
    let seconds = 0;
    let timer = 0;
    let focusIdx = 0;
    let flagMode = false;
    let best = {};
    try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (err) { best = {}; }

    const idx = (x, y) => y * L.cols + x;
    const xy = (i) => [i % L.cols, Math.floor(i / L.cols)];
    function neighbours(i) {
      const [x, y] = xy(i);
      const out = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < L.cols && ny < L.rows) out.push(idx(nx, ny));
        }
      }
      return out;
    }

    function setFace(name) { faceImg.src = `assets/minesweeper/face-${name}.png`; }

    function label(i) {
      const c = cells[i];
      const [x, y] = xy(i);
      let what = 'hidden';
      if (c.s === 'flag') what = 'flagged';
      else if (c.s === 'question') what = 'marked with a question mark';
      else if (c.s === 'open') what = c.mine ? 'mine' : (c.n ? `${c.n} mine${c.n > 1 ? 's' : ''} around` : 'empty');
      return `Row ${y + 1}, column ${x + 1}: ${what}`;
    }

    function paint(i, look) {
      const c = cells[i];
      c.btn.dataset.s = look || (c.s === 'open' ? (c.mine ? 'mine' : `n${c.n}`) : c.s);
      c.btn.setAttribute('aria-label', label(i));
    }

    function updateCounters() {
      drawLED(minesLED, L.mines - flags);
      drawLED(timeLED, seconds);
      minesLED.parentElement.querySelector('.sr-only').textContent = `${L.mines - flags} mines left`;
    }

    function updateStatus() {
      const b = best[level];
      statusEl.textContent = `${L.label} · ${L.cols}×${L.rows}, ${L.mines} mines · Best: ${b ? `${b} s` : '—'}`;
    }

    function tileSize() {
      if (fullLayout.matches) return 24;
      const avail = Math.min(window.innerWidth, 520) - 48;
      return Math.max(20, Math.min(36, Math.floor(avail / L.cols)));
    }

    /* --- build a new game --- */
    function newGame(lv, withSound) {
      if (lv) level = lv;
      if (withSound) sfx.newGame();
      L = LEVELS[level];
      clearInterval(timer);
      timer = 0;
      state = 'ready';
      flags = 0;
      opened = 0;
      seconds = 0;
      focusIdx = 0;
      liveEl.textContent = '';
      setFace('smile');
      levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));

      boardEl.textContent = '';
      boardEl.style.setProperty('--cols', L.cols);
      boardEl.style.setProperty('--t', `${tileSize()}px`);
      cells = [];
      const frag = document.createDocumentFragment();
      for (let i = 0; i < L.cols * L.rows; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ms-cell';
        btn.dataset.i = i;
        btn.tabIndex = i === 0 ? 0 : -1;
        cells.push({ mine: false, n: 0, s: 'hidden', btn });
        frag.append(btn);
      }
      boardEl.append(frag);
      cells.forEach((c, i) => paint(i));
      updateCounters();
      updateStatus();
    }

    // Mines are placed on the first reveal, never on or next to that tile
    function plant(safe) {
      const banned = new Set([safe, ...neighbours(safe)]);
      const spots = cells.map((c, i) => i).filter((i) => !banned.has(i));
      for (let k = 0; k < L.mines; k++) {
        const j = k + Math.floor(Math.random() * (spots.length - k));
        [spots[k], spots[j]] = [spots[j], spots[k]];
        cells[spots[k]].mine = true;
      }
      cells.forEach((c, i) => { c.n = neighbours(i).filter((j) => cells[j].mine).length; });
    }

    function startClock() {
      state = 'playing';
      timer = setInterval(() => {
        if (seconds < 999) seconds += 1;
        drawLED(timeLED, seconds);
      }, 1000);
    }

    /* --- moves --- */
    // returns how many tiles it opened; `quiet` lets a chord play one sound for all
    function reveal(i, quiet) {
      if (state === 'won' || state === 'lost') return 0;
      const c = cells[i];
      if (c.s === 'flag' || c.s === 'open') return 0;
      const before = opened;
      if (state === 'ready') {
        plant(i);
        startClock();
      }
      if (c.mine) {
        lose(i);
        return 0;
      }
      // flood-open empty areas
      const stack = [i];
      while (stack.length) {
        const j = stack.pop();
        const d = cells[j];
        if (d.s === 'open' || d.s === 'flag') continue;
        d.s = 'open';
        opened += 1;
        paint(j);
        if (d.n === 0) neighbours(j).forEach((k) => { if (cells[k].s !== 'open') stack.push(k); });
      }
      const count = opened - before;
      if (opened === cells.length - L.mines) win_();
      else if (!quiet) moveSound(count);
      return count;
    }

    function moveSound(count) {
      if (count > 1) sfx.cascade(count);
      else if (count === 1) sfx.open();
    }

    // Clicking an opened number whose flags are all placed opens the rest around it
    function chord(i) {
      const c = cells[i];
      if (c.s !== 'open' || !c.n) return;
      const around = neighbours(i);
      if (around.filter((j) => cells[j].s === 'flag').length !== c.n) return;
      let count = 0;
      around.forEach((j) => { if (cells[j].s === 'hidden' || cells[j].s === 'question') count += reveal(j, true); });
      if (state === 'playing') moveSound(count);
    }

    function toggleFlag(i) {
      if (state === 'won' || state === 'lost') return;
      const c = cells[i];
      if (c.s === 'open') return;
      if (c.s === 'hidden') { c.s = 'flag'; flags += 1; sfx.flag(); }
      else if (c.s === 'flag') { c.s = 'question'; flags -= 1; sfx.question(); }
      else { c.s = 'hidden'; sfx.unflag(); }
      paint(i);
      updateCounters();
    }

    function act(i, flag) {
      const c = cells[i];
      if (flag) toggleFlag(i);
      else if (c.s === 'open') chord(i);
      else reveal(i);
    }

    function lose(hit) {
      state = 'lost';
      clearInterval(timer);
      setFace('dead');
      sfx.boom();
      cells.forEach((c, i) => {
        if (c.mine && c.s !== 'flag') paint(i, i === hit ? 'mine-hit' : 'mine');
        else if (!c.mine && c.s === 'flag') paint(i, 'mine-wrong');
      });
      statusEl.textContent = `${quip(LOSE_QUIPS)} Click the face to try again.`;
      liveEl.textContent = 'You hit a mine. ' + statusEl.textContent;
    }

    function win_() {
      state = 'won';
      clearInterval(timer);
      setFace('cool');
      sfx.win();
      cells.forEach((c, i) => {
        if (c.mine && c.s !== 'flag') { c.s = 'flag'; paint(i); }
      });
      flags = L.mines;
      updateCounters();
      const record = !best[level] || seconds < best[level];
      if (record) {
        sfx.record();
        best[level] = seconds;
        try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (err) { /* no storage */ }
      }
      statusEl.textContent = `${quip(WIN_QUIPS)} ${seconds} s${record ? ' (new best!)' : ''}`;
      liveEl.textContent = `You cleared the field in ${seconds} seconds. ${statusEl.textContent}`;
    }

    /* --- input --- */
    let pressTimer = 0;
    let longPressed = false;

    boardEl.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.ms-cell');
      if (!btn || state === 'won' || state === 'lost') return;
      if (e.button === 0) setFace('oh');
      longPressed = false;
      if (e.pointerType !== 'mouse') {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          longPressed = true;
          toggleFlag(+btn.dataset.i);
          if (navigator.vibrate) navigator.vibrate(15);
          setFace('smile');
        }, LONG_PRESS);
      }
    });
    const release = () => {
      clearTimeout(pressTimer);
      if (state === 'ready' || state === 'playing') setFace('smile');
    };
    boardEl.addEventListener('pointerup', release);
    boardEl.addEventListener('pointercancel', release);
    boardEl.addEventListener('pointerleave', release);

    boardEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.ms-cell');
      if (!btn) return;
      if (longPressed) { longPressed = false; return; } // the long press already flagged it
      focusTo(+btn.dataset.i, false);
      act(+btn.dataset.i, flagMode);
    });

    boardEl.addEventListener('contextmenu', (e) => {
      const btn = e.target.closest('.ms-cell');
      if (!btn) return;
      e.preventDefault();
      if (!longPressed) toggleFlag(+btn.dataset.i);
    });

    // Keyboard: arrows move, Enter/Space open, F flags
    function focusTo(i, move = true) {
      cells[focusIdx].btn.tabIndex = -1;
      focusIdx = i;
      cells[i].btn.tabIndex = 0;
      if (move) cells[i].btn.focus();
    }
    boardEl.addEventListener('keydown', (e) => {
      const btn = e.target.closest('.ms-cell');
      if (!btn) return;
      const i = +btn.dataset.i;
      const [x, y] = xy(i);
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        const nx = Math.max(0, Math.min(L.cols - 1, x + moves[e.key][0]));
        const ny = Math.max(0, Math.min(L.rows - 1, y + moves[e.key][1]));
        focusTo(idx(nx, ny));
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFlag(i);
      }
    });

    faceBtn.addEventListener('click', () => newGame(null, true));
    levelBtns.forEach((b) => b.addEventListener('click', () => newGame(b.dataset.level, true)));

    // Sound on/off: shared with the other games; M toggles it while this window has focus
    const soundBtn = win.querySelector('#ms-sound');
    const syncSound = () => { soundBtn.textContent = window.RetroSFX.on ? 'Sound: On' : 'Sound: Off'; };
    const toggleSound = () => {
      window.RetroSFX.on = !window.RetroSFX.on;
      if (window.RetroSFX.on) sfx.flag();
    };
    soundBtn.addEventListener('click', toggleSound);
    win.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleSound();
      }
    });
    document.addEventListener('retrosfx:change', syncSound);
    syncSound();
    flagModeBtn.addEventListener('click', () => {
      flagMode = !flagMode;
      flagModeBtn.setAttribute('aria-pressed', String(flagMode));
    });

    // The clock pauses while the window is hidden
    new MutationObserver(() => {
      if (win.hidden) {
        clearInterval(timer);
        timer = 0;
      } else if (state === 'playing' && !timer) {
        startClock();
      }
    }).observe(win, { attributes: true, attributeFilter: ['hidden'] });

    // Re-fit tiles when switching between the desktop and phone layouts
    fullLayout.addEventListener('change', () => boardEl.style.setProperty('--t', `${tileSize()}px`));

    newGame();
  });
})();
