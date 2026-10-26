/**
 * dogfact skill — a random dog fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a dog fact", "dog fact", "random dog fact".
 */
export function isDogFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+dog\s+fact|(?:another|a|random)\s+dog\s+fact|dog\s+fact(?:\s+please)?|give\s+me\s+a\s+dog\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Dog fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://dog-api.kinduff.com/api/facts?number=1', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'dogfact';
    if (!j || !j.facts || !j.facts[0]) throw 0;
    el.innerHTML = '<h2>Dog fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.facts[0]) + '</p><div class="sub">say “another dog fact” for one more</div>'
      + '<div class="src">Source: <a href="https://dog-api.kinduff.com/" target="_blank" rel="noopener">dog-api.kinduff</a></div>';
    return 'dogfact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Dog fact</h2><p>The dog fact service didn\'t answer, so here is mine: A dog\'s sense of smell is about 40 times better than a human\'s.</p>';
    return 'dogfact';
  }
}

export default {
  name: 'dogfact',
  examples: ['tell me a dog fact', 'dog fact', 'random dog fact', 'another dog fact'],
  nearMisses: ['what is a dog', 'cat fact', 'facts about dogs'],
  match(lower, text) { return isDogFact(text); },
  run,
  suite() {
    const ok = isDogFact('tell me a dog fact') && isDogFact('dog fact') && !isDogFact('cat fact');
    return { ok, got: 'match works' };
  }
};
