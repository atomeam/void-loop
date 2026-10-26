/**
 * catfact skill — a random cat fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a cat fact", "cat fact", "random cat fact".
 */
export function isCatFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:fun\s+)?cat\s+fact|(?:another|a|fun|random)\s+cat\s+fact|cat\s+fact(?:\s+please)?|give\s+me\s+a\s+cat\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Cat fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://catfact.ninja/fact', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'catfact';
    if (!j || !j.fact) throw 0;
    el.innerHTML = '<h2>Cat fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.fact) + '</p><div class="sub">say “another cat fact” for one more</div>'
      + '<div class="src">Source: <a href="https://catfact.ninja/" target="_blank" rel="noopener">catfact.ninja</a></div>';
    return 'catfact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Cat fact</h2><p>The fact service didn\'t answer, so here is mine: A group of cats is called a clowder.</p>';
    return 'catfact';
  }
}

export default {
  name: 'catfact',
  examples: ['tell me a cat fact', 'cat fact', 'random cat fact', 'another cat fact'],
  nearMisses: ['what is a cat', 'dog fact', 'facts about cats in general'],
  match(lower, text) { return isCatFact(text); },
  run,
  suite() {
    const ok = isCatFact('tell me a cat fact') && isCatFact('cat fact') && !isCatFact('what is a cat');
    return { ok, got: 'match works' };
  }
};
