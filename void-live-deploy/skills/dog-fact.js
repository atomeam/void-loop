/**
 * dog-fact skill — a random dog fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a dog fact", "dog fact", "random dog fact".
 */
export function isDogFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:dog\s+)?fact|(?:another|a|fun|random)\s+dog\s+fact|dog\s+fact(?:\s+please)?|give\s+me\s+a\s+dog\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A dog fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://dogapi.dog/api/v2/facts', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'dog-fact';
    if (!j || !j.data || !j.data[0] || !j.data[0].attributes || !j.data[0].attributes.body) throw 0;
    const fact = j.data[0].attributes.body;
    el.innerHTML = '<h2>A dog fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(fact) + '</p><div class="sub">say “another dog fact” for one more</div>'
      + '<div class="src">Source: <a href="https://dogapi.dog/" target="_blank" rel="noopener">dogapi.dog</a></div>';
    return 'dog-fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A dog fact</h2><p>The dog fact service didn\'t answer, so here is mine: Dogs have about 1,700 taste buds. Humans have about 9,000.</p>';
    return 'dog-fact';
  }
}

export default {
  name: 'dog-fact',
  examples: ['tell me a dog fact', 'dog fact', 'random dog fact', 'another dog fact'],
  nearMisses: ['what is a dog', 'cat fact', 'facts about dogs'],
  match(lower, text) { return isDogFact(text); },
  run,
  suite() {
    const ok = isDogFact('tell me a dog fact') && isDogFact('dog fact') && !isDogFact('what is a dog');
    return { ok, got: 'match works' };
  }
};
