/**
 * recent skill — last few asks on an empty box (board Next #15)
 * Saved only in this browser (localStorage). The box stays blank until it is focused.
 * "recent asks", "what did I ask".
 */
export const ASKS_KEY = 'a2m.void.asks.v1';

export function recentAsks(store) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!bag) return [];
  try {
    const raw = JSON.parse(bag.getItem(ASKS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5) : [];
  } catch (_) { return []; }
}

export function rememberAsk(text, store) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  const t = String(text || '').trim().slice(0, 240);
  if (!bag || !t || /^(?:unlock\s*)+\S{16,}\s*$/i.test(t)) return recentAsks(bag);
  const prev = recentAsks(bag).filter((s) => s.toLowerCase() !== t.toLowerCase());
  const next = [t].concat(prev).slice(0, 5);
  try { bag.setItem(ASKS_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

export function recentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:show\s+)?(?:my\s+)?recent asks$/i.test(t)) return true;
  if (/^(?:what|which) did I ask(?: last| recently)?$/i.test(t)) return true;
  if (/^my last asks$/i.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!recentOf(text)) return 'none';
  const asks = recentAsks();
  const el = showPage((p) => { p.innerHTML = '<h2>Recent asks</h2>'; });
  const body = asks.length
    ? '<ul>' + asks.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>'
    : '<p>Nothing yet. Asks you make stay in this browser, and show on the empty box once you focus it.</p>';
  el.innerHTML = '<h2>Recent asks</h2>' + body
    + '<div class="src">Saved only in this browser. The surface stays empty until the box is focused.</div>';
  return 'recent';
}

export default {
  name: 'recent',
  examples: ['recent asks', 'what did I ask', 'show my recent asks', 'my last asks'],
  nearMisses: ['what can you do', 'make a clock', 'remind me at 5'],
  rememberAsk,
  recentAsks,
  match(lower, text) { return recentOf(text); },
  run
};
