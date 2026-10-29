/**
 * dice skill — roll dice or pick a random number in a range, pure client-side
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a dice", "roll 2d6", "random number between 1 and 100".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:dice|die|d\d+|\d+d\d+)|(?:random|pick\s+a)\s+number(?:\s+(?:between|from|to)\s+\d+\s+(?:and|to)\s+\d+)?|dice|die)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text).toLowerCase();
  let result = '';
  let label = 'Roll';
  const range = t.match(/(?:between|from|to)\s+(\d+)\s+(?:and|to)\s+(\d+)/);
  const dice = t.match(/(\d+)?d(\d+)/);
  if (range) {
    let a = parseInt(range[1], 10), b = parseInt(range[2], 10);
    if (a > b) [a, b] = [b, a];
    const n = a + Math.floor(Math.random() * (b - a + 1));
    result = String(n);
    label = 'Random number ' + a + ' to ' + b;
  } else if (dice) {
    const count = parseInt(dice[1] || '1', 10);
    const sides = parseInt(dice[2], 10);
    const rolls = Array.from({ length: Math.min(count, 20) }, () => roll(sides));
    const sum = rolls.reduce((s, r) => s + r, 0);
    result = rolls.join(' + ') + (count > 1 ? ' = ' + sum : '');
    label = count + 'd' + sides;
  } else {
    const n = roll(6);
    result = String(n);
    label = 'd6';
  }
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(label) + '</h2><p style="font-size:36px;font-weight:300;text-align:center">' + esc(result) + '</p><div class="sub">say “roll a dice” or “random number between 1 and 100”</div><div class="src">Rolled here on this device.</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a dice', 'roll 2d6', 'random number between 1 and 100', 'pick a number from 5 to 10', 'dice'],
  nearMisses: ['what is a dice', 'dice game', 'number theory'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a dice') && isDice('random number between 1 and 100') && !isDice('what is a dice');
    return { ok, got: 'match works' };
  }
};
