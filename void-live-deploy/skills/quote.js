/**
 * quote skill — a short inspirational or random quote.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a quote", "inspirational quote", "random quote", "say a quote".
 * Uses the free Quotable API (no key). Empty surface stays empty.
 */
export function quoteOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:give|tell|show|say)\s+(?:me\s+)?(?:an?\s+)?(?:inspirational|random|short|nice|good)?\s*quotes?|inspirational\s+quotes?|random\s+quotes?|a\s+quotes?|quotes?\s+please)$/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!quoteOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const r = await fetch('https://api.quotable.io/random');
    if (!api._pageStill(el)) return 'quote';
    const j = await r.json();
    if (!j || !j.content) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">“' + esc(j.content) + '”</p>'
      + '<div class="sub">— ' + esc(j.author || 'Unknown') + '</div>'
      + '<div class="src">Source: <a href="https://quotable.io" target="_blank" rel="noopener">Quotable</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service did not answer just now. Try again in a minute.</p>';
    return 'none';
  }
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'inspirational quote', 'random quote', 'say a quote'],
  nearMisses: ['what is a quote', 'quote of the day app', 'stock quote'],
  match(lower, text) { return quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf('give me a quote') && quoteOf('inspirational quote') && !quoteOf('what is a quote') && !quoteOf('hello') };
  },
};
