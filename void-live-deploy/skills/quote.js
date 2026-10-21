/**
 * quote skill — a short random quote from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a quote", "random quote", "inspire me".
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:give|tell|show)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?quote|random\s+quote|inspire\s+me|motivational\s+quote)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.quotable.io/random?maxLength=140').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    if (!j || !j.content) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.content) + '</p><div class="sub">' + esc(j.author || 'Unknown') + '</div><div class="src">Source: <a href="https://quotable.io" target="_blank" rel="noopener">quotable.io</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service didn\'t answer, so here is one: The only way to do great work is to love what you do. — Steve Jobs</p>';
    return 'quote';
  }
}

export function suite() {
  const ok = isQuote('give me a quote') && isQuote('random quote') && !isQuote('what is a quote');
  return { ok, got: ok ? 'match works' : 'match failed' };
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'random quote', 'inspire me', 'motivational quote'],
  nearMisses: ['what is a quote', 'who said that', 'explain this quote'],
  match(lower, text) { return isQuote(text || lower); },
  run,
  suite,
};
