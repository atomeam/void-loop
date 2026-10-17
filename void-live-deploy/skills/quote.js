/**
 * quote skill — a random inspirational quote from quotable.io (no key)
 * "inspire me", "quote of the day", "give me a quote", "tell me something inspiring".
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:inspire|motivate)\s+me|(?:give|tell)\s+me\s+(?:a|another|an?\s+inspirational)\s+quote|(?:a|another)\s+quote|quote(?:\s+of\s+the\s+day)?|something\s+inspiring)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.quotable.io/random').then((r) => r.json());
    if (!api._pageStill(el)) return 'quote';
    if (!j || !j.content) throw 0;
    el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">“' + esc(j.content) + '”</p><div class="sub">— ' + esc(j.author || 'Unknown') + '</div><div class="src">Source: <a href="https://quotable.io/quotes/' + encodeURIComponent(j._id || '') + '" target="_blank" rel="noopener">quotable.io</a></div>';
    return 'quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A quote</h2><p>The quote service didn\'t answer, so here is one: The best way to predict the future is to create it. — Abraham Lincoln</p>';
    return 'quote';
  }
}

export default {
  name: 'quote',
  examples: ['inspire me', 'quote of the day', 'give me a quote', 'tell me something inspiring'],
  nearMisses: ['what is a quote', 'stock quote', 'price quote'],
  match(lower, text) { return isQuote(text); },
  run
};
