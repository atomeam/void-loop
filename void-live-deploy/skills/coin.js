/**
 * coin skill — flip a coin: "flip a coin", "heads or tails".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty.
 */
export function coinOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:flip(?:\s+a)?\s+coin|heads\s+or\s+tails|toss\s+(?:a\s+)?coin)$/i.test(t) ? true : null;
}

async function run(text, api) {
  const { showPage } = api;
  if (!coinOf(text)) return 'none';
  const side = Math.random() < 0.5 ? 'heads' : 'tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><div class="sub">It landed on <b>' + side + '</b>.</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'toss a coin'],
  nearMisses: ['coin collection', 'flip the table', 'what is a coin'],
  match(lower, text) { return !!coinOf(text); },
  run,
  suite() {
    return { ok: coinOf('flip a coin') === true && coinOf('hello') === null };
  },
};
