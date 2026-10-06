/* Pixel-art toolkit: a tiny software rasteriser (no antialiasing), ASCII sprite parser, light-direction shading, outlines, a 5x7 bitmap font. 1 art pixel = PX.K logical pixels. */
(function (G) {
  'use strict';
  const PX = { K: 1 };
  G.px = PX;
  const K = PX.K;

  /* colours are packed ABGR ints so pixel buffers are plain Uint32Arrays */
  PX.rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
  const R = (c) => c & 255, Gc = (c) => (c >> 8) & 255, B = (c) => (c >> 16) & 255;
  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const pack = (r, g, b) => (0xff000000 | (cl(b) << 16) | (cl(g) << 8) | cl(r)) >>> 0;
  PX.pack = pack;
  PX.css = (c) => 'rgb(' + R(c) + ',' + Gc(c) + ',' + B(c) + ')';
  PX.mix = (a, b, t) => pack(R(a) + (R(b) - R(a)) * t, Gc(a) + (Gc(b) - Gc(a)) * t, B(a) + (B(b) - B(a)) * t);
  PX.hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return pack(f(0) * 255, f(8) * 255, f(4) * 255);
  };
  PX.pal = (o) => { const p = {}; for (const k in o) p[k] = PX.rgb(o[k]); return p; };
  /* a 5-step ramp [highlight, light, base, shade, deep] from a base colour, hue-shifted for a hand-made look */
  PX.ramp = (hue, sat, lum) => [PX.hsl(hue - 8, sat * 0.7, Math.min(92, lum + 34)), PX.hsl(hue - 4, sat * 0.9, lum + 16), PX.hsl(hue, sat, lum), PX.hsl(hue + 8, sat, Math.max(4, lum - 15)), PX.hsl(hue + 16, sat * 0.95, Math.max(3, lum - 28))];
  PX.OUT = PX.rgb('#0c0e1e');
  PX.snap = (v) => Math.round(v / K) * K;

  PX.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  PX.hash = hash;
  /* smooth value noise, periodic in x with period per (optional) */
  PX.noise = (seed, per) => (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const w = (i) => (per ? ((i % per) + per) % per : i);
    const a = hash(w(x0), y0, seed), b = hash(w(x0 + 1), y0, seed), c = hash(w(x0), y0 + 1, seed), d = hash(w(x0 + 1), y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /* ordered dither: true when t (0..1) passes the 4x4 Bayer threshold at x,y */
  PX.dither = (x, y, t) => t * 16 > BAY[(y & 3) * 4 + (x & 3)] + 0.5;

  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
    set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
    rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    disc(cx, cy, r, c) { return this.ell(cx, cy, r, r, c); }
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, c); }
      return this;
    }
    line(x0, y0, x1, y1, wd, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, o = Math.floor((wd - 1) / 2);
      let err = dx + dy;
      for (;;) { this.rect(x0 - o, y0 - o, wd, wd, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return this;
    }
    poly(pts, c) {
      let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yy = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
      return this;
    }
    blit(src, ox, oy, flip) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y * src.w + x]; if (c) this.set(flip ? ox + src.w - 1 - x : ox + x, oy + y, c); } return this; }
    clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); return p; }
    /* paint every set pixel of `mask` into this buffer using a light-from-upper-left ramp [hi, lt, base, sh, dp] */
    paint(mask, ox, oy, ramp, cap) {
      cap = cap || 3;
      const m = (x, y) => x >= 0 && y >= 0 && x < mask.w && y < mask.h && mask.d[y * mask.w + x] !== 0;
      for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
        if (!mask.d[y * mask.w + x]) continue;
        let a = 0, b = 0;
        while (a < cap && m(x - a - 1, y - a - 1) && m(x - a - 1, y) && m(x, y - a - 1)) a++;
        while (b < cap && m(x + b + 1, y + b + 1) && m(x + b + 1, y) && m(x, y + b + 1)) b++;
        const s = b - a, i = s >= cap - 1 ? 0 : s >= 1 ? 1 : s <= 1 - cap ? 4 : s <= -1 ? 3 : 2;
        this.set(ox + x, oy + y, ramp[i]);
      }
      return this;
    }
    /* smooth lit-dome shading for organic / rounded forms: height from the distance to the edge, banded + dithered through the ramp */
    shade3d(mask, ox, oy, ramp, o) {
      o = o || {};
      const D = o.depth || 8, lx = o.lx === undefined ? -0.55 : o.lx, ly = o.ly === undefined ? -0.65 : o.ly, lz = o.lz || 0.55, ll = Math.hypot(lx, ly, lz), w = mask.w, h = mask.h, n = w * h, d = new Float32Array(n), I0 = lz / ll, last = ramp.length - 1, mid = last / 2;
      for (let i = 0; i < n; i++) d[i] = mask.d[i] ? 1e5 : 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; let v = d[i]; v = Math.min(v, (x > 0 ? d[i - 1] : 0) + 1, (y > 0 ? d[i - w] : 0) + 1, (x > 0 && y > 0 ? d[i - w - 1] : 0) + 1.414, (x < w - 1 && y > 0 ? d[i - w + 1] : 0) + 1.414); d[i] = v; }
      for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; let v = d[i]; v = Math.min(v, (x < w - 1 ? d[i + 1] : 0) + 1, (y < h - 1 ? d[i + w] : 0) + 1, (x < w - 1 && y < h - 1 ? d[i + w + 1] : 0) + 1.414, (x > 0 && y < h - 1 ? d[i + w - 1] : 0) + 1.414); d[i] = v; }
      const hg = (x, y) => { x = x < 0 ? 0 : x >= w ? w - 1 : x; y = y < 0 ? 0 : y >= h ? h - 1 : y; const q = Math.min(d[y * w + x], D), t = (D - q) / D; return D * Math.sqrt(Math.max(0, 1 - t * t)); };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask.d[y * w + x]) continue;
        const nx = -(hg(x + 1, y) - hg(x - 1, y)) / 2, ny = -(hg(x, y + 1) - hg(x, y - 1)) / 2, nl = Math.hypot(nx, ny, 1), I = Math.max(0, (nx * lx + ny * ly + lz) / (nl * ll));
        const f = Math.max(0, Math.min(last, mid - (I - I0) * (o.k || 4.3) * last / 4)), i0 = Math.floor(f), fr = f - i0;
        this.set(ox + x, oy + y, ramp[i0 + (i0 < last && PX.dither(x, y, fr) ? 1 : 0)]);
      }
      return this;
    }
    /* grow a 1px outline around the silhouette (returns a bigger buffer) */
    outline(c, n) {
      n = n || 1; const o = new Pix(this.w + 2 * n, this.h + 2 * n), oc = c || PX.OUT;
      o.blit(this, n, n);
      for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
        if (o.d[y * o.w + x]) continue;
        const sx = x - n, sy = y - n;
        if (this.get(sx - 1, sy) || this.get(sx + 1, sy) || this.get(sx, sy - 1) || this.get(sx, sy + 1)) o.d[y * o.w + x] = oc;
      }
      return o;
    }
    toCanvas(k) {
      k = k || K;
      const t = document.createElement('canvas'); t.width = this.w; t.height = this.h;
      const tx = t.getContext('2d'), im = tx.createImageData(this.w, this.h);
      new Uint32Array(im.data.buffer).set(this.d); tx.putImageData(im, 0, 0);
      if (k === 1) return t;
      const c = document.createElement('canvas'); c.width = this.w * k; c.height = this.h * k;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, c.width, c.height);
      return c;
    }
  }
  PX.Pix = Pix;
  /* ASCII rows -> pixels. '.' and ' ' are transparent, other characters index the palette */
  PX.parse = function (rows, pal) {
    let w = 0; for (const r of rows) w = Math.max(w, r.length);
    const p = new Pix(w, rows.length);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch !== '.' && ch !== ' ') { const c = pal[ch]; if (c === undefined) throw new Error('px: no palette entry "' + ch + '" (row ' + y + ')'); p.d[y * w + x] = c; } }
    return p;
  };
  /* finished sprite: optional dark outline, K-scaled canvas, origin (ax, ay in ART pixels from the top-left of `pix`) */
  PX.sprite = function (pix, ax, ay, opt) {
    opt = opt || {};
    let p = pix, n = 0;
    if (opt.outline !== false) { p = pix.outline(opt.outlineColor, 1); n = 1; }
    return { c: p.toCanvas(), w: p.w * K, h: p.h * K, ox: (ax + n) * K, oy: (ay + n) * K, pix: p, ax: ax + n, ay: ay + n };
  };
  PX.flipped = function (s) {
    const c = document.createElement('canvas'); c.width = s.c.width; c.height = s.c.height;
    const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(s.c, 0, 0);
    return { c, w: s.w, h: s.h, ox: s.w - s.ox, oy: s.oy };
  };
  PX.flash = function (s, col) {
    const c = document.createElement('canvas'); c.width = s.c.width; c.height = s.c.height;
    const x = c.getContext('2d'); x.drawImage(s.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col || 'rgba(255,255,255,0.8)'; x.fillRect(0, 0, c.width, c.height);
    return { c, w: s.w, h: s.h, ox: s.ox, oy: s.oy };
  };
  /* draw at logical coords snapped to the art-pixel grid; f = -1 flips horizontally around the anchor */
  PX.draw = function (ctx, s, x, y, f) {
    x = Math.round(x / K) * K; y = Math.round(y / K) * K;
    if (f < 0) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h); ctx.restore(); }
    else ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  };

  /* hard-edged lines and rings on the art-pixel grid, straight to a canvas context (ax, ay in logical px) */
  PX.pline = function (ctx, x0, y0, x1, y1, t) {
    x0 = Math.round(x0 / K); y0 = Math.round(y0 / K); x1 = Math.round(x1 / K); y1 = Math.round(y1 / K); t = t || 1;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, o = Math.floor((t - 1) / 2) * K, ts = t * K;
    let err = dx + dy;
    for (;;) { ctx.fillRect(x0 * K - o, y0 * K - o, ts, ts); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  PX.dot = (ctx, x, y, s) => ctx.fillRect(Math.round(x / K) * K, Math.round(y / K) * K, (s || 1) * K, (s || 1) * K);

  /* ---------- 5x7 bitmap font ---------- */
  const GL = {
    A: '01110,10001,10001,11111,10001,10001,10001', B: '11110,10001,10001,11110,10001,10001,11110', C: '01110,10001,10000,10000,10000,10001,01110', D: '11110,10001,10001,10001,10001,10001,11110',
    E: '11111,10000,10000,11110,10000,10000,11111', F: '11111,10000,10000,11110,10000,10000,10000', G: '01110,10001,10000,10111,10001,10001,01111', H: '10001,10001,10001,11111,10001,10001,10001',
    I: '01110,00100,00100,00100,00100,00100,01110', J: '00111,00010,00010,00010,00010,10010,01100', K: '10001,10010,10100,11000,10100,10010,10001', L: '10000,10000,10000,10000,10000,10000,11111',
    M: '10001,11011,10101,10101,10001,10001,10001', N: '10001,11001,10101,10011,10001,10001,10001', O: '01110,10001,10001,10001,10001,10001,01110', P: '11110,10001,10001,11110,10000,10000,10000',
    Q: '01110,10001,10001,10001,10101,10010,01101', R: '11110,10001,10001,11110,10100,10010,10001', S: '01111,10000,10000,01110,00001,00001,11110', T: '11111,00100,00100,00100,00100,00100,00100',
    U: '10001,10001,10001,10001,10001,10001,01110', V: '10001,10001,10001,10001,10001,01010,00100', W: '10001,10001,10001,10101,10101,11011,10001', X: '10001,10001,01010,00100,01010,10001,10001',
    Y: '10001,10001,01010,00100,00100,00100,00100', Z: '11111,00001,00010,00100,01000,10000,11111',
    0: '01110,10001,10011,10101,11001,10001,01110', 1: '00100,01100,00100,00100,00100,00100,01110', 2: '01110,10001,00001,00010,00100,01000,11111', 3: '11110,00001,00001,01110,00001,00001,11110',
    4: '00010,00110,01010,10010,11111,00010,00010', 5: '11111,10000,11110,00001,00001,10001,01110', 6: '00110,01000,10000,11110,10001,10001,01110', 7: '11111,00001,00010,00100,01000,01000,01000',
    8: '01110,10001,10001,01110,10001,10001,01110', 9: '01110,10001,10001,01111,00001,00010,01100',
    '.': '00000,00000,00000,00000,00000,01100,01100', ',': '00000,00000,00000,00000,01100,00100,01000', ':': '00000,01100,01100,00000,01100,01100,00000', '-': '00000,00000,00000,11111,00000,00000,00000',
    '+': '00000,00100,00100,11111,00100,00100,00000', '/': '00001,00010,00010,00100,01000,01000,10000', '!': '00100,00100,00100,00100,00100,00000,00100',
    '?': '01110,10001,00001,00010,00100,00000,00100', "'": '00100,00100,01000,00000,00000,00000,00000', '(': '00010,00100,01000,01000,01000,00100,00010', ')': '01000,00100,00010,00010,00010,00100,01000',
    '%': '11001,11010,00010,00100,01000,01011,10011', '&': '01100,10010,10100,01000,10101,10010,01101', '*': '00000,10101,01110,11111,01110,10101,00000', '=': '00000,00000,11111,00000,11111,00000,00000',
    '∞': '00000,00000,01010,10101,10101,01010,00000', '_': '00000,00000,00000,00000,00000,00000,11111', '<': '00010,00100,01000,10000,01000,00100,00010', '>': '01000,00100,00010,00001,00010,00100,01000', ' ': '00000,00000,00000,00000,00000,00000,00000',
    '#': '01010,01010,11111,01010,11111,01010,01010', '@': '01110,10001,10111,10101,10110,10000,01110',
  };
  const glyphs = {};
  for (const k in GL) glyphs[k] = GL[k].split(',');
  glyphs.X2 = glyphs.X;
  PX.textW = (str, s) => Math.max(0, String(str).length * 6 - 1) * (s || K);
  PX.glyphs = glyphs;
  const tcache = new Map();
  function entry(str, o) {
    str = String(str).toUpperCase();
    const s = o.s || K, c = o.c || '#fff', oc = o.o || '', sh = o.sh || '', g = o.g ? o.g.join('/') : '';
    const key = str + '|' + s + '|' + c + '|' + oc + '|' + sh + '|' + g;
    let e = tcache.get(key);
    if (e) return e;
    if (tcache.size > 400) tcache.clear();
    const w = PX.textW(str, s), pad = s * 2, cv = document.createElement('canvas');
    cv.width = w + pad * 2 + (sh ? s : 0); cv.height = 7 * s + pad * 2 + (sh ? s : 0);
    const x2 = cv.getContext('2d');
    const draw = (ox, oy, col, grad) => {
      for (let i = 0; i < str.length; i++) {
        const gl = glyphs[str[i]] || glyphs['?'];
        for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (gl[r][q] === '1') { x2.fillStyle = grad ? (r < 3 ? grad[0] : grad[1]) : col; x2.fillRect(pad + ox + (i * 6 + q) * s, pad + oy + r * s, s, s); }
      }
    };
    if (sh) draw(s, s, sh);
    if (oc) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(dx * s, dy * s, oc);
    draw(0, 0, c, o.g);
    e = { cv, w, pad };
    tcache.set(key, e);
    return e;
  }
  /* draw pixel text. o = { s: pixel size, c: colour, o: outline colour, sh: drop-shadow colour, a: 'l'|'c'|'r', g: [top, bottom] gradient colours }; returns the width */
  const gcache = new Map();
  /* one cached canvas per glyph (so changing numbers never allocate) */
  function glyphCanvas(ch, o) {
    const s = o.s || K, c = o.c || '#fff', oc = o.o || '', sh = o.sh || '', g = o.g ? o.g.join('/') : '', key = ch + '|' + s + '|' + c + '|' + oc + '|' + sh + '|' + g;
    let e = gcache.get(key);
    if (e) return e;
    if (gcache.size > 600) gcache.clear();
    const pad = s * 2, cv = document.createElement('canvas'), x2 = cv.getContext('2d'), gl = glyphs[ch] || glyphs['?'];
    cv.width = 5 * s + pad * 2 + (sh ? s : 0); cv.height = 7 * s + pad * 2 + (sh ? s : 0);
    const draw = (ox, oy, col, grad) => { for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (gl[r][q] === '1') { x2.fillStyle = grad ? (r < 3 ? grad[0] : grad[1]) : col; x2.fillRect(pad + ox + q * s, pad + oy + r * s, s, s); } };
    if (sh) draw(s, s, sh);
    if (oc) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(dx * s, dy * s, oc);
    draw(0, 0, c, o.g);
    e = { cv, pad };
    gcache.set(key, e);
    return e;
  }
  PX.text = function (ctx, str, x, y, o) {
    o = o || {}; str = String(str).toUpperCase();
    const s = o.s || K, w = PX.textW(str, s), x0 = Math.round(x + (o.a === 'c' ? -w / 2 : o.a === 'r' ? -w : 0));
    for (let i = 0; i < str.length; i++) { if (str[i] === ' ') continue; const e = glyphCanvas(str[i], o); ctx.drawImage(e.cv, x0 + i * 6 * s - e.pad, Math.round(y) - e.pad); }
    return w;
  };
  /* a fresh canvas holding pixel text (for DOM use) */
  PX.textImage = function (str, o) {
    const e = entry(str, o || {}), c = document.createElement('canvas');
    c.width = e.cv.width; c.height = e.cv.height; c.getContext('2d').drawImage(e.cv, 0, 0);
    return c;
  };
  /* big chunky title lettering: row colours top->bottom (7), an extruded shadow and a dark outline */
  PX.logoImage = function (str, s, rows, ext, extCol) {
    str = String(str).toUpperCase();
    const gw = str.length * 7 - 1, pad = 2, W = gw + pad * 2 + ext, H = 7 + pad * 2 + ext, lit = new Pix(W, H), p = new Pix(W, H), cs = rows.map(PX.rgb), ec = PX.rgb(extCol);
    for (let i = 0; i < str.length; i++) { const gl = glyphs[str[i]] || glyphs['?']; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (gl[r][q] === '1') { lit.set(pad + i * 7 + q, pad + r, 1); lit.set(pad + i * 7 + q + 1, pad + r, 1); } }
    for (let e = ext; e >= 1; e--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (lit.d[y * W + x] && !lit.get(x + e, y + e)) p.set(x + e, y + e, ec);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!lit.d[y * W + x]) continue;
      let c = cs[y - pad];
      if (!lit.get(x - 1, y)) c = PX.mix(c, PX.rgb('#ffffff'), 0.35); else if (!lit.get(x + 1, y)) c = PX.mix(c, PX.rgb('#000000'), 0.28);
      if (!lit.get(x, y - 1)) c = PX.mix(c, PX.rgb('#ffffff'), 0.3); else if (!lit.get(x, y + 1)) c = PX.mix(c, PX.rgb('#000000'), 0.3);
      p.set(x, y, c);
    }
    return p.outline(PX.OUT, 1).toCanvas(s);
  };
})((window.SGS = window.SGS || {}));
