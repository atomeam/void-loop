/**
 * void-mood skill — the void's mood from its growth velocity.
 * "void mood", "how is the void feeling", "what's the void's mood".
 * Reads the growth ledger and reports speeding up as eager, stalled as quiet. Empty surface stays empty.
 */
export function moodOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:what(?:'s| is)\s+)?(?:the\s+)?void(?:'s)?\s+mood|how\s+(?:is|are)\s+(?:the\s+)?void\s+feeling|void\s+(?:feeling|mood))$/.test(t);
}

function trendToMood(trend) {
  if (trend === 'speeding up') return 'eager';
  if (trend === 'slowing') return 'settling';
  if (trend === 'stalled') return 'quiet';
  return 'steady';
}

async function run(text, api) {
  if (!moodOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Void mood</h2><div class="sub">reading the growth ledger…</div>'; });
  try {
    const list = await fetch('/void.growth.json').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'void-mood';
    const now = Date.now(), day = 864e5;
    const n = (a, b) => (Array.isArray(list) ? list : []).filter((e) => e && (e.kind === 'grow' || e.kind === 'build') && Date.parse(e.at) > now - b * day && Date.parse(e.at) <= now - a * day).length;
    const week = n(0, 7), before = n(7, 14);
    const trend = !week ? 'stalled' : !before || week >= before * 1.25 ? 'speeding up' : week <= before * 0.75 ? 'slowing' : 'steady';
    const mood = trendToMood(trend);
    el.innerHTML = '<h2>Void mood</h2>'
      + '<div class="sub" data-mood="' + esc(mood) + '">The void feels <b>' + esc(mood) + '</b> · velocity is ' + esc(trend) + '</div>'
      + '<p>This week ' + week + ' new or better, the week before ' + before + '.</p>'
      + '<div class="src">From the growth ledger. Nothing is sent or kept.</div>';
    return 'void-mood';
  } catch (_) {
    if (api._pageStill && api._pageStill(el)) el.innerHTML = '<h2>Void mood</h2><p>The ledger could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'void-mood',
  examples: ['void mood', "what's the void's mood", 'how is the void feeling'],
  nearMisses: ['what is a void', 'mood ring', 'how are you'],
  match(lower, text) { return moodOf(text || lower); },
  run,
  suite() { return { ok: moodOf('void mood') && !moodOf('films') }; },
};
