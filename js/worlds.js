/* The six worlds (three stages each: two runs and a boss) and their look. kind: plains = checkerboard floor + sky, corridor = tunnel, space = open starfield. */
(function (G) {
  'use strict';
  const W = {};
  G.worlds = W;
  W.list = [
    { name: 'EMERALD PLAINS', kind: 'plains', hue: 125, sky: ['#16307a', '#3f86d8', '#b4e8ff'], floor: ['#33a046', '#25843a', '#98ff86'], fog: '#b4e8ff', ridge: ['#3f6aa8', '#2f8a7a'], cloud: '#ffffff', music: 0, boss: 'EMERALD WYRM', foe: 20, props: ['column', 'bush', 'mush'] },
    { name: 'ORBITAL STATION', kind: 'corridor', hue: 210, wall: ['#2a3c68', '#1d2c52', '#4ab8ff'], floorC: ['#22304f', '#2c3c62'], ceilC: ['#18223e', '#212e50'], light: '#d8f4ff', fog: '#02040e', glow: '#6ac8ff', music: 1, boss: 'WARDEN MECH', foe: 350, props: ['pylon', 'crate'] },
    { name: 'FROST MOON', kind: 'plains', hue: 190, sky: ['#0a1c58', '#4c8cd4', '#d6f0ff'], floor: ['#eaf7ff', '#b6dcf2', '#ffffff'], fog: '#d6f0ff', ridge: ['#7aa8e0', '#b8d8f4'], cloud: '#e8f6ff', music: 2, boss: 'FROST GOLEM', foe: 320, props: ['spire', 'bush', 'column'] },
    { name: 'MAGMA RIFT', kind: 'plains', hue: 12, sky: ['#1e0610', '#8a2a14', '#ffa040'], floor: ['#4e2018', '#33140f', '#ff6a1a'], fog: '#ffa040', ridge: ['#4a1a14', '#7a2a14'], cloud: '#6a2a1a', music: 3, boss: 'MAGMA WYRM', foe: 180, props: ['rock', 'spire', 'column'] },
    { name: 'ASTEROID BELT', kind: 'space', hue: 30, bg: ['#02030c', '#0a1230'], planet: ['#c88a4a', '#6a4020'], music: 4, boss: 'DREADNOUGHT', foe: 140, props: ['asteroid'] },
    { name: 'VOID NEBULA', kind: 'space', hue: 295, bg: ['#06020e', '#220a40'], planet: ['#a04ad8', '#3a1060'], music: 4, boss: 'THE ABYSS', foe: 75, props: ['asteroid'] },
  ];
  W.of = (stage) => Math.floor((stage - 1) / 3) % 6;
  W.idx = (stage) => (stage - 1) % 3;
  W.isBoss = (stage) => (stage - 1) % 3 === 2;
  W.label = (stage) => (W.of(stage) + 1) + '-' + (W.idx(stage) + 1);
})((window.SGS = window.SGS || {}));
