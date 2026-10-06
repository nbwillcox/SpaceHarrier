/* Boss sprites, authored large (full size at scale 1). B.build(k) returns the pieces for boss k: 0 serpent, 1 mech, 2 golem, 3 magma serpent, 4 warship, 5 the Abyss. */
(function (G) {
  'use strict';
  const PX = G.px, Pix = PX.Pix, rgb = PX.rgb, mix = PX.mix, A = G.art;
  const BA = {};
  G.bossart = BA;
  const mask = (w, h, fn) => { const m = new Pix(w, h); fn(m); return m; };
  const WHT = rgb('#ffffff'), INK = rgb('#16162a'), YEL = rgb('#ffe45a'), ORG = rgb('#ffa63c');
  const METAL = ['#e4ecfa', '#aebbd8', '#7886a8', '#4e5a7e', '#2c3454'].map(rgb);
  const eye = (p, x, y, r, c) => { p.disc(x, y, r, WHT); p.disc(x, y + 1, Math.max(1, r - 2), c); p.disc(x + 1, y + 1, Math.max(1, r - 4), INK); p.set(x - 1, y - 1, WHT); };
  /* serpent: head (front view), body segment, tail */
  function serpent(hue, rage) {
    const R = PX.ramp(rage ? 355 : hue, 62, 46), D = R.map((c) => mix(c, rgb('#1a1030'), 0.42)), E = rage ? rgb('#ff3a3a') : YEL, S = {};
    let p = new Pix(120, 100);
    p.poly([[22, 30], [4, 4], [34, 22]], D[1]); p.poly([[98, 30], [116, 4], [86, 22]], D[1]); p.poly([[26, 30], [10, 10], [34, 24]], R[1]); p.poly([[94, 30], [110, 10], [86, 24]], R[1]);
    p.shade3d(mask(120, 100, (m) => { m.ell(60, 46, 42, 34, 1); m.poly([[26, 56], [60, 96], [94, 56]], 1); }), 0, 0, R, { depth: 12 });
    p.poly([[60, 4], [70, 24], [50, 24]], R[0]); p.poly([[60, 4], [66, 22], [54, 22]], D[1]);
    eye(p, 38, 40, 8, E); eye(p, 82, 40, 8, E); p.line(26, 30, 46, 38, 2, INK); p.line(94, 30, 74, 38, 2, INK);
    p.ell(50, 62, 3, 2, D[3]); p.ell(70, 62, 3, 2, D[3]);
    p.rect(34, 74, 52, 8, INK); for (let x = 36; x < 84; x += 8) { p.poly([[x, 74], [x + 4, 74], [x + 2, 84]], WHT); p.poly([[x, 82], [x + 4, 82], [x + 2, 74]], mix(WHT, rgb('#b0b8d0'), 0.5)); }
    S.head = A.spr(p, 60, 50);
    p = new Pix(80, 80);
    p.shade3d(mask(80, 80, (m) => m.disc(40, 40, 34, 1)), 0, 0, R, { depth: 14 });
    for (let i = 0; i < 5; i++) { const a = -2.4 + i * 0.6; p.poly([[40 + Math.cos(a - 0.2) * 30, 40 + Math.sin(a - 0.2) * 30], [40 + Math.cos(a) * 42, 40 + Math.sin(a) * 42], [40 + Math.cos(a + 0.2) * 30, 40 + Math.sin(a + 0.2) * 30]], R[0]); }
    for (let i = 0; i < 4; i++) p.line(18 + i * 14, 52, 22 + i * 14, 64, 1, D[2]);
    p.ell(40, 40, 12, 9, R[1]); p.ell(40, 40, 7, 5, D[2]);
    S.seg = A.spr(p, 40, 40);
    p = new Pix(52, 52); p.shade3d(mask(52, 52, (m) => m.disc(26, 26, 22, 1)), 0, 0, R, { depth: 10 }); p.poly([[26, 0], [34, 14], [18, 14]], R[0]);
    S.tail = A.spr(p, 26, 26);
    return S;
  }
  /* mech: torso (with a hollow core socket), core lens, head, arm with cannon (faces left; flipped for the right arm) */
  function mech(hue, rage) {
    const R = PX.ramp(hue, 38, 44), M = METAL, S = {}, E = rage ? rgb('#ff3a3a') : rgb('#7affff');
    let p = new Pix(260, 250);
    p.shade3d(mask(260, 250, (m) => { m.rect(60, 120, 50, 110, 1); m.rect(150, 120, 50, 110, 1); }), 0, 0, M, { depth: 8 }); p.rect(52, 222, 66, 18, M[3]); p.rect(142, 222, 66, 18, M[3]);
    p.shade3d(mask(260, 250, (m) => { m.poly([[40, 44], [220, 44], [200, 150], [60, 150]], 1); m.rect(90, 140, 80, 34, 1); }), 0, 0, R, { depth: 10 });
    p.shade3d(mask(260, 250, (m) => { m.rect(14, 30, 70, 50, 1); m.rect(176, 30, 70, 50, 1); }), 0, 0, M, { depth: 8 }); p.rect(20, 72, 58, 5, M[4]); p.rect(182, 72, 58, 5, M[4]);
    p.shade3d(mask(260, 250, (m) => m.rect(100, 6, 60, 48, 1)), 0, 0, M, { depth: 8 }); p.rect(106, 22, 48, 12, INK); p.rect(110, 25, 40, 5, E);
    p.ell(130, 100, 26, 26, M[4]); p.ell(130, 100, 22, 22, INK);
    for (let i = 0; i < 4; i++) p.line(70 + i * 40, 56, 76 + i * 40, 130, 1, mix(R[3], rgb('#000000'), 0.3));
    S.body = A.spr(p, 130, 125);
    p = new Pix(52, 52); p.shade3d(mask(52, 52, (m) => m.disc(26, 26, 22, 1)), 0, 0, PX.ramp(rage ? 355 : 190, 70, 52), { depth: 10 }); p.disc(26, 26, 9, E); p.disc(26, 26, 5, WHT);
    S.core = A.spr(p, 26, 26);
    p = new Pix(110, 150);
    p.shade3d(mask(110, 150, (m) => { m.rect(34, 0, 50, 70, 1); m.rect(20, 60, 70, 60, 1); }), 0, 0, R, { depth: 9 });
    p.shade3d(mask(110, 150, (m) => { m.rect(30, 100, 50, 46, 1); }), 0, 0, M, { depth: 6 }); p.disc(55, 138, 15, M[4]); p.disc(55, 138, 11, INK); p.disc(55, 138, 6, ORG); p.disc(55, 138, 3, WHT);
    for (let i = 0; i < 3; i++) p.rect(26, 74 + i * 9, 58, 3, M[3]);
    S.arm = A.spr(p, 55, 88);
    return S;
  }
  /* golem: head (angular stone face) and fist */
  function golem(hue, rage) {
    const R = PX.ramp(hue, 55, 62), D = R.map((c) => mix(c, rgb('#101840'), 0.4)), E = rage ? rgb('#ff4a3a') : rgb('#9ae8ff'), S = {};
    let p = new Pix(230, 210);
    const ice = PX.ramp(195, 80, 66);
    for (const [x, h, w] of [[30, 70, 18], [60, 100, 22], [170, 100, 22], [200, 70, 18], [115, 60, 26]]) p.poly([[x, 40], [x + w / 2, 40 - h * 0.6], [x + w, 40]], ice[1]);
    p.shade3d(mask(230, 210, (m) => { m.poly([[30, 60], [115, 30], [200, 60], [214, 110], [190, 190], [115, 206], [40, 190], [16, 110]], 1); }), 0, 0, R, { depth: 16 });
    p.poly([[40, 78], [100, 70], [110, 92], [52, 104]], D[2]); p.poly([[190, 78], [130, 70], [120, 92], [178, 104]], D[2]);
    p.ell(78, 94, 17, 11, INK); p.ell(152, 94, 17, 11, INK); p.ell(78, 94, 12, 8, E); p.ell(152, 94, 12, 8, E); p.ell(78, 94, 5, 6, WHT); p.ell(152, 94, 5, 6, WHT);
    p.poly([[115, 96], [128, 140], [102, 140]], D[1]); p.ell(108, 140, 5, 3, D[3]); p.ell(122, 140, 5, 3, D[3]);
    p.rect(66, 160, 98, 22, INK); for (let x = 68; x < 162; x += 12) { p.poly([[x, 160], [x + 7, 160], [x + 3, 174]], WHT); p.poly([[x + 2, 182], [x + 9, 182], [x + 6, 170]], ice[0]); }
    for (const [x1, y1, x2, y2] of [[40, 130, 60, 150], [180, 136, 196, 160], [96, 40, 104, 62]]) p.line(x1, y1, x2, y2, 1, D[4]);
    S.head = A.spr(p, 115, 112);
    p = new Pix(120, 120);
    p.shade3d(mask(120, 120, (m) => { m.ell(60, 66, 52, 46, 1); m.rect(14, 30, 92, 50, 1); }), 0, 0, R, { depth: 16 });
    for (let i = 0; i < 4; i++) { const x = 26 + i * 23; p.shade3d(mask(120, 120, (m) => m.ell(x, 30, 12, 14, 1)), 0, 0, R, { depth: 8 }); p.line(x + 11, 34, x + 11, 70, 1, D[3]); p.ell(x, 44, 7, 4, D[2]); }
    p.shade3d(mask(120, 120, (m) => m.ell(18, 78, 12, 18, 1)), 0, 0, R, { depth: 7 });
    for (let i = 0; i < 3; i++) p.line(34 + i * 22, 86, 40 + i * 22, 100, 1, D[4]);
    p.poly([[48, 100], [60, 118], [72, 100]], ice[1]);
    S.fist = A.spr(p, 60, 62);
    return S;
  }
  /* warship: hull, turret, engine pod, bridge */
  function ship(hue, rage) {
    const R = PX.ramp(hue, 28, 40), M = METAL, S = {}, E = rage ? rgb('#ff3a3a') : rgb('#ffe45a');
    let p = new Pix(380, 180);
    p.shade3d(mask(380, 180, (m) => { m.poly([[10, 100], [70, 40], [310, 40], [370, 100], [320, 160], [60, 160]], 1); }), 0, 0, R, { depth: 16 });
    p.shade3d(mask(380, 180, (m) => { m.rect(130, 10, 120, 50, 1); }), 0, 0, M, { depth: 8 });
    for (let i = 0; i < 9; i++) { p.rect(40 + i * 34, 84, 18, 6, (i & 1) ? E : rgb('#7affff')); p.rect(40 + i * 34, 110, 18, 4, M[3]); }
    for (let i = 0; i < 5; i++) p.line(86 + i * 52, 44, 80 + i * 52, 156, 1, mix(R[3], rgb('#000000'), 0.35));
    p.rect(150, 62, 80, 8, M[3]); p.rect(18, 98, 344, 3, M[4]);
    S.hull = A.spr(p, 190, 96);
    p = new Pix(64, 64); p.shade3d(mask(64, 64, (m) => { m.disc(32, 36, 22, 1); m.rect(10, 40, 44, 20, 1); }), 0, 0, M, { depth: 9 }); p.rect(26, 2, 12, 34, M[2]); p.rect(28, 0, 8, 8, INK); p.rect(30, 0, 4, 3, E); p.disc(32, 38, 8, R[1]); p.disc(32, 38, 4, E);
    S.turret = A.spr(p, 32, 36);
    p = new Pix(84, 84); p.shade3d(mask(84, 84, (m) => { m.rect(8, 12, 68, 60, 1); m.ell(42, 70, 34, 12, 1); }), 0, 0, M, { depth: 8 }); p.disc(42, 44, 20, INK); p.disc(42, 44, 15, ORG); p.disc(42, 44, 10, YEL); p.disc(42, 44, 5, WHT);
    S.engine = A.spr(p, 42, 44);
    p = new Pix(110, 90); p.shade3d(mask(110, 90, (m) => { m.poly([[10, 80], [24, 26], [86, 26], [100, 80]], 1); m.ell(55, 30, 36, 24, 1); }), 0, 0, R, { depth: 12 }); p.shade3d(mask(110, 90, (m) => m.ell(55, 34, 28, 16, 1)), 0, 0, PX.ramp(190, 60, 54), { depth: 6 }); p.rect(30, 32, 50, 8, INK); p.rect(34, 34, 42, 4, E);
    S.bridge = A.spr(p, 55, 48);
    return S;
  }
  /* the Abyss: a huge eye, plus a tentacle segment */
  function abyss(hue, rage) {
    const R = PX.ramp(hue, 60, 36), S = {}, E = rage ? rgb('#ff4a4a') : rgb('#ff5ad0');
    let p = new Pix(240, 240);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832; p.line(120 + Math.cos(a) * 90, 120 + Math.sin(a) * 90, 120 + Math.cos(a) * 112, 120 + Math.sin(a) * 112, 4, R[2]); }
    p.shade3d(mask(240, 240, (m) => m.disc(120, 120, 98, 1)), 0, 0, [rgb('#ffffff'), rgb('#f4eef0'), rgb('#dcd0d8'), rgb('#b8a0b0'), rgb('#8a6a86')], { depth: 36 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832 + 0.2, r1 = 60 + (i % 3) * 8, r2 = 96; p.line(120 + Math.cos(a) * r1, 120 + Math.sin(a) * r1, 120 + Math.cos(a + 0.15) * r2, 120 + Math.sin(a + 0.15) * r2, 1, rgb('#d84a6a')); }
    p.shade3d(mask(240, 240, (m) => m.disc(120, 120, 52, 1)), 0, 0, PX.ramp(rage ? 355 : 300, 85, 46), { depth: 18 });
    p.ell(120, 120, 18, 44, INK); p.ell(120, 120, 7, 36, rgb('#3a0a2a')); p.disc(100, 98, 6, WHT); p.disc(104, 102, 2, WHT);
    S.eye = A.spr(p, 120, 120);
    p = new Pix(44, 44); p.shade3d(mask(44, 44, (m) => m.disc(22, 22, 18, 1)), 0, 0, R, { depth: 8 }); p.disc(22, 22, 6, E); p.set(18, 18, WHT);
    S.tent = A.spr(p, 22, 22);
    return S;
  }
  BA.build = function (k, hue, rage) {
    const fn = [serpent, mech, golem, serpent, ship, abyss][k];
    const key = k + '|' + hue + '|' + (rage ? 1 : 0);
    BA.cache = BA.cache || {};
    return BA.cache[key] || (BA.cache[key] = fn(hue, rage));
  };
})((window.SGS = window.SGS || {}));
