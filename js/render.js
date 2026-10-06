/* Draws a frame: backdrop, then every world object far-to-near with perspective scaling, shadows, effects and the crosshair / lock-on overlay. */
(function (G) {
  'use strict';
  const C = G.C, U = G.U, Sc = G.scene, A = G.art, PX = G.px, SC = C.SC;
  const R = {};
  G.render = R;
  const list = [];
  const shadow = (ctx, x, y, z, w, a) => {
    Sc.proj(x, 0, z); const s = Sc.ps; if (s > 2.5) return;
    ctx.fillStyle = 'rgba(0,0,0,' + (a || 0.28) + ')'; const rw = Math.max(2, w * SC * s), rh = Math.max(1, rw * 0.22);
    ctx.fillRect(Math.round(Sc.px - rw / 2), Math.round(Sc.py - rh / 2), Math.round(rw), Math.max(1, Math.round(rh)));
    if (rw > 10) ctx.fillRect(Math.round(Sc.px - rw / 2 + rw * 0.12), Math.round(Sc.py - rh / 2 - 1), Math.round(rw * 0.76), 1);
  };
  /* a corridor barrier: solid panels with a glowing, hazard-striped opening */
  const gate = (ctx, p, wd) => {
    const f = Math.min(1, Math.max(0, p.z / 2300)), fog = PX.rgb(wd.fog), base = PX.rgb(wd.wall[1]);
    const col = PX.css(PX.mix(base, fog, f * f)), dk = PX.css(PX.mix(PX.rgb('#0a1020'), fog, f * f));
    for (const r of p.rects) {
      Sc.proj(r[0], r[3], p.z); const x0 = Sc.px, y0 = Sc.py; Sc.proj(r[2], r[1], p.z); const x1 = Sc.px, y1 = Sc.py, w = x1 - x0, h = y1 - y0;
      if (w < 0.5 || h < 0.5 || x1 < -50 || x0 > Sc.W + 50) continue;
      const X = Math.round(x0), Y = Math.round(y0), WW = Math.round(w), HH = Math.round(h);
      ctx.fillStyle = col; ctx.fillRect(X, Y, WW, HH);
      ctx.fillStyle = dk; const step = Math.max(6, Math.round(24 * Sc.ps)); for (let i = 0; i < Math.max(WW, HH); i += step) { ctx.fillRect(X + (i < WW ? i : 0), Y, 1, HH); if (i < HH) ctx.fillRect(X, Y + i, WW, 1); }
    }
    if (p.gw !== undefined) {
      Sc.proj(p.gx - p.gw / 2, p.gy + p.gh / 2, p.z); const x0 = Sc.px, y0 = Sc.py; Sc.proj(p.gx + p.gw / 2, p.gy - p.gh / 2, p.z); const x1 = Sc.px, y1 = Sc.py, t = Math.max(2, Math.round(5 * Sc.ps));
      ctx.fillStyle = Math.floor(Sc.scroll / 40) & 1 ? '#ffd24a' : '#1a1a2a';
      const lx = Math.max(-20, x0), rx = Math.min(Sc.W + 20, x1);
      ctx.fillRect(Math.round(lx), Math.round(y0 - t), Math.round(rx - lx), t); ctx.fillRect(Math.round(lx), Math.round(y1), Math.round(rx - lx), t);
      if (p.gw < 200) { ctx.fillRect(Math.round(x0 - t), Math.round(y0 - t), t, Math.round(y1 - y0 + 2 * t)); ctx.fillRect(Math.round(x1), Math.round(y0 - t), t, Math.round(y1 - y0 + 2 * t)); }
    }
  };
  R.draw = function (ctx, g, time) {
    const P = g.P, wd = g.wd, floorShadows = wd.kind !== 'space', W = Sc.W, H = Sc.H;
    ctx.save();
    if (g.shake > 0 && G.settings.shake) ctx.translate(Math.round((Math.random() - 0.5) * g.shake), Math.round((Math.random() - 0.5) * g.shake));
    Sc.drawBack(ctx, time);
    ctx.imageSmoothingEnabled = false;
    list.length = 0;
    for (const p of g.props) list.push({ z: p.z, o: p, k: 0 });
    for (const f of g.foes) list.push({ z: f.z, o: f, k: 1 });
    for (const i of g.items) list.push({ z: i.z, o: i, k: 2 });
    for (const e of g.eshots) list.push({ z: e.z, o: e, k: 3 });
    for (const b of g.booms) list.push({ z: b.z, o: b, k: 4 });
    for (const m of g.missiles) list.push({ z: m.z, o: m, k: 5 });
    for (const s of g.pshots) list.push({ z: s.z, o: s, k: 6 });
    for (const p of g.parts) list.push({ z: p.z, o: p, k: 7 });
    for (const f of g.floats) list.push({ z: f.z, o: f, k: 8 });
    list.push({ z: 0, o: P, k: 9 });
    list.sort((a, b) => b.z - a.z);
    if (floorShadows) {
      for (const f of g.foes) if (!f.dead && f.z > -20 && !f.noShadow) shadow(ctx, f.x, 0, f.z, f.rw * 1.6, 0.26);
      for (const p of g.props) if (p.kind !== 'gate' && p.kind !== 'ast' && p.z > -20) shadow(ctx, p.x, 0, p.z, p.rw * 2, 0.3);
      for (const i of g.items) shadow(ctx, i.x, 0, i.z, 12, 0.22);
      if (!P.dead) shadow(ctx, P.x, 0, 0, 16, 0.34);
      for (const e of g.eshots) shadow(ctx, e.x, 0, e.z, 4, 0.2);
    }
    for (const it of list) R.item(ctx, g, it, time);
    R.overlay(ctx, g, time);
    ctx.restore();
    if (g.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, g.flash * 0.7).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  };
  R.item = function (ctx, g, it, time) {
    const o = it.o, wd = g.wd, P = g.P;
    switch (it.k) {
      case 0: {
        if (o.dead) return;
        if (o.kind === 'gate') { gate(ctx, o, wd); return; }
        Sc.proj(o.x, o.kind === 'ast' ? o.y : 0, o.z); if (Sc.ps > 3) return;
        let spr = o.kind === 'ast' ? A.props.ast[o.size] : A.props[o.kind]; if (!spr) return;
        if (o.hit > 0) spr = A.flash(spr);
        A.draw(ctx, spr, Sc.px, Sc.py, Sc.ps, false); return;
      }
      case 1: {
        if (o.dead) return;
        if (o.draw) { o.draw(ctx, g, o, time); return; }
        Sc.proj(o.x, o.type === 5 ? 0 : o.y, o.z); if (Sc.ps > 3) return;
        let spr = A.foe[o.type][o.rage ? 1 : 0][Math.floor((o.t + o.ph) * 6) & 1];
        if (o.hit > 0) spr = A.flash(spr);
        A.draw(ctx, spr, Sc.px, Sc.py, Sc.ps, false); return;
      }
      case 2: {
        Sc.proj(o.x, o.y + Math.sin(o.t * 4) * 2.5, o.z); if (Sc.ps > 3) return; const k = Sc.ps * (1 + Math.sin(o.t * 6) * 0.06);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(Math.round(Sc.px - 16 * k), Math.round(Sc.py - 1), Math.round(32 * k), 2);
        A.draw(ctx, A.pick[o.kind], Sc.px, Sc.py, k * 1.1, false); return;
      }
      case 3: {
        Sc.proj(o.x, o.y, o.z); if (Sc.ps > 3) return;
        A.draw(ctx, o.kind === 'big' ? A.orbBig : o.kind === 'ice' ? A.orbIce : o.kind === 'fire' ? A.orbFire : A.orb, Sc.px, Sc.py, Math.max(0.42, Sc.ps) * 1.15, false); return;
      }
      case 4: { Sc.proj(o.x, o.y, o.z); if (Sc.ps > 3) return; A.draw(ctx, A.boom[Math.min(7, Math.floor(o.t / 0.07))], Sc.px, Sc.py, Math.max(0.3, Sc.ps) * o.size * 0.95, false); return; }
      case 5: {
        Sc.proj(o.x, o.y, o.z); const x = Sc.px, y = Sc.py, s = Sc.ps; Sc.proj(o.x - o.vx * 0.05, o.y - o.vy * 0.05, o.z - o.vz * 0.05);
        ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.moveTo(Sc.px, Sc.py); ctx.lineTo(x, y); ctx.stroke();
        const q = Math.max(2, Math.round(4 * s)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - q / 2), Math.round(y - q / 2), q, q); return;
      }
      case 6: {
        Sc.proj(o.x, o.y, o.z); const x = Sc.px, y = Sc.py, s = Sc.ps; Sc.proj(o.x - o.vx * 0.03, o.y - o.vy * 0.03, o.z - o.vz * 0.03);
        ctx.strokeStyle = P.cannon >= 4 ? '#7affff' : '#ffe86a'; ctx.lineWidth = Math.max(1, 2.2 * s); ctx.beginPath(); ctx.moveTo(Sc.px, Sc.py); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo((Sc.px + x) / 2, (Sc.py + y) / 2); ctx.lineTo(x, y); ctx.stroke(); return;
      }
      case 7: { Sc.proj(o.x, o.y, o.z); if (Sc.ps > 3) return; ctx.fillStyle = o.c; const q = Math.max(1, Math.round(2.4 * Sc.ps)); ctx.fillRect(Math.round(Sc.px), Math.round(Sc.py), q, q); return; }
      case 8: { Sc.proj(o.x, o.y, o.z); PX.text(ctx, o.txt, Sc.px, Sc.py - 8, { s: 1, c: o.col, o: '#0b0d1a', a: 'c' }); return; }
      case 9: R.drawHero(ctx, g, time);
    }
  };
  R.drawHero = function (ctx, g, time) {
    const P = g.P;
    if (P.dead) return;
    if (P.invuln > 0 && Math.floor(time * 18) % 2) return;
    Sc.proj(P.x, P.y, 0);
    const b = P.bank < -0.35 ? 0 : P.bank > 0.35 ? 2 : 1, p = P.pitch < -0.35 ? 0 : P.pitch > 0.35 ? 2 : 1, spr = A.hero[b][p][Math.floor(time * 14) & 1];
    if (P.drone > 0) for (const sx of [-1, 1]) A.draw(ctx, A.drone, Sc.px + sx * (30 + Math.sin(time * 3 + sx) * 3), Sc.py - 4 + Math.sin(time * 4 + sx * 2) * 3, 1.3, false);
    A.draw(ctx, spr, Sc.px, Sc.py, 1, false);
  };
  /* crosshair, lock-on brackets and the faint aim line */
  R.overlay = function (ctx, g, time) {
    const P = g.P, Rt = g.reticle; if (!Rt || g.state === 'over') return;
    Sc.proj(P.x, P.y, 0); const hx = Sc.px, hy = Sc.py;
    if (!P.dead && g.aimMode !== 'auto') { ctx.fillStyle = 'rgba(255,255,255,0.22)'; for (let i = 1; i < 9; i++) { const t = i / 9; ctx.fillRect(Math.round(hx + (Rt.x - hx) * t), Math.round(hy + (Rt.y - hy) * t), 1, 1); } }
    for (const f of g.locks) {
      if (f.dead) continue; Sc.proj(f.x, f.type === 5 ? f.y : f.y, f.z); const r = Math.max(9, f.rw * SC * Sc.ps + 5), x = Math.round(Sc.px), y = Math.round(Sc.py), c = Math.floor(time * 10) & 1 ? '#ff5a5a' : '#ffd0d0';
      ctx.fillStyle = c; const L = Math.max(4, Math.round(r * 0.5));
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(x + sx * r - (sx > 0 ? L - 1 : 0), y + sy * r - (sy > 0 ? 0 : 0), L, 1); ctx.fillRect(x + sx * r - (sx > 0 ? 0 : 0), y + sy * r - (sy > 0 ? L - 1 : 0), 1, L); }
    }
    const lock = g.lockHeld, col = lock ? '#ff6a6a' : g.hover ? '#ffd24a' : '#ffffff', x = Math.round(Rt.x), y = Math.round(Rt.y), r = lock ? 9 : 7;
    ctx.fillStyle = col;
    for (let a = 0; a < 12; a++) { const an = a / 12 * 6.2832 + (lock ? time * 3 : 0); ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r), 1, 1); }
    ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); ctx.fillStyle = '#0b0d1a'; ctx.fillRect(x, y, 1, 1);
    if (lock) { PX.text(ctx, String(g.locks.length), x + 12, y - 4, { s: 1, c: '#ff9a9a', o: '#0b0d1a' }); }
  };
})((window.SGS = window.SGS || {}));
