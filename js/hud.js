/* HUD drawn into the canvas in the 5x7 pixel font: score band, lives / shield / weapon status, chain, banners and the stage-clear panel. */
(function (G) {
  'use strict';
  const U = G.U, PX = G.px, A = G.art, Sc = G.scene;
  const HUD = {};
  G.hud = HUD;
  const OL = '#0b0d1a', ORG = '#ff9a3d', WHT = '#ffffff';
  const T = (ctx, s, x, y, c, sz, a, extra) => PX.text(ctx, s, x, y, Object.assign({ s: sz || 1, c, o: OL, a: a || 'l' }, extra || {}));
  const pips = (ctx, x, y, n, max, col, w) => { for (let i = 0; i < max; i++) { ctx.fillStyle = OL; ctx.fillRect(x + i * (w + 2) - 1, y - 1, w + 2, 8); ctx.fillStyle = i < n ? col : '#2a3050'; ctx.fillRect(x + i * (w + 2), y, w, 6); if (i < n) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + i * (w + 2), y, w, 1); } } };
  HUD.draw = function (ctx, g, W, H, time, demo) {
    if (!g.P || demo) return;
    const P = g.P, wd = g.wd;
    ctx.fillStyle = 'rgba(8,10,26,0.6)'; ctx.fillRect(0, 0, W, 19); ctx.fillStyle = '#2a3a66'; ctx.fillRect(0, 19, W, 1);
    T(ctx, '1UP', 10, 2, ORG); T(ctx, U.fmt(g.score), 10, 10, WHT);
    T(ctx, 'HIGH SCORE', W / 2, 2, ORG, 1, 'c'); T(ctx, U.fmt(Math.max(G.scores.best(), g.score)), W / 2, 10, '#9fe8ff', 1, 'c');
    const lab = g.mode === 'bossrush' ? 'BOSS ' + ((g.rushIdx | 0) + 1) + '/6' : g.mode === 'endless' ? 'ENDLESS ' + g.stage : 'STAGE ' + G.worlds.label(g.stage);
    T(ctx, lab, W - 10, 2, ORG, 1, 'r'); T(ctx, wd.name, W - 10, 10, '#a8c0e8', 1, 'r');
    // bottom status
    ctx.fillStyle = 'rgba(8,10,26,0.55)'; ctx.fillRect(0, H - 17, W, 17); ctx.fillStyle = '#2a3a66'; ctx.fillRect(0, H - 18, W, 1);
    for (let i = 0; i < Math.max(0, g.lives - 1) && i < 6; i++) A.draw(ctx, A.hero[1][1][0], 14 + i * 14, H - 6, 0.34, false);
    pips(ctx, 14 + Math.min(6, Math.max(0, g.lives - 1)) * 14 + 4, H - 12, P.shield, 3, P.shield <= 1 ? '#ff5a5a' : '#5affb0', 7);
    const cx = W / 2 - 78;
    T(ctx, 'CANNON', cx, H - 14, '#ffb36a'); pips(ctx, cx + 38, H - 13, P.cannon, 4, '#ffb36a', 5);
    T(ctx, 'LOCK', cx + 88, H - 14, '#7adfff'); pips(ctx, cx + 114, H - 13, P.lockTier + 1, 4, '#7adfff', 5);
    T(ctx, 'BOMB', W - 80, H - 14, '#ff7a7a'); for (let i = 0; i < P.bombs; i++) { ctx.fillStyle = OL; ctx.fillRect(W - 52 + i * 8, H - 14, 7, 7); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(W - 51 + i * 8, H - 13, 5, 5); ctx.fillStyle = '#ffd0d0'; ctx.fillRect(W - 51 + i * 8, H - 13, 2, 2); }
    if (P.drone > 0) T(ctx, 'OPT ' + Math.ceil(P.drone), W - 10, H - 28, '#d08aff', 1, 'r');
    if (g.chain >= 2) { const m = 1 + Math.min(7, Math.floor(g.chain / 3)) * 0.5; T(ctx, 'CHAIN ' + g.chain, W - 10, 26, g.chain >= 9 ? '#ffd24a' : WHT, 1, 'r'); T(ctx, 'x' + m.toFixed(1), W - 10, 34, '#7dffb8', 1, 'r'); }
    if (g.bossObj && G.boss && G.boss.hud) G.boss.hud(ctx, g, W, H, time);
    HUD.banner(ctx, g, W, H, time);
    if (g.state === 'clear' && g.rankStats) HUD.clearPanel(ctx, g, W, H, time);
  };
  HUD.banner = function (ctx, g, W, H, time) {
    if (g.state === 'intro') {
      const k = Math.min(1, g.introT / 2.4), a = k < 0.2 ? k / 0.2 : 1, boss = G.worlds.isBoss(g.stage);
      ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.4);
      T(ctx, g.mode === 'bossrush' ? 'BOSS RUSH' : 'STAGE ' + G.worlds.label(g.stage), W / 2, H * 0.3, WHT, 3, 'c', { g: ['#ffffff', '#ffb36a'], sh: '#3a1a6a' });
      T(ctx, g.wd.name, W / 2, H * 0.3 + 32, '#9fe8ff', 1, 'c');
      if (boss && g.mode !== 'bossrush') T(ctx, '- BOSS: ' + g.wd.boss + ' -', W / 2, H * 0.3 + 46, '#ff9a9a', 1, 'c');
      ctx.restore();
    }
    const b = g.bannerO; if (!b) return;
    const k = b.t / b.life, a = k < 0.1 ? k / 0.1 : k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
    ctx.save(); ctx.globalAlpha = a;
    if (b.kind === 'warn') {
      const fl = Math.floor(b.t * 4) % 2, y0 = Math.round(H * 0.34);
      for (let y = -26; y < 28; y += 3) { const f = 1 - Math.abs(y) / 28; ctx.fillStyle = 'rgba(255,40,40,' + (f * (fl ? 0.5 : 0.28)).toFixed(2) + ')'; ctx.fillRect(0, y0 + y, W, 3); }
      T(ctx, 'WARNING', W / 2, y0 - 14, fl ? '#ff7a7a' : '#ffffff', 4, 'c', { sh: '#7a0a0a' }); if (b.sub) T(ctx, b.sub, W / 2, y0 + 20, '#ffd0d0', 1, 'c');
    } else if (b.kind === 'small') T(ctx, b.text, W / 2, H * 0.42, '#7dffb8', 2, 'c', { sh: '#1a5a3a' });
    else { T(ctx, b.text, W / 2, H * 0.3, WHT, 3, 'c', { g: ['#ffffff', b.kind === 'good' ? '#7dffb8' : '#ffb36a'], sh: '#3a1a6a' }); if (b.sub) T(ctx, b.sub, W / 2, H * 0.3 + 30, '#ffd24a', 1, 'c'); }
    ctx.restore();
  };
  HUD.clearPanel = function (ctx, g, W, H, time) {
    const r = g.rankStats, t = g.clearT, k = Math.min(1, (6 - t) / 0.5), w = 230, h = 128, x = Math.round(W / 2 - w / 2), y = Math.round(H * 0.5 - h / 2);
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(8,10,28,0.88)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#4ad8ff'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    T(ctx, g.mode === 'bossrush' ? 'BOSS DOWN' : 'STAGE CLEAR', W / 2, y + 8, WHT, 2, 'c', { sh: '#3a1a6a' });
    const col = { S: '#ffd24a', A: '#7dffb8', B: '#7adfff', C: '#c0c8e0' }[r.r];
    T(ctx, r.r, x + 42, y + 34, col, 6, 'c', { sh: '#1a1a2a' });
    const row = (i, a, b) => { T(ctx, a, x + 86, y + 34 + i * 12, '#9fb7d8'); T(ctx, b, x + w - 14, y + 34 + i * 12, WHT, 1, 'r'); };
    row(0, 'HIT RATE', r.hit + '%'); row(1, 'MAX CHAIN', String(r.chain)); row(2, 'DAMAGE TAKEN', String(r.hits)); row(3, 'RANK BONUS', '+' + U.fmt(r.bonus));
    T(ctx, 'CLICK OR PRESS FIRE TO CONTINUE', W / 2, y + h - 14, Math.floor(time * 2) & 1 ? '#ffd24a' : '#8fa6c8', 1, 'c');
    ctx.restore();
  };
})((window.SGS = window.SGS || {}));
