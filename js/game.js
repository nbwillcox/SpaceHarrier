/* Game core: the hero, cannon tiers, lock-on missiles, bombs, enemies and their bullets, obstacles, pickups, scoring and stage flow.
   World units: x sideways, y up from the floor, z ahead of the hero (the hero is at z = 0, enemies come in from z = 2700 down to 0). */
(function (G) {
  'use strict';
  const C = G.C, U = G.U, Sc = G.scene, SC = C.SC, ZFAR = C.ZFAR;
  const Game = { state: 'title', time: 0 };
  G.game = Game;
  const clamp = U.clamp, rnd = U.rand;
  const snd = (n, a, b) => { const au = G.audio; if (au && au.sfx && au.sfx[n]) au.sfx[n](a, b); };
  Game.snd = snd;
  const CANNON = [null, { n: 1, dt: 0.13 }, { n: 2, dt: 0.12 }, { n: 3, dt: 0.115 }, { n: 3, dt: 0.1 }];
  const LOCKS = [3, 5, 8, 12];

  /* ---------- geometry helpers ---------- */
  Game.corridor = () => Sc.world && Sc.world.kind === 'corridor';
  Game.XR = () => (Sc.hangar ? 300 : 150);
  Game.CH = () => (Sc.hangar ? 170 : 125);
  Game.xb = function () { const sb = (Sc.W / 2 - 34) / (0.62 * SC); return this.corridor() ? Math.min(this.XR() - 16, sb) : sb; };
  Game.yb = function () { return this.corridor() ? this.CH() - 16 : 100; };
  Game.spread = function () { return this.xb() * 1.12; };       // sideways range enemies are placed in

  /* ---------- setup ---------- */
  Game.reset = function (diff, mode, stage) {
    this.diffIdx = diff === undefined ? 1 : diff; this.diff = C.DIFF[this.diffIdx]; this.mode = mode || 'campaign';
    this.score = 0; this.lives = this.diff.lives; this.conts = this.diff.cont; this.nextExtend = C.EXTEND_AT; this.over = false; this.demo = false;
    this.P = { x: 0, y: 40, vx: 0, vy: 0, bank: 0, pitch: 0, shield: 3, invuln: 2, cannon: 1, lockTier: 0, bombs: 1, drone: 0, dead: false, deadT: 0, fireT: 0, anim: 0, flash: 0 };
    this.rankStats = null; this.rushT = 0; this.stage = stage || 1; this.endlessN = 0; this.rushIdx = 0; this.ended = false;
    const dd = new Date(); this.endlessSeed = this.mode === 'endless' ? dd.getFullYear() * 10000 + (dd.getMonth() + 1) * 100 + dd.getDate() : 0;
    this.loadStage(this.stage);
  };
  Game.loadStage = function (n) {
    const W = G.worlds, wd = W.list[W.of(n)];
    this.stage = n; this.d = Math.min(1.5, (n - 1) / 17); this.wd = wd; this.stageT = 0; this.dist = 0; this.state = 'intro'; this.introT = 2.4; this.clearT = 0;
    Sc.setWorld(wd, W.isBoss(n) && wd.kind === 'corridor');
    G.art.buildFoes(wd.foe); G.art.buildProps(wd);
    this.foes = []; this.eshots = []; this.pshots = []; this.missiles = []; this.items = []; this.parts = []; this.booms = []; this.floats = []; this.props = []; this.locks = []; this.volleyQ = [];
    this.chain = 0; this.chainT = 0; this.shake = 0; this.flash = 0; this.bossObj = null; this.bannerO = null; this.spawned = 0; this.kills = 0; this.hitsTaken = 0; this.maxChain = 0; this.stageScore = this.score;
    this.plan = G.stages.make(n, { mode: this.mode, seed: this.endlessSeed || 0 }); this.planI = 0; this.speed = this.plan.speed; this.planEnd = false;
    const P = this.P; P.invuln = Math.max(P.invuln, 2.4); P.x = 0; P.y = 40; P.dead = false;
    this.reticle = { x: Sc.W / 2, y: Sc.H * 0.45 }; this.lockOn = false; this.lockHeld = false; this.lockSweepT = 0;
    if (G.audio && G.audio.music) G.audio.music(G.worlds.isBoss(n) && false ? 'boss' : 'play', wd.music);
  };
  Game.banner = function (text, life, kind, sub) { this.bannerO = { text, sub, life: life || 2, t: 0, kind: kind || '' }; };
  Game.float = function (x, y, z, txt, col) { this.floats.push({ x, y, z, txt, col: col || '#fff', t: 0 }); if (this.floats.length > 24) this.floats.shift(); };
  Game.addScore = function (v, x, y, z) {
    const m = this.mode === 'bossrush' ? 1 : 1 + Math.min(7, Math.floor(this.chain / 3)) * 0.5, pts = Math.round(v * m / 10) * 10;
    this.score += pts; if (x !== undefined) this.float(x, y, z, String(pts), '#ffffff');
    while (this.score >= this.nextExtend) { this.lives = Math.min(9, this.lives + 1); this.nextExtend += C.EXTEND_EVERY; snd('extend'); this.banner('EXTRA LIFE', 1.6, 'good'); }
  };

  /* ---------- the hero ---------- */
  Game.muzzle = function () { const P = this.P; return { x: P.x + 8, y: P.y + 2, z: 6 }; };
  Game.aimDir = function () {
    const m = this.muzzle(), t = Sc.unproj(this.reticle.x, this.reticle.y, 900, { x: 0, y: 0, z: 0 }), f = this.hoverF;
    if (f && !f.dead && f.z > 40) {   // aim assist: shoot at (and slightly ahead of) the target under the crosshair
      const tt = f.z / (1500 - (f.vz || 0)); t.x = f.x + (f.vx || 0) * tt; t.y = f.y + (f.vy || 0) * tt; t.z = f.z + (f.vz || 0) * tt;
    }
    let dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z; const l = Math.hypot(dx, dy, dz); return { x: dx / l, y: dy / l, z: dz / l };
  };
  Game.firePlayer = function () {
    const P = this.P, t = CANNON[P.cannon], d = this.aimDir(), m = this.muzzle(), sp = 1500, dmg = P.cannon >= 4 ? 1.5 : 1;
    const add = (ox, ax, ay) => { let dx = d.x + ax, dy = d.y + ay, dz = d.z; const l = Math.hypot(dx, dy, dz); this.pshots.push({ x: m.x + ox, y: m.y, z: m.z, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, dmg, pierce: P.cannon >= 4, hit: null, life: 2.2 }); };
    if (t.n === 1) add(0, 0, 0); else if (t.n === 2) { add(-5, 0, 0); add(5, 0, 0); } else { add(0, 0, 0); add(-3, -0.07, 0.01); add(3, 0.07, 0.01); }
    P.fireT = t.dt; snd('shot', P.cannon);
    if (P.drone > 0) for (const sx of [-1, 1]) { const dx = P.x + sx * 22 - 0, l = Math.hypot(d.x, d.y, d.z); this.pshots.push({ x: dx, y: P.y - 4, z: 6, vx: d.x / l * sp, vy: d.y / l * sp, vz: d.z / l * sp, dmg: 0.8, pierce: false, hit: null, life: 2.2 }); }
  };
  Game.firable = function (f) { return !f.dead && f.state !== 'spawn' && f.z > 30 && f.z < ZFAR - 120; };
  Game.bomb = function () {
    const P = this.P; if (P.bombs <= 0 || P.dead || this.state !== 'play' && this.state !== 'boss') return;
    P.bombs--; P.invuln = Math.max(P.invuln, 1.6); this.flash = 1; this.shake = 8; snd('bomb');
    for (const s of this.eshots) { s.dead = true; this.addScore(30); this.explodeAt(s.x, s.y, s.z, 0.35); }
    for (const f of this.foes) if (!f.dead && f.z < ZFAR - 100 && f.z > 0) this.damage(f, f.boss ? 14 : 30, 'bomb');
    for (const p of this.props) if (!p.dead && p.hp && p.z > 0 && p.z < ZFAR - 200) this.damageProp(p, 30);
  };
  Game.hurtPlayer = function () {
    const P = this.P; if (P.dead || P.invuln > 0 || (G.debug && G.debug.god)) return;
    this.hitsTaken++; this.chain = 0; this.chainT = 0; this.shake = 7; this.flash = 0.35; snd('hurt');
    for (let i = 0; i < 10; i++) this.parts.push({ x: P.x, y: P.y, z: 0, vx: rnd(-80, 80), vy: rnd(-20, 90), vz: rnd(-40, 80), t: 0, life: 0.7, c: i & 1 ? '#fff' : '#9fe8ff' });
    if (P.shield > 0) { P.shield--; P.invuln = 1.7; return; }
    P.dead = true; P.deadT = 0; this.explodeAt(P.x, P.y, 0, 1.4); snd('die');
    if (G.audio && G.audio.music) G.audio.music('off');
  };
  Game.afterDeath = function () {
    this.lives--;
    if (this.lives <= 0) { this.state = 'over'; this.over = true; snd('gameOver'); if (G.main) G.main.gameOver(this); return; }
    const P = this.P; Object.assign(P, { shield: 3, dead: false, deadT: 0, invuln: 3, x: 0, y: 40, vx: 0, vy: 0, cannon: Math.max(1, P.cannon - 1), drone: 0 });
    for (const s of this.eshots) s.dead = true;
    if (G.audio && G.audio.music) G.audio.music('play', this.wd.music);
  };
  Game.explodeAt = function (x, y, z, size) { this.booms.push({ x, y, z, t: 0, size: size || 1 }); };

  /* ---------- aliens ---------- */
  const T = [
    { hp: 1, rw: 11, rh: 10, pts: 100 }, { hp: 1, rw: 14, rh: 10, pts: 150 }, { hp: 6, rw: 17, rh: 10, pts: 500 }, { hp: 2, rw: 10, rh: 10, pts: 120 },
    { hp: 2, rw: 9, rh: 12, pts: 200 }, { hp: 3, rw: 11, rh: 15, pts: 250 }, { hp: 5, rw: 14, rh: 14, pts: 400 },
  ];
  Game.T = T;
  Game.spawnFoe = function (type, x, y, z, o) {
    const t = T[type], f = Object.assign({ type, x, y: type === 5 ? t.rh : y, z, x0: x, y0: y, vx: 0, vy: 0, vz: -300, hp: Math.max(1, Math.ceil(t.hp * this.diff.hp)), rw: t.rw, rh: t.rh, rd: 16, pts: t.pts, t: 0, ph: Math.random() * 6.28, fireT: 0.6 + Math.random() * 0.8, fireZ: rnd(850, 1300), hit: 0, dead: false, state: 'in', carry: null, lockable: true }, o || {});
    if (type === 2) { f.holdZ = rnd(650, 900); f.holdT = rnd(5, 7); }
    this.foes.push(f); this.spawned++; return f;
  };
  Game.spawnProp = function (kind, x, z, o) {
    const H = { column: 72, pillar: 36, bush: 17, mush: 27, spire: 70, rock: 20, pylon: 80, crate: 21 }, R = { column: 12, pillar: 12, bush: 17, mush: 14, spire: 13, rock: 18, pylon: 11, crate: 18 }, HP = { bush: 1, mush: 3, rock: 0, crate: 0 };
    const p = Object.assign({ kind, x, y: 0, z, h: H[kind] || 40, bot: 0, rw: R[kind] || 12, hp: HP[kind] || 0, hit: 0, dead: false }, o || {});
    this.props.push(p); return p;
  };
  Game.spawnShot = function (kind, x, y, z, tx, ty, o) {
    const sp = (this.speed + 170 * this.diff.shots * 0.7 + 90 + this.d * 90) * (o && o.sp || 1), t = Math.max(0.2, z / sp), L = Math.min(0.9, (this.stage - 1) / 13) * (o && o.nolead ? 0 : 1);
    tx = clamp(tx + this.P.vx * L * t, -this.xb(), this.xb()); ty = clamp(ty + this.P.vy * L * t, 4, this.yb());
    const s = Object.assign({ kind, x, y, z, vx: (tx - x) / t, vy: (ty - y) / t, vz: -sp, r: kind === 'big' ? 8 : 4, dead: false, t: 0 }, o || {});
    this.eshots.push(s); return s;
  };
  Game.fireAt = function (f, kind, o) { snd('eshot'); return this.spawnShot(kind || 'orb', f.x, f.y, f.z, this.P.x, this.P.y, o); };
  Game.updateFoes = function (dt) {
    const P = this.P, v = this.speed, df = this.diff.foe, fs = this.diff.shots;
    for (const f of this.foes) {
      if (f.dead) continue;
      f.t += dt; if (f.hit > 0) f.hit -= dt;
      if (f.update) { f.update(this, dt); continue; }
      switch (f.type) {
        case 0: f.vz = -(v * 0.3 + 300 * df); f.y = f.y0 + Math.sin(f.t * 3 + f.ph) * 6; if (!f.fired && f.z < f.fireZ) { f.fired = true; if (Math.random() < 0.8 * fs) { this.fireAt(f); f.vol = (this.d > 0.45 ? 1 : 0) + (this.d > 0.9 ? 1 : 0); f.volT = 0.16; } } if (f.vol > 0) { f.volT -= dt; if (f.volT <= 0 && !f.dead) { f.vol--; f.volT = 0.16; this.fireAt(f); } } break;
        case 1: f.vz = -(v * 0.3 + 340 * df); f.x = f.x0 + Math.sin(f.t * 2.2 + f.ph) * 55; f.y = f.y0 + Math.cos(f.t * 1.7 + f.ph) * 16; if (!f.fired && f.z < f.fireZ) { f.fired = true; if (Math.random() < 0.9 * fs) { this.fireAt(f); f.burst = 0.2; f.bn = 1 + (this.d > 0.6 ? 1 : 0); } } if (f.burst > 0) { f.burst -= dt; if (f.burst <= 0 && !f.dead) { this.fireAt(f); if (--f.bn > 0) f.burst = 0.2; } } break;
        case 2:
          if (f.state === 'in') { f.vz = -440; if (f.z <= f.holdZ) f.state = 'hold'; } else if (f.state === 'hold') {
            f.vz = 0; f.x = f.x0 + Math.sin(f.t * 0.8 + f.ph) * 70; f.y = clamp(f.y0 + Math.sin(f.t * 1.3 + f.ph) * 20, 14, this.yb()); f.holdT -= dt; f.fireT -= dt;
            if (f.fireT <= 0) { f.fireT = 1.25 / fs; for (const d of this.d > 0.5 ? [-28, -14, 0, 14, 28] : [-14, 0, 14]) this.spawnShot('orb', f.x, f.y, f.z, P.x + d, P.y, { sp: 0.95 }); snd('eshot'); }
            if (f.holdT <= 0) f.state = 'out';
          } else f.vz = -(280 * df + 100);
          break;
        case 3: f.vz = -(v * 0.62); f.y = f.y0 + Math.sin(f.t * 1.6 + f.ph) * 8; f.x += Math.sin(f.t + f.ph) * 5 * dt; break;
        case 4: f.vz = -(v * 0.3 + 640 * df); if (f.z > 480) { f.x += clamp(P.x - f.x, -1, 1) * 120 * df * dt; f.y += clamp(P.y - f.y, -1, 1) * 90 * df * dt; } break;
        case 5: f.vz = -v; f.y = f.rh; f.fireT -= dt; if (f.z < 1500 && f.z > 380 && f.fireT <= 0) { f.fireT = 1.7 / fs; this.fireAt(f); if (this.d > 0.5) this.fireAt(f, 'orb', { sp: 1.12 }); } break;
        case 6: f.vz = -(v * 0.25 + 150 * df); f.x = f.x0 + Math.sin(f.t * 1.3 + f.ph) * 50; f.y = f.y0 + Math.sin(f.t * 1.9 + f.ph) * 14; f.fireT -= dt; if (f.z < 1500 && f.z > 300 && f.fireT <= 0) { f.fireT = 2.2 / fs; this.fireAt(f, 'big', { sp: 0.7 }); } break;
      }
      f.z += f.vz * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.z < -90) { f.dead = true; f.gone = true; }
    }
    this.foes = this.foes.filter((f) => !f.dead);
  };
  Game.damage = function (f, d, src) {
    if (f.dead || f.invuln || (f.bossRef && f.bossRef.entering)) { if (f.boss && !f.deco) snd('hit'); return false; }
    if (f.armor) d *= f.armor(this);
    f.hp -= d; f.hit = 0.1;
    if (f.hp <= 0) { this.killFoe(f, src); return true; }
    snd('hit'); return false;
  };
  Game.killFoe = function (f, src) {
    if (f.dead) return;
    f.dead = true; this.kills++; this.chain++; this.chainT = 2; this.maxChain = Math.max(this.maxChain, this.chain);
    this.explodeAt(f.x, f.y, f.z, f.rw > 14 ? 1.5 : 1); snd(f.rw > 14 ? 'boom' : 'pop');
    this.addScore(f.pts, f.x, f.y + 6, f.z);
    if (f.carry) this.items.push({ kind: f.carry, x: f.x, y: Math.max(14, f.y), z: f.z, t: 0 });
    if (f.onKill) f.onKill(this, src);
    this.locks = this.locks.filter((l) => l !== f);
  };
  Game.damageProp = function (p, d) {
    if (p.dead || !p.hp) return; p.hp -= d; p.hit = 0.1;
    if (p.hp <= 0) { p.dead = true; this.explodeAt(p.x, p.h * 0.4, p.z, 0.9); this.addScore(p.kind === 'bush' ? 60 : 150, p.x, p.h, p.z); snd('pop'); }
  };

  /* ---------- player update: flying, aiming, firing, lock-on ---------- */
  Game.updatePlayer = function (dt, I) {
    const P = this.P;
    P.anim += dt; if (P.flash > 0) P.flash -= dt;
    if (P.dead) { P.deadT += dt; if (P.deadT > 1.9) this.afterDeath(); return; }
    if (P.invuln > 0) P.invuln -= dt;
    if (P.drone > 0) P.drone -= dt;
    const mx = I.moveX || 0, my = I.moveY || 0, sx = 185 * (G.settings.sens > 0 ? 1 : 1), sy = 130;
    P.vx += (mx * sx - P.vx) * Math.min(1, 9 * dt); P.vy += (my * sy - P.vy) * Math.min(1, 9 * dt);
    P.x = clamp(P.x + P.vx * dt, -this.xb(), this.xb()); P.y = clamp(P.y + P.vy * dt, 6, this.yb());
    P.bank += (clamp(P.vx / 120, -1, 1) - P.bank) * Math.min(1, 8 * dt); P.pitch += (clamp(P.vy / 90, -1, 1) - P.pitch) * Math.min(1, 8 * dt);
    // crosshair: mouse > right stick > automatic (straight ahead)
    const R = this.reticle, W = Sc.W, H = Sc.H;
    if (I.padAim) { R.x = clamp(R.x + I.rx * 300 * dt, 0, W); R.y = clamp(R.y + I.ry * 300 * dt, 0, H); this.aimMode = 'pad'; }
    else if (I.mouseMoved) { R.x = I.mx; R.y = I.my; this.aimMode = 'mouse'; }
    else {
      this.aimMode = 'auto'; Sc.proj(P.x, P.y, 900); R.x += (Sc.px - R.x) * Math.min(1, 10 * dt); R.y += (Sc.py - R.y) * Math.min(1, 10 * dt);
    }
    // lock-on: hold to paint targets, release to launch the volley
    const cap = LOCKS[P.lockTier], lockNow = I.lock && (this.state === 'play' || this.state === 'boss');
    if (lockNow && !this.lockHeld) { this.locks = []; snd('lockOn'); }
    if (lockNow) {
      if (this.aimMode === 'auto') {
        this.lockSweepT -= dt;
        if (this.lockSweepT <= 0) { this.lockSweepT = 0.11; let best = null, bd = 260; for (const f of this.foes) { if (!f.lockable || !this.firable(f) || this.locks.indexOf(f) >= 0) continue; Sc.proj(f.x, f.y, f.z); const d = Math.hypot(Sc.px - R.x, Sc.py - R.y); if (d < bd) { bd = d; best = f; } } if (best) { Sc.proj(best.x, best.y, best.z); R.x = Sc.px; R.y = Sc.py; } }
      }
      if (this.locks.length < cap) for (const f of this.foes) {
        if (!f.lockable || !this.firable(f) || this.locks.indexOf(f) >= 0) continue;
        Sc.proj(f.x, f.y, f.z); const rr = Math.max(16, f.rw * SC * Sc.ps + 8);
        if (Math.hypot(Sc.px - R.x, Sc.py - R.y) < rr) { this.locks.push(f); snd('lock', this.locks.length); if (this.locks.length >= cap) break; }
      }
    } else if (this.lockHeld) { if (this.locks.length) this.launchVolley(); }
    this.lockHeld = lockNow;
    if (I.takeVolley() && !lockNow && this.locks.length) this.launchVolley();
    this.hover = false; this.hoverF = null; let hz = 1e9; for (const f of this.foes) { if (f.dead || !f.lockable || f.z < 40 || f.z > ZFAR - 100) continue; Sc.proj(f.x, f.y, f.z); if (f.z < hz && Math.hypot(Sc.px - R.x, Sc.py - R.y) < Math.max(14, f.rw * SC * Sc.ps + 6)) { this.hover = true; this.hoverF = f; hz = f.z; } }
    // cannon
    P.fireT -= dt;
    const playing = this.state === 'play' || this.state === 'boss';
    if (playing && I.takeTap() && P.fireT < 0.07) this.firePlayer();
    else if (playing && I.fire && P.fireT <= 0) this.firePlayer();
    if (playing && I.takeBomb()) this.bomb();
    // queued missiles leave the launcher one by one
    for (const q of this.volleyQ) { q.t -= dt; if (q.t <= 0 && !q.done) { q.done = true; const m = this.muzzle(); this.missiles.push({ x: P.x + (q.i % 2 ? 10 : -10), y: P.y + 4, z: 10, vx: (q.i % 2 ? 1 : -1) * 90, vy: 70, vz: 280, tgt: q.f, t: 0, dead: false, speed: 520 }); snd('missile'); } }
    this.volleyQ = this.volleyQ.filter((q) => !q.done);
  };
  Game.launchVolley = function () {
    this.locks.forEach((f, i) => { if (!f.dead) this.volleyQ.push({ f, i, t: i * 0.055, done: false }); });
    this.locks = [];
  };

  /* ---------- projectiles ---------- */
  Game.nearestFoe = function (x, y, z) { let b = null, bd = 1e9; for (const f of this.foes) { if (f.dead || !f.lockable || !this.firable(f)) continue; const d = Math.hypot(f.x - x, f.y - y, (f.z - z) * 0.5); if (d < bd && f.z > z - 20) { bd = d; b = f; } } return b; };
  Game.updateShots = function (dt) {
    const P = this.P;
    for (const s of this.pshots) {
      const z0 = s.z; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.t > s.life || s.z > ZFAR) { s.dead = true; continue; }
      for (const f of this.foes) {
        if (f.dead || f.z < 20 || s.hit === f || (s.hits && s.hits.indexOf(f) >= 0)) continue;
        if (s.z + 8 >= f.z - f.rd && z0 - 8 <= f.z + f.rd && Math.abs(s.x - f.x) < f.rw + 3 && Math.abs(s.y - f.y) < f.rh + 3) {
          this.damage(f, s.dmg, 'cannon'); if (s.pierce) (s.hits = s.hits || []).push(f); else { s.dead = true; this.sparkAt(s.x, s.y, s.z); }
          break;
        }
      }
      if (!s.dead) for (const p of this.props) {
        if (p.dead || s.z + 8 < p.z - 12 || z0 - 8 > p.z + 12 || !this.propSolid(p, s.x, s.y, 2)) continue;
        if (p.hp) this.damageProp(p, s.dmg); if (!s.pierce || !p.hp) { s.dead = true; this.sparkAt(s.x, s.y, s.z); } break;
      }
      if (!s.dead) for (const e of this.eshots) { if (e.dead || e.kind === 'big') continue; if (Math.abs(e.z - s.z) < 40 && Math.abs(e.x - s.x) < e.r + 5 && Math.abs(e.y - s.y) < e.r + 5) { e.dead = true; s.dead = !s.pierce; this.addScore(40, e.x, e.y, e.z); this.sparkAt(e.x, e.y, e.z); snd('pop'); break; } }
    }
    for (const m of this.missiles) {
      m.t += dt;
      if (!m.tgt || m.tgt.dead) m.tgt = this.nearestFoe(m.x, m.y, m.z);
      const tg = m.tgt; m.speed = Math.min(1250, m.speed + 700 * dt);
      if (tg) {
        const dx = tg.x - m.x, dy = tg.y - m.y, dz = tg.z - m.z, l = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, (m.t < 0.18 ? 2 : 9) * dt);
        m.vx += (dx / l * m.speed - m.vx) * k; m.vy += (dy / l * m.speed - m.vy) * k; m.vz += (dz / l * m.speed - m.vz) * k;
        if (l < tg.rw + 10 + (tg.rd || 0) * 0.3 || (Math.abs(dz) < tg.rd + 14 && Math.abs(dx) < tg.rw + 6 && Math.abs(dy) < tg.rh + 6)) { m.dead = true; this.explodeAt(m.x, m.y, m.z, 0.7); this.damage(tg, tg.boss ? 3 : 5, 'missile'); for (const o of this.foes) if (o !== tg && !o.dead && !o.boss && Math.hypot(o.x - m.x, o.y - m.y, (o.z - m.z) * 0.5) < 22) this.damage(o, 2, 'missile'); continue; }
      } else { m.vz += (m.speed - m.vz) * Math.min(1, 3 * dt); }
      const sp = Math.hypot(m.vx, m.vy, m.vz); if (sp > m.speed) { m.vx *= m.speed / sp; m.vy *= m.speed / sp; m.vz *= m.speed / sp; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      if (m.z > ZFAR || m.t > 4) m.dead = true;
    }
    for (const e of this.eshots) {
      e.t += dt; const z0 = e.z; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      if (z0 > 6 && e.z <= 6 && !P.dead) { if (Math.abs(e.x - P.x) < e.r + 8 && Math.abs(e.y - P.y) < e.r + 10) { e.dead = true; this.hurtPlayer(); } }
      if (e.z < -40 || e.t > 9) e.dead = true;
    }
    this.pshots = this.pshots.filter((s) => !s.dead); this.missiles = this.missiles.filter((m) => !m.dead); this.eshots = this.eshots.filter((e) => !e.dead);
  };
  Game.sparkAt = function (x, y, z) { for (let i = 0; i < 4; i++) this.parts.push({ x, y, z, vx: rnd(-50, 50), vy: rnd(-30, 60), vz: rnd(-40, 40), t: 0, life: 0.25, c: i & 1 ? '#fff6a0' : '#ffb04a' }); };

  /* ---------- obstacles ---------- */
  /* is the point (x, y) inside the solid part of a prop? m = margin */
  Game.propSolid = function (p, x, y, m) {
    if (p.kind === 'gate') { for (const r of p.rects) if (x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m) return true; return false; }
    if (p.kind === 'ast') return Math.hypot(x - p.x, y - p.y) < p.rw + m;
    return Math.abs(x - p.x) < p.rw + m && y > p.bot - m && y < p.h + m;
  };
  Game.updateProps = function (dt) {
    const P = this.P, v = this.speed;
    for (const p of this.props) {
      if (p.dead) continue;
      const z0 = p.z; p.z -= (v + (p.vz || 0)) * dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.kind === 'ast') { p.rot = (p.rot || 0) + dt; p.h = p.y + p.rw; p.bot = p.y - p.rw; }
      if (p.hit > 0) p.hit -= dt;
      if (!P.dead && z0 > 6 && p.z <= 6 && !p.touched) {
        let hit = false;   // the hero is a small box: 7 wide, 9 tall
        if (p.kind === 'gate') { for (const r of p.rects) if (P.x + 7 > r[0] && P.x - 7 < r[2] && P.y + 9 > r[1] && P.y - 9 < r[3]) hit = true; }
        else if (p.kind === 'ast') hit = Math.hypot(P.x - p.x, P.y - p.y) < p.rw + 7;
        else hit = Math.abs(P.x - p.x) < p.rw + 7 && P.y - 9 < p.h;
        if (hit && P.invuln <= 0) { p.touched = true; this.hurtPlayer(); if (p.hp) this.damageProp(p, 99); }
      }
      if (p.z < -140) p.dead = true;
    }
    this.props = this.props.filter((p) => !p.dead);
  };
  /* aliens that ram the hero */
  Game.collideFoes = function () {
    const P = this.P; if (P.dead) return;
    for (const f of this.foes) {
      if (f.dead || f.boss || f.z > 10 || f.z < -14 || f.rammed) continue;
      if (Math.abs(f.x - P.x) < f.rw + 7 && Math.abs(f.y - P.y) < f.rh + 9) { f.rammed = true; if (P.invuln <= 0) { this.hurtPlayer(); if (f.type !== 2 && f.type !== 5 && f.type !== 6) { f.dead = true; this.explodeAt(f.x, f.y, f.z, 1); } } }
    }
  };
  Game.collect = function (it) {
    const P = this.P, k = it.kind; snd('pickup');
    if (k === 'P') { if (P.cannon < 4) { P.cannon++; this.banner('CANNON LV' + P.cannon, 1.1, 'small'); } else this.addScore(2000, P.x, P.y + 14, 0); }
    else if (k === 'L') { if (P.lockTier < 3) { P.lockTier++; this.banner('LOCK-ON x' + LOCKS[P.lockTier], 1.1, 'small'); } else this.addScore(2000, P.x, P.y + 14, 0); }
    else if (k === 'B') { if (P.bombs < 6) { P.bombs++; this.banner('BOMB +1', 1, 'small'); } else this.addScore(1500, P.x, P.y + 14, 0); }
    else if (k === 'S') { if (P.shield < 3) { P.shield++; this.banner('SHIELD +1', 1, 'small'); } else this.addScore(1500, P.x, P.y + 14, 0); }
    else if (k === 'D') { P.drone = 20; this.banner('OPTION DRONES', 1.2, 'small'); }
    else if (k === '1') { this.lives = Math.min(9, this.lives + 1); snd('extend'); this.banner('EXTRA LIFE', 1.4, 'good'); }
  };
  Game.updateItems = function (dt) {
    const P = this.P;
    for (const it of this.items) {
      it.t += dt; it.z -= this.speed * 0.72 * dt;
      if (!P.dead && it.z < 22 && it.z > -26 && Math.abs(it.x - P.x) < 24 && Math.abs(it.y - P.y) < 26) { it.dead = true; this.collect(it); }
      if (it.z < -80) it.dead = true;
    }
    this.items = this.items.filter((i) => !i.dead);
  };
  Game.updateFx = function (dt) {
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt - this.speed * dt * 0.5; p.vy -= 160 * dt; }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const b of this.booms) { b.t += dt; b.z -= this.speed * 0.5 * dt; }
    this.booms = this.booms.filter((b) => b.t < 0.56);
    for (const f of this.floats) { f.t += dt; f.y += 14 * dt; }
    this.floats = this.floats.filter((f) => f.t < 0.9);
    if (this.bannerO) { this.bannerO.t += dt; if (this.bannerO.t > this.bannerO.life) this.bannerO = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 18 * dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 2.4 * dt);
  };

  /* ---------- stage flow ---------- */
  Game.rank = function () {
    const hit = this.spawned ? this.kills / this.spawned : 1, h = this.hitsTaken;
    const r = hit >= 0.9 && h === 0 ? 'S' : hit >= 0.8 && h <= 1 ? 'A' : hit >= 0.6 ? 'B' : 'C';
    return { r, hit: Math.round(hit * 100), chain: this.maxChain, hits: h, bonus: { S: 20000, A: 10000, B: 5000, C: 2000 }[r] * (1 + Math.floor((this.stage - 1) / 3) * 0.25) };
  };
  Game.finishStage = function () {
    this.state = 'clear'; this.clearT = 6; this.rankStats = this.rank();
    this.score += this.rankStats.bonus; this.stageGain = this.score - this.stageScore;
    snd('clear'); if (G.progress && this.mode === 'campaign') { G.progress.maxStage = Math.max(G.progress.maxStage, Math.min(C.STAGES, this.stage + 1)); G.progress.save(); }
    if (G.audio && G.audio.music) G.audio.music('off');
  };
  Game.nextStage = function () {
    const n = this.stage + 1;
    if (this.mode === 'bossrush') { if (this.rushIdx + 1 >= 6) { this.state = 'ending'; if (G.main) G.main.ending(this); return; } this.rushIdx++; this.loadStage((this.rushIdx + 1) * 3); this.P.shield = 3; return; }
    if (this.mode === 'endless') { this.endlessN++; this.loadStage(this.stage + 1); return; }
    if (n > C.STAGES) { this.state = 'ending'; if (G.progress) { G.progress.cleared = true; G.progress.save(); } if (G.main) G.main.ending(this); return; }
    this.loadStage(n);
  };
  Game.updateFlow = function (dt) {
    this.stageT += dt;
    const ev = this.plan.events;
    while (this.planI < ev.length && ev[this.planI].t <= this.stageT) ev[this.planI++].fn(this);
    if (this.planI >= ev.length && !this.planEnd && this.stageT >= this.plan.end) {
      this.planEnd = true;
      if (this.plan.boss && G.boss) { this.state = 'boss'; G.boss.begin(this); }
    }
    if (this.planEnd && !this.plan.boss && this.state === 'play' && this.foes.every((f) => f.z < 60 || f.dead) && this.props.every((p) => p.z < 80)) this.finishStage();
  };
  Game.update = function (dt, I) {
    this.time += dt;
    this.updateFx(dt);
    if (this.state === 'over' || this.state === 'ending' || this.state === 'title') return;
    const P = this.P;
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chain = 0; }
    if (this.mode === 'bossrush' && this.state !== 'intro' && this.state !== 'clear') this.rushT += dt;
    Sc.scroll += this.speed * dt; this.dist += this.speed * dt; Sc.speed = this.speed; if (Sc.world && Sc.world.kind === 'space') Sc.updateStars(dt);
    Sc.setCam(P.x, P.y);
    if (this.state === 'intro') { this.introT -= dt; this.updatePlayer(dt, I); if (this.introT <= 0) this.state = 'play'; return; }
    this.updatePlayer(dt, I);
    if (this.state === 'play') this.updateFlow(dt);
    this.updateFoes(dt);
    if (this.bossObj && G.boss) G.boss.update(this, dt);
    this.updateShots(dt); this.updateProps(dt); this.updateItems(dt); this.collideFoes();
    if (this.state === 'clear') { this.clearT -= dt; const press = I.fire && !this._fp; this._fp = I.fire; if (this.clearT <= 0 || ((I.takeTap() || press) && this.clearT < 4.3)) this.nextStage(); } else this._fp = I.fire;
  };
})((window.SGS = window.SGS || {}));
