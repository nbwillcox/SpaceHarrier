/* Button remapping + dead zone for SpaceHarrier's own gamepad code (native mode: js/pad.js wraps navigator.getGamepads). btn[0] is the button the game reads for that action. Read by js/pad.js. */
window.PAD_CFG = {
  id: 'spaceharrier', title: 'SpaceHarrier', native: true, deadDefault: 0.1,
  actions: [
    { id: 'fire', label: 'Cannon (hold)', btn: ['A'] },
    { id: 'lock', label: 'Lock-on (hold, release = volley)', btn: ['RT'] },
    { id: 'bomb', label: 'Smart bomb', btn: ['B'] },
  ],
};
