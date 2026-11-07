/* =========================================================
   Your details — edit these once and they fill the whole site.
   ========================================================= */
const CONFIG = {
  name: '[YOUR NAME]',
  city: '[YOUR CITY]',
  email: '[YOUR EMAIL]',
  github: '#',   // e.g. 'https://github.com/your-username'
  linkedin: '#', // e.g. 'https://www.linkedin.com/in/your-profile'
};

/* =========================================================
   Fun texts — small jokes around the site. Edit, add or remove freely.
   ========================================================= */
const FUN = {
  // Welcome window: "Currently: …" (click it for another one)
  now: [
    'turning coffee into CSS',
    'centering a div (wish me luck)',
    'naming variables. The hardest part of coding.',
    'arguing with a semicolon',
    'pushing pixels, one at a time',
    'reading the docs (yes, really)',
    'debugging with console.log and no regrets',
    'teaching a snake to eat apples',
  ],
  // Terminal: C:\> fortune
  fortune: [
    'It works on my machine.',
    "There's no place like 127.0.0.1",
    '99 little bugs in the code...',
    'Ctrl+Z is my favourite superpower.',
    'CSS is awesome. Mostly.',
    'git commit -m "final_final_v2"',
    'Weeks of coding can save hours of planning.',
  ],
  // Boot screen: two random lines on every boot
  boot: [
    'Memory test: 640K OK',
    'Detecting bugs... 3 found (2 are features)',
    'Loading coffee.sys ... OK',
    'Defragmenting ideas ... done',
    'Counting pixels ... all present',
    'Warming up the CRT ... cozy',
    'Untangling cables ... mostly',
  ],
  // Taskbar clock tooltip, by hour
  clock: [
    [0, "It's late. Even the bugs are asleep."],
    [6, 'Good morning! Coffee first, code second.'],
    [12, 'Lunch time. The snake is hungry too.'],
    [14, 'Peak productivity hours (allegedly).'],
    [18, 'Evening mode: the best code happens now.'],
    [22, 'One more commit, then bed. Promise.'],
  ],
  // Contact: what the "No" button says on each click (the last one says yes)
  no: ['No', 'Are you sure?', 'Really sure?', 'Think again...', 'Last chance!', "OK fine, let's talk!"],
  // Blue screen: special reasons for some addresses
  bsod: {
    'recycle-bin': 'The Recycle Bin is empty. I already recycled all my bugs (well, most of them).',
  },
  bsodDefault: 'The page you are looking for has been moved, deleted, or was never written in the first place.',
  // Browser tab title while the visitor is on another tab
  away: 'Come back! The snake misses you',
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// The hourglass cursor shows until everything (images, fonts) has loaded
window.addEventListener('load', () => document.documentElement.classList.remove('is-loading'));

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Fill personal details ---------- */
  document.querySelectorAll('[data-fill]').forEach((el) => {
    const value = CONFIG[el.dataset.fill];
    if (value) el.textContent = value;
  });

  document.querySelectorAll('[data-link]').forEach((a) => {
    const key = a.dataset.link;
    if (key === 'email') {
      a.href = 'mailto:' + CONFIG.email;
      return;
    }
    const url = CONFIG[key];
    if (url && url !== '#') {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Elements ---------- */
  const stage = document.querySelector('.stage');
  const screenEl = document.querySelector('.screen');
  const welcomeWin = document.querySelector('[data-window="welcome"]');
  const explorer = document.querySelector('[data-window="explorer"]');
  // App windows: hash key → taskbar label, page title, and where its × leads
  const APPS = {
    games: { task: 'C:\\Games', title: 'Games', closeTo: 'welcome' },
    snake: { task: 'snake.exe', title: 'Snake', closeTo: 'games' },
    mines: { task: 'minesweeper.exe', title: 'Minesweeper', closeTo: 'games' },
    player: { task: 'winplayer.exe', title: 'WinPlayer', closeTo: 'welcome' },
  };
  const windows = { welcome: welcomeWin, explorer };
  Object.keys(APPS).forEach((k) => { windows[k] = document.querySelector(`[data-window="${k}"]`); });
  const maxBtn = explorer.querySelector('[data-win="max"]');
  const panels = [...document.querySelectorAll('.panel')];
  const keys = ['welcome', ...Object.keys(APPS), ...panels.map((p) => p.dataset.key)];
  const treeLinks = [...document.querySelectorAll('.tree')];
  const address = document.getElementById('address');
  const task = document.getElementById('task');
  const status = document.getElementById('status');
  const startBtn = document.querySelector('.start');
  const startMenu = document.getElementById('start-menu');
  const desktopEl = document.querySelector('.desktop');
  const taskbarEl = document.querySelector('.taskbar');
  const bsod = document.getElementById('bsod');
  const bsodPath = document.getElementById('bsod-path');
  const bsodBtn = bsod.querySelector('.bsod-continue');
  const bsodReason = document.getElementById('bsod-reason');

  const fullLayout = window.matchMedia('(min-width: 1000px) and (min-height: 601px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Windows ----------
     Windows share the desktop: "welcome" (welcome.exe), the APPS above (Games folder,
     Snake, Minesweeper, WinPlayer) and "explorer" (Skills / Projects / About / Contact).
     One is current at a time,
     and it is 'open', 'min' (only its taskbar button shows) or 'closed'. */
  let view = 'welcome';
  let winState = 'open';

  function setWin(state) {
    winState = state;
    Object.entries(windows).forEach(([name, el]) => {
      el.hidden = !(view === name && state === 'open');
    });
    task.hidden = state === 'closed';
    task.setAttribute('aria-pressed', String(state === 'open'));
  }

  function focusWin() {
    const heading = view === 'explorer'
      ? panels.find((p) => !p.hidden).querySelector('h2')
      : windows[view].querySelector('h2');
    heading.focus({ preventScroll: true });
  }

  function setMax(on, animate = true) {
    const apply = () => {
      document.body.classList.toggle('is-max', on);
      maxBtn.setAttribute('aria-label', on ? 'Restore' : 'Maximize');
    };
    // Smooth zoom in/out of the monitor where the browser supports it
    if (animate && document.startViewTransition && !reduceMotion.matches && fullLayout.matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }
  const isMax = () => document.body.classList.contains('is-max');

  /* ---------- 404: Blue Screen of Death ---------- */
  function showBSOD(key) {
    let name = key;
    try { name = decodeURIComponent(key); } catch (err) { /* keep it raw */ }
    closeStart();
    bsodPath.textContent = 'C:\\Portfolio\\' + name;
    bsodReason.textContent = FUN.bsod[name] || FUN.bsodDefault;
    bsod.hidden = false;
    desktopEl.inert = true;
    taskbarEl.inert = true;
    document.title = 'Fatal exception 404 · Portfolio';
    bsodBtn.focus({ preventScroll: true });
  }

  function clearBSOD() {
    bsod.hidden = true;
    desktopEl.inert = false;
    taskbarEl.inert = false;
  }

  // "Press any key to continue": back to the desktop, dropping the bad link from history
  function leaveBSOD() {
    if (bsod.hidden) return;
    history.replaceState(null, '', '#welcome');
    show('welcome', true);
  }

  bsod.addEventListener('click', leaveBSOD);
  document.addEventListener('keydown', (e) => {
    if (bsod.hidden || ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault();
    leaveBSOD();
  });

  /* ---------- Section switching (hash routing) ---------- */
  function show(key, moveFocus) {
    if (!keys.includes(key)) {
      if (key) { showBSOD(key); return; } // a link to a page that does not exist
      key = 'welcome';
    }
    if (!bsod.hidden) clearBSOD();

    if (key === 'welcome') {
      view = 'welcome';
      task.textContent = 'welcome.exe';
      document.title = `${CONFIG.name} · Front-end Portfolio`;
      if (isMax()) setMax(false, false); // welcome.exe has no restore button
    } else if (APPS[key]) {
      view = key;
      task.textContent = APPS[key].task;
      document.title = `${APPS[key].title} · ${CONFIG.name} · Portfolio`;
      if (isMax()) setMax(false, false); // only the Explorer can be maximized
    } else {
      view = 'explorer';
      const panel = panels.find((p) => p.dataset.key === key);
      panels.forEach((p) => { p.hidden = p !== panel; });
      treeLinks.forEach((a) => {
        if (a.getAttribute('href') === '#' + key) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      address.textContent = 'C:\\Portfolio\\' + panel.dataset.label;
      task.textContent = panel.dataset.task;
      status.textContent = panel.dataset.status;
      document.title = `${panel.dataset.label} · ${CONFIG.name} · Portfolio`;
      const body = panel.querySelector('.panel-body');
      if (body) body.scrollTop = 0;
    }

    setWin('open');
    if (moveFocus) focusWin();
  }

  function go(key) {
    if (location.hash !== '#' + key) history.pushState(null, '', '#' + key);
    show(key, true);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const key = a.getAttribute('href').slice(1);
    if (key === '') { e.preventDefault(); return; } // placeholder links
    if (!keys.includes(key)) return;
    e.preventDefault();
    go(key);
    closeStart();
  });

  window.addEventListener('popstate', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));

  /* ---------- Title-bar buttons: minimize, maximize, close ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-win]');
    if (!btn) return;
    const action = btn.dataset.win;
    if (action === 'min') {
      setWin('min');
      task.focus();
    } else if (action === 'max') {
      setMax(!isMax());
    } else if (action === 'close') {
      // let the window's app react (e.g. WinPlayer stops the music)
      document.dispatchEvent(new CustomEvent('portfolio:close', { detail: { view } }));
      if (view !== 'welcome') {
        // a game returns to the Games folder; everything else to the welcome window
        go(APPS[view] ? APPS[view].closeTo : 'welcome');
      } else {
        setWin('closed');
        document.querySelector('.ico').focus();
      }
    }
  });

  // Taskbar button: restore a minimized window, or minimize an open one
  task.addEventListener('click', () => {
    if (winState === 'open') {
      setWin('min');
    } else {
      setWin('open');
      focusWin();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.target.closest('.start-wrap')) return;
    if (isMax()) setMax(false);
  });

  /* ---------- Start menu ---------- */
  function openStart() {
    startMenu.hidden = false;
    startBtn.setAttribute('aria-expanded', 'true');
    startMenu.querySelector('a').focus();
  }
  function closeStart(returnFocus) {
    if (startMenu.hidden) return;
    startMenu.hidden = true;
    startBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) startBtn.focus();
  }

  startBtn.addEventListener('click', () => {
    if (startMenu.hidden) openStart();
    else closeStart();
  });
  startMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStart(true);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.start-wrap')) closeStart();
  });
  startMenu.addEventListener('focusout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('.start-wrap')) closeStart();
  });

  /* ---------- Scale the screen with the monitor ---------- */
  // The design's screen is 1284px wide. On bigger monitors the whole screen is
  // scaled up so it looks exactly like the design; on small ones it keeps a
  // layout at least MIN_SCREEN_W wide and is scaled down (see .screen in CSS).
  const DESIGN_SCREEN_W = 1284;
  const MIN_SCREEN_W = 800;

  function fitScreen() {
    if (!fullLayout.matches) {
      screenEl.style.removeProperty('--k');
      return;
    }
    const glassW = stage.clientWidth * (DESIGN_SCREEN_W / 1440);
    let k = 1;
    if (glassW > DESIGN_SCREEN_W) k = glassW / DESIGN_SCREEN_W;
    else if (glassW < MIN_SCREEN_W) k = glassW / MIN_SCREEN_W;
    screenEl.style.setProperty('--k', k.toFixed(4));
  }

  new ResizeObserver(fitScreen).observe(stage);
  fullLayout.addEventListener('change', fitScreen);
  fitScreen();

  /* ---------- Monitor power & restart ---------- */
  const powerBtn = document.querySelector('.hw-power');
  const resetBtn = document.querySelector('.hw-reset');
  const os = document.querySelector('.os');
  const boot = document.querySelector('.boot');
  let bootTimer;

  function setPower(state) { // 'on' | 'off' | 'boot'
    stage.dataset.power = state;
    powerBtn.setAttribute('aria-pressed', String(state !== 'off'));
    os.inert = state !== 'on';
    boot.hidden = true;
    if (state === 'boot') {
      void boot.offsetWidth; // restart the boot animation
      boot.hidden = false;
    }
  }

  function powerOff() {
    clearTimeout(bootTimer);
    closeStart();
    setPower('off');
  }

  function powerOn() {
    clearTimeout(bootTimer);
    closeStart();
    // two different random lines for the boot screen
    const first = pick(FUN.boot);
    document.getElementById('boot-1').textContent = first;
    document.getElementById('boot-2').textContent = pick(FUN.boot.filter((l) => l !== first));
    setPower('boot');
    bootTimer = setTimeout(() => setPower('on'), reduceMotion.matches ? 400 : 2100);
  }

  powerBtn.addEventListener('click', () => {
    if (stage.dataset.power === 'off') powerOn();
    else powerOff();
  });

  resetBtn.addEventListener('click', () => {
    if (stage.dataset.power !== 'off') powerOn();
  });

  // Phones/tablets have no monitor buttons, so never leave the screen dark there
  fullLayout.addEventListener('change', () => {
    if (!fullLayout.matches && stage.dataset.power !== 'on') {
      clearTimeout(bootTimer);
      setPower('on');
    }
  });

  /* ---------- Fun texts ---------- */
  const nowBtn = document.getElementById('now');
  const nowText = document.getElementById('now-text');
  let nowIdx = Math.floor(Math.random() * FUN.now.length);
  nowText.textContent = FUN.now[nowIdx];
  nowBtn.addEventListener('click', () => {
    nowIdx = (nowIdx + 1) % FUN.now.length;
    nowText.textContent = FUN.now[nowIdx];
  });

  document.getElementById('fortune').textContent = pick(FUN.fortune);

  // "No" never quite takes no for an answer; its last step opens the email
  const noBtn = document.getElementById('no-btn');
  let noStep = 0;
  noBtn.addEventListener('click', () => {
    if (noStep === FUN.no.length - 1) {
      document.querySelector('[data-link="email"]').click();
      return;
    }
    noStep += 1;
    noBtn.textContent = FUN.no[noStep];
  });

  let titleBeforeAway = '';
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      titleBeforeAway = document.title;
      document.title = FUN.away;
    } else if (titleBeforeAway && document.title === FUN.away) {
      document.title = titleBeforeAway;
    }
  });

  // A hello for developers who open the console
  console.log(
    '%cHey there, fellow developer!%c\nLooking under the hood? Everything here is plain HTML, CSS and JavaScript.\nLet\'s talk: ' + CONFIG.email,
    'font: bold 16px monospace; color: #000080; background: #C0C0C0; padding: 4px 8px;',
    'font: 12px monospace;',
  );

  /* ---------- Taskbar clock ---------- */
  const clock = document.getElementById('clock');
  function tick() {
    const now = new Date();
    clock.dateTime = now.toISOString();
    clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const h = now.getHours();
    clock.parentElement.title = FUN.clock.filter(([from]) => h >= from).pop()[1];
  }
  tick();
  setInterval(tick, 15000);
});
