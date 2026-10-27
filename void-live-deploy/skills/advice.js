/**
 * advice skill — a random piece of advice from api.adviceslip.com (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me some advice", "give me advice", "random advice".
 */
export function isAdvice(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:some|a|another|one\s+more)\s+advice|(?:another|some|a|random)\s+advice|advice(?:\s+please)?|give\s+me\s+(?:some\s+)?advice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Some advice</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.adviceslip.com/advice', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'advice';
    if (!j || !j.slip || !j.slip.advice) throw 0;
    el.innerHTML = '<h2>Some advice</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">"' + esc(j.slip.advice) + '"</p><div class="sub">say “another advice” for one more</div>'
      + '<div class="src">Source: <a href="https://api.adviceslip.com/" target="_blank" rel="noopener">adviceslip.com</a></div>';
    return 'advice';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Some advice</h2><p style="font-style:italic">"The best time to plant a tree was 20 years ago. The second best time is now."</p>';
    return 'advice';
  }
}

export default {
  name: 'advice',
  examples: ['tell me some advice', 'give me advice', 'random advice', 'another advice'],
  nearMisses: ['what is advice', 'financial advice', 'legal advice'],
  match(lower, text) { return isAdvice(text); },
  run,
  suite() {
    const ok = isAdvice('tell me some advice') && isAdvice('give me advice') && !isAdvice('what is advice');
    return { ok, got: 'match works' };
  }
};
