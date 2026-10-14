/**
 * quote skill — a short inspirational quote (no key; local list)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random quote", "inspirational quote", "quote of the day", "give me a quote".
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['In the middle of difficulty lies opportunity.', 'Albert Einstein'],
  ['It always seems impossible until it\'s done.', 'Nelson Mandela'],
  ['Be the change that you wish to see in the world.', 'Mahatma Gandhi'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['You miss 100% of the shots you don\'t take.', 'Wayne Gretzky'],
  ['Life is what happens when you\'re busy making other plans.', 'John Lennon'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb']
];
export function isQuote(text) {
  return /^(?:please\s+)?(?:give\s+me\s+|show\s+me\s+|tell\s+me\s+)?(?:a\s+|another\s+)?(?:random\s+|inspirational\s+|motivational\s+)?quote(?:\s+of\s+the\s+day)?(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function pick(rnd = Math.random) {
  return QUOTES[Math.floor(rnd() * QUOTES.length)];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const [q, by] = pick();
  showPage((p) => {
    p.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">“' + esc(q) + '”</p><div class="sub">— ' + esc(by) + '</div><div class="sub">say “another quote” for one more</div>';
  });
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['random quote', 'inspirational quote', 'give me a quote', 'quote of the day'],
  nearMisses: ['what is a quote', 'define quote', 'stock quote', 'price quote'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    const matched = isQuote('random quote') && isQuote('inspirational quote') && !isQuote('stock quote');
    const [q] = pick(() => 0);
    return { ok: matched && q === QUOTES[0][0], got: matched ? q.slice(0, 20) : 'match failed' };
  }
};
