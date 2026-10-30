/**
 * The 3D calendar: a real wall calendar (paper page, red month band, spiral rings, the pad of pages behind it) that you
 * can grab and turn. Drag turns it (it keeps a little spin and settles); the arrows flip the page over the rings to the
 * next or previous month; tap a day and an editor opens under it: add an event, change its name or time, or remove it.
 * Events are written on the days like ink. Built from the page's own elements with CSS 3D, so text stays sharp and
 * readable by screen readers. Events live in this browser, in the /calendar/ page's own store (lib/agenda.js), the same list the stage card uses.
 */
import * as A from '../lib/agenda.js';
const STYLE_ID = 'void-cal3d-style';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** the events as rows { id, title, at, allDay }, two years back to two years on (a repeat's days each a row); [] when there are none */
export function loadEvents() {
  const now = Date.now(), Y = 731 * 864e5;
  try { return A.rowsOf(A.events(), new Date(now - Y), new Date(now + Y)); } catch (_) { return []; }
}
const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const pad2 = (n) => String(n).padStart(2, '0');
/** the Calendar page on the day the wall calendar shows: the day picked, else the 1st of the month it is turned to. Pure. */
// how far the card sways (degrees) ms after it was shown or last turned: 3 for the first 6 s, then it fades out over
// 1.5 s and the card rests. Pure, so a test can hold it.
export const SWAY_HOLD = 6000, SWAY_FADE = 1500;
export const swayAmp = (age) => (age < SWAY_HOLD ? 3 : Math.max(0, 3 * (1 - (age - SWAY_HOLD) / SWAY_FADE)));
export const pageOfDay = (y, m, sel) => { const d = sel ? fromKey(sel) : new Date(y, m, 1); return '/calendar/?d=' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID;
  s.textContent = [
    '.c3d{position:relative;perspective:1300px;perspective-origin:50% 30%;height:440px;margin-top:4px;touch-action:none;user-select:none;cursor:grab}',
    '.c3d.grab{cursor:grabbing}',
    '.c3d-rig{position:absolute;left:50%;top:26px;width:420px;max-width:calc(100% - 8px);transform:translateX(-50%);transform-style:preserve-3d;will-change:transform}',
    // the pad: pages stacked behind, a cardboard back
    '.c3d-pad{position:absolute;inset:0;border-radius:4px;background:#ecebe4;box-shadow:0 1px 0 #d8d6cc}',
    '.c3d-back{position:absolute;inset:0;border-radius:4px;background:repeating-linear-gradient(45deg,#8a7a63 0 3px,#7f705a 3px 6px);transform:rotateY(180deg) translateZ(7px);backface-visibility:hidden;'
      + 'display:flex;align-items:flex-end;justify-content:center;padding-bottom:18px;box-sizing:border-box;color:#e9e1d1;font-size:11px;letter-spacing:.25em;text-transform:uppercase}',
    // the page
    '.c3d-page{position:relative;border-radius:4px;overflow:hidden;background:#fbfaf6;color:#26262b;transform-origin:50% 0;transform-style:preserve-3d;backface-visibility:hidden;'
      + 'box-shadow:0 18px 40px rgba(0,0,0,.45),0 2px 0 #e2e0d6;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.c3d-band{display:flex;align-items:center;justify-content:space-between;padding:22px 12px 10px;background:linear-gradient(180deg,#d9483b,#c23a2e);color:#fff}',
    '.c3d-band b{font-size:22px;font-weight:600;letter-spacing:.02em}',
    '.c3d-band span{font-size:14px;opacity:.85;margin-left:8px;font-weight:400}',
    '.c3d-band button{font:inherit;font-size:18px;line-height:1;color:#fff;background:rgba(255,255,255,.16);border:0;border-radius:999px;width:30px;height:30px;cursor:pointer}',
    '.c3d-band button:hover,.c3d-band button:focus-visible{background:rgba(255,255,255,.3)}',
    '.c3d-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:auto;border-top:1px solid #e3e1d8}',
    '.c3d-dow{font-size:10px;font-weight:600;color:#8b877a;text-align:center;padding:5px 0;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #e3e1d8}',
    '.c3d-dow.we{color:#c23a2e}',
    '.c3d-day{position:relative;height:47px;padding:3px 4px;box-sizing:border-box;border-right:1px solid #ecebe3;border-bottom:1px solid #ecebe3;text-align:left;font:inherit;'
      + 'background:transparent;color:inherit;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:1px;transition:background .15s}',
    '.c3d-day:nth-child(7n+7){border-right:0}',
    '.c3d-day .n{font-size:12px;font-weight:600;color:#3a3a40}',
    '.c3d-day.we .n{color:#c23a2e}',
    '.c3d-day.out{background:#f3f2ec}.c3d-day.out .n{color:#bdbab0}',
    '.c3d-day:hover{background:#f6efe2}',
    '.c3d-day.today .n{color:#fff;background:#c23a2e;border-radius:999px;padding:0 5px;align-self:flex-start}',
    '.c3d-day.sel{background:#fff4d6;box-shadow:inset 0 0 0 2px #e0a43a}',
    '.c3d-ev{font-size:9.5px;line-height:1.25;color:#1f3f8f;font-family:"Segoe Print","Bradley Hand","Comic Sans MS",cursive;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', // ellipsis-ok: drawn picture or short label, the full text is on the card
    '.c3d-more{font-size:9px;color:#8b877a}',
    // spiral rings over the top edge
    '.c3d-rings{position:absolute;left:14px;right:14px;top:-9px;height:24px;display:flex;justify-content:space-between;transform:translateZ(3px);pointer-events:none}',
    '.c3d-rings i{width:7px;height:24px;border-radius:5px;background:linear-gradient(90deg,#55565c,#d9dadf 45%,#6c6d73);box-shadow:0 2px 2px rgba(0,0,0,.35)}',
    '.c3d-rings i::after{content:"";display:block;width:9px;height:9px;margin:13px 0 0 -1px;border-radius:50%;background:#2a2a2e}',
    '.c3d-hook{position:absolute;left:50%;top:-24px;width:46px;height:20px;margin-left:-23px;border:3px solid #9a9ba1;border-bottom:0;border-radius:24px 24px 0 0;transform:translateZ(1px)}',
    // the editor under the calendar
    '.c3d-edit{margin-top:6px;font-size:14px}',
    '.c3d-edit .row{display:flex;gap:6px;align-items:center;margin:4px 0}',
    '.c3d-edit input{font:inherit;color:inherit;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:5px 8px;min-width:0}',
    '.c3d-edit input[type=text]{flex:1}',
    '.c3d-edit input[type=time]{width:7.5em;color-scheme:dark}',
    '.c3d-edit button{font:inherit;color:inherit;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 12px;cursor:pointer}',
    '.c3d-edit button.x{padding:4px 9px}',
    '@keyframes c3dIn{0%{opacity:0;transform:translateY(-30px) rotateX(-70deg)}100%{opacity:1;transform:none}}',
    '.c3d-page.in{animation:c3dIn .9s cubic-bezier(.16,1,.3,1) both}',
    '@media (prefers-reduced-motion:reduce){.c3d-page.in{animation:none}}',
  ].join('');
  document.head.appendChild(s);
}

// month grid: Monday first, 5 or 6 weeks
function monthCells(y, m) {
  const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const n = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: n }, (_, i) => new Date(y, m, 1 - lead + i));
}

export function show3d(api, focus) {
  const { showPage, esc } = api;
  ensureStyle();
  // the system setting, or Verse's own Reduced motion hard switch (lib/a11y-modes.js), read live: the switch can go on while the card is open
  const calm = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.classList.contains('a11y-motion');
  const reduce = calm();
  const f = focus ? new Date(focus) : new Date();
  let y = f.getFullYear(), m = f.getMonth(), sel = dayKey(focus ? f : new Date());
  const el = showPage((p) => {
    p.innerHTML = '<h2>Your calendar</h2><div class="sub">Drag to turn it · tap a day to add or change what’s on it</div>'
      + '<div class="c3d" role="group" aria-label="Calendar; drag to turn it"><div class="c3d-rig"></div></div><div class="c3d-edit" aria-live="polite"></div>'
      + '<div class="src">Saved in this browser only · “clear calendar” empties it</div>';
  });
  const scene = el.querySelector('.c3d'), rig = el.querySelector('.c3d-rig'), edit = el.querySelector('.c3d-edit');
  // the card's "Open the full Calendar page" link (lib/card-frame.js) follows the day: picked, or the month turned to
  const aimPage = () => { if (!el || !el.dataset) return; el.dataset.page = pageOfDay(y, m, sel); const a = el.querySelector(':scope > .vc-page'); if (a) a.href = el.dataset.page; };
  aimPage();
  if (!scene || !rig) return el;

  for (let i = 3; i >= 1; i--) { const p = document.createElement('div'); p.className = 'c3d-pad'; p.style.transform = 'translateZ(' + (-i * 2) + 'px) translateY(' + i * 1.5 + 'px)'; rig.appendChild(p); }
  const back = document.createElement('div'); back.className = 'c3d-back'; back.textContent = 'a-to-mind · void'; rig.appendChild(back);
  const page = document.createElement('div'); page.className = 'c3d-page' + (reduce ? '' : ' in'); rig.appendChild(page);
  const hook = document.createElement('div'); hook.className = 'c3d-hook'; rig.appendChild(hook);
  const rings = document.createElement('div'); rings.className = 'c3d-rings'; rings.innerHTML = '<i></i>'.repeat(14); rig.appendChild(rings);

  const byDay = () => { const map = {}; for (const ev of loadEvents()) { if (!ev || !ev.at) continue; const k = dayKey(new Date(ev.at)); (map[k] = map[k] || []).push(ev); } for (const k in map) map[k].sort((a, b) => String(a.at).localeCompare(String(b.at))); return map; };
  const refreshStage = () => { if (api.refreshThings) api.refreshThings(); };

  function build() {
    const map = byDay(), today = dayKey(new Date());
    page.innerHTML = '<div class="c3d-band"><button type="button" class="c3d-prev" aria-label="previous month">‹</button><div><b>' + esc(new Date(y, m, 1).toLocaleDateString([], { month: 'long' }))
      + '</b><span>' + y + '</span></div><button type="button" class="c3d-next" aria-label="next month">›</button></div>'
      + '<div class="c3d-grid">' + DOW.map((d, i) => '<div class="c3d-dow' + (i > 4 ? ' we' : '') + '">' + d + '</div>').join('') + '</div>';
    const grid = page.querySelector('.c3d-grid');
    monthCells(y, m).forEach((d, i) => {
      const k = dayKey(d), evs = map[k] || [];
      const c = document.createElement('button'); c.type = 'button'; c.dataset.k = k;
      c.className = 'c3d-day' + (d.getMonth() !== m ? ' out' : '') + (i % 7 > 4 ? ' we' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '');
      c.setAttribute('aria-label', d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + (evs.length ? ', ' + evs.map((e) => e.title).join(', ') : ''));
      c.innerHTML = '<span class="n">' + d.getDate() + '</span>' + evs.slice(0, 2).map((e) => '<span class="c3d-ev">' + esc(e.title || 'Event') + '</span>').join('')
        + (evs.length > 2 ? '<span class="c3d-more">+' + (evs.length - 2) + ' more</span>' : '');
      grid.appendChild(c);
    });
    scene.style.height = (page.offsetHeight + 50) + 'px';
    drawEditor();
  }

  // the editor for the selected day: each event is a name and a time you can change in place, × removes it, and a
  // blank row at the bottom adds one
  function drawEditor() {
    if (!sel) { edit.innerHTML = ''; return; }
    const d = fromKey(sel), evs = byDay()[sel] || [];
    edit.innerHTML = '<b>' + esc(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })) + '</b>'
      + evs.map((e) => '<div class="row" data-id="' + esc(e.id) + '"><input type="time" class="t" aria-label="time" value="' + (e.allDay ? '' : hhmm(new Date(e.at))) + '">'
        + '<input type="text" class="w" aria-label="event" maxlength="160" value="' + esc(e.title || '') + '"><button type="button" class="x" aria-label="remove ' + esc(e.title || 'event') + '">×</button></div>').join('')
      + '<div class="row add"><input type="time" class="t" aria-label="time for the new event"><input type="text" class="w" aria-label="new event" maxlength="160" placeholder="add an event…"><button type="button" class="ok">add</button></div>';
  }
  function at(k, t) { const d = fromKey(k); if (t) { const [h, mi] = t.split(':').map(Number); d.setHours(h, mi, 0, 0); } return d; }
  function change(id, patch) { A.write(A.withRow(A.events(), id, patch)); build(); refreshStage(); }
  function addFrom(row) {
    const w = row.querySelector('.w'), t = row.querySelector('.t'), title = (w.value || '').trim(); if (!title) { w.focus(); return; }
    A.write(A.withNew(A.events(), { title: title.slice(0, 160), at: at(sel, t.value), allDay: !t.value })); build(); refreshStage();
    const nw = edit.querySelector('.row.add .w'); if (nw) nw.focus();
    if (api.say) api.say('on your calendar: ' + title);
  }
  edit.addEventListener('click', (e) => {
    const row = e.target.closest('.row'); if (!row) return;
    if (e.target.closest('.ok')) addFrom(row);
    else if (e.target.closest('.x')) { A.write(A.withoutRow(A.events(), row.dataset.id)); build(); refreshStage(); }
  });
  edit.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return; const row = e.target.closest('.row'); if (!row) return; e.preventDefault(); e.stopPropagation();
    if (row.classList.contains('add')) addFrom(row); else e.target.blur();
  });
  edit.addEventListener('change', (e) => {
    const row = e.target.closest('.row'); if (!row || row.classList.contains('add')) return;
    if (e.target.classList.contains('w')) { const v = e.target.value.trim(); if (v) change(row.dataset.id, { title: v.slice(0, 160) }); }
    if (e.target.classList.contains('t')) { const v = e.target.value; change(row.dataset.id, { at: at(sel, v), allDay: !v }); }
  });

  // turning: drag sets the angle; letting go keeps a little spin that slows, then it eases back to face you.
  // It sways a little while it is new or just turned, then settles still and the frame loop stops: a still card
  // costs a phone nothing, and the days hold still under a finger or a pointer. A drag wakes it again.
  let rx = reduce ? -6 : -8, ry = reduce ? -10 : -16, vx = 0, vy = 0, drag = null, moved = false, flip = 0, running = false; // held still, it opens at rest
  const t0 = performance.now();
  let woke = t0;
  const apply = () => { rig.style.transform = 'translateX(-50%) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)'; page.style.transform = flip ? 'rotateX(' + flip + 'deg)' : ''; };
  function tick(now) {
    if (!el.isConnected) { running = false; return; }
    let rest = false;
    if (!drag && calm()) {
      // held still: no spin after a drag and no easing back, the card stands at the nearest front-facing turn at once
      vx = vy = 0; ry = Math.round((ry + 10) / 360) * 360 - 10; rx = -6; rest = !flip;
    } else if (!drag) {
      rx += vx; ry += vy; vx *= 0.92; vy *= 0.92;
      if (Math.abs(vx) + Math.abs(vy) < 0.05) {
        const amp = calm() ? 0 : swayAmp(now - woke);
        const sway = amp * Math.sin((now - t0) / 1800);
        const target = Math.round((ry + 10) / 360) * 360 - 10 + sway; // the nearest front-facing turn
        ry += (target - ry) * 0.04; rx += (-6 - rx) * 0.04;
        rest = !amp && !flip && Math.abs(target - ry) < 0.02 && Math.abs(-6 - rx) < 0.02;
      }
    }
    apply();
    if (rest) { running = false; return; }
    requestAnimationFrame(tick);
  }
  const wake = () => { woke = performance.now(); if (!running) { running = true; requestAnimationFrame(tick); } };
  scene.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.c3d-band button')) return;
    wake();
    drag = { x: e.clientX, y: e.clientY, rx, ry, lx: e.clientX, ly: e.clientY }; moved = false; scene.classList.add('grab');
  });
  scene.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) { moved = true; try { scene.setPointerCapture(e.pointerId); } catch (_) {} }
    if (!moved) return;
    ry = drag.ry + (e.clientX - drag.x) * 0.45; rx = Math.max(-70, Math.min(70, drag.rx - (e.clientY - drag.y) * 0.3));
    vy = (e.clientX - drag.lx) * 0.3; vx = -(e.clientY - drag.ly) * 0.15; drag.lx = e.clientX; drag.ly = e.clientY;
  });
  const end = () => { if (drag) { drag = null; scene.classList.remove('grab'); } };
  scene.addEventListener('pointerup', end); scene.addEventListener('pointercancel', end);

  // a month turns over the rings like a real page
  function go(dir) {
    const swap = () => { m += dir; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } sel = null; build(); aimPage(); };
    if (calm()) { swap(); return; }
    const t1 = performance.now(), dur = 520; let swapped = false;
    const step = (now) => {
      const t = Math.min(1, (now - t1) / dur);
      if (t < 0.5) flip = (dir > 0 ? 1 : -1) * 92 * (t * 2);
      else { if (!swapped) { swapped = true; swap(); } flip = (dir > 0 ? -1 : 1) * 92 * (1 - (t - 0.5) * 2); }
      if (t < 1) { apply(); requestAnimationFrame(step); } else { flip = 0; apply(); } // apply here too: the turn loop may be resting
    };
    requestAnimationFrame(step);
  }
  page.addEventListener('click', (e) => {
    if (e.target.closest('.c3d-prev')) { go(-1); return; }
    if (e.target.closest('.c3d-next')) { go(1); return; }
    if (moved) { moved = false; return; } // that was a turn, not a tap
    const c = e.target.closest('.c3d-day'); if (!c) return;
    sel = c.dataset.k;
    aimPage();
    page.querySelectorAll('.c3d-day.sel').forEach((x) => x.classList.remove('sel')); c.classList.add('sel');
    drawEditor(); const w = edit.querySelector('.row.add .w'); if (w) w.focus({ preventScroll: true });
  });

  build(); apply(); wake();
  el._cal3d = { month: () => [y, m], angle: () => [rx, ry], turn: (a, b) => { rx = a; ry = b; vx = vy = 0; apply(); wake(); }, moving: () => running }; // for tests
  return el;
}
