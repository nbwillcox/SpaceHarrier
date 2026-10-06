/* Constants, settings, difficulty tables, high scores and progress. */
(function (G) {
  'use strict';
  G.C = {
    IH: 270, MINW: 384, MAXW: 760,   // internal render height; width follows the window aspect between these
    SC: 2, Z0: 300, CAMH: 70, HY0: 100, ZFAR: 2700,
    REPO: 'https://github.com/nbwillcox/SpaceHarrier',
    EXTEND_AT: 60000, EXTEND_EVERY: 120000,
    STAGES: 18,
    DIFF: [
      { name: 'EASY', foe: 0.85, shots: 0.7, hp: 0.85, lives: 4, cont: 5, hint: 'More lives, slower enemies and gentler fire.' },
      { name: 'NORMAL', foe: 1.0, shots: 1.0, hp: 1.0, lives: 3, cont: 3, hint: 'The intended balance.' },
      { name: 'HARD', foe: 1.2, shots: 1.4, hp: 1.2, lives: 3, cont: 1, hint: 'Faster enemies, denser fire, tougher bosses.' },
    ],
  };
  const KEY = 'spaceharrier.settings.v1', HKEY = 'spaceharrier.scores.v1', PKEY = 'spaceharrier.progress.v1';
  const defaults = { master: 0.8, music: 0.6, sfx: 0.9, shake: true, reduced: false, gamepad: true, sens: 1, invertY: false };
  const S = Object.assign({}, defaults);
  let hadSaved = false;
  try { const raw = localStorage.getItem(KEY); if (raw) { Object.assign(S, JSON.parse(raw)); hadSaved = true; } } catch (e) { /* storage unavailable */ }
  S.save = function () { try { const o = {}; for (const k in defaults) o[k] = S[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  if (!hadSaved && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) S.reduced = true;
  G.settings = S;

  /* top-10 arcade table: [initials, score, stage label, mode letter] */
  const SC = { list: [['NBW', 400000, '18', 'C'], ['ACE', 260000, '15', 'C'], ['HRR', 180000, '12', 'C'], ['SKY', 120000, '9', 'C'], ['ORB', 80000, '7', 'C'], ['ZAP', 50000, '5', 'C'], ['NOVA', 30000, '3', 'C'], ['BIT', 18000, '2', 'C'], ['AAA', 9000, '1', 'C'], ['ZZZ', 3000, '1', 'C']], lastName: '' };
  SC.list = SC.list.map((r) => [r[0].slice(0, 3), r[1], r[2], r[3]]);
  try { const raw = localStorage.getItem(HKEY); if (raw) { const o = JSON.parse(raw); if (Array.isArray(o.list)) SC.list = o.list; SC.lastName = o.lastName || ''; } } catch (e) { /* ignore */ }
  const saveScores = () => { try { localStorage.setItem(HKEY, JSON.stringify({ list: SC.list, lastName: SC.lastName })); } catch (e) { /* ignore */ } };
  SC.best = () => SC.list[0][1];
  SC.qualifies = (score) => score > 0 && (SC.list.length < 10 || score > SC.list[SC.list.length - 1][1]);
  SC.add = (name, score, stage, mode) => { SC.lastName = name; SC.list.push([name, score, String(stage), mode || 'C']); SC.list.sort((a, b) => b[1] - a[1]); SC.list = SC.list.slice(0, 10); saveScores(); return SC.list.findIndex((r) => r[0] === name && r[1] === score); };
  G.scores = SC;

  /* progress: furthest stage reached (for the stage select), clears, boss-rush best time, endless best */
  const PR = { maxStage: 1, cleared: false, rushBest: 0, endlessBest: 0 };
  try { const raw = localStorage.getItem(PKEY); if (raw) Object.assign(PR, JSON.parse(raw)); } catch (e) { /* ignore */ }
  PR.save = function () { try { localStorage.setItem(PKEY, JSON.stringify({ maxStage: PR.maxStage, cleared: PR.cleared, rushBest: PR.rushBest, endlessBest: PR.endlessBest })); } catch (e) { /* ignore */ } };
  PR.unlocked = () => PR.cleared || PR.maxStage >= 12 || new URLSearchParams(location.search).get('unlock') === '1';
  G.progress = PR;
})((window.SGS = window.SGS || {}));
