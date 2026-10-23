/**
 * fact skill — a random fun fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "random fact", "fun fact".
 */
export function isFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:fun\s+)?fact|(?:another|a|random|fun)\s+fact|fact(?:\s+please)?|give\s+me\s+a\s+fact|random\s+fun\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'fact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>A fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “another fact” for one more</div>'
      + '<div class="src">Source: <a href="https://uselessfacts.jsph.pl/" target="_blank" rel="noopener">uselessfacts</a></div>';
    return 'fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A fact</h2><p>The fact service didn\'t answer, so here is mine: Honey never spoils.</p>';
    return 'fact';
  }
}

export default {
  name: 'fact',
  examples: ['tell me a fact', 'random fact', 'fun fact', 'another fact'],
  nearMisses: ['what is a fact', 'scientific facts', 'fact check'],
  match(lower, text) { return isFact(text); },
  run,
  suite() {
    const ok = isFact('tell me a fact') && isFact('random fact') && !isFact('fact check');
    return { ok, got: 'match works' };
  }
};
