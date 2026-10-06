/* An autopilot with the same input interface as the player: used for the title-screen attract mode and for headless testing. */
(function (G) {
  'use strict';
  const B = {}, Sc = G.scene, clamp = G.U.clamp;
  G.bot = B;
  B.make = function (g, skill) {
    skill = skill === undefined ? 1 : skill;
    const I = { moveX: 0, moveY: 0, fire: true, lock: false, mx: 240, my: 120, mouseMoved: true, padAim: false, rx: 0, ry: 0, _tap: false, _vol: false, _bomb: false, lockT: 4, k: {}, think: 0, tx: 0, ty: 40, ex: 0, ey: 0, errT: 0,
      takeTap() { return false; }, takeVolley() { const v = this._vol; this._vol = false; return v; }, takeBomb() { const v = this._bomb; this._bomb = false; return v; }, takePause() { return false; } };
    I.update = function (dt) {
      const P = g.P; if (!P || P.dead || (g.state !== 'play' && g.state !== 'boss' && g.state !== 'intro' && g.state !== 'clear')) { I.moveX = I.moveY = 0; I.lock = false; return; }
      let tx = P.x, ty = P.y, avoid = false;
      for (const p of g.props) {
        if (p.dead || p.z < -5 || p.z > 760) continue;
        if (p.kind === 'gate') { tx = p.gx; ty = p.gy; avoid = true; break; }
        if (p.z < 200 + 320 * skill && Math.abs(p.x - P.x) < p.rw + 28 && P.y - 14 < p.h && (p.kind !== 'ast' || Math.abs(p.y - P.y) < p.rw + 22)) { const dir = P.x >= p.x ? 1 : -1; tx = p.x + dir * (p.rw + 44); if (p.kind === 'ast') ty = P.y + (P.y >= p.y ? 1 : -1) * 30; avoid = true; }
      }
      if (!avoid) for (const e of g.eshots) if (e.z > 0 && e.z < 160 + 260 * skill && Math.abs(e.x - P.x) < 20 && Math.abs(e.y - P.y) < 22) { tx = P.x + (P.x >= e.x ? 1 : -1) * 34; ty = P.y + (P.y >= e.y ? 1 : -1) * 18; avoid = true; break; }
      if (!avoid) for (const f of g.foes) if (!f.dead && !f.boss && f.z > -10 && f.z < 150 + 230 * skill && Math.abs(f.x - P.x) < f.rw + 22 && Math.abs(f.y - P.y) < f.rh + 24) { tx = P.x + (P.x >= f.x ? 1 : -1) * 40; avoid = true; break; }
      let tgt = null, bz = 1e9;
      for (const f of g.foes) if (!f.dead && f.lockable && f.z > 60 && f.z < 1900 && f.z < bz) { bz = f.z; tgt = f; }
      if (tgt) { if (!avoid) { tx = tgt.x; ty = tgt.y + (tgt.type === 5 ? 20 : 0); } Sc.proj(tgt.x, tgt.y, tgt.z); I.mx = Sc.px; I.my = Sc.py; } else { Sc.proj(P.x, P.y, 900); I.mx = Sc.px; I.my = Sc.py; }
      if (g.corridor()) { tx = clamp(tx, -g.xb(), g.xb()); }
      I.think -= dt; if (I.think <= 0 || skill >= 1) { I.think = 0.42 - 0.38 * skill; I.tx = tx; I.ty = ty; }
      I.errT -= dt; if (I.errT <= 0) { I.errT = 0.3; const e = 34 * (1 - skill); I.ex = (Math.random() - 0.5) * e * 2; I.ey = (Math.random() - 0.5) * e * 2; }
      I.mx += I.ex; I.my += I.ey;
      I.moveX = clamp((I.tx - P.x) / 16, -1, 1); I.moveY = clamp((I.ty - P.y) / 12, -1, 1);
      I.fire = true; I.lockT -= dt;
      if (I.lockT <= 0 && !I.lock && g.foes.length > 2) { I.lock = true; I.lockT = 0.9; } else if (I.lock && I.lockT <= 0) { I.lock = false; I._vol = true; I.lockT = 5 + Math.random() * 3; }
      let near = 0; for (const e of g.eshots) if (e.z < 500) near++;
      if (near >= 9 && P.bombs > 0 && Math.random() < 0.02) I._bomb = true;
    };
    return I;
  };
})((window.SGS = window.SGS || {}));
