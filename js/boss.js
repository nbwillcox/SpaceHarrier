/* Bosses (one per world, the last stage of each): a serpent, a mech, a stone golem, a magma serpent, a warship and the Abyss. Their parts are ordinary foes
   (so cannon shots and lock-on work on them) positioned from one anchor each frame. */
(function (G) {
  'use strict';
  const C = G.C, U = G.U, Sc = G.scene, A = G.art, PX = G.px, BA = G.bossart;
  const B = {};
  G.boss = B;
  const rnd = U.rand, clamp = U.clamp, snd = (n) => { const a = G.audio; if (a && a.sfx && a.sfx[n]) a.sfx[n](); };
  const AI = [], INIT = [];
  const hue = (g) => g.wd.hue;

  /* a boss part: a foe with an offset from the boss anchor */
  function part(g, b, o) {
    const hp = Math.max(1, Math.round(o.hp * 1.2 * g.diff.hp * (g.mode === 'endless' ? 1 + (g.stage - 1) * 0.06 : 1)));
    const f = Object.assign({ type: -1, boss: true, bossRef: b, x: b.x, y: b.y, z: b.z, ox: 0, oy: 0, oz: 0, rw: 20, rh: 20, rd: 36, hp, maxhp: hp, pts: 600, t: 0, ph: 0, hit: 0, dead: false, lockable: true, state: 'in', carry: null, noShadow: true }, o);
    f.hp = hp; f.maxhp = hp;
    f.update = (gg, dt) => { f.t += 0; follow(f, b); if (f.tick) f.tick(gg, dt, b); if (f.contact && !f.dead) touch(gg, f); };
    f.draw = (ctx, gg, ff, time) => drawPart(ctx, gg, ff, b, time);
    f.onKill = (gg) => { if (f.core) defeat(gg, b); else if (f.kill) f.kill(gg, b); };
    g.foes.push(f); b.parts.push(f); return f;
  }
  const follow = (f, b) => { f.x = b.x + f.ox; f.y = b.y + f.oy; f.z = b.z + f.oz; };
  function touch(g, f) {
    const P = g.P; if (P.dead || f.z > 34 || f.z < -24) return;
    if (Math.abs(f.x - P.x) < f.rw * 0.8 + 7 && Math.abs(f.y - P.y) < f.rh * 0.8 + 9) g.hurtPlayer();
  }
  function drawPart(ctx, g, f, b, time) {
    if (f.dead || !f.spr) return;
    const sp = (b.rage ? b.spR : b.sp)[f.spr]; if (!sp) return;
    Sc.proj(f.x, f.y, f.z); if (Sc.ps > 3) return;
    const s = f.hit > 0 ? A.flash(sp) : sp;
    A.draw(ctx, s, Sc.px, Sc.py, Sc.ps * (f.scl || 1), !!f.flip);
    if (f.invuln && !f.deco && !b.entering) { ctx.strokeStyle = 'rgba(122,255,255,0.55)'; ctx.lineWidth = 1; const r = Math.max(8, f.rw * 2 * Sc.ps); ctx.beginPath(); ctx.ellipse(Sc.px, Sc.py, r, r * 0.85, 0, 0, 6.2832); ctx.stroke(); }
  }
  /* decorative body piece: draws a sprite and soaks up shots */
  function deco(g, b, o) {
    const f = part(g, b, Object.assign({ hp: 1e6, invuln: true, lockable: false, pts: 0, deco: true }, o)); f.maxhp = 1; return f;
  }
  const shotV = (g, x, y, z, vx, vy, vz, kind, r) => g.eshots.push({ kind: kind || 'orb', x, y, z, vx, vy, vz, r: r || (kind === 'big' ? 8 : 4), dead: false, t: 0 });
  const fan = (g, src, n, spread, kind, sp) => {
    const P = g.P, base = Math.atan2(P.x - src.x, 1), s = (g.speed + 200 * g.diff.shots * 1.3) * (sp || 0.85), t = Math.max(0.3, src.z / s);
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * spread; shotV(g, src.x, src.y, src.z, (P.x - src.x) / t + a * 140, (P.y - src.y) / t + a * 30 * 0, -s, kind); }
  };
  const ring = (g, src, n, kind, spd, a0) => { const s = (g.speed + 160) * 0.8; for (let i = 0; i < n; i++) { const a = (a0 || 0) + i / n * 6.2832; shotV(g, src.x, src.y, src.z, Math.cos(a) * spd, Math.sin(a) * spd * 0.7, -s, kind); } };
  const curtain = (g, z, gapX, gapW) => { const s = (g.speed + 200) * 0.9, L = g.xb() + 30; for (let x = -L; x <= L; x += 20) if (Math.abs(x - gapX) > gapW) shotV(g, x, g.P.y + (Math.random() - 0.5) * 6, z, 0, 0, -s, 'orb', 5); };
  B.helpers = { part, deco, fan, ring, curtain, shotV };

  /* ---------- 0 / 3: serpents (head path + a trail of segments) ---------- */
  function initSerpent(g, b, nseg, mag) {
    b.sp = BA.build(b.k, hue(g), false); b.spR = BA.build(b.k, hue(g), true); b.hist = []; b.u = 0; b.nseg = nseg; b.mag = mag; b.charge = 0; b.atk = 2; b.ringT = 6; b.chargeT = 9;
    const head = part(g, b, { name: 'head', spr: 'head', rw: 46, rh: 40, hp: b.k === 3 ? 56 : 42, core: true, pts: 6000, contact: true, rd: 40, scl: 1.5 });
    b.head = head; head.tick = null;
    b.segs = [];
    for (let i = 0; i < nseg; i++) { const s = part(g, b, { name: 'seg', spr: i === nseg - 1 ? 'tail' : 'seg', rw: i === nseg - 1 ? 24 : 32, rh: i === nseg - 1 ? 24 : 32, hp: 6, pts: 300, contact: true, idx: i, scl: 1.3 - i * 0.03 }); s.update = (gg, dt) => { const h = b.hist, d = Math.min(h.length - 1, Math.round((i + 1) * 5.2)); if (d >= 0 && h[d]) { s.x = h[d].x; s.y = h[d].y; s.z = h[d].z + (i + 1) * 4; } if (s.contact && !s.dead) touch(gg, s); }; b.segs.push(s); }
    head.update = (gg, dt) => { head.x = b.hx; head.y = b.hy; head.z = b.hz; if (!head.dead) touch(gg, head); };
    b.hx = 0; b.hy = 60; b.hz = 340;
  }
  function aiSerpent(g, b, dt) {
    const P = g.P, rage = b.rage, sp = (rage ? 1.35 : 1) * (g.diff.foe), mag = b.mag;
    b.atk -= dt; b.ringT -= dt; b.chargeT -= dt;
    if (b.charge > 0) {
      b.charge -= dt; const k = b.charge / 1.7, q = k > 0.5 ? (1 - k) / 0.5 : k / 0.5;
      b.hx += (P.x - b.hx) * Math.min(1, 2.4 * dt); b.hy += (P.y - b.hy) * Math.min(1, 2.4 * dt); b.hz = 340 - q * 290;
      if (b.charge <= 0) { b.u += 0; }
    } else {
      b.u += dt * 0.95 * sp;
      const tx = Math.sin(b.u) * 105 * mag, ty = 56 + Math.sin(b.u * 1.4 + 1) * 26, tz = 350 + Math.sin(b.u * 0.8) * 100;
      b.hx += (tx - b.hx) * Math.min(1, 4 * dt); b.hy += (ty - b.hy) * Math.min(1, 4 * dt); b.hz += (tz - b.hz) * Math.min(1, 3 * dt);
      if (b.chargeT <= 0) { b.chargeT = rage ? 7 : 10; b.charge = 1.7; snd('roar'); g.banner('INCOMING!', 1, 'small'); }
      if (b.atk <= 0 && !b.head.dead) { b.atk = (rage ? 0.95 : 1.4) / g.diff.shots * 1.3; fan(g, { x: b.hx, y: b.hy, z: b.hz }, rage ? 5 : 3, 0.5, b.k === 3 ? 'fire' : 'orb'); snd('eshot'); }
      if (b.ringT <= 0 && !b.head.dead) { b.ringT = rage ? 4 : 6.5; ring(g, { x: b.hx, y: b.hy, z: b.hz }, rage ? 14 : 10, b.k === 3 ? 'fire' : 'big', 55, rnd(0, 6)); snd('boom'); }
    }
    b.hist.unshift({ x: b.hx, y: b.hy, z: b.hz }); if (b.hist.length > 110) b.hist.pop();
  }
  INIT[0] = (g, b) => initSerpent(g, b, 12, 1); AI[0] = aiSerpent;
  INIT[3] = (g, b) => initSerpent(g, b, 15, 1.2); AI[3] = aiSerpent;

  /* ---------- 1: the Warden mech ---------- */
  INIT[1] = (g, b) => {
    b.sp = BA.build(1, hue(g), false); b.spR = BA.build(1, hue(g), true); b.atk = 2.2; b.volT = 3; b.curT = 8; b.baseZ = 380;
    deco(g, b, { spr: 'body', rw: 70, rh: 66, oz: 30, oy: -4, rd: 20 });
    const mk = (side) => part(g, b, { name: 'arm', spr: 'arm', flip: side > 0, ox: side * 92, oy: -8, oz: -14, rw: 28, rh: 40, hp: 26, pts: 1500, side, tick(gg, dt) { this.fireT = (this.fireT || 1 + (side > 0 ? 0.8 : 0)) - dt; if (this.fireT <= 0 && !this.dead) { this.fireT = 1.7 / gg.diff.shots * 1.3; fan(gg, this, 3, 0.45, 'orb'); snd('eshot'); } } });
    b.armL = mk(-1); b.armR = mk(1);
    b.coreP = part(g, b, { name: 'core', spr: 'core', ox: 0, oy: 8, oz: -10, rw: 22, rh: 22, hp: 46, core: true, pts: 7000, invuln: true });
  };
  AI[1] = (g, b, dt) => {
    const sp = (b.rage ? 1.35 : 1) * g.diff.foe; b.atk -= dt; b.curT -= dt;
    b.x = Math.sin(b.t * 0.55 * sp) * 70; b.y = 66 + Math.sin(b.t * 1.2) * 6;
    const open = b.armL.dead && b.armR.dead; b.coreP.invuln = !open && !b.entering;
    if (open && !b.opened) { b.opened = true; g.banner('CORE EXPOSED', 1.4, 'small'); snd('boss'); }
    if (open && b.atk <= 0 && !b.coreP.dead) { b.atk = 1.1 / g.diff.shots * 1.3; fan(g, b.coreP, 5, 0.4, 'big', 0.75); snd('eshot'); } else if (!open) b.atk = Math.max(b.atk, 0.1);
    if (b.curT <= 0) { b.curT = open ? 5.5 : 8.5; curtain(g, 400, clamp(g.P.x + rnd(-40, 40), -g.xb() + 30, g.xb() - 30), 28); g.banner('DODGE THE GAP!', 1.1, 'small'); snd('boss'); }
  };

  /* ---------- 2: the Frost golem (head, two slamming fists) ---------- */
  INIT[2] = (g, b) => {
    b.sp = BA.build(2, hue(g), false); b.spR = BA.build(2, hue(g), true); b.baseZ = 360; b.atk = 2; b.slamT = 3; b.slammer = null;
    b.headP = part(g, b, { name: 'head', spr: 'head', ox: 0, oy: 22, oz: 0, rw: 62, rh: 54, hp: 56, core: true, pts: 7000, armor: (gg) => ((b.fistL.dead && b.fistR.dead) ? 1 : 0.35) });
    const mk = (side) => part(g, b, { name: 'fist', spr: 'fist', flip: side > 0, ox: side * 115, oy: -12, oz: -30, rw: 32, rh: 32, hp: 22, pts: 1500, side, contact: true, home: { x: side * 115, y: -12, z: -30 }, mode: 'idle', mt: 0,
      tick(gg, dt) {
        const P = gg.P, h = this.home; this.mt += dt;
        if (this.mode === 'idle') { this.ox += (h.x + Math.sin(b.t * 1.4 + side) * 10 - this.ox) * Math.min(1, 4 * dt); this.oy += (h.y + Math.sin(b.t * 1.9 + side) * 8 - this.oy) * Math.min(1, 4 * dt); this.oz += (h.z - this.oz) * Math.min(1, 4 * dt); }
        else if (this.mode === 'aim') { this.ox += (P.x - b.x - this.ox) * Math.min(1, 3.5 * dt); this.oy += (P.y - b.y - this.oy) * Math.min(1, 3.5 * dt); if (this.mt > 0.95) { this.mode = 'punch'; this.mt = 0; snd('roar'); } }
        else if (this.mode === 'punch') { this.oz = -30 - (this.mt / 0.3) * (b.z - 10); if (this.mt > 0.3) { this.mode = 'back'; this.mt = 0; gg.shake = 6; snd('boom'); } }
        else if (this.mode === 'back') { this.oz += (h.z - this.oz) * Math.min(1, 5 * dt); if (this.mt > 0.8) { this.mode = 'idle'; this.mt = 0; b.slammer = null; } }
      }, kill(gg) { if (b.slammer === this) b.slammer = null; } });
    b.fistL = mk(-1); b.fistR = mk(1);
  };
  AI[2] = (g, b, dt) => {
    const sp = (b.rage ? 1.3 : 1) * g.diff.foe; b.atk -= dt; b.slamT -= dt;
    b.x = Math.sin(b.t * 0.45 * sp) * 55; b.y = 62 + Math.sin(b.t * 1.1) * 5;
    if (b.slamT <= 0 && !b.slammer) { const c = [b.fistL, b.fistR].filter((f) => !f.dead); if (c.length) { b.slammer = U.pick(c); b.slammer.mode = 'aim'; b.slammer.mt = 0; b.slamT = (b.fistL.dead && b.fistR.dead ? 2.4 : 3.6) / sp; snd('warning'); } else b.slamT = 2.4; }
    if (b.atk <= 0 && !b.headP.dead) { b.atk = (b.rage ? 1.3 : 2) / g.diff.shots * 1.3; fan(g, b.headP, 5, 0.38, 'ice'); snd('eshot'); if (b.rage) ring(g, b.headP, 8, 'ice', 45, b.t); }
  };

  /* ---------- 4: the Dreadnought (turrets, engines, an armoured bridge) ---------- */
  INIT[4] = (g, b) => {
    b.sp = BA.build(4, hue(g), false); b.spR = BA.build(4, hue(g), true); b.baseZ = 440; b.mineT = 6; b.canT = 9;
    deco(g, b, { spr: 'hull', rw: 180, rh: 70, oz: 40, oy: 0, rd: 24 });
    b.turrets = [];
    [-125, -45, 45, 125].forEach((ox, i) => b.turrets.push(part(g, b, { name: 'turret', spr: 'turret', ox, oy: -6, oz: -10, rw: 22, rh: 22, hp: 14, pts: 900, tick(gg, dt) { this.fireT = (this.fireT === undefined ? 0.8 + i * 0.45 : this.fireT) - dt; if (this.fireT <= 0 && !this.dead) { this.fireT = 2.2 / gg.diff.shots * 1.3; fan(gg, this, 2, 0.3, 'orb'); snd('eshot'); } } })));
    b.engines = [-150, 150].map((ox) => part(g, b, { name: 'engine', spr: 'engine', ox, oy: 34, oz: -6, rw: 28, rh: 28, hp: 20, pts: 1200 }));
    b.bridge = part(g, b, { name: 'bridge', spr: 'bridge', ox: 0, oy: -22, oz: -22, rw: 40, rh: 34, hp: 64, core: true, pts: 8000, armor: () => (b.turrets.every((t) => t.dead) ? 1 : 0.3) });
  };
  AI[4] = (g, b, dt) => {
    const sp = (b.rage ? 1.3 : 1) * g.diff.foe; b.mineT -= dt; b.canT -= dt;
    b.x = Math.sin(b.t * 0.35 * sp) * 70; b.y = 66 + Math.sin(b.t * 0.9) * 5;
    if (b.mineT <= 0 && !b.bridge.dead) { b.mineT = 8 / sp; for (let i = 0; i < 3; i++) { const m = g.spawnFoe(3, b.x + (i - 1) * 60, b.y + 30, b.z - 30); m.noCount = true; g.spawned--; } snd('warning'); }
    if (b.canT <= 0 && !b.bridge.dead) { b.canT = (b.rage ? 6 : 9) / sp; ring(g, b.bridge, b.rage ? 16 : 12, 'big', 60, rnd(0, 6)); curtain(g, 440, clamp(g.P.x, -g.xb() + 30, g.xb() - 30), 30); snd('boom'); }
  };

  /* ---------- 5: the Abyss (orbiting eyes shield a giant eye, then tentacles and spirals) ---------- */
  INIT[5] = (g, b) => {
    b.sp = BA.build(5, hue(g), false); b.spR = BA.build(5, hue(g), true); b.baseZ = 400; b.spin = 0; b.spT = 0; b.sumT = 8; b.curT = 10; b.phase = 0;
    b.eye = part(g, b, { name: 'eye', spr: 'eye', ox: 0, oy: 0, oz: 0, rw: 60, rh: 60, hp: 90, core: true, pts: 12000, invuln: true, armor: () => 1 });
    b.orbs = [];
    for (let i = 0; i < 6; i++) b.orbs.push(part(g, b, { name: 'orbiter', rw: 18, rh: 18, hp: 10, pts: 800, ang: i / 6 * 6.2832, noSpr: true, eyeSmall: true, tick(gg, dt) {
      this.ang += dt * (b.phase >= 2 ? 1.5 : 1); this.ox = Math.cos(this.ang) * 105; this.oy = Math.sin(this.ang) * 70; this.oz = -Math.sin(this.ang) * 30;
      this.fireT = (this.fireT === undefined ? i * 0.5 + 1 : this.fireT) - dt; if (this.fireT <= 0 && !this.dead) { this.fireT = 3 / gg.diff.shots * 1.3; fan(gg, this, 1, 0, 'orb', 0.9); }
    } }));
    for (const o of b.orbs) o.draw = (ctx, gg, f, time) => { if (f.dead) return; Sc.proj(f.x, f.y, f.z); if (Sc.ps > 3) return; const sp = A.foe[6][b.rage ? 1 : 0][Math.floor((f.t + f.ph) * 6) & 1]; A.draw(ctx, f.hit > 0 ? A.flash(sp) : sp, Sc.px, Sc.py, Sc.ps * 1.4, false); };
    b.tents = [];
  };
  function spawnTentacles(g, b) {
    [-1, 1].forEach((side) => {
      const t = part(g, b, { name: 'tentacle', rw: 24, rh: 24, hp: 16, pts: 1500, contact: true, side, noSpr: true, tick(gg, dt) { this.sw = (this.sw || 0) + dt; this.ox = side * (115 + Math.sin(this.sw * 1.3) * 30); this.oy = Math.sin(this.sw * 1.9 + side) * 45; this.oz = -40 + Math.sin(this.sw * 0.9) * 60; } });
      t.draw = (ctx, gg, f, time) => {
        if (f.dead) return; const sp = b.sp.tent;
        for (let i = 0; i <= 7; i++) { const k = i / 7; Sc.proj(b.x + side * 14 + (f.x - b.x - side * 14) * k, b.y + (f.y - b.y) * k + Math.sin(time * 3 + k * 5 + side) * 8 * Math.sin(k * 3.14), b.z - 10 + (f.z - b.z + 10) * k); if (Sc.ps < 3) A.draw(ctx, i === 7 && f.hit > 0 ? A.flash(sp) : sp, Sc.px, Sc.py, Sc.ps * (0.5 + k * 0.7), false); }
      };
      b.tents.push(t);
    });
  }
  AI[5] = (g, b, dt) => {
    const sp = g.diff.foe, alive = b.orbs.filter((o) => !o.dead).length, hpk = b.eye.hp / b.eye.maxhp; b.sumT -= dt; b.curT -= dt; b.spT -= dt;
    b.x = Math.sin(b.t * 0.4) * 40; b.y = 62 + Math.sin(b.t * 0.8) * 6;
    if (alive === 0 && b.phase < 1) { b.phase = 1; b.eye.invuln = false; g.banner('THE EYE OPENS', 1.6, 'small'); snd('roar'); g.shake = 8; spawnTentacles(g, b); }
    if (b.phase === 1 && hpk < 0.4) { b.phase = 2; b.rage = true; g.banner('FINAL FORM', 1.8, 'bad'); snd('roar'); g.shake = 10; }
    if (b.phase >= 1 && !b.eye.dead && b.spT <= 0) { b.spT = (b.phase === 2 ? 0.17 : 0.28) / sp; b.spin += 0.52; const arms = b.phase === 2 ? 3 : 2; for (let a = 0; a < arms; a++) { const an = b.spin + a * 6.2832 / arms, s = (g.speed + 140) * 0.8; shotV(g, b.x, b.y, b.z, Math.cos(an) * 70, Math.sin(an) * 50, -s, 'orb'); } }
    if (b.sumT <= 0 && b.phase >= 1 && !b.eye.dead) { b.sumT = b.phase === 2 ? 6 : 9; for (let i = 0; i < 2; i++) { const e = g.spawnFoe(6, rnd(-80, 80), rnd(30, 80), 1500); e.noCount = true; g.spawned--; } }
    if (b.curT <= 0 && b.phase >= 1 && !b.eye.dead) { b.curT = b.phase === 2 ? 6 : 10; curtain(g, 400, clamp(g.P.x, -g.xb() + 30, g.xb() - 30), 28); g.banner('DODGE THE GAP!', 1, 'small'); }
  };

  /* ---------- flow: entrance, update, defeat, HUD ---------- */
  const NAMES = ['EMERALD WYRM', 'WARDEN MECH', 'FROST GOLEM', 'MAGMA WYRM', 'DREADNOUGHT', 'THE ABYSS'];
  B.begin = function (g) {
    const k = g.mode === 'bossrush' ? g.rushIdx : G.worlds.of(g.stage);
    const b = { k, name: NAMES[k], parts: [], x: 0, y: 60, z: 2400, baseZ: 480, t: 0, rage: false, dying: false, entering: true, enterT: 0 };
    INIT[k](g, b); b.coreP = b.parts.find((f) => f.core);
    g.bossObj = b; g.speed = 250; g.chain = 0;
    g.banner('WARNING', 2.6, 'warn', NAMES[k]); snd('warning');
    if (G.audio && G.audio.music) G.audio.music('boss', 0);
  };
  function defeat(g, b) {
    if (b.dying) return;
    b.dying = true; b.dieT = 0; b.bT = 0; g.eshots.length = 0; g.P.invuln = Math.max(g.P.invuln, 30); g.shake = 10; g.flash = 0.5; snd('boom');
    for (const f of g.foes) if (!f.boss) { f.dead = true; g.explodeAt(f.x, f.y, f.z, 1); }
    for (const p of b.parts) { p.invuln = true; p.lockable = false; }
    g.locks = []; g.banner('BOSS DESTROYED', 3, 'good');
    if (G.audio && G.audio.music) G.audio.music('off');
  }
  function dying(g, b, dt) {
    b.dieT += dt; b.bT -= dt; g.shake = Math.max(g.shake, 4);
    if (b.bT <= 0) {
      b.bT = 0.1; const alive = b.parts.filter((p) => !p.dead);
      if (alive.length && Math.random() < 0.6) { const p = U.pick(alive); p.dead = true; g.explodeAt(p.x, p.y, p.z, 1.6); } else g.explodeAt(b.x + rnd(-90, 90), b.y + rnd(-50, 50), b.z + rnd(-30, 30), rnd(1.2, 2.2));
      snd(Math.random() < 0.5 ? 'boom' : 'pop');
    }
    if (b.dieT > 3) {
      for (const p of b.parts) p.dead = true;
      g.addScore(8000 + b.k * 4000, b.x, b.y + 20, b.z); g.bossObj = null; g.foes = g.foes.filter((f) => !f.boss); g.finishStage();
    }
  }
  B.update = function (g, dt) {
    const b = g.bossObj; if (!b) return;
    if (b.dying) { dying(g, b, dt); return; }
    b.t += dt;
    if (b.entering) {
      b.enterT += dt; const k = Math.min(1, b.enterT / 2.4), e = 1 - Math.pow(1 - k, 3); b.z = 2400 + (b.baseZ - 2400) * e; if (k >= 1) b.entering = false;
      if (b.hist) { b.hx = 0; b.hy = 60; b.hz = b.z; b.hist.unshift({ x: 0, y: 60, z: b.z }); if (b.hist.length > 110) b.hist.pop(); }
    } else AI[b.k](g, b, dt);
    const c = b.coreP;
    if (!b.rage && b.k !== 5 && c && !c.dead && c.hp < c.maxhp * 0.45) { b.rage = true; g.banner('ENRAGED!', 1.4, 'bad'); snd('roar'); g.shake = 6; }
  };
  B.hud = function (ctx, g, W, H, time) {
    const b = g.bossObj; if (!b || b.dying || b.entering) return;
    const c = b.coreP, cx = Math.round(W / 2), k = c ? clamp(c.hp / c.maxhp, 0, 1) : 0, armored = c && (c.invuln || (c.armor && c.armor(g) < 1));
    ctx.fillStyle = '#0b0d1a'; ctx.fillRect(cx - 82, 23, 164, 9); ctx.fillStyle = '#3a1620'; ctx.fillRect(cx - 80, 25, 160, 5);
    ctx.fillStyle = armored ? '#8a93b8' : b.rage ? '#ff5a3a' : '#ff9a3a'; ctx.fillRect(cx - 80, 25, Math.round(160 * k), 5); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx - 80, 25, Math.round(160 * k), 1);
    PX.text(ctx, b.name + (armored ? '  ARMORED' : ''), cx, 34, { s: 1, c: b.rage ? '#ff9a8a' : '#ffd0c0', o: '#0b0d1a', a: 'c' });
  };
  B.NAMES = NAMES;
})((window.SGS = window.SGS || {}));
