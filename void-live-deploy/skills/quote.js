/**
 * quote skill — an inspirational quote (ZenQuotes, no key)
 * "tell me a quote", "quote of the day", "inspire me", "random quote".
 * Attribution required for the free API.
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)?\s*(?:inspirational\s+|motivational\s+)?quote|(?:a|another)\s+quote|quote(?:\s+of\s+the\s+day)?|inspire\s+me|motivational\s+quote|random\s+quote)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://zenquotes.io/api/random').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    const q = Array.isArray(j) && j[0];
    if (!q || !q.q) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">“' + esc(q.q) + '”</p><div class="sub">— ' + esc(q.a || 'Unknown') + '</div>'
      + '<div class="src">Inspirational quotes provided by <a href="https://zenquotes.io/" target="_blank" rel="noopener">ZenQuotes API</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service didn\'t answer, so here is one: The only way to do great work is to love what you do. — Steve Jobs</p>';
    return 'quote';
  }
}

export default {
  name: 'quote',
  examples: ['tell me a quote', 'quote of the day', 'inspire me', 'random quote', 'give me a motivational quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote from the movie', 'price quote'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    return { ok: isQuote('tell me a quote') && isQuote('inspire me') && !isQuote('what is a quote') && !isQuote('stock quote') };
  },
};
