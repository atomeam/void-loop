/**
 * advice skill — a random piece of advice from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me advice", "random advice", "some advice".
 */
export function isAdvice(text) {
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:some\s+)?advice|(?:random|some)\s+advice|advice(?:\s+please)?|tell\s+me\s+some\s+advice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Advice</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.adviceslip.com/advice', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'advice';
    if (!j || !j.slip || !j.slip.advice) throw 0;
    el.innerHTML = '<h2>Advice</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.slip.advice) + '</p><div class="sub">say “some advice” for another</div>'
      + '<div class="src">Source: <a href="https://api.adviceslip.com/" target="_blank" rel="noopener">Advice Slip</a></div>';
    return 'advice';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Advice</h2><p>Measure twice, cut once.</p>';
    return 'advice';
  }
}

export default {
  name: 'advice',
  examples: ['give me advice', 'random advice', 'some advice', 'tell me some advice'],
  nearMisses: ['advice on stocks', 'legal advice', 'what is advice'],
  match(lower, text) { return isAdvice(text); },
  run,
  suite() {
    const ok = isAdvice('give me advice') && isAdvice('random advice') && !isAdvice('legal advice');
    return { ok, got: 'match works' };
  }
};
