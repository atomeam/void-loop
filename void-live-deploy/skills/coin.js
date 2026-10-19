/**
 * coin skill — flip a coin. "flip a coin", "heads or tails", "coin flip".
 * Pure client-side; nothing leaves the browser. Empty stage stays empty.
 */
export function isCoin(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails|flip\s+it)$/.test(t);
}

function flip() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

async function run(text, api) {
  if (!isCoin(text)) return 'none';
  const { showPage, esc } = api;
  const result = flip();
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:32px;line-height:1.4;font-weight:300">' + esc(result) + '</p><div class="sub">say “flip again” for another</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['what is a coin', 'coin collecting', 'flip the script'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    const ok = isCoin('flip a coin') && isCoin('heads or tails') && !isCoin('what is a coin') && (flip() === 'heads' || flip() === 'tails');
    return { ok, got: 'coin parse ok' };
  },
};
