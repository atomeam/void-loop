/**
 * quote skill: a quote from Wikiquote, from its page on the theme asked for, or its quote of the day for a random past day (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a quote", "random quote", "inspirational quote".
 */
export function isQuote(text) {
  return isDayQuote(text) || /^(?:please\s+)?(?:(?:(?:tell|give|show)\s+(?:me\s+)?(?:a|an|another|one\s+more|some)\s+|(?:another|a|an|some)\s+)?(?:(?:inspirational|motivational|inspiring|uplifting|famous|wise|random|good)\s+)?quotes?(?:\s+about\s+.+)?(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

// "quote of the day", "what's today's quote": the page Wikiquote's editors made for today (2026-10-30: these asks fell to an article)
export function isDayQuote(text) {
  return /^(?:please\s+)?(?:(?:what'?s|what\s+is|tell\s+me|give\s+me|show\s+me)\s+)?(?:the\s+|a\s+)?(?:quote\s+of\s+the\s+day|today'?s\s+quote|daily\s+quote)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
/** the quote-of-the-day page for a date, as Wikiquote names it: "Wikiquote:Quote of the day/October 30, 2026". local = the asker's own day. Pure. */
export function dayTitle(d, local = true) {
  const m = local ? d.getMonth() : d.getUTCMonth(), day = local ? d.getDate() : d.getUTCDate(), y = local ? d.getFullYear() : d.getUTCFullYear();
  return 'Wikiquote:Quote of the day/' + MONTHS[m] + ' ' + day + ', ' + y;
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
  const cq = cquoteFrom(html); if (cq) return cq;
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

// the shape Wikiquote's pages have had since 2026 (October 30, 2026): a Cquote table, the quote in its widest cell, the author in <cite>—Name</cite>
function cquoteFrom(html) {
  const h = String(html || ''), at = h.indexOf('class="cquote"'); if (at < 0) return null;
  const tab = h.slice(at), cite = tab.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i); if (!cite) return null;
  const text = (x) => ent(x.replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  const author = text(cite[1]).replace(/^[\u2014\u2013-]+\s*/, '').trim();
  let quote = ''; for (const m of tab.slice(0, tab.indexOf(cite[0])).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) { const t = text(m[1]); if (t.length > quote.length) quote = t; }
  if (quote.length > 700) { const cut = quote.indexOf('. ', 500); if (cut < 0) return null; quote = quote.slice(0, cut + 1); }
  return quote.length >= 8 && author && author.length <= 120 ? { quote, author } : null;
}

// "motivational quote", "quote about courage": a quote from Wikiquote's page on that theme, so the ask gets what it named.
const SECT = 'https://en.wikiquote.org/w/api.php?format=json&formatversion=2&origin=*&action=parse&redirects=1&prop=sections&page=';
const HEART = ['Perseverance', 'Courage']; // the theme pages for "motivational", "inspirational", "uplifting" (2026-10-30: Effort gave complaints, not lifts)
/** the Wikiquote page an ask names: "quote about X" -> "X", a motivational ask -> a HEART page, anything else -> null. Pure. */
export function themeOf(text, rand = Math.random) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const about = t.match(/\bquotes?\s+about\s+(.+?)(?:\s+please)?$/i);
  if (about) { const w = about[1].replace(/^(?:the|a|an)\s+/i, '').trim(); return w && w.length <= 40 ? w.charAt(0).toUpperCase() + w.slice(1) : null; }
  return /\b(?:inspirational|motivational|inspiring|uplifting)\b/i.test(t) ? HEART[Math.floor(rand() * HEART.length)] : null;
}
const SKIP = /^(?:see also|external links|references|notes|sources|further reading|bibliography|disputed|misattributed|misattributions|about|quotes about .*)$/i;
/** a theme page's sections -> one top-level section of quotes, never "Misattributed", "Disputed" or "See also"; null = the page has none. Pure. */
export function pickSection(sections, rand = Math.random) {
  const ok = (Array.isArray(sections) ? sections : []).filter((x) => String(x.level) === '2' && !SKIP.test(String(x.line || '').replace(/<[^>]*>/g, '').trim()));
  return ok.length ? ok[Math.floor(rand() * ok.length)] : null;
}
const plain = (h) => ent(String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
/** a theme page's HTML -> [{ quote, author }]: each quote is a list item, its author the start of the item nested under it. Pure. */
export function themeQuotes(html) {
  const s = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '');
  const out = [];
  for (const m of s.matchAll(/<li(?:\s[^>]*)?>((?:(?!<\/?(?:li|ul)\b)[\s\S])+?)<ul>\s*<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)) {
    const quote = plain(m[1]), author = plain(m[2]).split(',')[0].trim();
    if (quote.length >= 15 && quote.length <= 400 && author && author.length <= 60 && !/[:;]/.test(author)) out.push({ quote, author });
  }
  return out;
}
const pageUrl = (title, anchor) => 'https://en.wikiquote.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',') + (anchor ? '#' + encodeURIComponent(anchor) : '');
async function json(u, get = fetch) { const r = await get(u); if (!r.ok) throw new Error('wikiquote ' + r.status); return r.json(); }
async function fromTheme(name, rand = Math.random, get = fetch) {
  try {
    const p = (await json(SECT + encodeURIComponent(name), get)).parse;
    if (!p || !p.title) return null;
    for (let i = 0; i < 2; i++) { // a section can hold no quote in the usual shape; one more try, then the quote of the day
      const sec = pickSection(p.sections, rand), j = await json(WQ + encodeURIComponent(p.title) + (sec ? '&section=' + encodeURIComponent(sec.index) : ''), get); // void-review: ok (at most 2 tries, stops at the first quote)
      const list = themeQuotes(j && j.parse && j.parse.text);
      if (list.length) return { ...list[Math.floor(rand() * list.length)], page: pageUrl(p.title, sec && sec.anchor), label: 'Wikiquote, ' + p.title };
      if (!sec) break;
    }
  } catch (_) {}
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api, get = api.fetch || fetch; // api.fetch: the server's run for an MCP client names itself to Wikiquote (lib/mcp-run.js)
  const el = showPage((p) => { p.innerHTML = '<h2>A quote</h2><div class="sub">…</div>'; });
  const theme = themeOf(text), today = isDayQuote(text);
  let got = theme ? await fromTheme(theme, Math.random, get) : null;
  if (today) for (const title of [...new Set([dayTitle(new Date()), dayTitle(new Date(), false)])]) { // the asker's day, then Wikiquote's own (UTC) day
    if (got) break;
    try { const r = await get(WQ + encodeURIComponent(title)); if (r.ok) { const j = await r.json(); const q = qotdFrom(j && j.parse && j.parse.text); if (q) got = { ...q, page: pageUrl(title), label: 'Wikiquote, quote of the day for ' + title.split('/')[1], today: true }; } } catch (_) {} // void-review: ok (at most 2 tries, stops at the first quote)
  }
  for (let i = 0; i < 3 && !got; i++) { // a day with no page, or a page in another shape, is skipped for another day
    const title = qotdTitle();
    try { const r = await get(WQ + encodeURIComponent(title)); if (r.ok) { const j = await r.json(); const q = qotdFrom(j && j.parse && j.parse.text); if (q) got = { ...q, page: pageUrl(title), label: 'Wikiquote, ' + title.split('/')[1], day: true }; } } catch (_) {} // void-review: ok (a retry that stops at the first quote, not one request per item)
  }
  if (!api._pageStill(el)) return got ? 'quote' : 'none';
  if (!got) {
    el.innerHTML = '<h2>A quote</h2><p>Wikiquote didn\'t answer just now, so I have no quote to show. Ask again in a moment.</p>';
    return 'none';
  }
  let note = theme && got.day && /\babout\b/i.test(text) ? '<div class="sub">Wikiquote has no quotes page on “' + esc(theme) + '”, so this is its quote of the day.</div>' : '';
  if (today && !got.today) note = '<div class="sub">Wikiquote has no quote of the day for today, so this is one from another day.</div>';
  el.innerHTML = '<h2>' + (got.today ? 'Quote of the day' : 'A quote') + '</h2>' + note + '<p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">“' + esc(got.quote) + '”</p><p style="font-size:16px">' + esc(got.author) + '</p><div class="sub">say “another quote” for one more</div>'
    + '<div class="src">Source: <a href="' + esc(got.page) + '" target="_blank" rel="noopener">' + esc(got.label) + '</a></div>';
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['tell me a quote', 'random quote', 'inspirational quote', 'another quote', 'quote about perseverance', 'quote of the day', "what's today's quote"],
  nearMisses: ['what is a quote', 'stock quotes', 'quote of the day news'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    const ok = isQuote('tell me a quote') && isQuote('random quote') && !isQuote('stock quotes');
    return { ok, got: 'match works' };
  }
};
