/* SpaceHarrier - https://github.com/nbwillcox/SpaceHarrier - CC BY-NC 4.0 */
(function (G) {
  'use strict';
  const U = {};
  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  U.smooth = (t) => t * t * (3 - 2 * t);

  // cubic bezier point; writes into out
  U.bezier = (p, t, out) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.x = a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x;
    out.y = a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y;
    return out;
  };

  U.hsl = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a === undefined ? 1 : a})`;
  U.pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
  U.fmt = (n) => Math.max(0, Math.floor(n)).toLocaleString('en-US');

  // shortest signed distance along one wrapped axis of length n
  U.wrapD = (a, b, n) => { let d = a - b; if (d > n / 2) d -= n; else if (d < -n / 2) d += n; return d; };
  U.wrap = (v, n) => { v %= n; return v < 0 ? v + n : v; };

  G.U = U;
})((window.SGS = window.SGS || {}));
