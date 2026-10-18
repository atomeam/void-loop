/**
 * quote skill — a random inspirational quote from zenquotes (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a quote", "inspire me", "random quote".
 * Empty surface stays empty.
 */
export function isQuote(text) {
  return /^(?:give\s+me\s+(?:a\s+)?(?:random\s+)?quote|inspire\s+me|random\s+quote|quote\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://zenquotes.io/api/random').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    const q = Array.isArray(j) && j[0] ? j[0] : null;
    if (!q || !q.q) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">“' + esc(q.q) + '”</p><div class="sub">— ' + esc(q.a || '') + '</div>'
      + '<div class="src">Source: <a href="https://zenquotes.io/" target="_blank" rel="noopener">zenquotes</a> (no key)</div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service did not answer just now. Here is one: The only way to do great work is to love what you do. — Steve Jobs</p>';
    return 'quote';
  }
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'inspire me', 'random quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote of the day history', 'how to quote someone'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    return { ok: isQuote('give me a quote') && isQuote('inspire me') && !isQuote('hello') };
  },
};
