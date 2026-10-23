/**
 * advice skill — a random piece of advice from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me advice", "random advice", "some advice".
 */
export function isAdvice(text) {
  return /^(?:please\s+)?(?:(?:give|tell)\s+(?:me\s+)?(?:a|some|another)\s+advice|(?:another|a|random|some)\s+advice|advice(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Advice</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.adviceslip.com/advice', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'advice';
    const slip = j && j.slip && j.slip.advice;
    if (!slip) throw 0;
    el.innerHTML = '<h2>Advice</h2><p style="font-size:20px;line-height:1.45;font-style:italic">"' + esc(slip) + '"</p><div class="sub">say “another advice” for one more</div>'
      + '<div class="src">Source: <a href="https://adviceslip.com/" target="_blank" rel="noopener">adviceslip.com</a></div>';
    return 'advice';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Advice</h2><p style="font-style:italic">"The best time to plant a tree was 20 years ago. The second best time is now."</p>';
    return 'advice';
  }
}

export default {
  name: 'advice',
  examples: ['give me advice', 'random advice', 'some advice', 'another advice'],
  nearMisses: ['what is advice', 'advice column', 'legal advice'],
  match(lower, text) { return isAdvice(text); },
  run,
  suite() {
    const ok = isAdvice('give me advice') && isAdvice('random advice') && !isAdvice('legal advice');
    return { ok, got: 'match works' };
  }
};
