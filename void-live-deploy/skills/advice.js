/**
 * advice skill — a random piece of advice from the Advice Slip API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me advice", "random advice", "advice please".
 */
export function isAdvice(text) {
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:some|a|another|one\s+more)\s+advice|(?:random|some|another|a)\s+advice|advice(?:\s+please)?|what\s+should\s+i\s+do)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Advice</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.adviceslip.com/advice', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'advice';
    const advice = j && j.slip && j.slip.advice;
    if (!advice) throw 0;
    el.innerHTML = '<h2>Advice</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(advice) + '</p><div class="sub">say “another advice” for one more</div>'
      + '<div class="src">Source: <a href="https://api.adviceslip.com/" target="_blank" rel="noopener">Advice Slip</a></div>';
    return 'advice';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Advice</h2><p>The advice service didn\'t answer, so here is mine: Take one small step today toward the thing you have been putting off.</p>';
    return 'advice';
  }
}

export default {
  name: 'advice',
  examples: ['give me advice', 'random advice', 'advice please', 'another advice', 'what should i do'],
  nearMisses: ['legal advice', 'financial advice', 'what is advice'],
  match(lower, text) { return isAdvice(text); },
  run,
  suite() {
    const ok = isAdvice('give me advice') && isAdvice('random advice') && !isAdvice('legal advice');
    return { ok, got: 'match works' };
  }
};
