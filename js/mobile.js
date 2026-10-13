/* Touch controls and mobile shell, shared by every game in the series. A game supplies window.TOUCH_CFG (js/touchcfg.js); this file builds the on-screen controls and turns touches into
   the keyboard / mouse events the game already listens for, so no game's own input code has to change. Also: rotate prompt, first-tap fullscreen + orientation lock, wake lock,
   a TOUCH CONTROLS group in the settings screen, and TK.layout() which the game's resize() calls so a portrait playfield sits at the top and leaves a thumb band underneath.
   ?touch=1 forces the touch UI on (for testing on a desktop), ?touch=0 forces it off. */
(function () {
  'use strict';
  const CFG = window.TOUCH_CFG || {}, D = document, W = window;
  const TK = (W.TK = { cfg: CFG, on: false, supported: false, safe: { t: 0, r: 0, b: 0, l: 0 } });
  const SKEY = (CFG.id || 'game') + '.touch.v1';
  const st = (TK.st = { mode: 'auto', size: 1, op: 0.75, left: false, fs: true });
  try { Object.assign(st, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const mm = (q) => { try { return W.matchMedia(q).matches; } catch (e) { return false; } };
  const force = new URLSearchParams(W.location.search).get('touch');
  const coarse = mm('(pointer: coarse)'), standalone = mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || !!navigator.standalone;
  TK.supported = coarse || navigator.maxTouchPoints > 0 || force === '1';
  let hid = false, autoHeld = false, autoSuspend = 0, seen = false, canvas = null, root = null, ctrls = [], built = false, menuState = null, rotState = null, ignoreRotate = false, gestured = false;
  const want = () => (force === '1' ? true : force === '0' ? false : st.mode === 'on' ? true : st.mode === 'off' ? false : coarse || seen);
  const menuOpen = CFG.menuOpen || (() => D.body.classList.contains('menu-open') || !!D.querySelector('#ui .screen:not(.hidden)'));

  /* ---- synthetic input -------------------------------------------------------------------------------------------------------------------------------------------------------- */
  const KC = { Space: 32, Enter: 13, Escape: 27, Tab: 9, ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  function keyInfo(code) {
    let key = code, kc = KC[code] || 0;
    if (/^Key[A-Z]$/.test(code)) { key = code[3].toLowerCase(); kc = code.charCodeAt(3); }
    else if (/^Digit\d$/.test(code)) { key = code[5]; kc = code.charCodeAt(5); }
    else if (code === 'Space') key = ' ';
    return { key, kc };
  }
  function fireKey(type, code, repeat) {
    const k = keyInfo(code), ev = new KeyboardEvent(type, { code, key: k.key, keyCode: k.kc, which: k.kc, repeat: !!repeat, bubbles: true, cancelable: true });
    if (ev.keyCode !== k.kc) { Object.defineProperty(ev, 'keyCode', { get: () => k.kc }); Object.defineProperty(ev, 'which', { get: () => k.kc }); }
    D.body.dispatchEvent(ev);
  }
  const heldKeys = {};                                                                          /* ref-counted, so a stick and a button can share a key */
  function hold(code) { if (!heldKeys[code]) heldKeys[code] = 0; if (heldKeys[code]++ === 0) fireKey('keydown', code); }
  function drop(code) { if (!heldKeys[code]) return; if (--heldKeys[code] === 0) { delete heldKeys[code]; fireKey('keyup', code); } }
  function tapKey(code, ms) { hold(code); setTimeout(() => drop(code), ms || 70); }
  const BTN = [1, 4, 2];
  function mouse(type, x, y, button, mx, my) {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: W, clientX: x, clientY: y, button: button || 0, buttons: type === 'mouseup' ? 0 : BTN[button || 0] });
    Object.defineProperty(ev, 'movementX', { value: mx || 0 }); Object.defineProperty(ev, 'movementY', { value: my || 0 });          /* some browsers ignore these in the constructor */
    (canvas || D.body).dispatchEvent(ev);
  }
  function pointer(type, x, y, id, button) {                                                    /* for games that read pointer events on the canvas */
    const ev = new PointerEvent(type, { bubbles: true, cancelable: true, view: W, clientX: x, clientY: y, pointerId: id || 1, pointerType: 'mouse', isPrimary: true, button: button || 0, buttons: type === 'pointerup' ? 0 : BTN[button || 0] });
    (canvas || D.body).dispatchEvent(ev);
  }
  TK.hold = hold; TK.drop = drop; TK.tapKey = tapKey; TK.mouse = mouse; TK.pointer = pointer;

  /* ---- DOM helpers ------------------------------------------------------------------------------------------------------------------------------------------------------------ */
  function div(cls, parent, text) { const e = D.createElement('div'); if (cls) e.className = cls; if (text) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function rgba(hex, a) { const n = parseInt(hex.replace('#', ''), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function zone(spec, parent) {
    const z = div('tk-zone', parent), b = spec.zone || [0, 0, 1, 1], x0 = st.left && spec.mirror !== false ? 1 - b[2] : b[0], x1 = st.left && spec.mirror !== false ? 1 - b[0] : b[2];
    z.style.left = x0 * 100 + '%'; z.style.top = b[1] * 100 + '%'; z.style.width = (x1 - x0) * 100 + '%'; z.style.height = (b[3] - b[1]) * 100 + '%';
    z.addEventListener('contextmenu', (e) => e.preventDefault());
    return z;
  }
  function claim(z, c, spec) {                                                                  /* one pointer per control; capture so the release is always seen */
    z.addEventListener('pointerdown', (e) => {
      if (c.pid !== null || e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); c.pid = e.pointerId; try { z.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      c.down(e);
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === c.pid) { e.preventDefault(); c.move(e); } });
    const up = (e) => { if (e.pointerId !== c.pid) return; c.pid = null; c.up(e); };
    z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up); z.addEventListener('lostpointercapture', up);
    c.reset = () => { if (c.pid !== null) { c.pid = null; c.up({}); } };
    c.pid = null; ctrls.push(c); return c;
  }

  /* ---- controls --------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  function mkButton(spec, parent) {
    const b = div('tk-btn' + (spec.cls ? ' ' + spec.cls : ''), parent, typeof spec.label === 'function' ? spec.label() : spec.label), p = spec.pos || {};
    const flip = { l: 'r', r: 'l' }, sz = spec.size || 72;
    for (const k in p) {
      const side = st.left && spec.mirror !== false ? flip[k] || k : k, prop = { l: 'left', r: 'right', t: 'top', b: 'bottom' }[side];
      b.style[prop] = 'calc(var(--sa' + side + ') + ' + p[k] + 'px)';
    }
    b.style.width = b.style.height = 'calc(var(--k) * ' + sz + 'px)'; b.style.fontSize = 'calc(var(--k) * ' + Math.round(sz * 0.2) + 'px)';
    const keys = spec.keys || (spec.key ? [spec.key] : []);
    const c = claim(b, {
      down(e) {
        if (spec.toggle) { c.state = !c.state; b.classList.toggle('lit', c.state); if (spec.onToggle) spec.onToggle(c.state); return; }
        b.classList.add('on');
        if (spec.suspendAuto) TK.suspendAuto(true);
        keys.forEach((k) => (spec.hold === false ? tapKey(k) : hold(k)));
        if (spec.mouse !== undefined) { const r = b.getBoundingClientRect(); mouse('mousedown', r.left + r.width / 2, r.top + r.height / 2, spec.mouse); }
        if (spec.onDown) spec.onDown(e);
      },
      move() {},
      up(e) {
        if (spec.toggle) return;
        b.classList.remove('on');
        if (spec.suspendAuto) TK.suspendAuto(false);
        if (spec.hold !== false) keys.forEach((k) => drop(k));
        if (spec.mouse !== undefined) { const r = b.getBoundingClientRect(); mouse('mouseup', r.left + r.width / 2, r.top + r.height / 2, spec.mouse); }
        if (spec.onUp) spec.onUp(e);
      },
    }, spec);
    c.el = b; c.spec = spec; return c;
  }
  function mkStick(spec, parent) {
    const z = zone(spec, parent), ring = div('tk-stick', parent), knob = div('tk-knob', ring), rest = div('tk-rest', parent), K = spec.keys || {};
    const R = () => (spec.r || 56) * st.size, b = spec.zone || [0, 0.4, 0.5, 1], at = spec.at || [(b[0] + b[2]) / 2, b[1] + (b[3] - b[1]) * 0.68];
    rest.style.left = (st.left && spec.mirror !== false ? 1 - at[0] : at[0]) * 100 + '%'; rest.style.top = at[1] * 100 + '%';
    ring.dataset.when = rest.dataset.when = spec.when || 'play';
    rest.style.setProperty('--r', 'calc(var(--k) * ' + (spec.r || 56) + 'px)');
    let ox = 0, oy = 0, held = {}, axis = '';
    const place = () => { ring.style.left = ox + 'px'; ring.style.top = oy + 'px'; };
    function setKeys(want) {
      for (const k in held) if (!want[k]) { drop(k); delete held[k]; }
      for (const k in want) if (!held[k]) { hold(k); held[k] = 1; }
    }
    function upd(e) {
      let dx = e.clientX - ox, dy = e.clientY - oy; const r = R(), d = Math.hypot(dx, dy);
      if (d > r) { const f = (d - r) / d; if (spec.follow !== false) { ox += dx * f; oy += dy * f; place(); } dx -= dx * f; dy -= dy * f; }          /* the stick follows a thumb that drifts */
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const th = r * (spec.dead || 0.3), want = {}, mode = spec.mode || '4';
      if (spec.onMove) spec.onMove(dx / r, dy / r);
      if (mode === 'h') { if (dx < -th) want[K.l] = 1; else if (dx > th) want[K.r] = 1; }
      else if (mode === '8') { if (dx < -th) want[K.l] = 1; else if (dx > th) want[K.r] = 1; if (dy < -th) want[K.u] = 1; else if (dy > th) want[K.d] = 1; }
      else {                                                                                  /* 4-way: the stronger axis wins, with a little stickiness so it doesn't flicker on a diagonal */
        const ax = Math.abs(dx) * (axis === 'x' ? 1.3 : 1), ay = Math.abs(dy) * (axis === 'y' ? 1.3 : 1);
        if (Math.max(ax, ay) > th) { if (ax >= ay) { axis = 'x'; want[dx < 0 ? K.l : K.r] = 1; } else { axis = 'y'; want[dy < 0 ? K.u : K.d] = 1; } } else axis = '';
      }
      delete want.undefined; setKeys(want);
    }
    const c = claim(z, {
      down(e) { ox = e.clientX; oy = e.clientY; place(); ring.classList.add('on'); rest.classList.add('off'); knob.style.transform = 'translate(0,0)'; axis = ''; if (spec.onMove) spec.onMove(0, 0); },
      move: upd,
      up() { ring.classList.remove('on'); rest.classList.remove('off'); setKeys({}); if (spec.onMove) spec.onMove(0, 0); },
    }, spec);
    c.el = z; return c;
  }
  function mkDrag(spec, parent) {                                                               /* a finger acting as the mouse: absolute position; fire:true holds the left button while touching, tapFire clicks on a short tap, fireKey holds a key while touching */
    const z = zone(spec, parent); let lx = 0, ly = 0, t0 = 0, dist = 0, fk = null;
    const dy = spec.dy || 0, usePointer = spec.events === 'pointer';
    const moveTo = (x, y, mx, my) => (usePointer ? pointer('pointermove', x, y + dy, 1) : mouse('mousemove', x, y + dy, 0, mx, my));
    const c = claim(z, {
      down(e) {
        lx = e.clientX; ly = e.clientY; t0 = performance.now(); dist = 0; moveTo(lx, ly, 1, 1);
        if (spec.fire !== false && !usePointer) mouse('mousedown', lx, ly + dy, 0);
        fk = typeof spec.fireKey === 'function' ? spec.fireKey() : spec.fireKey; if (fk) hold(fk);
      },
      move(e) { const mx = e.clientX - lx, my = e.clientY - ly; lx = e.clientX; ly = e.clientY; dist += Math.abs(mx) + Math.abs(my); if (mx || my) moveTo(lx, ly, mx, my); },
      up() {
        if (spec.fire !== false && !usePointer) mouse('mouseup', lx, ly + dy, 0);
        else if (spec.tapFire && dist < 14 && performance.now() - t0 < 320) { const x = lx, y = ly + dy; mouse('mousedown', x, y, 0); setTimeout(() => mouse('mouseup', x, y, 0), 40); }
        if (fk) { drop(fk); fk = null; }
      },
    }, spec);
    c.el = z; return c;
  }
  function mkSwipe(spec, parent) {                                                              /* a flick in a direction taps that direction's key */
    const z = zone(spec, parent), K = spec.keys || {}, min = spec.min || 26; let sx = 0, sy = 0;
    const c = claim(z, {
      down(e) { sx = e.clientX; sy = e.clientY; },
      move(e) {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
        const k = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? K.l : K.r) : dy < 0 ? K.u : K.d;
        if (k) tapKey(k, 60);
        sx = e.clientX; sy = e.clientY;
      },
      up() {},
    }, spec);
    c.el = z; return c;
  }
  function mkTap(spec, parent) {                                                                /* a short tap clicks the mouse at that spot */
    const z = zone(spec, parent); let sx = 0, sy = 0, moved = false;
    const c = claim(z, {
      down(e) { sx = e.clientX; sy = e.clientY; moved = false; if (spec.track) mouse('mousemove', sx, sy, 0, 1, 1); },
      move(e) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) moved = true; if (spec.track) mouse('mousemove', e.clientX, e.clientY, 0, e.clientX - sx || 1, e.clientY - sy); },
      up(e) { if (!moved && e.clientX !== undefined) { mouse('mousemove', e.clientX, e.clientY, 0, 1, 1); mouse('mousedown', e.clientX, e.clientY, spec.button || 0); setTimeout(() => mouse('mouseup', e.clientX, e.clientY, spec.button || 0), 40); } },
    }, spec);
    c.el = z; return c;
  }
  function mkAimFire(spec, parent) {                                                            /* a fire button that is also an aim stick: hold = fire (key), drag from the centre = aim; CFG.onAim(nx, ny) gets a unit-ish vector, or null when centred */
    const b = div('tk-btn tk-aimfire' + (spec.cls ? ' ' + spec.cls : ''), parent, spec.label), knob = div('tk-knob', b), p = spec.pos || {}, sz = spec.size || 96, flip = { l: 'r', r: 'l' };
    for (const k in p) { const side = st.left && spec.mirror !== false ? flip[k] || k : k, prop = { l: 'left', r: 'right', t: 'top', b: 'bottom' }[side]; b.style[prop] = 'calc(var(--sa' + side + ') + ' + p[k] + 'px)'; }
    b.style.width = b.style.height = 'calc(var(--k) * ' + sz + 'px)'; b.style.fontSize = 'calc(var(--k) * ' + Math.round(sz * 0.18) + 'px)';
    const aim = (e) => {
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), full = r.width * (spec.reach || 0.9), dead = r.width * 0.16;
      if (d < dead) { knob.style.transform = 'translate(0,0)'; if (spec.onAim) spec.onAim(null); return; }
      const m = Math.min(d, full) / d; knob.style.transform = 'translate(' + dx * m * 0.5 + 'px,' + dy * m * 0.5 + 'px)'; if (spec.onAim) spec.onAim(dx / d, dy / d);
    };
    const c = claim(b, {
      down(e) { b.classList.add('on'); if (spec.key) hold(spec.key); aim(e); },
      move(e) { aim(e); },
      up() { b.classList.remove('on'); if (spec.key) drop(spec.key); knob.style.transform = 'translate(0,0)'; if (spec.onAim) spec.onAim(null); },
    }, spec);
    c.el = b; c.spec = spec; return c;
  }
  const MAKE = { aimfire: mkAimFire, btn: mkButton, stick: mkStick, drag: mkDrag, swipe: mkSwipe, tap: mkTap };

  function build() {
    canvas = D.querySelector(CFG.canvas || '#game');
    if (!root) { root = D.createElement('div'); root.id = 'touch'; (canvas && canvas.parentNode ? canvas.after(root) : D.body.appendChild(root)); root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); }
    ctrls.forEach((c) => c.reset && c.reset()); ctrls = []; root.textContent = '';
    const list = (CFG.controls || []).slice();
    if (CFG.pause !== false) list.push({ t: 'btn', id: 'pause', label: '| |', key: (CFG.pause && CFG.pause.key) || 'KeyP', hold: false, size: 42, cls: 'tk-small', when: 'play', pos: (CFG.pause && CFG.pause.pos) || { r: 12, t: 10 }, mirror: !!(CFG.pause && CFG.pause.mirror) });
    list.forEach((s) => { const c = MAKE[s.t](s, root); if (c && c.el) { c.el.dataset.tk = s.id || s.t; c.el.dataset.when = s.when || 'play'; c.spec = s; } });
    built = true; style();
  }
  function style() {
    if (!root) return;
    root.style.setProperty('--k', st.size); root.style.setProperty('--op', st.op);
    const a = CFG.accent || '#37e6ff'; root.style.setProperty('--tk', a); root.style.setProperty('--tk-a', rgba(a, 0.5)); root.style.setProperty('--tk-f', rgba(a, 0.16));
  }

  /* ---- state: touch on/off, menus, rotate prompt ------------------------------------------------------------------------------------------------------------------------------ */
  function releaseAll() { ctrls.forEach((c) => c.reset && c.reset()); for (const k in heldKeys) { delete heldKeys[k]; fireKey('keyup', k); } autoHeld = false; autoSuspend = 0; }
  /* CFG.autoKeys: keys the layer holds down by itself while a race / level is running (e.g. accelerate), unless a control suspends them (a brake button) */
  function syncAuto() {
    const want = !!(CFG.autoKeys && TK.on && !menuState && !rotState && !hid && autoSuspend <= 0);
    if (want !== autoHeld) { autoHeld = want; CFG.autoKeys.forEach((k) => (want ? hold(k) : drop(k))); }
  }
  TK.suspendAuto = (on) => { autoSuspend = Math.max(0, autoSuspend + (on ? 1 : -1)); syncAuto(); };
  function refresh() {
    const on = want();
    if (on !== TK.on) { TK.on = on; D.body.classList.toggle('touch', on); if (on && !built) build(); if (!on) releaseAll(); W.dispatchEvent(new Event('resize')); }
    const menu = menuOpen();
    if (menu !== menuState) { menuState = menu; D.body.classList.toggle('tk-menu', menu); if (menu) releaseAll(); }
    const need = on && !ignoreRotate && CFG.orient !== 'any' && Math.min(W.innerWidth, W.innerHeight) < 700 && W.innerWidth > W.innerHeight !== (CFG.orient === 'landscape');
    if (need !== rotState) { rotState = need; D.body.classList.toggle('rotate-needed', need); if (need) { releaseAll(); W.dispatchEvent(new Event('blur')); try { if (CFG.onRotate) CFG.onRotate(); } catch (e) { /* ignore */ } } }
    syncAuto();
  }
  TK.refresh = refresh;

  function buildRotate() {
    const r = div('', D.body); r.id = 'tk-rotate';
    r.innerHTML = '<svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true"><g class="ph" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="20" y="6" width="24" height="44" rx="4"/><path d="M30 44h4"/></g><path d="M50 52a18 18 0 0 1-30 8M20 60l-1-9m1 9l9-1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>' +
      '<p class="big">ROTATE YOUR DEVICE</p><p class="sm">' + (CFG.title || 'This game') + ' plays best in ' + (CFG.orient === 'landscape' ? 'landscape' : 'portrait') + '.</p><button type="button">PLAY ANYWAY</button>';
    r.querySelector('button').addEventListener('click', () => { ignoreRotate = true; refresh(); });
  }

  /* ---- settings screen ---------------------------------------------------------------------------------------------------------------------------------------------------------- */
  function buildSettings() {
    const panel = D.querySelector('#settings .panel');
    if (!panel || !TK.supported || CFG.settings === false) return;
    const g = div('tk-set', panel);
    g.innerHTML = '<h3>TOUCH CONTROLS</h3>' +
      '<label>On-screen controls <select id="tkMode"><option value="auto">Auto</option><option value="on">Always on</option><option value="off">Off</option></select></label>' +
      '<label>Control size <input id="tkSize" type="range" min="0.8" max="1.4" step="0.05"></label>' +
      '<label>Opacity <input id="tkOp" type="range" min="0.3" max="1" step="0.05"></label>' +
      '<label class="check"><input id="tkLeft" type="checkbox"> Left-handed layout</label>' +
      '<label class="check"><input id="tkFs" type="checkbox"> Fullscreen on first tap</label>';
    const $ = (id) => g.querySelector('#' + id);
    $('tkMode').value = st.mode; $('tkSize').value = st.size; $('tkOp').value = st.op; $('tkLeft').checked = st.left; $('tkFs').checked = st.fs;
    $('tkMode').addEventListener('change', (e) => { st.mode = e.target.value; save(); refresh(); });
    $('tkSize').addEventListener('input', (e) => { st.size = +e.target.value; save(); style(); });
    $('tkOp').addEventListener('input', (e) => { st.op = +e.target.value; save(); style(); });
    $('tkLeft').addEventListener('change', (e) => { st.left = e.target.checked; save(); if (built) build(); });
    $('tkFs').addEventListener('change', (e) => { st.fs = e.target.checked; save(); });
  }

  /* ---- first gesture: audio, fullscreen, orientation lock, wake lock ------------------------------------------------------------------------------------------------------------- */
  let wl = null;
  function wakeLock() { try { if (navigator.wakeLock && !wl) navigator.wakeLock.request('screen').then((l) => { wl = l; l.addEventListener('release', () => { wl = null; }); }, () => {}); } catch (e) { /* ignore */ } }
  function goFullscreen() {
    const d = D.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!rq || D.fullscreenElement || D.webkitFullscreenElement) return;
    const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock(CFG.orient === 'landscape' ? 'landscape' : 'portrait').catch(() => {}); } catch (e) { /* ignore */ } };
    try { const p = rq.call(d, { navigationUI: 'hide' }); if (p && p.then) p.then(lock, () => {}); else lock(); } catch (e) { /* ignore */ }
  }
  function onGesture(e) {
    if (!e.isTrusted) return;
    try { if (CFG.unlock) CFG.unlock(); } catch (er) { /* ignore */ }                          /* iOS only lets audio start from touchend / click */
    if (!TK.on || gestured) return;
    gestured = true;
    if (st.fs && !standalone) goFullscreen();
    wakeLock();
  }

  /* ---- layout hook: the game's resize() calls this after it has set view.{w,h,s,ox,oy} ----------------------------------------------------------------------------------------- */
  const probe = D.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  function readSafe() { const c = W.getComputedStyle(probe); TK.safe = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; }
  TK.layout = function (view, gw, gh) {
    if (!TK.on || CFG.orient === 'landscape' || CFG.bias === false) return;
    readSafe();
    const free = view.h - gh * view.s;
    if (free > view.h * 0.2) view.oy = Math.min(view.oy, TK.safe.t + 6);                    /* tall phone: playfield to the top, the band underneath is for the thumb */
  };

  /* ---- init --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  function init() {
    D.body.appendChild(probe); readSafe();
    D.body.dataset.orient = CFG.orient || 'portrait';
    if (CFG.hint) D.querySelectorAll('#ui .hint').forEach((h) => { const t = D.createElement('p'); t.className = 'hint thint'; t.innerHTML = CFG.hint; h.after(t); });
    buildRotate(); buildSettings();
    D.addEventListener('pointerdown', (e) => { if (e.isTrusted && e.pointerType === 'touch' && !seen) { seen = true; refresh(); } }, true);
    D.addEventListener('pointerup', onGesture, true); D.addEventListener('touchend', onGesture, true);
    D.addEventListener('gesturestart', (e) => e.preventDefault());
    D.addEventListener('visibilitychange', () => { if (!D.hidden) { if (gestured && TK.on) wakeLock(); } else releaseAll(); });
    W.addEventListener('resize', refresh); W.addEventListener('orientationchange', () => setTimeout(refresh, 200));
    if (W.visualViewport) W.visualViewport.addEventListener('resize', refresh);
    W.addEventListener('blur', releaseAll);
    const mo = new MutationObserver(refresh), ui = D.getElementById('ui');
    mo.observe(D.body, { attributes: true, attributeFilter: ['class'] }); if (ui) mo.observe(ui, { attributes: true, subtree: true, attributeFilter: ['class'] });
    refresh();
    /* CFG.hide(): the game is on a canvas screen that needs plain taps (upgrade cards, ...), so the controls step aside */
    /* CFG.screen(): 'play' or 'menu' for games whose menus are drawn on the canvas (controls with when:'menu' show only then); spec.show(): hide a control until it is useful */
    let scr = 'play';
    setInterval(() => {
      if (!TK.on) return;
      if (autoHeld) CFG.autoKeys.forEach((k) => fireKey('keydown', k, true));          /* like a keyboard's auto-repeat: a game that clears its key state when a race starts picks the held key up again */
      if (CFG.hide) { const h = !!CFG.hide(); if (h !== hid) { hid = h; D.body.classList.toggle('tk-hide', h); if (h) releaseAll(); syncAuto(); } }
      if (CFG.screen) { const sc = CFG.screen() === 'menu' ? 'menu' : 'play'; if (sc !== scr) { scr = sc; D.body.classList.toggle('tk-scr-menu', sc === 'menu'); releaseAll(); } }
      for (const c of ctrls) if (c.spec && c.spec.show && c.el) { const v = !!c.spec.show(); if (c.shown !== v) { c.shown = v; c.el.style.display = v ? '' : 'none'; if (!v && c.reset) c.reset(); } }
      if (CFG.tick) CFG.tick(ctrls);
    }, 120);
  }
  if (D.body) init(); else D.addEventListener('DOMContentLoaded', init);
})();
