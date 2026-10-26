/**
 * numfact skill — a random number fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a number fact", "number fact", "random number fact".
 */
export function isNumFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+number\s+fact|(?:another|a|random)\s+number\s+fact|number\s+fact(?:\s+please)?|give\s+me\s+a\s+number\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Number fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://numbersapi.com/random/trivia?json', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'numfact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>Number fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “another number fact” for one more</div>'
      + '<div class="src">Source: <a href="http://numbersapi.com/" target="_blank" rel="noopener">numbersapi</a></div>';
    return 'numfact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Number fact</h2><p>The number fact service didn\'t answer, so here is mine: 42 is the answer to the ultimate question of life, the universe, and everything.</p>';
    return 'numfact';
  }
}

export default {
  name: 'numfact',
  examples: ['tell me a number fact', 'number fact', 'random number fact', 'another number fact'],
  nearMisses: ['what is a number', 'math fact', 'facts about pi'],
  match(lower, text) { return isNumFact(text); },
  run,
  suite() {
    const ok = isNumFact('tell me a number fact') && isNumFact('number fact') && !isNumFact('math fact');
    return { ok, got: 'match works' };
  }
};
