/**
 * coin skill — flip a coin. "flip a coin", "heads or tails", "toss a coin".
 * Empty surface stays empty. Pure match; run shows heads or tails on a card.
 */
export function coinOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:flip|toss|throw)\s+(?:a\s+|the\s+)?coin(?:\s+please)?$/.test(t)) return true;
  if (/^(?:heads\s+or\s+tails|coin\s+flip)$/.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!coinOf(text)) return 'none';
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin</h2><div class="sub">a fair flip</div><p style="font-size:32px;font-weight:600;margin:12px 0">' + esc(side) + '</p>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'toss a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['coin', 'what is a coin', 'flip a table', 'heads'],
  match(lower, text) { return coinOf(text || lower); },
  run,
  suite() {
    return { ok: coinOf('flip a coin') === true && coinOf('hello') === false };
  },
};
