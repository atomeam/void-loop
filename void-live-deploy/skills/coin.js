/**
 * coin skill — flip a coin, heads or tails (no key; pure random)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "flip a coin", "heads or tails", "toss a coin".
 * Empty stage stays empty: only shows a page on a matching ask.
 */
export function isCoin(text) {
  return /^(?:(?:flip|toss|throw)\s+(?:a\s+|the\s+)?coin|heads\s+or\s+tails|coin\s+flip|flip\s+it)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  if (!isCoin(text)) return 'none';
  const { showPage, esc } = api;
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:8px 0;text-align:center">' + esc(side) + '</div>'
      + '<div class="sub">say “flip a coin” again for another</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'toss a coin'],
  nearMisses: ['what is a coin', 'bitcoin price', 'flip the script'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    const ok = isCoin('flip a coin') && !isCoin('what is a coin');
    return { ok, got: ok ? undefined : 'matcher failed' };
  }
};
