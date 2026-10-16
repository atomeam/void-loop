/**
 * quote skill — a random inspirational quote (quotable API, no key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a quote", "inspirational quote", "quote of the day".
 * Empty surface stays empty.
 */
export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:inspirational\s+|motivational\s+|random\s+)?quote|(?:a|another|random|inspirational)\s+quote|quote(?:\s+please)?|quote\s+of\s+the\s+day)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!quoteOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.quotable.io/random').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    const quote = j && j.content ? j.content : 'The service did not return a quote just now.';
    const author = j && j.author ? j.author : '';
    el.innerHTML = '<h2>A quote</h2><p style="font-size:20px;line-height:1.45;font-weight:300;font-style:italic">' + esc(quote) + '</p>'
      + (author ? '<div class="sub">— ' + esc(author) + '</div>' : '')
      + '<div class="sub">say “another quote” for one more</div>'
      + '<div class="src">Source: <a href="https://quotable.io/" target="_blank" rel="noopener">quotable</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service did not answer just now. Try again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'quote',
  examples: ['tell me a quote', 'inspirational quote', 'quote of the day', 'another quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote me'],
  match(lower, text) { return quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf('tell me a quote') && !quoteOf('hello') };
  },
};
