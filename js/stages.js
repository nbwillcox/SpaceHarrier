/* Stage scripts: a seeded timeline of waves per stage. Each wave pattern spawns aliens / obstacles at the far end of the view (z = 2500). */
(function (G) {
  'use strict';
  const PX = G.px, Z = 2500;
  const St = {};
  G.stages = St;
  const lat = (g) => (g.corridor() ? g.xb() - 6 : g.spread());
  const rx = (g, r, f) => (r() * 2 - 1) * lat(g) * (f || 0.85);
  const ry = (g, r, lo, hi) => lo + r() * (Math.min(hi, g.yb() - 4) - lo);
  const PAT = {
    droneLine(g, r, d) { const n = 4 + Math.floor(d * 3), y = ry(g, r, 18, 70), sp = lat(g) * 1.5 / (n - 1); for (let i = 0; i < n; i++) g.spawnFoe(0, -lat(g) * 0.75 + i * sp, y, Z); },
    droneArc(g, r, d) { const n = 5 + Math.floor(d * 2), y = ry(g, r, 22, 52), x0 = rx(g, r, 0.4); for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; g.spawnFoe(0, x0 + k * 34, y + k * k * 2.4, Z + Math.abs(k) * 70); } },
    vForm(g, r) { const y = ry(g, r, 24, 62), x0 = rx(g, r, 0.5); for (let i = 0; i < 5; i++) { const k = i - 2; g.spawnFoe(1, x0 + k * 30, y + Math.abs(k) * 5, Z + Math.abs(k) * 170); } },
    swoopStream(g, r, d) { const n = 5 + Math.floor(d * 3), y = ry(g, r, 24, 64), x0 = rx(g, r, 0.5); for (let i = 0; i < n; i++) g.spawnFoe(1, x0, y, Z + i * 170, { ph: 0.5 }); },
    gunships(g, r, d) { const n = 1 + (d > 0.5 ? 1 : 0); for (let i = 0; i < n; i++) g.spawnFoe(2, rx(g, r, 0.6), ry(g, r, 30, 70), Z + i * 320); },
    mines(g, r, d) { const n = 5 + Math.floor(d * 3); for (let i = 0; i < n; i++) g.spawnFoe(3, rx(g, r, 0.9), ry(g, r, 14, 80), Z + r() * 700); },
    chargers(g, r, d) { const n = 3 + Math.floor(d * 3); for (let i = 0; i < n; i++) g.spawnFoe(4, rx(g, r, 0.9), ry(g, r, 20, 80), Z + i * 280); },
    turrets(g, r, d) { const n = 2 + Math.floor(d * 2); for (let i = 0; i < n; i++) g.spawnFoe(5, rx(g, r, 0.9), 0, Z + i * 220); },
    eyes(g, r, d) { const n = 2 + Math.floor(d * 2); for (let i = 0; i < n; i++) g.spawnFoe(6, rx(g, r, 0.7), ry(g, r, 28, 70), Z + i * 260); },
    columnRow(g, r, d) {
      const gx = rx(g, r, 0.7), L = lat(g) * 1.05, kind = r() < 0.5 ? 'column' : (r() < 0.5 ? 'pillar' : 'column');
      for (let x = -L; x <= L; x += 46) if (Math.abs(x - gx) > 36) g.spawnProp(r() < 0.25 ? 'pillar' : kind, x + (r() - 0.5) * 8, Z);
    },
    columnPairs(g, r) { for (let i = 0; i < 3; i++) g.spawnProp(r() < 0.6 ? 'column' : 'spire', rx(g, r, 0.95), Z + i * 330); },
    bushField(g, r, d) { const n = 8 + Math.floor(d * 4); for (let i = 0; i < n; i++) g.spawnProp(r() < 0.55 ? 'bush' : (g.wd.hue === 125 ? 'mush' : 'rock'), rx(g, r, 1), Z + r() * 1000); },
    pillarMaze(g, r) { for (let row = 0; row < 3; row++) { const gx = rx(g, r, 0.7), L = lat(g) * 1.05; for (let x = -L; x <= L; x += 54) if (Math.abs(x - gx) > 34) g.spawnProp(row === 1 ? 'pillar' : 'column', x, Z + row * 260); } },
    astField(g, r, d) {
      const n = 7 + Math.floor(d * 4), R = [13, 22, 36], HP = [2, 6, 0];
      for (let i = 0; i < n; i++) { const sz = r() < 0.45 ? 0 : r() < 0.7 ? 1 : 2, y = ry(g, r, 14, 84); g.spawnProp('ast', rx(g, r, 1), Z + r() * 900, { y, size: sz, rw: R[sz], hp: HP[sz], h: y + R[sz], bot: y - R[sz], vx: (r() - 0.5) * 24, vy: (r() - 0.5) * 10, vz: r() * 80 }); }
    },
    gate(g, r, d) {
      const XR = g.XR(), CH = g.CH(), w = d > 0.5 ? 64 : 78, h = d > 0.5 ? 52 : 64, cx = (r() * 2 - 1) * (XR - w / 2 - 14), cy = h / 2 + 12 + r() * (CH - h - 30);
      g.spawnProp('gate', 0, Z, { rects: [[-XR, 0, cx - w / 2, CH], [cx + w / 2, 0, XR, CH], [cx - w / 2, 0, cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2, cx + w / 2, CH]], h: CH, rw: XR, gx: cx, gy: cy, gw: w, gh: h });
    },
    slit(g, r, d) {
      const XR = g.XR(), CH = g.CH(), h = d > 0.5 ? 46 : 58, cy = h / 2 + 12 + r() * (CH - h - 30);
      g.spawnProp('gate', 0, Z, { rects: [[-XR, 0, XR, cy - h / 2], [-XR, cy + h / 2, XR, CH]], h: CH, rw: XR, gx: 0, gy: cy, gw: XR * 2, gh: h });
    },
    crates(g, r) { for (let i = 0; i < 3; i++) g.spawnProp(r() < 0.4 ? 'pylon' : 'crate', rx(g, r, 0.9), Z + i * 260); },
  };
  const POOL = {
    plains: [['droneLine', 5, 0], ['droneArc', 3, 0], ['vForm', 4, 0], ['swoopStream', 3, 0.1], ['gunships', 2, 0.25], ['mines', 2, 0.3], ['chargers', 3, 0.2], ['turrets', 3, 0], ['columnRow', 5, 0], ['columnPairs', 3, 0], ['bushField', 4, 0], ['pillarMaze', 2, 0.35]],
    corridor: [['droneLine', 4, 0], ['vForm', 3, 0], ['swoopStream', 3, 0.1], ['gunships', 2, 0.25], ['mines', 2, 0.3], ['chargers', 3, 0.2], ['gate', 8, 0], ['slit', 3, 0.15], ['crates', 3, 0], ['turrets', 2, 0]],
    space: [['droneLine', 3, 0], ['vForm', 3, 0], ['swoopStream', 3, 0.1], ['gunships', 3, 0.15], ['mines', 3, 0.2], ['chargers', 3, 0.1], ['astField', 8, 0], ['eyes', 2, 0.1]],
  };
  const LETTERS = ['P', 'P', 'P', 'L', 'L', 'B', 'S', 'S', 'D'];
  St.make = function (n, o) {
    o = o || {};
    const W = G.worlds, wd = W.list[W.of(n)], idx = W.idx(n), boss = W.isBoss(n), d = Math.min(1.5, (n - 1) / 17), r = PX.rng(n * 911 + (o.seed | 0) + 17);
    if (o.mode === 'bossrush') return { speed: 390 + n * 8, end: 1.2, boss: true, events: [] };
    const len = boss ? 26 : idx === 0 ? 60 : 68, events = [], pool = POOL[wd.kind].filter((p) => p[2] <= d + 0.05), wsum = pool.reduce((a, p) => a + p[1], 0 + (wd.hue === 295 ? 0 : 0));
    let t = 3.2, k = 0;
    const pickLetter = () => (k++ === 9 && idx === 1 ? '1' : LETTERS[Math.floor(r() * LETTERS.length)]);
    while (t < len) {
      let q = r() * wsum, pat = pool[0]; for (const p of pool) { q -= (wd.hue === 295 && p[0] === 'eyes' ? p[1] * 2 : p[1]); if (q <= 0) { pat = p; break; } }
      const name = pat[0], forced = k === 1 ? 'P' : k === 3 ? 'L' : null, carry = forced || (r() < 0.2 ? pickLetter() : null), seedP = Math.floor(r() * 1e6);
      events.push({ t, fn: (g) => { const rr = PX.rng(seedP), before = g.foes.length; PAT[name](g, rr, d); const added = g.foes.filter((f, i) => i >= before && f.type !== 5); if (carry && added.length) added[Math.floor(rr() * added.length)].carry = carry; } });
      k++;
      if (d > 0.3 && r() < d * 0.5 && name !== 'gate' && name !== 'slit') { const alt = pool.filter((p) => ['gate', 'slit', 'astField', 'columnRow', 'pillarMaze'].indexOf(p[0]) < 0)[Math.floor(r() * 4) % 4], an = alt ? alt[0] : 'droneLine', sd = Math.floor(r() * 1e6); events.push({ t: t + 0.9, fn: (g) => { PAT[an](g, PX.rng(sd), d); } }); }
      t += Math.max(1.5, (name === 'gate' || name === 'slit' ? 3.4 : name === 'astField' ? 3.6 : 2.5) - d * 1.3) + r() * 0.6;
    }
    return { speed: 380 + n * 13 + (o.mode === 'endless' ? 40 : 0), end: len + 5, boss, events, label: wd.name };
  };
  St.PAT = PAT;
})((window.SGS = window.SGS || {}));
