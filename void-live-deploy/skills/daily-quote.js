/**
 * daily-quote skill — summons a short inspirational quote card on the stage (new growth idea).
 * "daily quote", "inspirational quote", "quote of the day", "show me a quote".
 * A small set of public-domain style quotes, client-side, nothing fetched. Empty surface stays empty.
 */
const QUOTES = [
  { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
  { q: 'In the middle of difficulty lies opportunity.', a: 'Albert Einstein' },
  { q: 'What you do today can improve all your tomorrows.', a: 'Ralph Marston' },
  { q: 'The future belongs to those who believe in the beauty of their dreams.', a: 'Eleanor Roosevelt' },
  { q: 'Do what you can, with what you have, where you are.', a: 'Theodore Roosevelt' },
];

export function wantsQuote(lower) {
  const t = String(lower || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give|get)\s+(?:me\s+)?)?(?:a\s+|the\s+)?(?:daily\s+|inspirational\s+|motivational\s+)?quote(?:\s+of\s+the\s+day)?$/.test(t);
}

function pick() {
  const i = Math.floor(Date.now() / 864e5) % QUOTES.length;
  return QUOTES[i];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = pick();
  showPage((el) => {
    el.innerHTML = '<h2>Daily quote</h2>'
      + '<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #7a5cff;font-size:18px;line-height:1.4">' + esc(q.q) + '</blockquote>'
      + '<div class="sub" style="text-align:right">— ' + esc(q.a) + '</div>'
      + '<p class="src">A short quote for the day. Nothing sent anywhere.</p>';
  });
  return 'daily-quote';
}

export default {
  name: 'daily-quote',
  examples: ['daily quote', 'inspirational quote', 'quote of the day', 'show me a quote'],
  nearMisses: ['what is a quote', 'quote me a price', 'stock quote'],
  match(lower) { return wantsQuote(lower); },
  run,
  suite() {
    return { ok: wantsQuote('daily quote') && wantsQuote('quote of the day') && !wantsQuote('hello') && pick().q.length > 10 };
  },
};
