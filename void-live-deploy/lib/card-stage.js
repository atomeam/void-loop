// Keeps every answer card, throws a flick, and lays a crowd out above the ask bar.
// A card with a video is moved by left and top only: a transform restarts the clip.
import { coast, tidy } from './card-tidy.js';

let api = null;
const media = (el) => !!(el && el.querySelector && el.querySelector('video, audio, iframe'));
function areaOf() {
  const row = document.getElementById('row');
  const top = row ? row.getBoundingClientRect().top : innerHeight - 90;
  return { w: innerWidth, h: Math.max(100, top - 12) };
}
export function glide(el, th, land) {
  if (!el || !land || land.off) return;
  const frames = land.frames && land.frames.length > 1 ? land.frames : [{ x: land.x, y: land.y }];
  el.classList.add('tossing'); el.dataset.pinned = '1'; if (th) th.pinned = true;
  if (!media(el)) el.style.transform = 'none';
  let i = 0;
  const step = () => {
    if (!el.isConnected) return;
    const f = frames[Math.min(i, frames.length - 1)];
    el.style.left = Math.round(f.x) + 'px'; el.style.top = Math.round(f.y) + 'px';
    if (th) { th.x = Math.round(f.x); th.y = Math.round(f.y); }
    if (++i < frames.length) { requestAnimationFrame(step); return; }
    el.style.left = land.x + 'px'; el.style.top = land.y + 'px'; el.classList.remove('tossing');
    if (th) { th.x = land.x; th.y = land.y; th.pinned = true; }
    try { api && api.save && api.save(); } catch (_) {}
  };
  requestAnimationFrame(step);
}
function flyOff(el, vx, vy) {
  let x = parseFloat(el.style.left) || 0, y = parseFloat(el.style.top) || 0, tvx = vx || 1.2, tvy = vy || -0.4, prev = performance.now();
  const w = el.offsetWidth || 40, h = el.offsetHeight || 40;
  const step = (t) => {
    if (!el.isConnected) return;
    const dt = Math.min(32, t - prev); prev = t; tvx *= 0.995; tvy += 0.0016 * dt; x += tvx * dt; y += tvy * dt;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (!media(el)) el.style.transform = 'rotate(' + (tvx * 40) + 'deg)';
    if (x + w < 0 || y + h < 0 || x > innerWidth || y > innerHeight) {
      try { if (api && api.page && api.page() === el && api.setPage) api.setPage(null); } catch (_) {}
      el.remove(); return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function layout() {
  if (document.documentElement.classList.contains('dragging')) return;
  try {
    const area = areaOf();
    const pages = [...document.querySelectorAll('.vpage')].filter((el) => el.offsetWidth > 2 || el.classList.contains('kept'));
    if (pages.length >= 2) put(pages, area, true);
    const things = [...document.querySelectorAll('#stage > .thing')].filter((el) => el.offsetWidth > 2 && el.style.display !== 'none');
    if (things.length >= 6) put(things, area, false);
  } catch (_) {}
}
function put(els, area, fixed) {
  const stage = document.getElementById('stage');
  const s0 = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
  const bag = api && api.things ? api.things() : {};
  const cards = els.map((el, n) => {
    const r = el.getBoundingClientRect();
    if (!el.dataset.cardId && !el.dataset.id) el.dataset.cardId = 'c' + n + Math.random().toString(36).slice(2, 6);
    const th = el.dataset.id && bag[el.dataset.id];
    return { id: el.dataset.id || el.dataset.cardId, el, x: r.left, y: r.top, w: Math.max(40, r.width), h: Math.max(40, r.height), pinned: el.dataset.pinned === '1' || !!(th && th.pinned) };
  });
  const moves = tidy(cards, area);
  for (const c of cards) {
    const m = moves[c.id]; if (!m) continue;
    const el = c.el, x = fixed ? m.x : Math.round(m.x - s0.left), y = fixed ? m.y : Math.round(m.y - s0.top);
    el.dataset.tidy = '1'; el.classList.add(fixed ? 'placed' : 'card-glide'); el.style.boxSizing = 'border-box';
    if (!media(el)) el.style.transform = 'none';
    el.style.translate = ''; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = m.w + 'px'; el.style.maxHeight = m.h + 'px';
    const th = el.dataset.id && bag[el.dataset.id];
    if (th && !th.pinned) { th.x = x; th.y = y; }
  }
}
function later() { for (const ms of [80, 500, 1100]) setTimeout(() => requestAnimationFrame(layout), ms); }
function onDown(e) {
  const el = e.target && e.target.closest && e.target.closest('.vpage');
  if (!el || e.button > 0 || e.target.closest('input, textarea, select, a, button, [contenteditable="true"]')) return;
  const sx = e.clientX, sy = e.clientY;
  let lastX = sx, lastY = sy, lastT = performance.now(), vx = 0, vy = 0, moved = false, origin = null;
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!moved) {
      moved = true; const r = el.getBoundingClientRect(); origin = { x: r.left, y: r.top, w: r.width, h: r.height };
      document.documentElement.classList.add('dragging'); el.classList.add('placed', 'tossing');
      el.style.position = 'fixed'; el.style.margin = '0'; el.style.left = origin.x + 'px'; el.style.top = origin.y + 'px'; el.style.width = origin.w + 'px';
      if (!media(el)) el.style.transform = 'none';
    }
    const now = performance.now(), dt = Math.max(16, now - lastT);
    vx = (ev.clientX - lastX) / dt; vy = (ev.clientY - lastY) / dt; lastX = ev.clientX; lastY = ev.clientY; lastT = now;
    el.style.left = (origin.x + ev.clientX - sx) + 'px'; el.style.top = (origin.y + ev.clientY - sy) + 'px';
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    document.documentElement.classList.remove('dragging');
    if (!moved) return;
    const x = origin.x + lastX - sx, y = origin.y + lastY - sy, speed = Math.hypot(vx, vy), area = areaOf();
    const land = coast({ x, y, vx, vy, w: origin.w, h: origin.h, stageW: area.w, stageH: area.h });
    if (speed >= 0.62 && (speed >= 0.9 || land.off)) { flyOff(el, vx, vy); return; }
    if (speed >= 0.62) { glide(el, null, land); return; }
    el.classList.remove('tossing'); el.dataset.pinned = '1'; el.style.left = Math.max(8, x) + 'px'; el.style.top = Math.max(8, y) + 'px';
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
export function boot(stageApi) {
  api = stageApi; window.__cardCoast = coast; window.__glideCard = glide;
  document.addEventListener('void:cards', later);
  window.addEventListener('void:stage-change', later);
  window.addEventListener('resize', later);
  document.addEventListener('pointerdown', onDown, true);
}
