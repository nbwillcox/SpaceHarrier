/* Keyboard + mouse + gamepad. WASD/arrows/left stick fly; the mouse (or right stick) moves the crosshair; tap left click = one cannon shot,
   hold left click = paint lock-ons, release = homing volley; Space/X/right click = auto-fire; Q/E/B/middle click = bomb; P/Esc = pause. */
(function (G) {
  'use strict';
  const S = G.settings;
  const I = { moveX: 0, moveY: 0, fire: false, lock: false, mx: 0, my: 0, mouseMoved: false, padAim: false, rx: 0, ry: 0, lmb: false, lmbT: 0, k: {}, _prev: {}, _tap: false, _vol: false, _bomb: false, _pause: false, _any: false, view: { l: 0, t: 0, w: 1, h: 1, iw: 1, ih: 1 } };
  const MAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'f', KeyX: 'f', KeyJ: 'f', ShiftLeft: 'k', ShiftRight: 'k', KeyC: 'k', KeyK: 'k', KeyQ: 'b', KeyE: 'b', KeyB: 'b' };
  const typing = (t) => { const n = t && t.tagName; return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT'; };
  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    const m = MAP[e.code];
    if (m) { if (!I.k[m] && m === 'b') I._bomb = true; I.k[m] = true; }
    if (!e.repeat) { if (e.code === 'KeyP' || e.code === 'Escape') I._pause = true; I._any = true; }
    if ((m || e.code === 'KeyP') && e.target.tagName !== 'BUTTON') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { const m = MAP[e.code]; if (m) I.k[m] = false; });
  window.addEventListener('blur', () => { I.k = {}; I.lmb = false; });
  const toView = (e) => { const v = I.view; I.mx = Math.max(0, Math.min(v.iw, (e.clientX - v.l) / v.w * v.iw)); I.my = Math.max(0, Math.min(v.ih, (e.clientY - v.t) / v.h * v.ih)); };
  window.addEventListener('pointermove', (e) => { toView(e); I.mouseMoved = true; I.padAim = false; });
  window.addEventListener('pointerdown', (e) => {
    if (!e.target || e.target.id !== 'game') return;
    toView(e); I.mouseMoved = true; I.padAim = false; I._any = true;
    if (e.button === 0) { I.lmb = true; I.lmbT = 0; } else if (e.button === 2) I.k.f = true; else if (e.button === 1) { I._bomb = true; e.preventDefault(); }
  });
  window.addEventListener('pointerup', (e) => { if (e.button === 0 && I.lmb) { I.lmb = false; if (I.lmbT < 0.17) I._tap = true; else I._vol = true; I.lmbT = 0; } else if (e.button === 2) I.k.f = false; });
  window.addEventListener('contextmenu', (e) => { if (e.target && e.target.id === 'game') e.preventDefault(); });
  I.takeTap = () => { const b = I._tap; I._tap = false; return b; };
  I.takeVolley = () => { const b = I._vol; I._vol = false; return b; };
  I.takeBomb = () => { const b = I._bomb; I._bomb = false; return b; };
  I.takePause = () => { const b = I._pause; I._pause = false; return b; };
  I.clear = () => { I.k = {}; I.lmb = false; I.lmbT = 0; I.moveX = I.moveY = 0; I.fire = I.lock = false; I._tap = I._vol = I._bomb = I._pause = I._any = false; };
  I.setView = (l, t, w, h, iw, ih) => { I.view = { l, t, w, h, iw, ih }; };
  /* sample the devices once per frame (call before the fixed-step loop) */
  I.poll = function (dt) {
    const k = I.k;
    let mx = (k.r ? 1 : 0) - (k.l ? 1 : 0), my = (k.u ? 1 : 0) - (k.d ? 1 : 0), fire = !!k.f, lock = !!k.k, rx = 0, ry = 0;
    if (I.lmb) I.lmbT += dt;
    if (I.lmb && I.lmbT >= 0.17) lock = true;
    if (S.gamepad && navigator.getGamepads) {
      for (const g of navigator.getGamepads()) {
        if (!g || !g.connected) continue;
        const dz = (v) => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8), bt = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
        const ax = dz(g.axes[0] || 0), ay = dz(g.axes[1] || 0), bx = dz(g.axes[2] || 0), by = dz(g.axes[3] || 0);
        mx += ax + (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0); my += -ay + (bt(12) ? 1 : 0) - (bt(13) ? 1 : 0);
        rx = bx; ry = by; if (bx || by) I.padAim = true;
        fire = fire || bt(0) || bt(6);
        const glock = bt(7) || bt(5), gb = bt(1) || bt(2) || bt(3);
        lock = lock || glock;
        if (gb && !I._prev.b) I._bomb = true;
        if (bt(9) && !I._prev.s) I._pause = true;
        if (!glock && I._prev.l) I._vol = true;
        I._prev = { b: gb, s: bt(9), l: glock };
        if (bt(0) || bt(1) || bt(7) || bt(9)) I._any = true;
        break;
      }
    }
    // keyboard lock key: releasing it fires the volley
    if (!k.k && I._prevK) I._vol = true;
    I._prevK = !!k.k;
    I.moveX = Math.max(-1, Math.min(1, mx)); I.moveY = Math.max(-1, Math.min(1, my));
    if (S.invertY) I.moveY = -I.moveY;
    I.fire = fire; I.lock = lock; I.rx = rx; I.ry = ry;
  };
  G.input = I;
})((window.SGS = window.SGS || {}));
