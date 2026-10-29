/**
 * arcade-card — the shared card for Verse's arcade games (skills/pong.js, skills/snake.js): a title bar, a canvas, a status
 * line with Verse's reason, and New game. The game loop runs only while the card is on the page and the tab is visible.
 */
export function arcadeCard(th, stageApi, { cls, title, sub, w, h }) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card ' + cls; el.dataset.id = th.id; el.tabIndex = 0;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(' + (w + 24) + 'px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title"></span><span class="g-sub"></span></div>';
  el.querySelector('.g-title').textContent = title; el.querySelector('.g-sub').textContent = sub;
  const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.cssText = 'display:block;width:100%;aspect-ratio:' + w + '/' + h + ';border-radius:10px;background:#05040c;touch-action:none;cursor:crosshair';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const status = document.createElement('div'); status.className = 'g-status ' + cls + '-status'; status.setAttribute('aria-live', 'polite'); status.style.cssText = 'display:block;font-size:13px;margin-top:6px';
  const why = document.createElement('div'); why.className = cls + '-why'; why.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);min-height:1.4em';
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn ' + cls + '-new'; again.textContent = 'New game';
  for (const n of [cv, again]) n.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.append(cv, status, why, again);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  let raf = 0, last = 0, onFrame = null;
  const loop = (t) => { raf = 0; if (!el.isConnected) return; const dt = last ? (t - last) / 1000 : 0.016; last = t; if (!document.hidden && onFrame) onFrame(dt, ctx); raf = requestAnimationFrame(loop); };
  return { el, cv, ctx, status, why, again, start(fn) { onFrame = fn; if (!raf) raf = requestAnimationFrame(loop); }, local(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height }; } };
}
