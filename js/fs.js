/* Fullscreen button shared by every game: a small square in the top-left corner. Click = fullscreen, click again (or Esc) = back. Hidden when the browser cannot do fullscreen (iPhone Safari)
   or the game is already running as an installed full-screen app. It swallows its own pointer events so a click never fires a shot or a menu press underneath. */
(function () {
  'use strict';
  const D = document, de = D.documentElement;
  const req = de.requestFullscreen || de.webkitRequestFullscreen, exit = D.exitFullscreen || D.webkitExitFullscreen;
  const isFs = () => !!(D.fullscreenElement || D.webkitFullscreenElement);
  let standalone = false;
  try { standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || !!navigator.standalone; } catch (e) { /* ignore */ }
  if (!req || standalone) return;
  function init() {
    const st = D.createElement('style');
    st.textContent = '#fsBtn{position:fixed;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));width:36px;height:36px;padding:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(8,12,30,.62);border:1.5px solid rgba(255,255,255,.55);border-radius:7px;color:#fff;cursor:pointer;opacity:.7;transition:opacity .15s,background .15s;-webkit-tap-highlight-color:transparent}' +
      '#fsBtn:hover,#fsBtn:focus-visible{opacity:1;background:rgba(8,12,30,.85)}#fsBtn svg{width:20px;height:20px;pointer-events:none}';
    D.head.appendChild(st);
    const b = D.createElement('button');
    b.id = 'fsBtn'; b.type = 'button'; b.tabIndex = -1; b.setAttribute('aria-label', 'Toggle full screen'); b.title = 'Full screen';
    const ico = (on) => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (on ? '<path d="M7 2v5H2M13 2v5h5M7 18v-5H2M13 18v-5h5"/>' : '<path d="M2 7V2h5M18 7V2h-5M2 13v5h5M18 13v5h-5"/>') + '</svg>';
    const sync = () => { b.innerHTML = ico(isFs()); b.title = isFs() ? 'Exit full screen' : 'Full screen'; };
    sync();
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup'].forEach((t) => b.addEventListener(t, (e) => e.stopPropagation()));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { const r = isFs() ? exit.call(D) : req.call(de); if (r && r.catch) r.catch(() => {}); } catch (err) { /* ignore */ }
      b.blur();
    });
    D.addEventListener('fullscreenchange', sync); D.addEventListener('webkitfullscreenchange', sync);
    D.body.appendChild(b);
  }
  if (D.body) init(); else D.addEventListener('DOMContentLoaded', init);
})();
