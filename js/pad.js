/* Gamepad support shared by every game in the series. A game supplies window.PAD_CFG (js/padcfg.js); this file reads the controller and turns it into the keyboard / mouse events the game
   already listens for, so no game's own input code has to change. Also: menu navigation (d-pad / left stick moves a highlight over the DOM menu buttons, A presses, B goes back, Start plays /
   resumes, sliders and drop-downs adjust with left / right, initials entry with up / down), a virtual mouse cursor for the mouse-aimed games, a CONTROLLER group in the settings screen
   (on / off, dead zone, cursor speed, remap every action, reset) and a small "controller connected" toast. Settings are saved per game in localStorage.
   PAD_CFG = { id, title, pause:'Escape', menuOpen(), move:{keys:{l,r,u,d}, mode:'8'|'4'|'h'|'v', stick:'left'|'right', fn(x,y)},
               aim:{keys, mode, stick, fn(x,y), holdKey, holdAt} | cursor:{sticks:['right'], speed:760, pointer:false},
               actions:[{id,label,btn:['A'],key:'Space'|mouse:0|2, hold}], hint:'...' }   buttons: A B X Y LB RB LT RT BACK START L3 R3 UP DOWN LEFT RIGHT */
(function () {
  'use strict';
  const CFG = window.PAD_CFG || {}, D = document, W = window;
  const PAD = (W.PAD = { cfg: CFG, connected: false, name: '', using: false, menu: false, rumbleOK: true });
  const SKEY = (CFG.id || 'game') + '.pad.v1';
  let realGet = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;       /* native mode wraps navigator.getGamepads, so the kit always reads the real one */
  const st = (PAD.st = { on: true, dead: CFG.deadDefault == null ? 0.25 : CFG.deadDefault, speed: 1, map: {} });
  try { Object.assign(st, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
  const IDX = {}; NAMES.forEach((n, i) => { IDX[n] = i; });
  const PRETTY = { BACK: 'Back', START: 'Start', UP: 'D-pad Up', DOWN: 'D-pad Down', LEFT: 'D-pad Left', RIGHT: 'D-pad Right' };
  const pretty = (n) => PRETTY[n] || n;
  const actions = CFG.actions || [];
  const binds = (a) => (st.map[a.id] && st.map[a.id].length ? st.map[a.id] : st.map[a.id] === null ? [] : a.btn || []);
  const menuOpen = () => (CFG.menuOpen ? !!CFG.menuOpen() : D.body.classList.contains('menu-open') || !!D.querySelector('#ui .screen:not(.hidden)'));
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const el = (tag, cls, parent, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; if (parent) parent.appendChild(e); return e; };

  /* ---- synthetic input -------------------------------------------------------------------------------------------------------------------------------------------------------- */
  const KC = { Space: 32, Enter: 13, Escape: 27, Tab: 9, ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  function keyInfo(code) {
    let key = code, kc = KC[code] || 0;
    if (/^Key[A-Z]$/.test(code)) { key = code[3].toLowerCase(); kc = code.charCodeAt(3); }
    else if (/^Digit\d$/.test(code)) { key = code[5]; kc = code.charCodeAt(5); }
    else if (code === 'Space') key = ' ';
    return { key, kc };
  }
  function fireKey(type, code) {
    const k = keyInfo(code), ev = new KeyboardEvent(type, { code, key: k.key, keyCode: k.kc, which: k.kc, bubbles: true, cancelable: true });
    if (ev.keyCode !== k.kc) { Object.defineProperty(ev, 'keyCode', { get: () => k.kc }); Object.defineProperty(ev, 'which', { get: () => k.kc }); }
    D.body.dispatchEvent(ev);
  }
  let keysDown = new Set(), mouseDown = new Set();
  function setKeys(want) {                                                                       /* diff the wanted key set against what is held, fire the edges */
    for (const k of keysDown) if (!want.has(k)) fireKey('keyup', k);
    for (const k of want) if (!keysDown.has(k)) fireKey('keydown', k);
    keysDown = want;
  }
  const canvas = () => D.getElementById('game') || D.querySelector('canvas');
  const cur = { x: 0, y: 0, init: false };
  const BTNM = [1, 4, 2];
  function mouseEv(type, button, mx, my) {
    const t = canvas() || D.body;
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: W, clientX: cur.x, clientY: cur.y, button: button || 0, buttons: type === 'mouseup' ? 0 : BTNM[button || 0] });
    Object.defineProperty(ev, 'movementX', { value: mx || 0 }); Object.defineProperty(ev, 'movementY', { value: my || 0 });
    t.dispatchEvent(ev);
    if (CFG.cursor && CFG.cursor.pointer) {
      const pt = { mousemove: 'pointermove', mousedown: 'pointerdown', mouseup: 'pointerup' }[type];
      t.dispatchEvent(new PointerEvent(pt, { bubbles: true, cancelable: true, view: W, clientX: cur.x, clientY: cur.y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: button || 0, buttons: type === 'mouseup' ? 0 : BTNM[button || 0] }));
    }
  }
  function setMouse(want) {
    for (const b of mouseDown) if (!want.has(b)) mouseEv('mouseup', b);
    for (const b of want) if (!mouseDown.has(b)) mouseEv('mousedown', b);
    mouseDown = want;
  }
  function releaseAll() { setKeys(new Set()); setMouse(new Set()); aimFn(0, 0, true); if (moveFnOn && CFG.move && CFG.move.fn) { moveFnOn = false; CFG.move.fn(0, 0); } }
  W.addEventListener('mousemove', (e) => { if (e.isTrusted) { cur.x = e.clientX; cur.y = e.clientY; cur.init = true; } }, true);
  W.addEventListener('blur', releaseAll);

  /* ---- reading the pad -------------------------------------------------------------------------------------------------------------------------------------------------------- */
  function getPad() {
    const ps = (realGet && realGet()) || [];
    let pad = null;
    for (const p of ps) if (p && p.connected) { if (!pad) pad = p; if (p.mapping === 'standard') { pad = p; break; } }
    return pad;
  }
  const bt = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
  function stickXY(p, which, dead) {
    const o = which === 'right' ? 2 : 0, x = p.axes[o] || 0, y = p.axes[o + 1] || 0, m = Math.hypot(x, y);
    if (m < dead) return [0, 0];
    const k = Math.min(1, (m - dead) / (1 - dead)) / m;
    return [x * k, y * k];
  }
  const prevBtn = new Array(16).fill(false);
  let listening = null, listenGrace = 0;                                                         /* rebinding: { act, done } */

  /* ---- gameplay mapping ------------------------------------------------------------------------------------------------------------------------------------------------------- */
  let aimOn = false, moveFnOn = false;
  function aimFn(x, y, force) { const a = CFG.aim; if (!a || !a.fn) return; if (force && !aimOn) return; aimOn = !!(x || y); a.fn(x, y); }
  function dirs(x, y, mode, keys, want, th) {
    th = th || 0.4;
    let l = x < -th, r = x > th, u = y < -th, d = y > th;
    if (mode === '4') { if (Math.abs(x) >= Math.abs(y)) { u = d = false; } else { l = r = false; } }
    else if (mode === 'h') u = d = false; else if (mode === 'v') l = r = false;
    if (keys.l && l) want.add(keys.l); if (keys.r && r) want.add(keys.r); if (keys.u && u) want.add(keys.u); if (keys.d && d) want.add(keys.d);
  }
  let lastT = 0;
  function play(p, dt) {
    const want = new Set(), wantM = new Set(), dead = st.dead;
    const dpx = (bt(p, 15) ? 1 : 0) - (bt(p, 14) ? 1 : 0), dpy = (bt(p, 13) ? 1 : 0) - (bt(p, 12) ? 1 : 0);
    const mv = CFG.move, am = CFG.aim, cs = CFG.cursor;
    const csticks = cs ? cs.sticks || ['right'] : [];
    let usedDpad = false;
    if (mv) {
      let [x, y] = stickXY(p, mv.stick || 'left', dead);
      if (!(cs && csticks.includes(mv.stick || 'left')) && !mv.noDpad) { if (dpx || dpy) { x = x || dpx; y = y || dpy; usedDpad = true; } }
      if (mv.fn) { mv.fn(x, y); moveFnOn = !!(x || y); } else dirs(x, y, mv.mode || '8', mv.keys || {}, want);
      if (mv.fn && mv.keys) dirs(x, y, mv.mode || '8', mv.keys, want);
    }
    if (am && !cs) {
      const [x, y] = stickXY(p, am.stick || 'right', dead);
      if (am.keys) dirs(x, y, am.mode || '8', am.keys, want, am.thresh || 0.35);
      const mag = Math.hypot(x, y);
      if (am.holdKey && mag > (am.holdAt || 0.3)) want.add(am.holdKey);
      if (am.fn) aimFn(x, y);
    }
    if (!mv && !cs && (dpx || dpy) && CFG.dpad) { dirs(dpx, dpy, CFG.dpad.mode || '4', CFG.dpad.keys, want); }
    if (cs) {
      let sx = 0, sy = 0;
      for (const s of csticks) { const [x, y] = stickXY(p, s, dead); sx += x; sy += y; }
      if (cs.dpad && (dpx || dpy)) { sx += dpx; sy += dpy; }
      if (!cur.init) { const r = (canvas() || D.body).getBoundingClientRect(); cur.x = r.left + r.width / 2; cur.y = r.top + r.height / 2; cur.init = true; }
      if (sx || sy) {
        const sp = (cs.speed || 760) * st.speed * dt, m = Math.hypot(sx, sy), k = Math.min(1, m);
        const mx = (sx / m) * k * sp, my = (sy / m) * k * sp, r = (canvas() || D.body).getBoundingClientRect();
        cur.x = Math.max(r.left, Math.min(r.right - 1, cur.x + mx)); cur.y = Math.max(r.top, Math.min(r.bottom - 1, cur.y + my));
        mouseEv('mousemove', 0, mx, my);
      }
    }
    for (const a of actions) {
      let on = false;
      for (const n of binds(a)) if (bt(p, IDX[n])) on = true;
      if (!on) continue;
      const k = typeof a.key === 'function' ? a.key() : a.key;
      if (k) want.add(k);
      if (a.mouse !== undefined) wantM.add(a.mouse);
    }
    if (bt(p, IDX.START)) want.add(CFG.pause || 'Escape');
    setKeys(want); setMouse(wantM);
  }

  /* ---- menus -------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  let focus = null, scr = null, rep = { dir: '', t: 0, n: 0 };
  function screenEl() { return D.querySelector('#ui .screen:not(.hidden)') || D.body; }
  function items(root) {
    return Array.from(root.querySelectorAll('button, input, select, textarea, [data-pad]')).filter((e) => !e.disabled && e.type !== 'hidden' && visible(e));
  }
  function setFocus(e) {
    if (focus) focus.classList.remove('pad-focus');
    focus = e;
    if (e) { e.classList.add('pad-focus'); try { e.focus({ preventScroll: true }); } catch (x) { /* ignore */ } e.scrollIntoView && e.scrollIntoView({ block: 'nearest' }); }
  }
  function nativeFocus() {
    const a = D.activeElement;
    if (a && a.tagName === 'BUTTON' && visible(a) && a.closest('#ui')) return;
    const l = items(screenEl()).filter((e) => e.tagName === 'BUTTON'), pr = l.find((e) => e.classList.contains('primary')) || l[0];
    if (pr) setFocus(pr);
  }
  function enterMenu() {
    PAD.menu = true; releaseAll();
  }
  function leaveMenu() { PAD.menu = false; if (focus) { focus.classList.remove('pad-focus'); try { focus.blur(); } catch (x) { /* ignore */ } } focus = null; scr = null; }
  function moveFocus(dir) {
    const list = items(scr || screenEl());
    if (!list.length) return;
    if (!focus || !list.includes(focus)) { setFocus(list.find((e) => e.classList.contains('primary')) || list[0]); return; }
    const fr = focus.getBoundingClientRect(), fx = fr.left + fr.width / 2, fy = fr.top + fr.height / 2;
    let best = null, bs = 1e9;
    for (const e of list) {
      if (e === focus) continue;
      const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - fx, dy = r.top + r.height / 2 - fy;
      const prim = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      if (prim <= 2) continue;
      const cross = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      const s = prim + cross * (dir === 'up' || dir === 'down' ? 0.3 : 3);
      if (s < bs) { bs = s; best = e; }
    }
    if (!best && (dir === 'up' || dir === 'down')) { const i = list.indexOf(focus); best = list[(i + (dir === 'down' ? 1 : list.length - 1)) % list.length]; }
    if (best) setFocus(best);
  }
  function adjust(e, dir) {                                                                      /* left / right on a slider, drop-down or initials box */
    const s = dir === 'right' ? 1 : -1;
    if (e.type === 'range') {
      const mn = +e.min || 0, mx = e.max === '' ? 100 : +e.max, step = +e.step || (mx - mn) / 20, v = Math.max(mn, Math.min(mx, +e.value + s * Math.max(step, (mx - mn) / 20)));
      e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true;
    }
    if (e.tagName === 'SELECT') {
      const i = Math.max(0, Math.min(e.options.length - 1, e.selectedIndex + s));
      if (i !== e.selectedIndex) { e.selectedIndex = i; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    }
    if (e.type === 'text' || e.tagName === 'TEXTAREA') {
      if (s < 0) e.value = e.value.slice(0, -1); else if (!e.maxLength || e.maxLength < 0 || e.value.length < e.maxLength) e.value += 'A';
      e.dispatchEvent(new Event('input', { bubbles: true })); return true;
    }
    return false;
  }
  function letter(e, s) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    if (!e.value) e.value = 'A';
    const c = e.value.slice(-1).toUpperCase(), i = A.indexOf(c);
    e.value = e.value.slice(0, -1) + A[(i < 0 ? 0 : i + s + A.length) % A.length];
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function nav(dir) {
    const e = focus;
    if (e && (e.type === 'text' || e.tagName === 'TEXTAREA') && (dir === 'up' || dir === 'down')) { letter(e, dir === 'up' ? 1 : -1); return; }
    if (e && (dir === 'left' || dir === 'right') && adjust(e, dir)) return;
    moveFocus(dir);
  }
  function press(e) {
    if (!e) return;
    if (e.type === 'text') { const l = items(scr || screenEl()), i = l.indexOf(e); if (l[i + 1]) setFocus(l[i + 1]); return; }
    if (e.tagName === 'SELECT' || e.type === 'range') return;
    e.click();
  }
  function menuStep(p, t) {
    const root = screenEl();
    if (root !== scr) { scr = root; setFocus(null); }
    if (!focus || !D.contains(focus) || !visible(focus)) { const l = items(root); setFocus(l.find((e) => e.classList.contains('primary')) || l[0] || null); }
    const [lx, ly] = stickXY(p, 'left', 0.5);
    let dir = '';
    if (bt(p, 12) || ly < -0.6) dir = 'up'; else if (bt(p, 13) || ly > 0.6) dir = 'down'; else if (bt(p, 14) || lx < -0.6) dir = 'left'; else if (bt(p, 15) || lx > 0.6) dir = 'right';
    if (dir) {
      if (dir !== rep.dir) { rep = { dir, t: t + 380 }; nav(dir); }
      else if (t >= rep.t) { rep.t = t + 110; if (dir === 'left' || dir === 'right') nav(dir); else if (focus && focus.type === 'text') nav(dir); else nav(dir); }
    } else rep.dir = '';
    const edge = (i) => bt(p, i) && !prevBtn[i];
    if (edge(0)) press(focus);
    if (edge(1)) { const back = root.querySelector('[data-pad-back]'); if (back) back.click(); else { fireKey('keydown', 'Escape'); fireKey('keyup', 'Escape'); } }
    if (edge(9)) {
      const id = root.id;
      if (id === 'settings' || id === 'pause') { fireKey('keydown', 'Escape'); fireKey('keyup', 'Escape'); }
      else { const pr = root.querySelector('button.primary'); if (pr && visible(pr)) pr.click(); else press(focus); }
    }
  }

  /* ---- main loop ---------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  function loop(now) { requestAnimationFrame(loop); step(now); }
  function step(now) {
    const dt = Math.min(0.05, ((now || 0) - lastT) / 1000) || 0.016; lastT = now || 0;
    const p = getPad();
    if (!p) { if (PAD.connected) { PAD.connected = false; PAD.name = ''; releaseAll(); status(); } return; }
    if (!PAD.connected) { PAD.connected = true; PAD.name = p.id; status(); toast(); }
    let any = false;
    for (let i = 0; i < 16; i++) if (bt(p, i)) any = true;
    if (Math.abs(p.axes[0] || 0) + Math.abs(p.axes[1] || 0) + Math.abs(p.axes[2] || 0) + Math.abs(p.axes[3] || 0) > 0.6) any = true;
    if (any) PAD.using = true;
    if (listening) { listen(p); }
    else if (CFG.native) { if (st.on && menuOpen()) nativeFocus(); }                              /* the game reads the pad itself (through the wrapper below); we only make sure a button is highlighted so A works at once */
    else if (st.on) {
      const m = menuOpen();
      if (m !== PAD.menu) { if (m) enterMenu(); else leaveMenu(); }
      if (m) menuStep(p, now || 0); else if (CFG.menuOnly) releaseAll(); else play(p, dt);
    } else releaseAll();
    for (let i = 0; i < 16; i++) prevBtn[i] = bt(p, i);
  }

  /* ---- settings screen ------------------------------------------------------------------------------------------------------------------------------------------------------------ */
  let statEl = null, rows = {};
  function status() { if (statEl) statEl.textContent = PAD.connected ? 'Connected: ' + PAD.name.replace(/\s*\(.*$/, '').slice(0, 48) : 'No controller found - connect one and press any button'; }
  function label(a) { const b = CFG.native ? binds(a).slice(0, 1) : binds(a); return b.length ? b.map(pretty).join(' / ') : 'unbound'; }
  function refreshRows() { for (const a of actions) if (rows[a.id]) rows[a.id].textContent = label(a); }
  function listen(p) {
    if (listenGrace > 0) { listenGrace--; return; }
    for (let i = 0; i < 16; i++) {
      if (!bt(p, i) || prevBtn[i]) continue;
      const act = listening.act, name = NAMES[i];
      if (name === 'START') continue;                                                           /* Start is always pause / play */
      if (CFG.native) {                                                                         /* one button per action: swap with whoever had it */
        const old = binds(act)[0];
        for (const a of actions) if (a !== act && binds(a)[0] === name) st.map[a.id] = [old];
      } else for (const a of actions) if (a !== act) { const b = binds(a).filter((n) => n !== name); if (b.length !== binds(a).length) st.map[a.id] = b.length ? b : null; }
      st.map[act.id] = [name];
      save(); listening.done(); listening = null; refreshRows(); return;
    }
  }
  function buildSettings() {
    const panel = D.querySelector('#settings .panel');
    if (!panel || CFG.settings === false || (CFG.menuOnly && !actions.length)) return;
    const g = el('div', 'pad-set', panel);
    el('h3', '', g, 'CONTROLLER');
    statEl = el('p', 'pad-stat', g); status();
    const mk = (html) => { const l = el('label', '', g); l.innerHTML = html; return l; };
    const on = mk('<input id="padOn" type="checkbox"> Use controller'); on.className = 'check'; if (CFG.native) on.style.display = 'none';
    const dz = mk('Stick dead zone <input id="padDead" type="range" min="0.05" max="0.6" step="0.05">');
    on.querySelector('input').checked = st.on; dz.querySelector('input').value = st.dead;
    on.querySelector('input').addEventListener('change', (e) => { st.on = e.target.checked; save(); if (!st.on) releaseAll(); });
    dz.querySelector('input').addEventListener('input', (e) => { st.dead = +e.target.value; save(); });
    if (CFG.cursor) {
      const cs = mk('Aim cursor speed <input id="padSpeed" type="range" min="0.4" max="2" step="0.1">');
      cs.querySelector('input').value = st.speed; cs.querySelector('input').addEventListener('input', (e) => { st.speed = +e.target.value; save(); });
    }
    if (actions.length) {
      el('div', 'pad-sub', g, CFG.native ? 'Main buttons - select one, then press the button you want (the other button swaps in)' : 'Buttons - select one, then press the button you want');
      const tbl = el('div', 'pad-map', g);
      for (const a of actions) {
        const r = el('div', 'pad-row', tbl); el('span', '', r, a.label || a.id);
        const b = el('button', 'pad-bind', r); b.type = 'button'; rows[a.id] = b; b.textContent = label(a);
        b.addEventListener('click', () => {
          if (listening) { listening.done(); listening = null; }
          b.textContent = 'press a button...'; listenGrace = 8; listening = { act: a, done: () => { refreshRows(); } };
        });
      }
      const sp = el('div', 'pad-row', tbl); el('span', '', sp, 'Start button: ' + (CFG.startLabel || 'pause / resume') + ' (fixed)');
      const rs = el('button', 'pad-reset', g, 'Reset buttons to default'); rs.type = 'button';
      rs.addEventListener('click', () => { st.map = {}; st.dead = 0.25; st.speed = 1; save(); refreshRows(); g.querySelector('#padDead').value = st.dead; const s = g.querySelector('#padSpeed'); if (s) s.value = st.speed; });
    }
    if (CFG.hint) el('p', 'pad-hint', g).innerHTML = CFG.hint;
  }
  function css() {
    const s = el('style'); s.textContent =
      '.pad-focus{outline:3px solid #fff !important;outline-offset:2px;box-shadow:0 0 14px 2px rgba(255,255,255,.55) !important}' +
      '.pad-set{margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.18);text-align:left}.pad-set h3{margin:0 0 8px;font-size:14px;letter-spacing:.18em;opacity:.85}' +
      '.pad-set label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}.pad-set label.check{justify-content:flex-start}.pad-set input[type=range]{flex:1;max-width:55%}' +
      '.pad-stat,.pad-hint{font-size:12px;opacity:.7;margin:4px 0 8px}.pad-sub{font-size:12px;opacity:.75;margin:10px 0 4px}' +
      '.pad-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:3px 0;font-size:14px}.pad-bind,.pad-reset{font:inherit;font-size:13px;padding:5px 10px;min-width:118px;cursor:pointer;color:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.3);border-radius:6px}' +
      '.pad-reset{margin-top:10px}.pad-toast{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;padding:8px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;color:#fff;background:rgba(10,14,34,.92);border:1px solid rgba(255,255,255,.35);pointer-events:none;transition:opacity .5s;max-width:92vw;text-align:center}';
    D.head.appendChild(s);
  }
  let toastEl = null, toastT = 0;
  function toast() {
    if (!toastEl) toastEl = el('div', 'pad-toast', D.body);
    toastEl.innerHTML = '&#127918; Controller connected' + (CFG.hint ? '<div style="font-weight:400;font-size:12px;opacity:.8;margin-top:3px">' + CFG.hint + '</div>' : '');
    toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, 4200);
  }

  /* ---- rumble (games may call PAD.rumble on hits) --------------------------------------------------------------------------------------------------------------------------------- */
  PAD._setReal = (f) => { realGet = f; };                                                       /* tests feed a mock pad through this */
  PAD.step = step;                                                                              /* tests drive this by hand when the tab is hidden and rAF is paused */
  PAD.tap = function (code, ms) { fireKey('keydown', code); setTimeout(() => fireKey('keyup', code), ms || 60); };
  PAD.rumble = function (strong, weak, ms) {
    if (!PAD.rumbleOK || !PAD.connected) return;
    const p = getPad(), a = p && p.vibrationActuator;
    if (!a || !a.playEffect) return;
    a.playEffect('dual-rumble', { duration: ms || 120, strongMagnitude: strong == null ? 0.5 : strong, weakMagnitude: weak == null ? 0.5 : weak }).catch(() => { PAD.rumbleOK = false; });
  };


  /* ---- native mode: a wrapper around navigator.getGamepads for games that read the pad themselves. It applies the dead zone, swaps the remapped buttons and goes quiet while a button is being picked.
          Menus see the real pad, so A / B / D-pad always behave the same there. ---------------------------------------------------------------------------------------------------------------- */
  function installWrapper() {
    if (!CFG.native || !realGet) return;
    navigator.getGamepads = function () {
      const ps = realGet();
      if (!st.on && !listening) return ps.map(() => null);
      const out = [];
      for (const p of ps) {
        if (!p) { out.push(p); continue; }
        const quiet = !!listening, menu = !quiet && menuOpen();
        const ax = Array.from(p.axes), bs = [];
        for (let i = 0; i < p.buttons.length; i++) { const b = p.buttons[i]; bs.push({ pressed: quiet ? false : b.pressed, touched: b.touched, value: quiet ? 0 : b.value }); }
        if (quiet) ax.fill(0);
        else {
          for (let o = 0; o + 1 < ax.length && o < 4; o += 2) {
            const x = ax[o], y = ax[o + 1], m = Math.hypot(x, y);
            if (m < st.dead) { ax[o] = 0; ax[o + 1] = 0; } else { const k = Math.min(1, (m - st.dead) / (1 - st.dead)) / m; ax[o] = x * k; ax[o + 1] = y * k; }
          }
          if (!menu) {
            const src = bs.map((b) => ({ pressed: b.pressed, touched: b.touched, value: b.value }));
            for (const a of actions) { const d = IDX[(a.btn || [])[0]], q = IDX[binds(a)[0]]; if (d !== undefined && q !== undefined && d !== q && src[q]) bs[d] = src[q]; }
          }
        }
        out.push({ id: p.id, index: p.index, connected: p.connected, mapping: p.mapping, timestamp: p.timestamp, axes: ax, buttons: bs, vibrationActuator: p.vibrationActuator, hapticActuators: p.hapticActuators });
      }
      return out;
    };
  }

  function init() {
    css(); installWrapper(); buildSettings(); requestAnimationFrame(loop);
    if (!D.querySelector('#settings .pad-set')) {                                                /* games that build their menus from script: retry until the settings panel exists */
      let n = 0, t = setInterval(() => { buildSettings(); if (D.querySelector('#settings .pad-set') || ++n > 40) clearInterval(t); }, 250);
    }
  }
  if (D.body) init(); else D.addEventListener('DOMContentLoaded', init);
})();
