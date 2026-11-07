/* =========================================================
   snake.exe — classic Snake for Portfolio 95
   Sprites are pixel art drawn in code, after the asset sheet:
   one art pixel = 2 canvas px, one cell = 12×12 art pixels.
   ========================================================= */
(() => {
  const PX = 2;
  const N = 12;              // art pixels per cell side
  const CELL = N * PX;       // 24 canvas px
  const COLS = 24;           // board incl. the brick border
  const ROWS = 15;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const BEST_KEY = 'portfolio95-snake-best';

  // Speed: milliseconds per step (bigger = slower). The snake speeds up by
  // SPEED_STEP after every apple until it reaches SPEED_FASTEST.
  const SPEED_START = 220;
  const SPEED_FASTEST = 120;
  const SPEED_STEP = 3;

  // Palette taken from the asset sheet
  const C = {
    k: '#0E0B12',                                   // outline
    g: '#4FC23A', G: '#7EE04A', d: '#2E8B3A',       // snake / leaf greens
    r: '#E5262E', R: '#A8141F', h: '#FF8A7A', w: '#FFE3DA', s: '#6B4423', // fruit
    y: '#FFD23F', Y: '#FFF1A0', o: '#F09A1A',       // star / trophy gold
    e: '#FFFFFF', t: '#E5262E',                     // eyes, tongue
    brick: '#7B2233', brickHi: '#9A3143', brickLo: '#5A1626', mortar: '#2B0F18',
    bg: '#1B1828', bg2: '#201D2F',
  };

  const SPRITES = {
    apple: [
      '......s.kkk.',
      '......skgggk',
      '..kkk.skkkk.',
      '.krrrkskrrk.',
      'krhhrrrrrrrk',
      'krhwrrrrrrRk',
      'krhrrrrrrrRk',
      'krrrrrrrrrRk',
      'krrrrrrrrRRk',
      '.krrrrrrRRk.',
      '..kRRkkRRk..',
      '...kk..kk...',
    ],
    cherry: [
      '......Ggg...',
      '......g.....',
      '.....g.g....',
      '....g...g...',
      '...g.....g..',
      '..kkk...kkk.',
      '.krhrk.krhrk',
      '.khwrk.khwrk',
      '.krrRk.krrRk',
      '.kRRRk.kRRRk',
      '..kkk...kkk.',
      '............',
    ],
    star: [
      '.....kk.....',
      '....kYyk....',
      '....kYyk....',
      'kkkkkYyykkkk',
      'kYYYYyyyyyok',
      '.kyyyyyyyok.',
      '..kyyyyyok..',
      '..kyyyyyyk..',
      '.kyyyokyyyk.',
      '.kyok..kyok.',
      'kkk......kkk',
      '............',
    ],
    trophy: [
      '..kkkkkkkk..',
      'kkkYyyyyokkk',
      'kykYyyyyokyk',
      'kykYyyyyokyk',
      '.kkkyyyyokk.',
      '...kyyyyok..',
      '....kyyok...',
      '.....kok....',
      '.....kok....',
      '....kyyok...',
      '...kYyyyok..',
      '...kkkkkkk..',
    ],
  };

  const FOOD = {
    apple: { points: 10 },
    cherry: { points: 30 },
    star: { points: 50 },
  };

  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  // A random comment under GAME OVER
  const QUIPS = [
    'The snake has left the chat.',
    'That wall came out of nowhere.',
    'Nom nom nom... CRASH.',
    'Have you tried turning it off and on again?',
    'snake.exe has stopped working.',
    'So close. Probably.',
  ];
  const RECORD_QUIP = 'New record! The snake is proud of you.';

  /* ---------- Sound effects (the shared engine is js/sfx.js) ---------- */
  const { note, noise, seq } = window.RetroSFX;
  const sfx = {
    start: () => seq([523, 659, 784, 1047], 0.07, { vol: 0.06 }),
    eat: () => { note(587, 0.05, { slide: 1.6 }); note(988, 0.06, { at: 0.045, vol: 0.05 }); },
    bonus: () => seq([784, 988, 1175, 1568, 1976], 0.045, { type: 'triangle', vol: 0.11 }),
    appear: () => { note(1568, 0.05, { type: 'triangle', vol: 0.06 }); note(2093, 0.07, { at: 0.06, type: 'triangle', vol: 0.06 }); },
    wall: () => { note(140, 0.14, { type: 'triangle', vol: 0.14, slide: 0.5 }); noise(0.08, { vol: 0.08 }); },
    pause: () => { note(660, 0.06); note(440, 0.08, { at: 0.07 }); },
    resume: () => { note(440, 0.06); note(660, 0.08, { at: 0.07 }); },
    over: () => {
      noise(0.18, { vol: 0.16 });
      seq([392, 330, 262], 0.13, { at: 0.08, vol: 0.07 });
      note(196, 0.45, { at: 0.47, vol: 0.07, slide: 0.7 });
    },
    best: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 0.08, { type: 'triangle', vol: 0.1 }),
  };

  /* ---------- Drawing helpers ---------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function drawSprite(ctx, map, x = 0, y = 0, px = PX) {
    map.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        ctx.fillStyle = C[ch];
        ctx.fillRect(x + i * px, y + j * px, px, px);
      });
    });
  }

  // Map a point in "facing right" local coords to the cell for a direction
  function rot(dir) {
    switch (dir) {
      case 'left': return (x, y) => [N - 1 - x, N - 1 - y];
      case 'down': return (x, y) => [N - 1 - y, x];
      case 'up': return (x, y) => [y, N - 1 - x];
      default: return (x, y) => [x, y];
    }
  }

  // Shade a 12×12 mask: outline, light top/left edge, dark bottom/right edge.
  // Edges listed in `open` continue into the neighbouring cell (no outline there).
  function paintMask(ctx, mask, open) {
    const inside = (x, y) => {
      if (x < 0) return open.left ? 1 : 0;
      if (x >= N) return open.right ? 1 : 0;
      if (y < 0) return open.up ? 1 : 0;
      if (y >= N) return open.down ? 1 : 0;
      return mask[y * N + x];
    };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!mask[y * N + x]) continue;
        let col = C.g;
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = C.k;
        else if (!inside(x, y - 2) || !inside(x - 2, y)) col = C.G;
        else if (!inside(x, y + 2) || !inside(x + 2, y) || !inside(x, y + 3) || !inside(x + 3, y)) col = C.d;
        ctx.fillStyle = col;
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
  }

  function bodyMask(open) {
    const m = new Uint8Array(N * N);
    const fill = (x0, x1, y0, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * N + x] = 1;
    };
    fill(2, 9, 2, 9);
    if (open.up) fill(2, 9, 0, 1);
    if (open.down) fill(2, 9, 10, 11);
    if (open.left) fill(0, 1, 2, 9);
    if (open.right) fill(10, 11, 2, 9);
    // round the outer corners
    const cut = (pts) => pts.forEach(([x, y]) => { m[y * N + x] = 0; });
    if (!open.up && !open.left) cut([[2, 2], [3, 2], [2, 3]]);
    if (!open.up && !open.right) cut([[9, 2], [8, 2], [9, 3]]);
    if (!open.down && !open.left) cut([[2, 9], [3, 9], [2, 8]]);
    if (!open.down && !open.right) cut([[9, 9], [8, 9], [9, 8]]);
    return m;
  }

  // Build a mask from per-column row ranges in local coords, rotated to `dir`
  function shapeMask(ranges, dir) {
    const m = new Uint8Array(N * N);
    const to = rot(dir);
    ranges.forEach(([y0, y1], x) => {
      for (let y = y0; y <= y1; y++) {
        const [gx, gy] = to(x, y);
        m[gy * N + gx] = 1;
      }
    });
    return m;
  }

  // Head facing +x: neck at x = 0, rounded snout at x = 11
  const HEAD = [[2, 9], [2, 9], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [2, 9], [3, 8], [4, 7]];
  // Tail pointing toward the body at +x, tip at x = 0
  const TAIL = [[5, 6], [5, 6], [4, 7], [4, 7], [3, 8], [3, 8], [3, 8], [2, 9], [2, 9], [2, 9], [2, 9], [2, 9]];

  const tiles = new Map();
  function tile(key, paint) {
    let c = tiles.get(key);
    if (!c) {
      c = makeCanvas(CELL, CELL);
      paint(c.getContext('2d'));
      tiles.set(key, c);
    }
    return c;
  }

  const bodyTile = (open) => tile(`b${+!!open.up}${+!!open.down}${+!!open.left}${+!!open.right}`,
    (ctx) => paintMask(ctx, bodyMask(open), open));

  const tailTile = (dir) => tile(`t-${dir}`, (ctx) => paintMask(ctx, shapeMask(TAIL, dir), { [dir]: true }));

  const headTile = (dir, dead) => tile(`h-${dir}-${dead ? 1 : 0}`, (ctx) => {
    const neck = OPP[dir];
    paintMask(ctx, shapeMask(HEAD, dir), { [neck]: true });
    const to = rot(dir);
    const dot = (x, y, col) => {
      const [gx, gy] = to(x, y);
      ctx.fillStyle = col;
      ctx.fillRect(gx * PX, gy * PX, PX, PX);
    };
    if (dead) {
      [[7, 3], [8, 3], [7, 8], [8, 8]].forEach(([x, y]) => dot(x, y, C.k));
    } else {
      [[7, 2], [8, 2], [7, 3], [8, 3], [7, 8], [8, 8], [7, 9], [8, 9]].forEach(([x, y]) => dot(x, y, C.e));
      dot(8, 3, C.k);
      dot(8, 8, C.k);
    }
  });

  const spriteTile = (name) => tile(`s-${name}`, (ctx) => drawSprite(ctx, SPRITES[name]));

  function dirBetween(a, b) {
    if (b.x > a.x) return 'right';
    if (b.x < a.x) return 'left';
    if (b.y > a.y) return 'down';
    return 'up';
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const win = document.querySelector('[data-window="snake"]');
    if (!win) return;

    const canvas = document.getElementById('snake-canvas');
    const ctx = canvas.getContext('2d');
    const board = win.querySelector('.snake-board');
    const scoreEl = document.getElementById('snake-score');
    const bestEl = document.getElementById('snake-best');
    const finalEl = document.getElementById('snake-final');
    const quipEl = document.getElementById('snake-quip');
    const liveEl = document.getElementById('snake-live');
    const pauseBtn = document.getElementById('snake-pause');
    const soundBtn = document.getElementById('snake-sound');

    function syncSound() {
      soundBtn.textContent = window.RetroSFX.on ? 'Sound: On' : 'Sound: Off';
    }
    function toggleSound() {
      window.RetroSFX.on = !window.RetroSFX.on; // shared by all games
      if (window.RetroSFX.on) sfx.eat(); // a little blip so you hear it is back
    }
    document.addEventListener('retrosfx:change', syncSound);
    syncSound();
    const stage = document.querySelector('.stage');
    const bsod = document.getElementById('bsod');
    const startMenu = document.getElementById('start-menu');

    canvas.width = W;
    canvas.height = H;

    // HUD icons
    win.querySelectorAll('canvas[data-sprite]').forEach((c) => {
      c.width = CELL;
      c.height = CELL;
      drawSprite(c.getContext('2d'), SPRITES[c.dataset.sprite]);
    });

    // Bricks: one full-board layer, so the running bond lines up everywhere
    const bricks = makeCanvas(W, H);
    (() => {
      const b = bricks.getContext('2d');
      for (let gy = 0; gy < ROWS * N; gy++) {
        const off = (Math.floor(gy / 4) % 2) * 4;
        for (let gx = 0; gx < COLS * N; gx++) {
          const yy = gy % 4;
          const xx = (gx + off) % 8;
          let col = C.brick;
          if (yy === 3 || xx === 7) col = C.mortar;
          else if (yy === 0) col = C.brickHi;
          else if (xx === 6) col = C.brickLo;
          b.fillStyle = col;
          b.fillRect(gx * PX, gy * PX, PX, PX);
        }
      }
    })();

    // Static layer: checkered floor + brick border
    const floor = makeCanvas(W, H);
    (() => {
      const f = floor.getContext('2d');
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
          if (border) {
            f.drawImage(bricks, x * CELL, y * CELL, CELL, CELL, x * CELL, y * CELL, CELL, CELL);
          } else {
            f.fillStyle = (x + y) % 2 ? C.bg2 : C.bg;
            f.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
      }
    })();

    /* ---------- Game state ---------- */
    let snake = [];
    let dir = 'right';
    let queue = [];
    let food = null;
    let bonus = null;      // { x, y, type, ttl }
    let walls = new Set(); // inner brick obstacles, as cell keys
    let score = 0;
    let eaten = 0;
    let tickMs = SPEED_START;
    let state = 'ready';   // ready | playing | paused | over
    let acc = 0;
    let last = 0;
    let raf = 0;
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (err) { best = 0; }

    const cellKey = (x, y) => y * COLS + x;
    const isBorder = (x, y) => x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1;
    const onSnake = (x, y) => snake.some((s) => s.x === x && s.y === y);

    function freeCell(minDist = 0) {
      const head = snake[0];
      const ok = (x, y) => !isBorder(x, y) && !walls.has(cellKey(x, y)) && !onSnake(x, y)
        && !(food && food.x === x && food.y === y)
        && !(bonus && bonus.x === x && bonus.y === y)
        && (!head || Math.abs(head.x - x) + Math.abs(head.y - y) >= minDist);
      for (let i = 0; i < 400; i++) {
        const x = 1 + Math.floor(Math.random() * (COLS - 2));
        const y = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (ok(x, y)) return { x, y };
      }
      for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (ok(x, y)) return { x, y };
      return null;
    }

    function fmt(n) { return String(n).padStart(4, '0'); }

    function updateHud() {
      scoreEl.textContent = fmt(score);
      bestEl.textContent = fmt(best);
    }

    function setState(s) {
      state = s;
      board.dataset.state = s;
      pauseBtn.disabled = s !== 'playing' && s !== 'paused';
      pauseBtn.textContent = s === 'paused' ? 'Resume' : 'Pause';
    }

    function reset() {
      const cy = Math.floor(ROWS / 2);
      snake = [{ x: 6, y: cy }, { x: 5, y: cy }, { x: 4, y: cy }];
      dir = 'right';
      queue = [];
      walls = new Set();
      bonus = null;
      food = null;
      score = 0;
      eaten = 0;
      tickMs = SPEED_START;
      acc = 0;
      food = freeCell(3);
      updateHud();
    }

    function start() {
      reset();
      setState('playing');
      sfx.start();
      liveEl.textContent = 'Game started.';
      board.focus({ preventScroll: true });
    }

    // quiet: automatic pauses (window hidden, monitor off…) make no sound
    function pause(quiet) {
      if (state !== 'playing') return;
      setState('paused');
      if (!quiet) sfx.pause();
    }

    function resume() {
      if (state !== 'paused') return;
      acc = 0;
      setState('playing');
      sfx.resume();
      board.focus({ preventScroll: true });
    }

    function gameOver() {
      setState('over');
      sfx.over();
      quipEl.textContent = score > best && best > 0 ? RECORD_QUIP : QUIPS[Math.floor(Math.random() * QUIPS.length)];
      if (score > best) {
        if (best > 0) setTimeout(() => sfx.best(), 1000); // a fanfare for beating the record
        best = score;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (err) { /* private mode */ }
      }
      updateHud();
      finalEl.textContent = `SCORE ${fmt(score)} · BEST ${fmt(best)}`;
      liveEl.textContent = `Game over. Score ${score}. Best ${best}.`;
      win.querySelector('.snake-overlay[data-for="over"] .pix-btn').focus({ preventScroll: true });
    }

    function turn(nd) {
      const lastDir = queue.length ? queue[queue.length - 1] : dir;
      if (nd === lastDir || nd === OPP[lastDir] || queue.length >= 3) return;
      queue.push(nd);
    }

    function tick() {
      if (queue.length) dir = queue.shift();
      const [vx, vy] = VEC[dir];
      const head = { x: snake[0].x + vx, y: snake[0].y + vy };

      const eatsFood = food && head.x === food.x && head.y === food.y;
      const eatsBonus = bonus && head.x === bonus.x && head.y === bonus.y;
      const growing = eatsFood || eatsBonus;
      const body = growing ? snake : snake.slice(0, -1); // the tail moves out of the way

      if (isBorder(head.x, head.y) || walls.has(cellKey(head.x, head.y))
        || body.some((s) => s.x === head.x && s.y === head.y)) {
        gameOver();
        return;
      }

      snake.unshift(head);
      if (!growing) snake.pop();

      if (eatsBonus) {
        score += FOOD[bonus.type].points;
        bonus = null;
        sfx.bonus();
      }
      if (eatsFood) {
        score += FOOD.apple.points;
        eaten += 1;
        tickMs = Math.max(SPEED_FASTEST, SPEED_START - eaten * SPEED_STEP);
        food = freeCell(2);
        sfx.eat();
        if (eaten % 4 === 0 && !bonus) {
          const spot = freeCell(4);
          if (spot) {
            bonus = { ...spot, type: Math.random() < 0.25 ? 'star' : 'cherry', ttl: 45 };
            setTimeout(() => sfx.appear(), 150);
          }
        }
        if (eaten % 5 === 0 && walls.size < 12) {
          const spot = freeCell(6);
          if (spot) {
            walls.add(cellKey(spot.x, spot.y));
            setTimeout(() => sfx.wall(), 120);
          }
        }
      }
      if (bonus && --bonus.ttl <= 0) bonus = null;
      if (growing) updateHud();
    }

    /* ---------- Rendering ---------- */
    function drawCell(img, x, y) { ctx.drawImage(img, x * CELL, y * CELL); }

    function render(t) {
      ctx.drawImage(floor, 0, 0);
      walls.forEach((k) => {
        const x = k % COLS;
        const y = Math.floor(k / COLS);
        ctx.drawImage(bricks, x * CELL, y * CELL, CELL, CELL, x * CELL, y * CELL, CELL, CELL);
      });
      if (food) drawCell(spriteTile('apple'), food.x, food.y);
      if (bonus && !(bonus.ttl < 12 && Math.floor(t / 150) % 2)) drawCell(spriteTile(bonus.type), bonus.x, bonus.y);

      const len = snake.length;
      for (let i = len - 1; i >= 0; i--) {
        const s = snake[i];
        let img;
        if (i === 0) {
          img = headTile(len > 1 ? dirBetween(snake[1], s) : dir, state === 'over');
        } else if (i === len - 1) {
          img = tailTile(dirBetween(s, snake[i - 1]));
        } else {
          const a = dirBetween(s, snake[i - 1]);
          const b = dirBetween(s, snake[i + 1]);
          img = bodyTile({ [a]: true, [b]: true });
        }
        drawCell(img, s.x, s.y);
      }

      // Flicking tongue
      if (state === 'playing' && Math.floor(t / 220) % 4 === 0 && len > 1) {
        const h = snake[0];
        const to = rot(dirBetween(snake[1], h));
        ctx.fillStyle = C.t;
        [[12, 5], [12, 6], [13, 5], [13, 6], [14, 4], [14, 7]].forEach(([x, y]) => {
          const [gx, gy] = to(x, y);
          ctx.fillRect(h.x * CELL + gx * PX, h.y * CELL + gy * PX, PX, PX);
        });
      }
    }

    /* ---------- Loop (runs only while the window is visible) ---------- */
    const envOk = () => stage.dataset.power === 'on' && bsod.hidden && startMenu.hidden && !document.hidden;

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(250, t - (last || t));
      last = t;
      if (state === 'playing') {
        if (!envOk()) {
          pause(true);
        } else {
          acc += dt;
          while (acc >= tickMs && state === 'playing') {
            acc -= tickMs;
            tick();
          }
        }
      }
      render(t);
    }

    function startLoop() {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    new MutationObserver(() => {
      if (win.hidden) {
        pause(true);
        stopLoop();
      } else {
        startLoop();
      }
    }).observe(win, { attributes: true, attributeFilter: ['hidden'] });

    /* ---------- Input ---------- */
    const active = () => !win.hidden && envOk();

    function steer(d) {
      if (state === 'playing') turn(d);
      else if (state === 'ready') { start(); turn(d); }
      else if (state === 'paused') { resume(); turn(d); }
    }

    document.addEventListener('keydown', (e) => {
      if (!active() || e.ctrlKey || e.metaKey || e.altKey) return;
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        steer(d);
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleSound();
        return;
      }
      const onControl = e.target.closest('button, a');
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'p' || e.key === 'P') {
        if (onControl && e.key !== 'p' && e.key !== 'P') return; // let buttons click themselves
        e.preventDefault();
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
        else if (e.key !== 'p' && e.key !== 'P') start();
      }
    });

    win.addEventListener('click', (e) => {
      const act = e.target.closest('[data-snake]');
      if (!act) return;
      const what = act.dataset.snake;
      if (what === 'start') start();
      else if (what === 'sound') toggleSound();
      else if (what === 'resume') resume();
      else if (what === 'pause') {
        if (state === 'playing') pause();
        else resume();
      }
    });

    // On-screen arrow keys: react on press, keyboard users get the click
    win.querySelectorAll('[data-dir]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        steer(btn.dataset.dir);
      });
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) steer(btn.dataset.dir);
      });
    });

    // Swipe on the board
    let swipe = null;
    canvas.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
        if (state === 'ready') start();
        return;
      }
      steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    reset();
    setState('ready');
    render(0);
    if (!win.hidden) startLoop();
  });
})();
