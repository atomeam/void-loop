/**
 * daily-quote skill — quote of the day on a card.
 * Contract: { name, examples, nearMisses, match, run, suite }
 * "quote of the day", "daily quote", "inspirational quote".
 * Fetches from zenquotes.io (free, no key). Empty surface stays empty.
 */
export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give|get)\s+(?:me\s+)?)?(?:the\s+)?(?:quote of the day|daily quote|inspirational quote|today'?s quote)$/.test(t);
}

async function run(text, api) {
  if (!quoteOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Quote of the day</h2><div class="sub">looking up…</div>'; });
  try {
    const r = await fetch('https://zenquotes.io/api/today');
    if (!api._pageStill(el)) return 'daily-quote';
    const data = await r.json();
    const q = data[0] || {};
    el.innerHTML = '<h2>Quote of the day</h2><blockquote style="font-size:1.2em;margin:16px 0;padding:12px;border-left:3px solid #7a5cff">' + esc(q.q || 'No quote today') + '</blockquote>'
      + '<div class="sub">— ' + esc(q.a || 'Unknown') + '</div>'
      + '<div class="src">Source: <a href="https://zenquotes.io" target="_blank" rel="noopener">zenquotes.io</a> (free API)</div>';
    return 'daily-quote';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Quote of the day</h2><p>The quote service did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'daily-quote',
  examples: ['quote of the day', 'daily quote', 'inspirational quote', 'today\'s quote'],
  nearMisses: ['what is a quote', 'movie quote', 'how do I quote someone'],
  match(lower, text) { return quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf('quote of the day') && !quoteOf('hello') };
  },
};
