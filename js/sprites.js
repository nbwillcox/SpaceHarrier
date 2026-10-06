/* Pixel art, all drawn once at start-up: the astronaut seen from behind, six alien types (recoloured per world), terrain props, pickups, shots and explosions.
   Every sprite is authored at its full on-screen size (scale 1, nearest the camera) and gets half / quarter / eighth size mips so distant ones stay clean. */
(function (G) {
  'use strict';
  const PX = G.px, Pix = PX.Pix, rgb = PX.rgb, mix = PX.mix;
  const A = {};
  G.art = A;
  const mask = (w, h, fn) => { const m = new Pix(w, h); fn(m); return m; };
  const rp = (a) => a.map(rgb);
  const SUIT = rp(['#ffffff', '#e8effd', '#c6d3f0', '#8ea2d2', '#5d6eaa']), METAL = rp(['#e4ecfa', '#aebbd8', '#7886a8', '#4e5a7e', '#2c3454']), ORNG = rp(['#ffd884', '#ffa63c', '#ee7a1c', '#b44a1a', '#7a2a14']);
  const WHT = rgb('#ffffff'), INK = rgb('#16162a'), YEL = rgb('#ffe45a');

  /* finished sprite: outline, canvas, anchor and mip chain */
  A.spr = function (pix, ax, ay, noOutline) {
    const p = noOutline ? pix : pix.outline(rgb('#0c0e1e'), 1), n = noOutline ? 0 : 1, c = p.toCanvas(1), s = { c, w: p.w, h: p.h, ax: ax + n, ay: ay + n, mips: [c] };
    for (let i = 1; i < 4; i++) {
      const w = Math.max(1, Math.round(p.w / (1 << i))), h = Math.max(1, Math.round(p.h / (1 << i))), m = document.createElement('canvas'); m.width = w; m.height = h;
      const x = m.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(s.mips[i - 1], 0, 0, w, h); s.mips.push(m);
    }
    return s;
  };
  /* draw a sprite with its anchor at (x, y), scaled by k (1 = authored size); tint-free, pixel-crisp */
  A.draw = function (ctx, s, x, y, k, flip) {
    if (k <= 0.02) return;
    const lv = Math.min(3, Math.max(0, Math.round(-Math.log2(k))));
    const m = s.mips[lv], f = (1 << lv) * k, w = m.width * f, h = m.height * f, ax = s.ax / (1 << lv) * f, ay = s.ay / (1 << lv) * f;
    if (flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(m, Math.round(-ax), Math.round(y - ay), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); ctx.restore(); }
    else ctx.drawImage(m, Math.round(x - ax), Math.round(y - ay), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  /* a white-flashed copy of a sprite (shown briefly when it takes a hit) */
  A.flash = function (s) {
    if (s.fl) return s.fl;
    const c = document.createElement('canvas'); c.width = s.c.width; c.height = s.c.height; const x = c.getContext('2d'); x.drawImage(s.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,0.78)'; x.fillRect(0, 0, c.width, c.height);
    const f = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay, mips: [c] };
    for (let i = 1; i < 4; i++) { const m = document.createElement('canvas'); m.width = s.mips[i].width; m.height = s.mips[i].height; const mx = m.getContext('2d'); mx.imageSmoothingEnabled = true; mx.drawImage(f.mips[i - 1], 0, 0, m.width, m.height); f.mips.push(m); }
    return (s.fl = f);
  };
  const shear = (p, k) => { const q = new Pix(p.w, p.h); for (let y = 0; y < p.h; y++) { const off = Math.round(k * (y - p.h / 2) / (p.h / 2)); for (let x = 0; x < p.w; x++) { const c = p.d[y * p.w + x]; if (c) q.set(x + off, y, c); } } return q; };

  /* ---------- the astronaut from behind: bank -1/0/1, pitch -1 (dive) / 0 / 1 (climb), flame frame 0/1 ---------- */
  function hero(bank, pitch, fr) {
    const p = new Pix(44, 48), ox = 2;
    // legs trail behind (towards the camera)
    const lk = pitch > 0 ? 3 : pitch < 0 ? -2 : 0;
    p.shade3d(mask(44, 48, (m) => { m.rect(ox + 14, 34, 6, 8 + lk, 1); m.rect(ox + 22, 34, 6, 8 + lk, 1); }), 0, 0, SUIT.map((c) => mix(c, rgb('#2a3566'), 0.2)), { depth: 3 });
    p.rect(ox + 13, 40 + lk, 8, 3, ORNG[2]); p.rect(ox + 21, 40 + lk, 8, 3, ORNG[2]); p.rect(ox + 13, 42 + lk, 8, 1, ORNG[4]); p.rect(ox + 21, 42 + lk, 8, 1, ORNG[4]);
    // arms
    p.shade3d(mask(44, 48, (m) => { m.rect(ox + 5, 17, 6, 16, 1); m.ell(ox + 8, 17, 4, 3, 1); }), 0, 0, SUIT, { depth: 3 });
    p.shade3d(mask(44, 48, (m) => { m.rect(ox + 31, 15, 6, 12, 1); m.ell(ox + 34, 16, 4, 3, 1); }), 0, 0, SUIT, { depth: 3 });
    // the arm cannon: seen from behind, a fat barrel pointing away with a glowing breech
    p.shade3d(mask(44, 48, (m) => m.rect(ox + 32, 8, 9, 14, 1)), 0, 0, METAL, { depth: 4 });
    p.rect(ox + 34, 11, 5, 6, ORNG[3]); p.rect(ox + 35, 12, 3, 4, rgb('#9ae8ff')); p.set(ox + 35, 12, WHT);
    // jetpack
    p.shade3d(mask(44, 48, (m) => { m.rect(ox + 11, 15, 20, 19, 1); }), 0, 0, METAL, { depth: 4 });
    p.rect(ox + 13, 18, 16, 2, METAL[3]); p.rect(ox + 13, 24, 16, 2, METAL[3]); p.rect(ox + 19, 16, 4, 16, METAL[2]);
    for (const nx of [ox + 13, ox + 24]) { p.rect(nx, 34, 5, 3, METAL[4]); p.rect(nx + 1, 36, 3, 1, ORNG[0]); const fl = 4 + (fr ? 2 : 0) + (pitch > 0 ? 2 : 0); p.rect(nx + 1, 37, 3, fl, ORNG[1]); p.rect(nx + 2, 37, 1, fl + 1, YEL); }
    // helmet (back of the head) and antenna
    p.shade3d(mask(44, 48, (m) => m.ell(ox + 21, 9, 9, 8.5, 1)), 0, 0, SUIT, { depth: 5 });
    p.rect(ox + 15, 13, 12, 2, SUIT[3]); p.rect(ox + 20, 1, 1, 3, METAL[2]); p.set(ox + 20, 0, rgb('#ff5a5a'));
    p.rect(ox + 17, 6, 3, 2, SUIT[0]);
    return A.spr(shear(p, bank * 4), 24, 26);
  }
  A.buildHero = function () { A.hero = []; for (let b = -1; b <= 1; b++) { A.hero[b + 1] = []; for (let pt = -1; pt <= 1; pt++) { A.hero[b + 1][pt + 1] = [hero(b, pt, 0), hero(b, pt, 1)]; } } };

  /* ---------- aliens: 0 drone, 1 swooper, 2 gunship, 3 mine, 4 charger, 5 turret (stands on the floor), 6 eye ---------- */
  function foe(type, hue, fr, rage) {
    const p = new Pix(44, 40), R = PX.ramp(rage ? 355 : hue, rage ? 80 : 60, 46), D = R.map((c) => mix(c, rgb('#1a1030'), 0.42)), E = rage ? rgb('#ff3a3a') : rgb('#ffe45a'), cx = 22, cy = 20;
    const eye = (x, y, r) => { p.disc(x, y, r, WHT); p.disc(x + 1, y + 1, Math.max(1, r - 2), E); p.set(x + 1, y + 1, INK); };
    if (type === 0) {
      const fl = fr ? 3 : -2;
      p.poly([[cx - 10, cy], [2, cy - 8 + fl], [6, cy + 5]], D[1]); p.poly([[cx + 10, cy], [41, cy - 8 + fl], [37, cy + 5]], D[1]);
      p.poly([[cx - 10, cy], [4, cy - 6 + fl], [8, cy + 3]], R[2]); p.poly([[cx + 10, cy], [39, cy - 6 + fl], [35, cy + 3]], R[2]);
      p.shade3d(mask(44, 40, (m) => m.disc(cx, cy, 12, 1)), 0, 0, R, { depth: 7 });
      p.ell(cx, cy, 7, 5, WHT); p.ell(cx, cy + 1, 4, 4, E); p.disc(cx, cy + 1, 2, INK); p.set(cx - 2, cy - 1, WHT);
      p.rect(cx - 1, 4, 2, 4, D[2]); p.set(cx, 3, rage ? rgb('#ff6a6a') : rgb('#7affd8'));
    } else if (type === 1) {
      const up = fr ? -4 : 3;
      p.poly([[cx, cy - 3], [2, cy - 10 + up], [10, cy + 4], [cx, cy + 9]], D[2]); p.poly([[cx, cy - 3], [42, cy - 10 + up], [34, cy + 4], [cx, cy + 9]], D[2]);
      p.poly([[cx, cy - 3], [5, cy - 8 + up], [12, cy + 3], [cx, cy + 6]], R[1]); p.poly([[cx, cy - 3], [39, cy - 8 + up], [32, cy + 3], [cx, cy + 6]], R[1]);
      p.shade3d(mask(44, 40, (m) => m.ell(cx, cy + 1, 8, 9, 1)), 0, 0, R, { depth: 5 });
      eye(cx - 3, cy - 1, 3); eye(cx + 3, cy - 1, 3); p.rect(cx - 1, cy + 6, 3, 3, D[3]);
    } else if (type === 2) {
      p.shade3d(mask(44, 40, (m) => m.poly([[3, cy], [10, cy - 8], [34, cy - 8], [41, cy], [34, cy + 8], [10, cy + 8]], 1)), 0, 0, R, { depth: 5 });
      p.shade3d(mask(44, 40, (m) => m.ell(cx, cy - 7, 8, 6, 1)), 0, 0, PX.ramp(190, 50, 56), { depth: 4 }); eye(cx - 1, cy - 7, 3);
      for (const bx of [3, 36]) { p.rect(bx, cy - 3, 5, 12, METAL[2]); p.rect(bx + 1, cy + 8, 3, 4, INK); p.rect(bx + 1, cy + 10, 3, 1, YEL); }
      for (let i = 0; i < 4; i++) p.rect(11 + i * 6, cy + 3, 3, 2, (i + fr) & 1 ? YEL : ORNG[2]);
      p.rect(cx - 4, cy + 9, 8, 3, D[3]);
    } else if (type === 3) {
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.39, sx = cx + Math.cos(a) * 11, sy = cy + Math.sin(a) * 11; p.poly([[cx + Math.cos(a + 0.35) * 8, cy + Math.sin(a + 0.35) * 8], [sx + Math.cos(a) * 5, sy + Math.sin(a) * 5], [cx + Math.cos(a - 0.35) * 8, cy + Math.sin(a - 0.35) * 8]], R[1]); }
      p.shade3d(mask(44, 40, (m) => m.disc(cx, cy, 10, 1)), 0, 0, D.map((c, i) => mix(c, R[i], 0.5)), { depth: 6 });
      p.disc(cx, cy, 4, fr ? rgb('#ff4a4a') : rgb('#ffd24a')); p.set(cx - 1, cy - 1, WHT);
    } else if (type === 4) {
      p.shade3d(mask(44, 40, (m) => m.poly([[cx, 2], [cx + 11, cy + 4], [cx + 5, 38], [cx - 5, 38], [cx - 11, cy + 4]], 1)), 0, 0, R, { depth: 6 });
      p.poly([[cx - 11, cy + 4], [3, 34], [cx - 5, cy + 12]], D[1]); p.poly([[cx + 11, cy + 4], [41, 34], [cx + 5, cy + 12]], D[1]);
      p.ell(cx, 10, 4, 6, E); p.ell(cx, 10, 2, 4, WHT); p.rect(cx - 1, cy + 4, 2, 10, D[3]);
      p.rect(cx - 3, 34, 6, 2 + fr * 2, ORNG[1]);
    } else if (type === 5) {
      p.shade3d(mask(44, 40, (m) => { m.rect(8, 28, 28, 9, 1); m.rect(14, 24, 16, 6, 1); }), 0, 0, METAL, { depth: 3 });
      p.rect(8, 35, 28, 2, METAL[4]);
      p.shade3d(mask(44, 40, (m) => m.ell(cx, 22, 11, 11, 1)), 0, 0, R, { depth: 6 });
      p.rect(cx - 3, 5, 6, 14, METAL[2]); p.rect(cx - 2, 3, 4, 3, INK); p.rect(cx - 1, 3, 2, 1, fr ? YEL : rgb('#ff8a3a')); eye(cx, 22, 4);
    } else {
      const wob = fr ? 1 : -1;
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + wob * 0.1; p.line(cx + Math.cos(a) * 8, cy + 8 + Math.sin(a) * 6, cx + Math.cos(a) * 17 + wob, cy + 14 + Math.sin(a) * 8, 2, D[2]); }
      p.shade3d(mask(44, 40, (m) => m.disc(cx, cy, 13, 1)), 0, 0, [rgb('#ffffff'), rgb('#f0ece8'), rgb('#d8d0cc'), rgb('#b8a8a8'), rgb('#8a7878')], { depth: 7 });
      for (const [vx, vy, vx2, vy2] of [[cx - 12, cy - 4, cx - 6, cy - 2], [cx + 12, cy - 6, cx + 6, cy - 3], [cx - 4, cy + 12, cx - 3, cy + 6]]) p.line(vx, vy, vx2, vy2, 1, rgb('#d84a5a'));
      p.disc(cx, cy, 7, E); p.ell(cx, cy, 2, 6, INK); p.set(cx - 3, cy - 3, WHT); p.set(cx - 2, cy - 4, WHT);
    }
    return A.spr(p, cx, type === 5 ? 37 : cy);
  }
  A.buildFoes = function (hue) { A.foe = []; for (let t = 0; t < 7; t++) { A.foe[t] = []; for (let r = 0; r < 2; r++) A.foe[t][r] = [foe(t, hue, 0, !!r), foe(t, hue, 1, !!r)]; } };

  /* ---------- terrain props (authored at full size; world units = pixels / 2) ---------- */
  const lerpRamp = (R, t) => R[Math.max(0, Math.min(4, Math.round(t)))];
  function column(h, hue, sat, lum, glow) {
    const w = 32, p = new Pix(w, h), R = PX.ramp(hue, sat, lum);
    for (let x = 1; x < w - 1; x++) { const v = Math.abs(x - w * 0.38) / (w * 0.62), idx = Math.min(4, Math.max(0, Math.round(v * 4.4 - 0.2))); p.rect(x, 9, 1, h - 20, (x % 6 === 3) ? R[Math.min(4, idx + 1)] : R[idx]); }
    p.shade3d(mask(w, h, (m) => { m.rect(0, 0, w, 9, 1); }), 0, 0, R, { depth: 3 }); p.rect(2, 8, w - 4, 2, R[3]);
    p.shade3d(mask(w, h, (m) => { m.rect(1, h - 12, w - 2, 12, 1); }), 0, 0, R, { depth: 3 }); p.rect(3, h - 12, w - 6, 2, R[3]);
    if (glow) for (let i = 0; i < 4; i++) { const gy = 16 + i * ((h - 40) / 4) + (i * 7) % 5; p.line(6 + (i * 5) % 14, gy, 12 + (i * 7) % 12, gy + 7, 1, rgb('#ff7a1a')); p.line(12 + (i * 7) % 12, gy + 7, 9 + (i * 3) % 10, gy + 13, 1, YEL); }
    return A.spr(p, w / 2, h - 2);
  }
  function bush(hue, sat, lum) {
    const p = new Pix(50, 36), R = PX.ramp(hue, sat, lum);
    p.shade3d(mask(50, 36, (m) => { for (const [x, y, r] of [[14, 24, 11], [26, 18, 14], [38, 24, 11], [20, 26, 10], [32, 27, 10]]) m.disc(x, y, r, 1); m.rect(8, 26, 36, 8, 1); }), 0, 0, R, { depth: 8 });
    for (const [x, y] of [[16, 17], [28, 11], [37, 19], [22, 24], [33, 25]]) { p.set(x, y, R[0]); p.set(x + 1, y, R[0]); p.set(x, y + 1, R[1]); }
    return A.spr(p, 25, 33);
  }
  function mush(hue, sat, lum) {
    const p = new Pix(44, 56), R = PX.ramp(hue, sat, lum), S = PX.ramp(hue + 140, 20, 80);
    p.shade3d(mask(44, 56, (m) => { m.rect(16, 24, 12, 30, 1); }), 0, 0, S, { depth: 4 }); p.rect(14, 51, 16, 3, S[3]);
    p.shade3d(mask(44, 56, (m) => { m.ell(22, 18, 20, 15, 1); m.rect(2, 18, 40, 6, 1); }), 0, 0, R, { depth: 7 });
    for (const [x, y, r] of [[12, 12, 3], [22, 7, 3], [31, 14, 3], [24, 18, 2], [14, 19, 2]]) p.disc(x, y, r, mix(R[0], WHT, 0.6));
    return A.spr(p, 22, 54);
  }
  function spire(hue) {
    const H = 140, p = new Pix(40, H), R = PX.ramp(hue, 70, 62);
    p.shade3d(mask(40, H, (m) => { m.poly([[20, 0], [31, 40], [29, H - 4], [11, H - 4], [9, 40]], 1); }), 0, 0, R, { depth: 5 });
    p.poly([[20, 0], [31, 40], [29, H - 4], [20, H - 4]], mix(R[2], rgb('#101840'), 0.3)); p.poly([[20, 0], [20, H - 4], [11, H - 4], [9, 40]], R[1]); p.line(20, 4, 20, H - 6, 1, R[0]);
    p.shade3d(mask(40, H, (m) => m.poly([[4, H - 4], [10, H - 36], [15, H - 4]], 1)), 0, 0, R, { depth: 3 }); p.shade3d(mask(40, H, (m) => m.poly([[26, H - 4], [33, H - 28], [37, H - 4]], 1)), 0, 0, R, { depth: 3 });
    return A.spr(p, 20, H - 2);
  }
  function rock(hue, sat, lum) {
    const p = new Pix(50, 42), R = PX.ramp(hue, sat, lum);
    p.shade3d(mask(50, 42, (m) => m.poly([[3, 38], [8, 18], [18, 6], [32, 3], [43, 14], [47, 38]], 1)), 0, 0, R, { depth: 8 });
    p.line(20, 10, 24, 22, 1, R[4]); p.line(34, 12, 30, 26, 1, R[4]); p.rect(10, 20, 4, 2, R[0]);
    return A.spr(p, 25, 40);
  }
  function pylon() {
    const H = 160, p = new Pix(30, H), M = METAL;
    p.shade3d(mask(30, H, (m) => { m.rect(5, 6, 4, H - 12, 1); m.rect(21, 6, 4, H - 12, 1); }), 0, 0, M, { depth: 2 });
    for (let y = 8; y < H - 14; y += 16) { p.line(7, y, 23, y + 16, 1, M[2]); p.line(23, y, 7, y + 16, 1, M[3]); p.rect(5, y, 20, 2, M[1]); }
    p.shade3d(mask(30, H, (m) => m.rect(2, H - 10, 26, 8, 1)), 0, 0, M, { depth: 3 });
    p.disc(15, 5, 4, rgb('#ff5a5a')); p.disc(15, 5, 2, WHT);
    return A.spr(p, 15, H - 2);
  }
  function crate() {
    const p = new Pix(44, 44), M = ORNG;
    p.shade3d(mask(44, 44, (m) => m.rect(2, 2, 40, 40, 1)), 0, 0, METAL, { depth: 3 });
    p.rect(6, 6, 32, 32, METAL[3]); p.rect(8, 8, 28, 28, METAL[2]);
    for (let i = 0; i < 6; i++) p.line(8 + i * 5, 36, 8 + i * 5 + 5, 8, 1, i & 1 ? M[1] : INK);
    p.rect(8, 8, 28, 2, METAL[1]);
    return A.spr(p, 22, 42);
  }
  function asteroid(size, hue, seed) {
    const w = size + 4, p = new Pix(w, w), r = PX.rng(seed), R = PX.ramp(hue, 22, 40), c = w / 2, ph = [r() * 6, r() * 6, r() * 6];
    p.shade3d(mask(w, w, (m) => { for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dx = x + 0.5 - c, dy = y + 0.5 - c, a = Math.atan2(dy, dx), rr = size / 2 * (0.82 + 0.1 * Math.sin(a * 3 + ph[0]) + 0.07 * Math.sin(a * 5 + ph[1]) + 0.05 * Math.sin(a * 9 + ph[2])); if (dx * dx + dy * dy <= rr * rr) m.set(x, y, 1); } }), 0, 0, R, { depth: Math.max(4, size / 4) });
    for (let i = 0; i < Math.max(2, size / 9); i++) { const cx = c + (r() - 0.5) * size * 0.6, cy = c + (r() - 0.5) * size * 0.6, cr = 2 + r() * size * 0.1; p.ell(cx, cy, cr, cr * 0.8, R[3]); p.ell(cx - 0.5, cy - 0.5, cr * 0.7, cr * 0.5, R[4]); }
    return A.spr(p, c, c);
  }
  A.buildProps = function (wd) {
    const h = wd.hue, P = {};
    if (wd.kind === 'plains') {
      const st = wd.hue === 125 ? [35, 30, 56] : wd.hue === 190 ? [200, 55, 70] : [12, 25, 26];
      P.column = column(144, st[0], st[1], st[2], wd.hue === 12); P.pillar = column(72, st[0], st[1], st[2], wd.hue === 12);
      P.bush = bush(wd.hue === 125 ? 125 : wd.hue === 190 ? 190 : 8, wd.hue === 190 ? 30 : 60, wd.hue === 190 ? 78 : 42);
      P.mush = mush(wd.hue === 125 ? 340 : wd.hue === 190 ? 200 : 30, 70, 54);
      P.spire = spire(wd.hue === 12 ? 12 : 195); P.rock = rock(wd.hue === 12 ? 12 : 30, 25, wd.hue === 12 ? 28 : 46);
    } else if (wd.kind === 'corridor') { P.pylon = pylon(); P.crate = crate(); } else { P.ast = [asteroid(26, wd.hue, 3), asteroid(44, wd.hue, 5), asteroid(72, wd.hue, 9)]; }
    A.props = P;
  };

  /* ---------- pickups, shots, explosions ---------- */
  const PICK = { P: 30, L: 190, B: 355, S: 125, D: 280, '1': 52 };
  function pickup(ch, hue) {
    const p = new Pix(28, 28), R = PX.ramp(hue, 80, 52);
    p.shade3d(mask(28, 28, (m) => m.disc(14, 14, 12, 1)), 0, 0, R, { depth: 7 });
    p.ell(14, 14, 9, 9, R[4]); p.shade3d(mask(28, 28, (m) => m.disc(14, 14, 8, 1)), 0, 0, R, { depth: 6 });
    const g = PX.glyphs[ch]; if (g) { for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '1') p.set(12 + q, 11 + r, INK); for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '1') p.set(11 + q, 10 + r, WHT); }
    p.set(8, 7, WHT); p.set(9, 7, WHT); p.set(8, 8, WHT);
    return A.spr(p, 14, 14);
  }
  function shot(r, c1, c2) {
    const n = r * 2 + 4, p = new Pix(n, n), c = n / 2;
    p.disc(c, c, r, c1); p.disc(c, c, r * 0.7, mix(c1, WHT, 0.5)); p.disc(c, c, Math.max(1, r * 0.35), c2 || WHT);
    return A.spr(p, c, c, false);
  }
  function boom(f) {
    const p = new Pix(72, 72), t = f / 7, r0 = 6 + t * 30, rn = PX.rng(11), ph = [rn() * 6, rn() * 6, rn() * 6];
    const pal = ['#ffffff', '#fff2a0', '#ffc83c', '#ff8a1c', '#e0481a', '#7a2a1a', '#3a2024'].map(rgb);
    for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) {
      const dx = x + 0.5 - 36, dy = y + 0.5 - 36, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy), rr = r0 * (0.8 + 0.12 * Math.sin(a * 4 + ph[0]) + 0.1 * Math.sin(a * 7 + ph[1]));
      if (d > rr) continue;
      const q = d / rr, hole = t > 0.45 ? (t - 0.45) * 1.5 : 0;
      if (q < hole && PX.dither(x, y, 0.6)) continue; if (q < hole * 0.8) continue;
      const v = Math.min(6, Math.max(0, q * 3.2 + t * 4.2 + (PX.dither(x, y, 0.5) ? 0.4 : 0)));
      if (v > 5.6 && t > 0.8) continue;
      p.set(x, y, pal[Math.floor(v)]);
    }
    return A.spr(p, 36, 36, true);
  }
  A.buildShots = function () {
    A.pick = {}; for (const k in PICK) A.pick[k] = pickup(k, PICK[k]);
    A.orb = shot(5, rgb('#ff5ad0')); A.orbBig = shot(9, rgb('#ff3a8a')); A.orbIce = shot(5, rgb('#5ad8ff')); A.orbFire = shot(5, rgb('#ff8a2a'));
    A.boom = []; for (let f = 0; f < 8; f++) A.boom.push(boom(f));
    A.drone = (() => { const p = new Pix(16, 14); p.shade3d(mask(16, 14, (m) => m.disc(8, 7, 6, 1)), 0, 0, PX.ramp(280, 70, 55), { depth: 4 }); p.rect(6, 5, 4, 3, WHT); p.rect(7, 6, 2, 2, rgb('#ff4ad8')); return A.spr(p, 8, 7); })();
  };
  A.init = function () { A.buildHero(); A.buildShots(); };
})((window.SGS = window.SGS || {}));
