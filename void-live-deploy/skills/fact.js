/**
 * fact skill — a random interesting fact (uselessfacts API, no key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "random fact", "interesting fact".
 * Empty surface stays empty.
 */
export function factOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:interesting\s+|random\s+)?fact|(?:a|another|random)\s+fact|interesting\s+fact|fact(?:\s+please)?)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!factOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>A fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en').then((r) => r.json());
    if (!api._pageStill(el)) return 'fact';
    const fact = j && j.text ? j.text : 'The service did not return a fact just now.';
    el.innerHTML = '<h2>A fact</h2><p style="font-size:20px;line-height:1.45;font-weight:300">' + esc(fact) + '</p>'
      + '<div class="sub">say “another fact” for one more</div>'
      + '<div class="src">Source: <a href="https://uselessfacts.jsph.pl/" target="_blank" rel="noopener">uselessfacts</a></div>';
    return 'fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A fact</h2><p>The fact service did not answer just now. Try again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'fact',
  examples: ['tell me a fact', 'random fact', 'interesting fact', 'another fact'],
  nearMisses: ['what is a fact', 'fact check', 'the fact is'],
  match(lower, text) { return factOf(text); },
  run,
  suite() {
    return { ok: factOf('tell me a fact') && !factOf('hello') };
  },
};
