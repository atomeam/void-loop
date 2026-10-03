/**
 * dice skill — flip a coin or roll dice in the browser
 * Nothing is sent. The surface stays empty until the ask.
 * "flip a coin", "roll a die", "roll 2d6".
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:flip|toss)\s+(?:a\s+)?coin$/i.test(t)) return { kind: 'coin' };
  if (/^(?:please\s+)?roll\s+(?:a\s+)?(?:die|dice)$/i.test(t)) return { kind: 'die', n: 1, sides: 6 };
  const m = t.match(/^(?:please\s+)?roll\s+(\d{1,2})d(\d{1,3})$/i);
  if (!m) return null;
  const n = Math.min(12, Math.max(1, +m[1]));
  const sides = Math.min(100, Math.max(2, +m[2]));
  return { kind: 'die', n, sides };
}

export function rollDice(hit, rand = Math.random) {
  if (!hit) return null;
  const r = typeof rand === 'function' ? rand : Math.random;
  if (hit.kind === 'coin') return { label: 'Coin', value: r() < 0.5 ? 'heads' : 'tails' };
  const rolls = Array.from({ length: hit.n }, () => 1 + Math.floor(r() * hit.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  return { label: hit.n + 'd' + hit.sides, value: rolls.join(' + '), total };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = diceOf(text);
  if (!hit) return 'none';
  const rolled = rollDice(hit);
  const title = hit.kind === 'coin' ? 'Coin' : 'Dice';
  const line = hit.kind === 'coin' ? rolled.value : rolled.value + (hit.n > 1 ? ' = ' + rolled.total : '');
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2><div class="util-out" style="font-size:44px;font-weight:300;line-height:1.15;margin:8px 0">' + esc(line) + '</div>'
      + '<div class="src">Rolled in this browser. Nothing was sent.</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['flip a coin', 'toss a coin', 'roll a die', 'roll 2d6', 'please roll a die'],
  nearMisses: ['what is a coin', 'dice history', 'make a clock'],
  diceOf,
  rollDice,
  match(lower, text) { return !!diceOf(text); },
  run
};
