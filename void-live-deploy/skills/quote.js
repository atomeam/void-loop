/**
 * quote skill — an inspirational or random quote with attribution (new idea to grow Void).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "quote of the day", "give me a quote", "inspirational quote", "random quote".
 * Fetches from a public no-key API; falls back to a built-in if the network fails. Empty surface stays empty.
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:give|show|tell)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:inspirational\s+|random\s+|daily\s+)?quote|(?:quote|inspirational quote|quote of the day|random quote)(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const FALLBACKS = [
  { content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { content: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { content: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' }
];

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isQuote(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  let q = null;
  try {
    const r = await fetch('https://api.quotable.io/random');
    if (r.ok) {
      const j = await r.json();
      if (j && j.content) q = { content: j.content, author: j.author || 'Unknown' };
    }
  } catch (_) {}
  if (!q) q = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  if (!api._pageStill(el)) return 'quote';
  el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">“' + esc(q.content) + '”</p><div class="sub">— ' + esc(q.author) + '</div><div class="src">Source: quotable.io or built-in</div>';
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['quote of the day', 'give me a quote', 'inspirational quote', 'random quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote a price', 'define quote'],
  match(lower, text) { return isQuote(text || lower); },
  run,
  suite() {
    return { ok: isQuote('give me a quote') && isQuote('quote of the day') && !isQuote('what is a quote') && !isQuote('stock quote for AAPL') };
  },
};
