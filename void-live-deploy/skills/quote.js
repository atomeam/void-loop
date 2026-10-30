/**
 * quote skill — a random quote from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a quote", "random quote", "inspirational quote".
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:(?:tell|give|show)\s+(?:me\s+)?(?:a|an|another|one\s+more|some)\s+|(?:another|a|an|some)\s+)?(?:(?:inspirational|motivational|inspiring|uplifting|famous|wise|random|good)\s+)?quotes?(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.quotable.io/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    if (!j || !j.content) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">"' + esc(j.content) + '"</p><p style="font-size:16px">— ' + esc(j.author || 'Unknown') + '</p><div class="sub">say “another quote” for one more</div>'
      + '<div class="src">Source: <a href="https://quotable.io/" target="_blank" rel="noopener">quotable.io</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p style="font-style:italic">"The only way to do great work is to love what you do."</p><p>— Steve Jobs</p>';
    return 'quote';
  }
}

export default {
  name: 'quote',
  examples: ['tell me a quote', 'random quote', 'inspirational quote', 'another quote'],
  nearMisses: ['what is a quote', 'stock quotes', 'quote of the day news'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    const ok = isQuote('tell me a quote') && isQuote('random quote') && !isQuote('stock quotes');
    return { ok, got: 'match works' };
  }
};
