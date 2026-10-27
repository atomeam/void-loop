/**
 * number skill — a random number trivia fact from numbersapi.com (plain text, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "number trivia", "tell me a number fact", "random number fact".
 */
export function isNumber(text) {
  return /^(?:please\s+)?(?:(?:tell\s+me\s+)?(?:a|another)\s+(?:number|trivia)\s+fact|number\s+(?:trivia|fact)|random\s+number\s+fact|number\s+trivia)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Number trivia</h2><div class="sub">…</div>'; });
  try {
    const fact = await fetch('http://numbersapi.com/random/trivia').then((r) => r.text());
    if (!api._pageStill(el)) return 'number';
    if (!fact || fact.length < 5) throw 0;
    el.innerHTML = '<h2>Number trivia</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(fact.trim()) + '</p><div class="sub">say “another number fact” for one more</div>'
      + '<div class="src">Source: <a href="http://numbersapi.com/" target="_blank" rel="noopener">numbersapi.com</a></div>';
    return 'number';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Number trivia</h2><p>42 is the answer to the ultimate question of life, the universe, and everything.</p>';
    return 'number';
  }
}

export default {
  name: 'number',
  examples: ['number trivia', 'tell me a number fact', 'random number fact', 'another number fact'],
  nearMisses: ['what is a number', 'phone number', 'account number'],
  match(lower, text) { return isNumber(text); },
  run,
  suite() {
    const ok = isNumber('number trivia') && isNumber('random number fact') && !isNumber('phone number');
    return { ok, got: 'match works' };
  }
};
