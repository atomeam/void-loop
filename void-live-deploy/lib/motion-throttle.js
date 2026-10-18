// The Zorbleflux throttle (asked by Verse, 2026-10-18: "Create a 'Zorbleflux' throttle that slows down chaotic motion when a user is actively
// interacting with a card's input."). While a person types in a card (an input, textarea, select or contenteditable inside a stage card has focus) or
// holds the pointer down on a card, the moving things on the stage (the Zorbleflux field, the living field cards: lib/field-stage.js) run at SLOW of
// their speed, eased there and back so nothing jerks, and stay slow for IDLE_MS after the person lets go, then speed back up along a smooth curve over RAMP_MS
// (asked by Verse, 2026-10-18: a velocity-smoothing curve instead of a hard cut-off: the speed leaves SLOW gently, is fastest mid-way and settles into full speed gently). The card being used is never
// slowed by itself (pressing on the Zorbleflux board is playing it). The pure half is targetOf / ease; motionThrottle() is the page half.

export const SLOW = 0.25;     // the speed of chaotic motion while someone is using a card's input
export const IDLE_MS = 700;   // the field stays slow this long after the last interaction
export const RAMP_MS = 500;   // then the target climbs from SLOW to full speed along a smoothstep over this long (no step in it)
export const TAU_MS = 220;    // the easing time constant (about 2/3 of the way in TAU_MS)
const FIELDS = /^(?:input|textarea|select)$/i;
const TEXTLESS = /^(?:button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i;

/** true when an element (or a plain { tagName, type, isContentEditable } object) takes typed or chosen input. Pure. */
export function isField(el) {
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  if (!FIELDS.test(el.tagName)) return false;
  return !(/^input$/i.test(el.tagName) && TEXTLESS.test(String(el.type || '')));
}
/** the speed a moving card should head for: SLOW while someone is using ANOTHER card (or within IDLE_MS of it), then a smoothstep from SLOW up to 1 over
 *  RAMP_MS (flat at both ends, so the speed leaves slow gently and settles into full gently), else 1. `self` is the moving card,
 *  `busy` the card in use (null when none), `lastAt` when it was last in use. Pure. */
export function targetOf({ busy = null, lastAt = -Infinity, self = null, now = 0 } = {}) {
  if (busy && busy === self) return 1;
  if (busy) return SLOW;
  if (!(lastAt > -Infinity)) return 1;
  const t = (now - lastAt - IDLE_MS) / RAMP_MS;
  return t <= 0 ? SLOW : t >= 1 ? 1 : SLOW + (1 - SLOW) * t * t * (3 - 2 * t);
}
/** one smoothing step from `cur` toward `target` over dtMs (exponential, frame-rate independent), clamped to [SLOW, 1]. Pure. */
export function ease(cur, target, dtMs, tau = TAU_MS) {
  const k = 1 - Math.exp(-Math.max(0, Number(dtMs) || 0) / tau), v = cur + (target - cur) * k;
  return Math.min(1, Math.max(SLOW, Math.abs(v - target) < 0.002 ? target : v));
}

let shared = null;
/** The page half, one per document: listens for focus and presses inside stage cards (`.thing`) and answers scale(selfEl, now) for a moving card,
 *  eased per card. Sets data-motion-throttle="slow" on <html> while it holds things back (for the browser test). */
export function motionThrottle(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return { scale: () => 1 };
  if (shared && shared.doc === doc) return shared;
  let busy = null, lastAt = -Infinity, down = null;
  const cardOf = (el) => (el && el.closest ? el.closest('.thing') : null);
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const mark = () => { doc.documentElement.dataset.motionThrottle = busy || nowMs() - lastAt < IDLE_MS + RAMP_MS ? 'slow' : 'full'; };
  const refresh = () => { const a = doc.activeElement, f = isField(a) ? cardOf(a) : null; const was = busy; busy = down || f || null; if (was && !busy) lastAt = nowMs(); if (busy) lastAt = nowMs(); mark(); };
  doc.addEventListener('focusin', refresh, true);
  doc.addEventListener('focusout', () => setTimeout(refresh, 0), true);
  doc.addEventListener('pointerdown', (e) => { down = cardOf(e.target); refresh(); }, true);
  const up = () => { if (down) { down = null; refresh(); } };
  doc.addEventListener('pointerup', up, true); doc.addEventListener('pointercancel', up, true);
  const per = new WeakMap();
  const scale = (self, now = nowMs()) => {
    const card = cardOf(self) || self, st = (card && per.get(card)) || { v: 1, at: now };
    st.v = ease(st.v, targetOf({ busy, lastAt, self: card, now }), now - st.at); st.at = now;
    if (card) per.set(card, st);
    if (!busy && doc.documentElement.dataset.motionThrottle === 'slow' && now - lastAt >= IDLE_MS + RAMP_MS) mark();
    return st.v;
  };
  shared = { doc, scale, state: () => ({ busy: !!busy, lastAt }) };
  return shared;
}
