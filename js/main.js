/* Boot, scaling (the internal canvas follows the window aspect so ultrawide screens see a wider view), fixed-step loop and app modes. */
(function (G) {
  'use strict';
  const C = G.C, S = G.settings, I = G.input, Game = G.game, HUD = G.hud, R = G.render, Sc = G.scene, STEP = 1 / 120;
  const M = { mode: 'title', time: 0, IW: 480 };
  G.main = M;
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d'), params = new URLSearchParams(location.search);
  G.debug = { god: params.get('god') === '1' };
  function resize() {
    const w = Math.max(64, window.innerWidth), h = Math.max(64, window.innerHeight), iw = Math.max(C.MINW, Math.min(C.MAXW, Math.round(C.IH * (w / h) / 2) * 2));
    if (iw !== M.IW || canvas.width !== iw) { M.IW = iw; canvas.width = iw; canvas.height = C.IH; ctx.imageSmoothingEnabled = false; Sc.resize(iw, C.IH); }
    const cw = Math.min(w, Math.round(h * iw / C.IH)), ch = Math.min(h, Math.round(w * C.IH / iw)), st = canvas.style, l = Math.round((w - cw) / 2), t = Math.round((h - ch) / 2);
    st.width = cw + 'px'; st.height = ch + 'px'; st.left = l + 'px'; st.top = t + 'px'; st.right = 'auto'; st.bottom = 'auto';
    I.setView(l, t, cw, ch, iw, C.IH);
  }
  window.addEventListener('resize', resize);
  M.startGame = function (diff, mode, stage) {
    if (G.audio) G.audio.resume();
    I.clear(); M.demo = false; Game.demo = false; M.mode = 'play';
    Game.reset(diff, mode || 'campaign', mode === 'bossrush' ? 3 : (G.debug.stage || stage || 1));
    if (G.ui) G.ui.hideAll();
  };
  M.continueGame = function () { Game.conts--; Game.lives = 3; Game.over = false; Game.P.shield = 3; Game.P.dead = false; Game.loadStage(Game.stage); M.mode = 'play'; I.clear(); if (G.ui) G.ui.hideAll(); };
  M.startDemo = function () {
    M.demo = true; Game.reset(1, 'campaign', 1 + Math.floor(Math.random() * 5) * 3 - (Math.random() < 0.5 ? 0 : 0)); Game.demo = true; Game.state = 'play'; Game.introT = 0; Game.lives = 5;
    M.bot = G.bot.make(Game); M.demoT = 0; M.mode = 'title';
  };
  M.pause = function () { if (M.mode !== 'play') return; M.mode = 'pause'; I.clear(); if (G.audio) G.audio.suspend(); if (G.ui) G.ui.show('pause'); };
  M.resume = function () { if (M.mode !== 'pause') return; M.mode = 'play'; I.clear(); if (G.audio) G.audio.resumeAll(); if (G.ui) G.ui.hideAll(); };
  M.quit = function () { if (G.audio) { G.audio.resumeAll(); G.audio.music('title'); } M.startDemo(); if (G.ui) G.ui.show('title'); };
  M.gameOver = function (g) {
    M.mode = 'over';
    if (g.mode === 'endless' && G.progress && g.stage > G.progress.endlessBest) { G.progress.endlessBest = g.stage; G.progress.save(); }
    if (G.ui) G.ui.showGameOver(g);
  };
  M.ending = function (g) {
    M.mode = 'over'; if (G.audio) G.audio.music('ending');
    if (g.mode === 'bossrush' && G.progress) { const t = Math.round(g.rushT); if (!G.progress.rushBest || t < G.progress.rushBest) { G.progress.rushBest = t; G.progress.save(); } }
    if (g.mode === 'endless' && G.progress) { G.progress.endlessBest = Math.max(G.progress.endlessBest, g.stage); G.progress.save(); }
    if (G.ui) G.ui.showEnding(g);
  };
  let last = 0, acc = 0, musicOn = false;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 1 / 60; if (dt > 0.05) dt = 0.05;
    M.time += dt; I.poll(dt);
    if (G.ui && G.ui.isOpen()) G.ui.padNav();
    if (M.mode === 'play') {
      if (I.takePause()) M.pause();
      else { acc += dt; while (acc >= STEP) { Game.update(STEP, I); acc -= STEP; if (M.mode !== 'play') break; } }
    } else if (M.mode === 'pause') { if (I.takePause()) M.resume(); }
    else if (M.mode === 'title' && M.demo) {
      acc += dt; M.demoT += dt;
      while (acc >= STEP) { M.bot.update(STEP); Game.update(STEP, M.bot); acc -= STEP; Game.lives = 5; if (Game.P.dead && Game.P.deadT > 1.7) { Game.P.shield = 3; } }
      if (M.demoT > 45) M.startDemo();
    }
    render();
  }
  function render() {
    if (!Game.wd) return;
    R.draw(ctx, Game, M.time);
    HUD.draw(ctx, Game, M.IW, C.IH, M.time, M.mode === 'title' && M.demo);
  }
  const kick = () => { if (!G.audio) return; G.audio.resume(); if (!musicOn && M.mode === 'title') { musicOn = true; G.audio.music('title'); } };
  window.addEventListener('pointerdown', kick); window.addEventListener('keydown', kick);
  document.addEventListener('visibilitychange', () => { if (document.hidden) M.pause(); });
  window.addEventListener('blur', () => M.pause());
  M.boot = function () {
    resize(); G.art.init(); Sc.setWorld(G.worlds.list[0]);
    if (G.ui) G.ui.init();
    G.debug.stage = parseInt(params.get('stage'), 10) || 0;
    M.startDemo(); if (G.ui) G.ui.show('title');
    if (params.get('play') !== null) { const d = parseInt(params.get('play'), 10); M.startGame(d >= 0 && d <= 2 ? d : 1, params.get('mode') || 'campaign', G.debug.stage || 1); }
    requestAnimationFrame((t) => { last = t; frame(t); });
  };
})((window.SGS = window.SGS || {}));
