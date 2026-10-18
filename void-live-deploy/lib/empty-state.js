// The empty stage and the ask bar (owner, 2026-10-18): pure helpers the page wires up in void.html, so each rule can be tested without a browser.
// No network, nothing stored. tools/empty-state.test.mjs runs every suggestion through the real skill router.

// One-line suggestions for the empty stage: each is a skill's own example, and routes to that skill (tools/empty-state.test.mjs checks both).
export const SUGGESTIONS = [
  { ask: 'open the rule registry', skill: 'guide' },
  { ask: 'play othello', skill: 'games' },
  { ask: 'open a calculator', skill: 'calc' },
  { ask: 'make a counter', skill: 'counter' },
  { ask: 'open a notepad', skill: 'notepad' },
  { ask: 'draw a circle', skill: 'shape' },
  { ask: 'sticky note buy milk', skill: 'sticky' },
  { ask: 'set a timer for 5 minutes', skill: 'time' },
  { ask: 'make a 3d torus', skill: 'make' },
  { ask: 'open a converter', skill: 'convert' },
  { ask: '20% tip on 45', skill: 'tip' },
  { ask: 'where is jupiter', skill: 'skycard' },
];

// the next suggestion: never the one just shown (rnd is injectable for tests)
export function pickSuggestion(list, last, rnd = Math.random) {
  const asks = (list || []).map((s) => (typeof s === 'string' ? s : s && s.ask)).filter(Boolean);
  const pool = asks.filter((a) => a !== last);
  if (!pool.length) return asks[0] || '';
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

export const OFFLINE_PLACEHOLDER = 'offline: skills that need the network will wait';
export const READY_PLACEHOLDER = 'Command the Verse'; // the owner, 2026-10-18: the stage is the Verse now, and the bar says so

// The link state, from what the page already sees: the browser's online flag and its own failed requests. Two same-origin requests in a
// row that never reached the network count as offline; any success (or the browser's `online` event) clears it at once.
export function createLinkState(failLimit = 2) {
  let online = true, fails = 0;
  return {
    setOnline(v) { online = v !== false; if (online) fails = 0; },
    fail() { fails++; },
    ok() { fails = 0; online = true; },
    get offline() { return !online || fails >= failLimit; },
  };
}

// what the ask bar and the halo show for a link state
export function offlineView(offline) {
  return offline ? { placeholder: OFFLINE_PLACEHOLDER, halo: 'amber' } : { placeholder: READY_PLACEHOLDER, halo: null };
}

// how far the on-screen keyboard covers the bottom of the layout viewport (px): the ask bar lifts by this much
export function keyboardInset(layoutHeight, vv) {
  if (!vv || !(layoutHeight > 0)) return 0;
  const covered = layoutHeight - ((vv.height || 0) + (vv.offsetTop || 0));
  return covered > 40 ? Math.round(covered) : 0; // under 40px is browser chrome moving, not a keyboard
}

// may the ask bar take focus now? Only with a fine pointer (a touch screen would pop its keyboard over the stage), and never from a
// field someone is typing in or a dialog
export function mayAutofocus({ finePointer, activeTag = '', activeEditable = false, inDialog = false }) {
  if (!finePointer || inDialog || activeEditable) return false;
  return !/^(INPUT|TEXTAREA|SELECT)$/.test(String(activeTag).toUpperCase());
}

// WCAG contrast of two "r g b" colours (0-255), alpha folded onto the background first
export function lum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
export function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export function over(fg, alpha, bg) { return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)); }
