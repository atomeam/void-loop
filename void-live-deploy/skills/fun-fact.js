/**
 * fun-fact skill — a random fun fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fun fact", "random fun fact", "fun fact".
 */
export function isFunFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:fun\s+)?fact|(?:another|a|random|fun)\s+fact|fun\s+fact(?:\s+please)?|give\s+me\s+a\s+fun\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A fun fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://uselessfacts.jsph.pl/random.json?language=en', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'fun-fact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>A fun fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “another fun fact” for one more</div>'
      + '<div class="src">Source: <a href="https://uselessfacts.jsph.pl/" target="_blank" rel="noopener">uselessfacts.jsph.pl</a></div>';
    return 'fun-fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A fun fact</h2><p>Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.</p>';
    return 'fun-fact';
  }
}

export default {
  name: 'fun-fact',
  examples: ['tell me a fun fact', 'random fun fact', 'fun fact', 'another fun fact'],
  nearMisses: ['what is a fact', 'stock facts', 'fact of the day news'],
  match(lower, text) { return isFunFact(text); },
  run,
  suite() {
    const ok = isFunFact('tell me a fun fact') && isFunFact('random fun fact') && !isFunFact('stock facts');
    return { ok, got: 'match works' };
  }
};
