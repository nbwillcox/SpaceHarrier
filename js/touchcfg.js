/* Touch controls for SpaceHarrier: a floating stick flies; touch-and-drag on the right aims the crosshair and the cannon auto-fires while you touch. With LOCK switched on the same
   gesture holds the lock-on key instead (paint targets, lift to launch the volley). BOMB, pause. Read by js/mobile.js. */
(function () {
  let lock = false;
  window.TOUCH_CFG = {
    id: 'spaceharrier', title: 'SpaceHarrier', orient: 'landscape', accent: '#ff9a3d',
    hint: '<b>Left thumb</b>: floating stick to fly &nbsp; <b>Right thumb</b>: drag to aim, the cannon auto-fires &nbsp; <b>LOCK</b> on: sweep targets, lift to launch &nbsp; <b>BOMB</b>',
    unlock: () => window.SGS && window.SGS.audio && window.SGS.audio.resume(),
    pause: { pos: { r: 10, t: 38 } },                                              /* just under the HUD bar */
    controls: [
      { t: 'stick', id: 'fly', zone: [0, 0.18, 0.4, 1], mode: '8', keys: { l: 'KeyA', r: 'KeyD', u: 'KeyW', d: 'KeyS' }, r: 56 },
      { t: 'drag', id: 'aim', zone: [0.4, 0, 1, 1], events: 'pointer', fire: false, dy: -56, fireKey: () => (lock ? 'ShiftLeft' : 'Space') },
      { t: 'btn', id: 'lock', label: 'LOCK', toggle: true, onToggle: (s) => { lock = s; }, size: 56, pos: { r: 14, b: 14 } },
      { t: 'btn', id: 'bomb', label: 'BOMB', key: 'KeyB', hold: false, size: 56, pos: { r: 14, b: 78 } },
    ],
  };
})();
