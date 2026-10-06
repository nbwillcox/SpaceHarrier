/* The pseudo-3D view: perspective projection, the checkerboard floor / tunnel / starfield and the sky, all drawn per scanline. Everything in the world has
   x (sideways), y (height above the floor) and z (distance ahead of the hero); s = Z0 / (Z0 + z) is the perspective scale. */
(function (G) {
  'use strict';
  const C = G.C, PX = G.px, U = G.U, SC = C.SC, Z0 = C.Z0;
  const Sc = { W: 480, H: C.IH, cx: 240, hy: C.HY0, camX: 0, camH: C.CAMH, scroll: 0, ps: 1, px: 0, py: 0, world: null, stars: [] };
  G.scene = Sc;
  const rgb = PX.rgb, mix = PX.mix, rng = PX.rng;
  let fbuf = null, f32 = null, fcv = null, sky = null, back = [], space = null, rowS = null, rowZ = null;

  Sc.resize = function (W, H) {
    Sc.W = W; Sc.H = H; Sc.cx = W / 2;
    fcv = document.createElement('canvas'); fcv.width = W; fcv.height = H;
    fbuf = fcv.getContext('2d').createImageData(W, H); f32 = new Uint32Array(fbuf.data.buffer);
    rowS = new Float32Array(H); rowZ = new Float32Array(H);
    if (Sc.world) Sc.setWorld(Sc.world, Sc.hangar);
  };
  /* project a world point; results in Sc.px, Sc.py, Sc.ps */
  Sc.proj = function (x, y, z) {
    const s = Z0 / (Z0 + z);
    Sc.ps = s; Sc.px = Sc.cx + (x - Sc.camX) * s * SC; Sc.py = Sc.hy + (Sc.camH - y) * s * SC;
  };
  /* a screen point back to the world at depth z */
  Sc.unproj = function (sx, sy, z, out) {
    const s = Z0 / (Z0 + z);
    out.x = (sx - Sc.cx) / (s * SC) + Sc.camX; out.y = Sc.camH - (sy - Sc.hy) / (s * SC); out.z = z; return out;
  };
  Sc.setCam = function (hx, hy_) { Sc.camX = hx * 0.38; Sc.camH = C.CAMH + (hy_ - 40) * 0.2; Sc.hy = C.HY0 + (hy_ - 40) * 0.15; };

  /* ---------- cached backdrops ---------- */
  const bands = (ctx, w, h, stops, steps, dither) => {
    const cols = stops.map(rgb), im = ctx.createImageData(w, h), d = new Uint32Array(im.data.buffer);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1), seg = t < 0.5 ? 0 : 1, lt = seg ? (t - 0.5) * 2 : t * 2, f = lt * steps, i0 = Math.floor(f), fr = f - i0;
      for (let x = 0; x < w; x++) {
        const q = (i0 + (dither && PX.dither(x, y, fr) ? 1 : 0)) / steps, c = mix(cols[seg], cols[seg + 1], Math.min(1, q));
        d[y * w + x] = c;
      }
    }
    ctx.putImageData(im, 0, 0);
  };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function ridge(w, h, col, base, amp, seed, snow) {
    const c = mk(w, h), x = c.getContext('2d'), r = rng(seed), ph = [r() * 6, r() * 6, r() * 6];
    const col1 = rgb(col), top = PX.css(mix(col1, rgb('#ffffff'), 0.28)), body = PX.css(col1), dk = PX.css(mix(col1, rgb('#101030'), 0.35));
    for (let i = 0; i < w; i++) {
      const a = i / w * 6.2832, v = Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 11 + ph[2]) * 0.2, y = Math.round(base - (v * 0.5 + 0.5) * amp);
      x.fillStyle = body; x.fillRect(i, y, 1, h - y); x.fillStyle = top; x.fillRect(i, y, 1, 2 + (snow ? 3 : 0)); x.fillStyle = dk; x.fillRect(i, y + 6 + (i & 1), 1, h - y);
      x.fillStyle = body; x.fillRect(i, y + 2 + (snow ? 3 : 0), 1, 4);
    }
    return c;
  }
  Sc.setWorld = function (wd, hangar) {
    Sc.world = wd; Sc.hangar = hangar; back = []; sky = null; space = null;
    const W = Sc.W, H = Sc.H;
    if (wd.kind === 'plains') {
      sky = mk(W, 200); bands(sky.getContext('2d'), W, 200, wd.sky, 14, true);
      const r = rng(wd.hue * 31 + 5), cx = sky.getContext('2d');
      // soft sun / moon
      cx.fillStyle = PX.css(mix(rgb(wd.sky[2]), rgb('#ffffff'), 0.6)); const sx = Math.floor(W * (0.2 + r() * 0.6)); cx.beginPath(); cx.arc(sx, 120, 20, 0, 6.3); cx.fill();
      back = [{ c: ridge(W, 70, wd.ridge[0], 66, 40, wd.hue + 1, wd.hue > 150 && wd.hue < 200), k: 0.12, y: -70 }, { c: ridge(W, 60, wd.ridge[1], 56, 26, wd.hue + 7, false), k: 0.25, y: -58 }];
      // clouds tile
      const cl = mk(W, 60), cc = cl.getContext('2d'); cc.fillStyle = wd.cloud; for (let i = 0; i < 9; i++) { const x0 = r() * W, y0 = 8 + r() * 38, w = 26 + r() * 40; cc.globalAlpha = 0.5 + r() * 0.3; cc.fillRect(Math.round(x0), Math.round(y0), Math.round(w), 4); cc.fillRect(Math.round(x0 + 6), Math.round(y0 - 3), Math.round(w * 0.6), 4); cc.fillRect(Math.round(x0 + 3), Math.round(y0 + 4), Math.round(w * 0.8), 3); }
      back.unshift({ c: cl, k: 0.04, y: -150, wrap: true });
      Sc.fl = [rgb(wd.floor[0]), rgb(wd.floor[1]), rgb(wd.floor[2]), rgb(wd.fog)];
    } else if (wd.kind === 'space') {
      space = mk(W, H); const x = space.getContext('2d'); bands(x, W, H, [wd.bg[0], wd.bg[1], wd.bg[0]], 16, true);
      const r = rng(wd.hue + 77);
      // nebula clouds
      for (let i = 0; i < 70; i++) { x.globalAlpha = 0.05 + r() * 0.07; x.fillStyle = PX.css(mix(rgb(wd.bg[1]), rgb(wd.planet[0]), r() * 0.6)); x.beginPath(); x.arc(r() * W, r() * H, 18 + r() * 60, 0, 6.3); x.fill(); }
      x.globalAlpha = 1;
      // big dithered planet
      const px = W * (0.18 + r() * 0.64), py = H * 0.34, pr = 46 + r() * 20, im = x.getImageData(0, 0, W, H), d = new Uint32Array(im.data.buffer), pa = rgb(wd.planet[0]), pb = rgb(wd.planet[1]);
      for (let yy = Math.floor(py - pr); yy <= py + pr; yy++) for (let xx = Math.floor(px - pr); xx <= px + pr; xx++) { const dx = (xx - px) / pr, dy = (yy - py) / pr, q = dx * dx + dy * dy; if (q > 1 || xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const lit = Math.max(0, Math.min(1, 0.5 - dx * 0.55 - dy * 0.45 + (1 - q) * 0.35)), band = Math.sin(yy * 0.35 + Math.sin(xx * 0.07) * 2) * 0.1; d[yy * W + xx] = mix(pb, pa, PX.dither(xx, yy, lit + band) ? Math.min(1, lit + 0.3) : Math.max(0, lit - 0.2)); }
      x.putImageData(im, 0, 0);
      Sc.stars = []; for (let i = 0; i < 240; i++) Sc.stars.push({ x: (r() - 0.5) * 560, y: (r() - 0.5) * 340, z: r() * C.ZFAR });
    } else Sc.stars = [];
  };

  /* ---------- floor (plains): per-scanline checkerboard in perspective, filled as spans ---------- */
  const TW = 44, TD = 70;
  function floor(ctx) {
    const W = Sc.W, H = Sc.H, hy = Math.round(Sc.hy), fl = Sc.fl, camH = Sc.camH, camX = Sc.camX, cx = Sc.cx, scr = Sc.scroll;
    for (let y = hy + 1; y < H; y++) {
      const s = (y - Sc.hy) / (camH * SC), z = Z0 * (1 / s - 1), f = Math.min(1, Math.max(0, 1 - Math.pow(Math.min(1, s / 0.62), 0.75)));
      const ca = mix(fl[0], fl[3], f), cb = mix(fl[1], fl[3], f), cc = mix(fl[2], fl[3], f * 1.05), zi = Math.floor((z + scr) / TD), cw = TW * s * SC, row = y * W;
      if (cw < 2.2) { f32.fill(mix(ca, cb, 0.5), row, row + W); continue; }
      const k0 = Math.floor((camX - cx / (s * SC)) / TW), k1 = Math.ceil((camX + (W - cx) / (s * SC)) / TW);
      for (let k = k0; k <= k1; k++) {
        const a = Math.max(0, Math.round(cx + (k * TW - camX) * s * SC)), b = Math.min(W, Math.round(cx + ((k + 1) * TW - camX) * s * SC));
        if (b <= a) continue;
        const col = ((k + zi) & 1) ? cb : ca;
        if (cw > 7 && (((k % 6) + 6) % 6 === 0)) { const m = Math.min(b, a + Math.max(1, Math.round(cw * 0.1))); f32.fill(cc, row + a, row + m); f32.fill(col, row + m, row + b); } else f32.fill(col, row + a, row + b);
      }
    }
    ctx.putImageData(fbuf, 0, 0, 0, hy + 1, W, H - hy - 1);
  }

  /* ---------- tunnel (corridor): every pixel is the nearest of floor / ceiling / left wall / right wall; rendered at half resolution through a colour x fog lookup ---------- */
  let tcv = null, tbuf = null, t32 = null, lut = null;
  function tunnelLut(wd) {
    const base = [wd.floorC[0], wd.floorC[1], wd.ceilC[0], wd.ceilC[1], wd.wall[0], wd.wall[1], wd.wall[2], wd.light].map(rgb), n = base.length;
    for (let i = 0; i < 7; i++) base.push(mix(base[i], 0xff000000, 0.45));
    base.push(mix(base[6], 0xff000000, 0.4));
    const fog = rgb(wd.fog); lut = new Uint32Array(base.length * 16);
    for (let i = 0; i < base.length; i++) for (let f = 0; f < 16; f++) { const q = f / 15; lut[i * 16 + f] = mix(base[i], fog, q * q); }
    lut.n = n;
  }
  function tunnel(ctx) {
    const wd = Sc.world, W = Sc.W, H = Sc.H, w = W >> 1, h = H >> 1, hy = Sc.hy, cx = Sc.cx, camH = Sc.camH, camX = Sc.camX, XR = Sc.hangar ? 300 : 150, CH = Sc.hangar ? 170 : 125, k = 1 / (Z0 * SC), scr = Sc.scroll;
    if (!tcv || tcv.width !== w || tcv.height !== h) { tcv = mk(w, h); tbuf = tcv.getContext('2d').createImageData(w, h); t32 = new Uint32Array(tbuf.data.buffer); }
    if (!lut || lut.wd !== wd) { tunnelLut(wd); lut.wd = wd; }
    const GLOW = rgb(wd.glow), FG = rgb(wd.fog);
    for (let y = 0; y < h; y++) {
      const v = (hy - (y * 2 + 1)) * k, row = y * w, cT = v < 0 ? -camH / v : v > 0 ? (CH - camH) / v : 1e9, pv = v < 0 ? 0 : 1;
      for (let x = 0; x < w; x++) {
        const u = (x * 2 + 1 - cx) * k;
        let T = cT, p = pv, t;
        if (u > 0) { t = (XR - camX) / u; if (t < T) { T = t; p = 2; } } else if (u < 0) { t = (-XR - camX) / u; if (t < T) { T = t; p = 3; } }
        if (T > 2300) { const d = Math.hypot(x * 2 - cx, (y * 2 - hy) * 1.4) / 60; t32[row + x] = mix(GLOW, FG, Math.min(1, d * d)); continue; }
        const zt = (T - Z0 + scr) / 60, zi = Math.floor(zt), zf = zt - zi;
        let ci, dk = 0;
        if (p < 2) {
          const lat = (camX + u * T) / 44, li = Math.floor(lat), lf = lat - li;
          ci = (p ? 2 : 0) + ((zi + li) & 1);
          if (zf < 0.07 || lf < 0.07) dk = 1;
          else if (p && (((zi % 4) + 4) % 4 === 0) && lf > 0.2 && lf < 0.8 && zf > 0.25 && zf < 0.75) ci = 7;
          else if (!p && lf > 0.46 && lf < 0.54 && (zi & 1)) ci = 6;
        } else {
          const yy = (camH + v * T) / 40, yi = Math.floor(yy), yf = yy - yi;
          ci = (zi + yi) & 1 ? 4 : 5;
          if (zf < 0.06 || yf < 0.06) dk = 1;
          else if (yi === 1) { ci = 6; if (zf >= 0.5) dk = 2; }
          else if (yi === 2 && (((zi % 3) + 3) % 3 === 0) && zf > 0.2 && zf < 0.8) ci = 7;
        }
        if (dk === 1) ci = ci < 7 ? ci + 8 : ci; else if (dk === 2) ci = 15;
        const f = T < 250 ? 0 : Math.min(15, ((T - 250) / 130) | 0);
        t32[row + x] = lut[ci * 16 + f];
      }
    }
    const tx = tcv.getContext('2d'); tx.putImageData(tbuf, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tcv, 0, 0, W, H);
  }

  /* ---------- the whole backdrop for a frame ---------- */
  Sc.drawBack = function (ctx, time) {
    const wd = Sc.world, W = Sc.W, H = Sc.H;
    if (!wd) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    if (wd.kind === 'plains') {
      ctx.drawImage(sky, 0, Math.round(Sc.hy) - 200 + 1);
      for (const L of back) {
        const off = -((Sc.camX * L.k * 3 + (L.wrap ? time * 4 : 0)) % W + W) % W, y = Math.round(Sc.hy + L.y);
        ctx.drawImage(L.c, Math.round(off), y); ctx.drawImage(L.c, Math.round(off) + W, y);
      }
      floor(ctx);
    } else if (wd.kind === 'corridor') tunnel(ctx);
    else {
      ctx.drawImage(space, Math.round(-Sc.camX * 0.05), Math.round((Sc.hy - C.HY0) * 0.3));
      ctx.strokeStyle = '#fff';
      for (const st of Sc.stars) {
        if (st.z < 5) { st.z += C.ZFAR; continue; }
        Sc.proj(st.x, st.y, st.z); const x1 = Sc.px, y1 = Sc.py, k = Sc.ps;
        if (x1 < -20 || y1 < -20 || x1 > W + 20 || y1 > H + 20) continue;
        Sc.proj(st.x, st.y, st.z + Sc.speed * 0.05); ctx.globalAlpha = Math.min(1, k * 2.4 + 0.25); ctx.lineWidth = k > 0.45 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(Sc.px, Sc.py); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };
  Sc.speed = 400;
  Sc.updateStars = function (dt) { for (const st of Sc.stars) st.z -= Sc.speed * dt; };
})((window.SGS = window.SGS || {}));
