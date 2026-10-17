/**
 * flip skill: coin flip for yes/no or heads/tails.
 * "flip a coin", "heads or tails", "coin flip", "yes or no".
 * Pure; card shows result and reflip. Empty surface stays empty.
 */
export function flipOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:flip|toss)\s+(?:a\s+)?(?:coin|heads?\s+or\s+tails?)|(?:heads?\s+or\s+tails?)|(?:yes\s+or\s+no)|coin\s+flip)(?:\s+please)?$/.test(t) ? true : null;
}

function toss() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!flipOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Coin flip</h2><p>Flipping…</p>'; });
  if (!el) return 'flip';
  const side = toss();
  el.innerHTML = '<h2>Coin flip</h2><div style="font-size:32px;margin:16px 0;text-transform:capitalize">' + esc(side) + '</div><button class="flip-again" type="button">Flip again</button><p class="src">Flipped in this browser. Nothing is stored or sent.</p>';
  const btn = el.querySelector('.flip-again');
  if (btn) btn.addEventListener('click', () => {
    el.querySelector('div').textContent = toss();
  });
  return 'flip';
}

export default {
  name: 'flip',
  examples: ['flip a coin', 'heads or tails', 'coin flip', 'yes or no'],
  nearMisses: ['flip the page', 'what is a coin', 'toss the salad', 'yes please'],
  match(lower, text) { return !!flipOf(text || lower); },
  run,
  suite() {
    return { ok: flipOf('flip a coin') === true && flipOf('hello') === null };
  },
};
