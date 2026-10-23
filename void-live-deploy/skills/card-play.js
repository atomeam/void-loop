/**
 * card-play skill — four small things to do with cards, each by words and each opt-in (asked for by the owner, 2026-10-18):
 * "flip this card" turns the picked card once around; "stamp it approved" (or rejected, paid, draft, done, urgent, ...) presses a
 * rotated stamp on the picked card and keeps it ("remove the stamp" lifts it); "tape on" puts a strip of tape on every sticky note
 * ("tape off" peels it); "rubber band select" lets you drag a box on the empty stage to pick several cards, with a small bar to
 * remove them or let go. Reduced motion is respected: the flip and the stamp land without moving. Nothing appears until asked.
 * Pure logic: lib/fx.js (tests: tools/tools-pack-8.test.mjs). The selection bar asks "remove N?" when "confirm before mass delete" is on.
 */
import { playIntent, stampStyle, rectBetween, pickedBy } from '../lib/fx.js';

const KEY = 'a2m.void.play.v1';
const doc = typeof document !== 'undefined' ? document : null;
const still = () => { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
function write(patch) { const s = { ...read(), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} return s; }
const stageEl = () => (doc ? doc.getElementById('stage') : null);
const elOf = (stageApi, id) => stageApi.stage.querySelector('[data-id="' + CSS.escape(String(id)) + '"]');

// ---------- the picked card ----------
function target(stageApi) {
  const things = stageApi.things(), sel = stageApi.selected();
  if (sel && things[sel]) return things[sel];
  const all = Object.values(things); return all[all.length - 1] || null;
}

function flip(stageApi) {
  const th = target(stageApi); if (!th) return 'Nothing on the stage to flip.';
  const el = elOf(stageApi, th.id); if (!el) return 'Nothing on the stage to flip.';
  el.dataset.flipped = String(Date.now());
  if (still()) { el.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 200 }); return 'flipped'; }
  try { el.animate([{ rotate: 'y 0deg' }, { rotate: 'y 360deg' }], { duration: 700, easing: 'ease-in-out' }); } catch (_) {}
  return 'flipped';
}

// ---------- stamps ----------
function paintStamps(stageApi) {
  for (const th of Object.values(stageApi.things())) {
    if (!th || !th.stamp) continue;
    const el = elOf(stageApi, th.id); if (!el || el.querySelector(':scope > .play-stamp')) continue;
    const s = stampStyle(th.stamp), st = doc.createElement('div');
    st.className = 'play-stamp'; st.textContent = s.text; st.setAttribute('aria-label', 'stamped ' + s.text.toLowerCase());
    st.style.cssText = 'position:absolute;right:10px;bottom:12px;padding:3px 10px;border:3px double ' + s.color + ';border-radius:6px;color:' + s.color + ';font:800 18px/1.1 system-ui,sans-serif;letter-spacing:.12em;opacity:.88;transform:rotate(-12deg);pointer-events:none;text-shadow:0 0 1px ' + s.color + ';background:rgba(255,255,255,.12)';
    el.appendChild(st);
    if (!still() && fresh.has(th.id)) { try { st.animate([{ transform: 'rotate(-12deg) scale(1.9)', opacity: 0 }, { transform: 'rotate(-12deg) scale(1)', opacity: 0.88 }], { duration: 220, easing: 'ease-in' }); } catch (_) {} }
    fresh.delete(th.id);
  }
}

// ---------- tape ----------
function tapeStyle(on) {
  if (!doc) return;
  let s = doc.getElementById('play-tape-style');
  if (!on) { if (s) s.remove(); return; }
  if (s) return;
  s = doc.createElement('style'); s.id = 'play-tape-style';
  s.textContent = '.thing.sticky::after{content:"";position:absolute;top:-9px;left:50%;width:74px;height:20px;margin-left:-37px;transform:rotate(-3deg);background:rgba(255,246,200,.62);border-left:2px dotted rgba(0,0,0,.08);border-right:2px dotted rgba(0,0,0,.08);box-shadow:0 1px 2px rgba(0,0,0,.18);pointer-events:none}';
  doc.head.appendChild(s);
}

// ---------- rubber band ----------
const fresh = new Set();
let picked = new Set(), rbOn = false, rbBar = null, rbApi = null;
function rbMark(stageApi) {
  for (const el of stageApi.stage.querySelectorAll('.rb-picked')) el.classList.remove('rb-picked'), el.style.removeProperty('box-shadow');
  for (const id of picked) { const el = elOf(stageApi, id); if (el) { el.classList.add('rb-picked'); el.style.boxShadow = '0 0 0 2px #ffd166'; } }
  if (rbBar) { rbBar.remove(); rbBar = null; }
  if (!picked.size) return;
  rbBar = doc.createElement('div'); rbBar.className = 'rb-bar'; rbBar.setAttribute('role', 'status');
  rbBar.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2100;display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:12px;background:rgba(24,24,34,.96);border:1px solid rgba(255,255,255,.25);color:#eee;font:14px system-ui,sans-serif';
  const msg = doc.createElement('span'); msg.className = 'rb-count'; msg.textContent = picked.size + ' selected';
  const btn = 'font:inherit;font-size:13px;padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;cursor:pointer';
  const rm = doc.createElement('button'); rm.type = 'button'; rm.className = 'rb-remove'; rm.textContent = 'Remove'; rm.style.cssText = btn;
  const no = doc.createElement('button'); no.type = 'button'; no.className = 'rb-clear'; no.textContent = 'Let go'; no.style.cssText = btn;
  rm.addEventListener('click', () => {
    const ids = [...picked];
    let sure = true;
    try { if (ids.length >= 2 && JSON.parse(localStorage.getItem('a2m.void.safety.v1') || '{}').confirmMass) sure = window.confirm('Remove ' + ids.length + ' things? (Say undo afterwards to bring them back.)'); } catch (_) {}
    if (!sure) return;
    try { stageApi.snapshot(); } catch (_) {}
    for (const id of ids) delete stageApi.things()[id];
    picked = new Set(); stageApi.select(null); stageApi.save(); stageApi.render(); if (stageApi.say) stageApi.say(ids.length + ' removed');
  });
  no.addEventListener('click', () => { picked = new Set(); rbMark(stageApi); });
  rbBar.append(msg, rm, no); doc.body.appendChild(rbBar);
}

function rbEnable(stageApi) {
  rbApi = stageApi;
  if (rbOn) return;
  rbOn = true;
  const st = stageApi.stage; let start = null, box = null;
  try { st.dataset.rubberBand = 'on'; } catch (_) {} // armed: the suite waits for this before it drags (a drag before the listener is on selects nothing)
  const local = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  st.addEventListener('pointerdown', (e) => {
    if (!rbOn || e.target !== st || e.button > 0) return;
    // a band drag is not a text selection: without this the drag selects the cards' words, and the next drag that starts inside
    // that selection becomes a native drag of the text (dragstart, then pointercancel), so it never picks anything
    e.preventDefault(); try { doc.getSelection().removeAllRanges(); } catch (_) {}
    start = local(e);
    box = doc.createElement('div'); box.className = 'rb-box';
    box.style.cssText = 'position:absolute;border:1px dashed #ffd166;background:rgba(255,209,102,.12);pointer-events:none;z-index:30;left:' + start.x + 'px;top:' + start.y + 'px;width:0;height:0';
    st.appendChild(box);
  });
  addEventListener('pointermove', (e) => {
    if (!start || !box) return;
    const r = rectBetween(start, local(e));
    box.style.left = r.x + 'px'; box.style.top = r.y + 'px'; box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
  });
  const up = (e) => {
    if (!start) return;
    const band = rectBetween(start, local(e)); start = null;
    if (box) { box.remove(); box = null; }
    const sr = st.getBoundingClientRect(), boxes = [];
    for (const el of st.querySelectorAll('.thing[data-id]')) { const r = el.getBoundingClientRect(); boxes.push({ id: el.dataset.id, x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }); }
    const ids = pickedBy(band, boxes);
    if (ids.length) { picked = new Set(ids); rbMark(stageApi); }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', () => { start = null; if (box) { box.remove(); box = null; } });
}
function rbDisable(stageApi) { rbOn = false; picked = new Set(); if (stageApi) rbMark(stageApi); }

/** carry out one card-play ask; returns the sentence to say, or '' when the ask is not ours */
export function ask(text, stageApi) {
  const it = playIntent(text);
  if (!it) return '';
  switch (it.op) {
    case 'flip': return flip(stageApi);
    case 'stamp': {
      const th = target(stageApi); if (!th) return 'Put something on the stage first, then stamp it.';
      th.stamp = it.word; fresh.add(th.id); stageApi.save(); stageApi.render(); return 'stamped ' + it.word;
    }
    case 'unstamp': {
      const th = target(stageApi); if (!th || !th.stamp) return 'No stamp to remove.';
      delete th.stamp; stageApi.save(); stageApi.render(); return 'stamp removed';
    }
    case 'tape': write({ tape: it.on }); tapeStyle(it.on); return it.on ? 'tape on your sticky notes · "tape off" peels it' : 'tape off';
    case 'rubber': write({ rubber: it.on }); if (it.on) { rbEnable(stageApi); return 'rubber band on · drag a box on the empty stage to pick several cards'; } rbDisable(stageApi); return 'rubber band off';
    default: return '';
  }
}

if (doc) {
  const apply = () => { const s = read(); if (s.tape) tapeStyle(true); };
  if (doc.head) apply(); else doc.addEventListener('DOMContentLoaded', apply, { once: true });
}

export default {
  name: 'card-play',
  examples: ['flip this card', 'stamp it approved', 'put tape on my notes', 'rubber band select'],
  nearMisses: ['flip a coin', 'stamp collecting for beginners', 'how much is a postage stamp', 'tape measure converter', 'select all', 'sticky note buy milk'],
  intent: playIntent,
  match(lower, text) { return !!playIntent(text || lower); },
  async run(text, api) { const said = ask(text, api.stage); if (said && api.say) api.say(said); return playIntent(text) ? 'card-play' : 'none'; },
  decorate(st) {
    if (!doc) return;
    paintStamps(st);
    const s = read();
    if (s.tape) tapeStyle(true);
    if (s.rubber && !rbOn) rbEnable(st);
    if (rbOn && picked.size) rbMark(st);
  },
};
