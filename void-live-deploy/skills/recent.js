/**
 * recent skill — last few asks on an empty box (board Next #15)
 * Saved only in this browser (localStorage). The box stays blank until it is focused.
 * "recent asks", "what did I ask".
 */
export const ASKS_KEY = 'a2m.void.asks.v1';

// an ask is kept whole up to what the answer engine reads (ASK_MAX, lib/answer-honesty.js): at 240 a pasted note was cut mid-sentence
// ("Until then the music") and a tap on it asked the cut version (owner, 2026-10-30)
export const KEPT_ASK_MAX = 4000;
export const KEPT_ASKS = 12; // stored; the empty box still shows the newest 5 (the ask clipboard card, skills/ask-clipboard.js, reads all)
export function recentAsks(store, n = 5) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!bag) return [];
  try {
    const raw = JSON.parse(bag.getItem(ASKS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, n) : [];
  } catch (_) { return []; }
}

export function rememberAsk(text, store) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  const t = String(text || '').trim().slice(0, KEPT_ASK_MAX); // kept whole: a tap on it asks it again, and a cut ask was answered from the cut
  if (!bag || !t || /^(?:unlock\s*)+\S{16,}\s*$/i.test(t)) return recentAsks(bag);
  const prev = recentAsks(bag, KEPT_ASKS).filter((s) => s.toLowerCase() !== t.toLowerCase());
  const next = [t].concat(prev).slice(0, KEPT_ASKS);
  try { bag.setItem(ASKS_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

// earlier answers (owner, 2026-10-18, UI polish: "no way to see earlier answers"): one answer card is open at a time, so a card that is replaced
// leaves its one-line header and its words behind (void.html trailKeep), here in this browser only; "recent asks" shows them as one line each that opens on a tap
export const TRAIL_KEY = 'a2m.void.trail.v1';
export function earlierAnswers(store) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!bag) return [];
  try {
    const raw = JSON.parse(bag.getItem(TRAIL_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.t === 'string' && e.t && typeof e.x === 'string').slice(0, 12) : [];
  } catch (_) { return []; }
}

export function recentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:show\s+)?(?:my\s+)?recent asks$/i.test(t)) return true;
  if (/^(?:what|which) did I ask(?: last| recently)?$/i.test(t)) return true;
  if (/^my last asks$/i.test(t)) return true;
  if (/^(?:show\s+)?(?:my\s+)?(?:earlier|previous|past|older)\s+answers$|^answer history$/i.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!recentOf(text)) return 'none';
  const asks = recentAsks();
  const el = showPage((p) => { p.innerHTML = '<h2>Recent asks</h2>'; });
  el.dataset.noTrail = '1'; // this card is not itself an earlier answer
  const trail = earlierAnswers();
  const earlier = trail.length ? '<h3 style="margin:16px 0 6px;font-size:14px">Earlier answers</h3>' + trail.map((e) => '<details class="trail-one" style="margin:4px 0"><summary style="cursor:pointer">' + esc(e.t.slice(0, 90)) + '</summary><p style="margin:6px 0 8px">' + esc(e.x) + '</p></details>').join('') : '';
  const body = asks.length
    ? '<ul>' + asks.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>'
    : '<p>Nothing yet. Asks you make stay in this browser, and show on the empty box once you focus it.</p>';
  el.innerHTML = '<h2>Recent asks</h2>' + body + earlier
    + '<div class="src">Saved only in this browser. The surface stays empty until the box is focused.</div>';
  return 'recent';
}

export default {
  name: 'recent',
  examples: ['recent asks', 'what did I ask', 'show my recent asks', 'my last asks', 'earlier answers'],
  nearMisses: ['what can you do', 'make a clock', 'remind me at 5'],
  rememberAsk,
  recentAsks,
  match(lower, text) { return recentOf(text); },
  run
};
