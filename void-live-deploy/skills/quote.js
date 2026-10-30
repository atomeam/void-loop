/**
 * quote skill: a quote Wikiquote's editors chose, from its quote of the day for a random past day (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a quote", "random quote", "inspirational quote".
 */
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:(?:tell|give|show)\s+(?:me\s+)?(?:a|an|another|one\s+more|some)\s+|(?:another|a|an|some)\s+)?(?:(?:inspirational|motivational|inspiring|uplifting|famous|wise|random|good)\s+)?quotes?(?:\s+about\s+.+)?(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

// Wikiquote's quote of the day for a random past day (2026-10-30: api.quotable.io stopped answering, so every ask on a-to-mind.com
// showed the same fixed line with no source). Wikiquote's editors chose and attributed each one; the card links the day's page.
const WQ = 'https://en.wikiquote.org/w/api.php?format=json&formatversion=2&origin=*&action=parse&prop=text&page=';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** a random day from 2008-01-01 (the first day Wikiquote has a page for) to yesterday (UTC), as Wikiquote names its page: "Quote of the day/March 3, 2011". Pure. */
export function qotdTitle(rand = Math.random, now = Date.now()) {
  const a = Date.UTC(2008, 0, 1), b = now - 864e5, d = new Date(a + Math.floor(rand() * Math.max(1, b - a)));
  return 'Wikiquote:Quote of the day/' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
}
const ent = (x) => String(x).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d{1,6});/g, (_, n) => (+n <= 0x10ffff ? String.fromCodePoint(+n) : ''))
  .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => (parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : '')).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** a quote-of-the-day page's HTML -> { quote, author } | null: the author is the "~ Name ~" line, the quote the text just above it. Pure. */
export function qotdFrom(html) {
  const lines = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|td|tr|div|li|dd|dl|table)>/gi, '\n').replace(/<[^>]*>/g, '').split('\n').map((l) => ent(l).replace(/\s+/g, ' ').trim());
  const at = lines.findIndex((l) => /^~\s*\S.*~$/.test(l));
  if (at < 1) return null;
  const author = lines[at].replace(/^~\s*|\s*~$/g, '').trim(), q = [];
  let i = at - 1; while (i >= 0 && !lines[i]) i--; // the cell or row break between the quote and its author
  for (; i >= 0 && lines[i]; i--) q.unshift(lines[i]);
  let quote = q.join(' ').trim();
  if (quote.length > 700) { const cut = quote.indexOf('. ', 500); if (cut < 0) return null; quote = quote.slice(0, cut + 1); } // whole sentences, never a cut word
  return quote.length >= 8 && author && author.length <= 120 ? { quote, author } : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  let got = null, title = '';
  for (let i = 0; i < 3 && !got; i++) { // a day with no page, or a page in another shape, is skipped for another day
    title = qotdTitle();
    try { const r = await fetch(WQ + encodeURIComponent(title)); if (r.ok) { const j = await r.json(); got = qotdFrom(j && j.parse && j.parse.text); } } catch (_) {} // void-review: ok (a retry that stops at the first quote, not one request per item)
  }
  if (!api._pageStill(el)) return got ? 'quote' : 'none';
  if (!got) {
    el.innerHTML = '<h2>A quote</h2><p>Wikiquote didn\'t answer just now, so I have no quote to show. Ask again in a moment.</p>';
    return 'none';
  }
  const page = 'https://en.wikiquote.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',');
  el.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">“' + esc(got.quote) + '”</p><p style="font-size:16px">' + esc(got.author) + '</p><div class="sub">say “another quote” for one more</div>'
    + '<div class="src">Source: <a href="' + esc(page) + '" target="_blank" rel="noopener">Wikiquote, ' + esc(title.split('/')[1]) + '</a></div>';
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['tell me a quote', 'random quote', 'inspirational quote', 'another quote', 'quote about perseverance'],
  nearMisses: ['what is a quote', 'stock quotes', 'quote of the day news'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    const ok = isQuote('tell me a quote') && isQuote('random quote') && !isQuote('stock quotes');
    return { ok, got: 'match works' };
  }
};
