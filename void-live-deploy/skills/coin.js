/**
 * coin skill — flip a coin: "flip a coin", "heads or tails", "coin flip".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty.
 */
export function isCoin(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:please\s+)?(?:flip|toss)\s+(?:a\s+|the\s+)?coin|coin\s+flip|heads\s+or\s+tails)$/.test(t);
}
async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:32px;font-weight:300">' + esc(side) + '</p><div class="sub">say “flip a coin” for another</div>';
  });
  return 'coin';
}
export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin flip', 'toss a coin'],
  nearMisses: ['coin collection', 'what is a coin', 'bitcoin'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    return { ok: isCoin('flip a coin') && !isCoin('hello world') };
  },
};
