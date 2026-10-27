/**
 * numberfact skill — a fact about a number or a random one from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "number fact", "fact about 42", "random number fact".
 */
export function numberOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  const m = t.match(/^(?:please\s+)?(?:(?:a|the|another)\s+)?(?:number\s+fact|fact\s+about\s+(?:the\s+number\s+)?(\d+)|fact\s+for\s+(\d+)|number\s+(\d+)\s+fact)$/);
  if (!m) return null;
  return m[1] || m[2] || m[3] || 'random';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const n = numberOf(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Number fact</h2><div class="sub">…</div>'; });
  try {
    const url = n === 'random' ? 'https://numbersapi.com/random/trivia?json' : 'https://numbersapi.com/' + n + '/trivia?json';
    const j = await fetch(url, { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'numberfact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>Number fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “another number fact” or “fact about 7” for more</div>'
      + '<div class="src">Source: <a href="https://numbersapi.com/" target="_blank" rel="noopener">Numbers API</a></div>';
    return 'numberfact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Number fact</h2><p>The number service didn\'t answer, so here is mine: 42 is the answer to the ultimate question of life, the universe, and everything.</p>';
    return 'numberfact';
  }
}

export default {
  name: 'numberfact',
  examples: ['number fact', 'fact about 42', 'random number fact', 'number 7 fact'],
  nearMisses: ['what is a number', 'prime numbers', 'number of stars'],
  match(lower, text) { return !!numberOf(text); },
  run,
  suite() {
    const ok = numberOf('fact about 42') === '42' && numberOf('number fact') === 'random' && numberOf('what is a number') === null;
    return { ok, got: 'match works' };
  }
};
