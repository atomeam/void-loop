/**
 * quote skill — a short daily quote that stays on the stage.
 * "quote of the day", "give me a quote", "inspire me".
 * A small fixed set so it needs no network and stays empty-surface clean.
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Stay hungry, stay foolish.', 'Steve Jobs'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['It always seems impossible until it\'s done.', 'Nelson Mandela'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb'],
  ['Everything you can imagine is real.', 'Pablo Picasso'],
  ['What we think, we become.', 'Buddha'],
];

export function isQuote(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:give|show|tell)\s+me\s+)?(?:a\s+)?(?:quote(?:\s+of\s+the\s+day)?|daily\s+quote|inspire\s+me|something\s+inspiring)$/.test(t);
}

function run(text, api) {
  if (!isQuote(text)) return 'none';
  const [q, by] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>A quote</h2><p style="font-size:20px;line-height:1.4;font-weight:300">' + esc(q) + '</p><div class="sub">— ' + esc(by) + '</div>'
      + '<div class="sub">say "quote of the day" for another</div>';
  });
  return 'quote';
}

export function suite() {
  if (!isQuote('quote of the day')) return { ok: false, got: 'no match' };
  if (isQuote('what is a quote')) return { ok: false, got: 'false positive' };
  return { ok: true, got: 'matches' };
}

export default {
  name: 'quote',
  examples: ['quote of the day', 'give me a quote', 'inspire me', 'daily quote'],
  nearMisses: ['what is a quote', 'stock quotes', 'quote this book'],
  match(lower, text) { return isQuote(text || lower); },
  run,
  suite,
};
