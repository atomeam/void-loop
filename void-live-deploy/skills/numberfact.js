/**
 * numberfact skill — trivia about a number from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "number fact", "fact about 42", "trivia for 7".
 */
export function isNumberFact(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:a\s+|another\s+|random\s+)?number\s+fact|(?:fact|trivia)\s+(?:about|for|on)\s+\d+|number\s+trivia|give\s+me\s+a\s+number\s+fact)$/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text || '').match(/\b(\d+)\b/);
  const num = m ? m[1] : 'random';
  const el = showPage((p) => { p.innerHTML = '<h2>A number fact</h2><div class="sub">…</div>'; });
  try {
    const url = num === 'random' ? 'https://numbersapi.com/random/trivia?json' : `https://numbersapi.com/${num}/trivia?json`;
    const j = await fetch(url, { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'numberfact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>A number fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “number fact” or “fact about 17” for another</div>'
      + '<div class="src">Source: <a href="http://numbersapi.com/" target="_blank" rel="noopener">numbersapi</a></div>';
    return 'numberfact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A number fact</h2><p>42 is the answer to the ultimate question of life, the universe, and everything.</p>';
    return 'numberfact';
  }
}

export default {
  name: 'numberfact',
  examples: ['number fact', 'fact about 42', 'trivia for 7', 'random number fact'],
  nearMisses: ['what is a number', 'math fact', 'phone number'],
  match(lower, text) { return isNumberFact(text); },
  run,
  suite() {
    const ok = isNumberFact('number fact') && isNumberFact('fact about 42') && !isNumberFact('what is a number');
    return { ok, got: 'match works' };
  }
};
