/**
 * quote skill — a short inspirational quote (quotable.io, no key)
 * "give me a quote", "inspire me", "random quote"
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:give\s+me\s+(?:a\s+|an\s+)?(?:random\s+)?quote|inspire\s+me|random\s+quote|quote\s+of\s+the\s+day|say\s+something\s+inspiring)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isQuote(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.quotable.io/random').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    if (!j || !j.content) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">“' + esc(j.content) + '”</p><div class="sub">— ' + esc(j.author || 'unknown') + '</div><div class="src">Source: <a href="https://quotable.io" target="_blank" rel="noopener">quotable.io</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service didn\'t answer, so here is mine: The best time to plant a tree was twenty years ago. The second best time is now.</p>';
    return 'quote';
  }
}

export function suite() {
  if (!isQuote('give me a quote')) return { ok: false, got: 'match' };
  if (isQuote('what is a quote')) return { ok: false, got: 'near' };
  return { ok: true };
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'inspire me', 'random quote'],
  nearMisses: ['what is a quote', 'define quote', 'who said that'],
  match(lower, text) { return isQuote(text); },
  run,
  suite
};
