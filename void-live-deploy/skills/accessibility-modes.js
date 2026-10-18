/**
 * accessibility-modes skill — ten switches in one place, saved on this device and applied by classes and a stylesheet
 * (tools pack 7, owner 2026-10-18: items 171 to 180): spoken labels on objects, keyboard-only stage move, a focus trap in cards,
 * a reduced-motion hard switch, a dyslexia-friendly font, a colorblind-safe palette, 44px click targets, captions for system
 * speech, a haptic tick on keep, a sticky focus outline. "dyslexia friendly font", "turn on reduced motion", "colorblind safe palette",
 * "44px click targets", "captions for system speech", "haptic tick on keep", "sticky focus outline", "keyboard only stage move",
 * "focus trap", "screen reader labels off", "accessibility settings" (a panel with every switch). Each ask turns one switch on, "off"
 * turns it off. The state is one small object at a2m.void.a11y.v1; nothing is sent anywhere. The look is in void.html's style block, the
 * classes are put on before the first paint by the first-frame script there. Logic: lib/a11y-modes.js (tests: tools/tools-pack-7.test.mjs).
 */
import { cardEl, keepOut, addThing, firstOf } from '../lib/stage-pack.js';
import * as A from '../lib/a11y-modes.js';

export const MOTION_KEY = 'a2m.void.motion.v1'; // the switch the worlds and figures already read (figures.js, scene3d.js)

let state = null;      // the saved switches, read once
let API = null;        // the stage, handed over by decorate() after each render
let lastKept = null;   // how many kept answers the stage held at the last render, for the haptic tick

function store() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } }
export function loadState(bag = store()) { let raw = null; try { raw = bag && bag.getItem(A.KEY); } catch (_) { raw = null; } return A.readState(raw); }
export function saveState(s, bag = store()) { try { if (bag) bag.setItem(A.KEY, A.writeState(s)); } catch (_) { /* a full or blocked store: the switch still holds for this visit */ } }
const cur = () => state || (state = loadState());

/** put the classes on <html> (their look is in void.html's style block) and the motion key where the worlds read it */
export function applyAll(s = cur(), doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  const root = doc.documentElement, on = A.classesFor(s);
  for (const m of A.MODES) if (m.cls) root.classList.toggle(m.cls, on.includes(m.cls));
  try {
    const bag = store();
    if (bag && s.motion) bag.setItem(MOTION_KEY, 'still');
  } catch (_) { /* no storage: the class alone still stops the animations */ }
}

/** set one switch, save it, apply it; the new state */
export function setMode(id, on) {
  const s = { ...cur(), [id]: !!on };
  if (id === 'motion' && !on) { try { const bag = store(); if (bag && bag.getItem(MOTION_KEY) === 'still') bag.removeItem(MOTION_KEY); } catch (_) { /* nothing to clear */ } } // the worlds and figures read this key too
  state = s; saveState(s); applyAll(s);
  if (API && API.stage) refreshPanels(API);
  return s;
}

// ---- behaviours ------------------------------------------------------------------------------------

function onKey(e) {
  const s = cur(), stage = API && API.stage;
  if (!stage || e.defaultPrevented) return;
  const t = e.target, card = t && t.closest ? t.closest('.thing') : null;
  if (!card || !stage.contains(card)) return;
  const typing = t.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if (s.trap && e.key === 'Escape') {
    const box = document.getElementById('input'); if (box) { e.stopPropagation(); e.preventDefault(); box.focus(); } return;
  }
  if (s.trap && e.key === 'Tab') {
    const f = [...card.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null || n === card);
    if (f.length) {
      const first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || at === card)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (s.keys && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.startsWith('Arrow')) {
    const th = API.things()[card.dataset.id], to = th && A.moveBy(th, e.key, e.shiftKey);
    if (!to) return;
    e.preventDefault(); th.x = to.x; th.y = to.y; API.save(); API.render();
    const again = stage.querySelector('[data-id="' + CSS.escape(th.id) + '"]');
    if (again) { if (!again.hasAttribute('tabindex')) again.setAttribute('tabindex', '-1'); again.focus(); }
  }
}

let speechPatched = false, capTimer = 0;
function showCaption(text) {
  let el = document.getElementById('a11y-caption');
  if (!el) { el = document.createElement('div'); el.id = 'a11y-caption'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'off'); document.body.appendChild(el); }
  el.textContent = String(text || '').slice(0, 400); el.hidden = !el.textContent;
  clearTimeout(capTimer); capTimer = setTimeout(hideCaption, Math.min(30000, 2500 + String(text || '').length * 90));
}
function hideCaption() { const el = document.getElementById('a11y-caption'); if (el) { el.textContent = ''; el.hidden = true; } }
function patchSpeech() {
  if (speechPatched || typeof speechSynthesis === 'undefined' || typeof speechSynthesis.speak !== 'function') return;
  speechPatched = true;
  const speak = speechSynthesis.speak.bind(speechSynthesis), cancel = speechSynthesis.cancel.bind(speechSynthesis);
  speechSynthesis.speak = (u) => {
    try { if (cur().captions && u && u.text) { showCaption(u.text); u.addEventListener('end', hideCaption); u.addEventListener('error', hideCaption); } } catch (_) { /* captions are an extra: speech goes on */ }
    return speak(u);
  };
  speechSynthesis.cancel = () => { hideCaption(); return cancel(); };
}

function labelThings(stageApi) {
  const stage = stageApi.stage, things = stageApi.things();
  for (const el of stage.querySelectorAll(':scope > .thing[data-id]')) {
    const th = things[el.dataset.id];
    if (!th || el.dataset.restore) continue;
    const had = el.getAttribute('aria-label');
    if (!(el.hasAttribute('data-a11y-label') || A.isGenericLabel(had))) continue;
    const label = A.describeThing(th);
    if (label && label !== had) el.setAttribute('aria-label', label);
    el.setAttribute('data-a11y-label', '1');
    if (!el.getAttribute('role')) el.setAttribute('role', 'group');
  }
}

/** runs after every render of the stage: remembers the stage, speaks labels, ticks when a kept answer appears */
export function decorate(stageApi) {
  API = stageApi;
  const s = cur();
  if (s.labels) { try { labelThings(stageApi); } catch (_) { /* a label is an extra */ } }
  const kept = Object.values(stageApi.things()).filter((t) => t && t.kind === 'kept').length;
  if (lastKept !== null && kept === lastKept + 1 && s.haptic) { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12); } catch (_) { /* no vibration here */ } }
  lastKept = kept;
}

// ---- the panel ---------------------------------------------------------------------------------------

function refreshPanels(stageApi) { try { stageApi.render(); } catch (_) { /* nothing to redraw */ } }

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'a11y-panel');
  el.style.width = 'min(92vw,420px)';
  const head = document.createElement('div'); head.style.cssText = 'margin-bottom:8px'; const b = document.createElement('b'); b.textContent = 'Accessibility settings'; head.appendChild(b);
  const sub = document.createElement('div'); sub.style.cssText = 'font-size:12px;opacity:.7'; sub.textContent = 'Kept on this device. Each switch also answers to words, like "dyslexia friendly font off".'; head.appendChild(sub);
  el.appendChild(head);
  const s = cur();
  for (const m of A.MODES) {
    const row = document.createElement('label'); row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:5px 0;cursor:pointer'; row.dataset.mode = m.id;
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!s[m.id]; cb.style.marginTop = '3px'; cb.setAttribute('aria-label', m.label);
    cb.addEventListener('change', () => { setMode(m.id, cb.checked); }); keepOut(cb);
    const txt = document.createElement('span'); const t1 = document.createElement('span'); t1.textContent = m.label; t1.style.display = 'block';
    const t2 = document.createElement('span'); t2.textContent = m.does; t2.style.cssText = 'display:block;font-size:12px;opacity:.7';
    txt.append(t1, t2); row.append(cb, txt); keepOut(row); el.appendChild(row);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the kind's ask: one switch, the panel, or the status; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const p = A.parseA11y(text);
  if (!p) return '';
  API = stageApi;
  if (p.act === 'panel') {
    const th = firstOf(stageApi, 'a11y') || addThing(stageApi, 'a11y', {});
    stageApi.select(th.id); stageApi.save(); stageApi.render();
    return 'accessibility-panel';
  }
  if (p.act === 'status') {
    const s = cur(), on = A.MODES.filter((m) => s[m.id]).map((m) => m.label);
    stageApi.say(on.length ? 'on: ' + on.join(' · ') : 'no accessibility switches are on');
    return 'accessibility-status';
  }
  const m = A.MODES.find((x) => x.id === p.id);
  setMode(p.id, p.on);
  stageApi.say(m.label + (p.on ? ' on' : ' off'));
  return 'accessibility-' + p.id;
}

// the saved switches are applied the moment the skill loads, and the speech hook is in before anyone speaks
if (typeof document !== 'undefined') { try { applyAll(cur()); patchSpeech(); document.addEventListener('keydown', onKey, true); } catch (_) { /* the page works without it */ } }

export default {
  name: 'accessibility-modes',
  examples: ['dyslexia friendly font', 'turn on reduced motion', 'colorblind safe palette', '44px click targets', 'captions for system speech', 'haptic tick on keep',
    'sticky focus outline', 'keyboard only stage move', 'focus trap on', 'screen reader labels off', 'accessibility settings'],
  nearMisses: ['what is dyslexia', 'what is a colorblind test', 'how do I reduce motion sickness', 'is my website accessible', 'tap the screen to keep', 'wheelchair accessible restaurants near me', 'what is a focus trap'],
  parseA11y: A.parseA11y,
  match(lower, text) { return !!A.parseA11y(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'accessibility-modes' : 'none'; },
  decorate,
  stageKinds: { a11y: { mount, ask } },
};
