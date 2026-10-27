/**
 * dice skill — roll dice, fair from the device's crypto random
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice roll".
 */
export function isDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+|me\s+)?(?:die|dice)(?:\s+(?:roll)?)?|dice(?:\s+roll)?|roll\s+\d+d\d+|roll\s+(?:a\s+)?\d+\s*(?:sided\s+)?die)$/.test(t);
}

function rollDie(sides = 6) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return 1 + (a[0] % sides);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let n = 1, sides = 6;
  const m = /(\d+)\s*d\s*(\d+)/.exec(t) || /roll\s+(\d+)\s*(?:sided\s+)?die/.exec(t);
  if (m) {
    n = Math.min(20, Math.max(1, +m[1] || 1));
    sides = Math.min(100, Math.max(2, +m[2] || 6));
  } else if (/2\s*dice|two\s*dice|pair\s*of\s*dice/.test(t)) {
    n = 2;
  }
  const rolls = Array.from({ length: n }, () => rollDie(sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300;text-align:center">' + rolls.map(esc).join(' · ') + '</p>'
      + (n > 1 ? '<div class="sub" style="text-align:center">Total: ' + total + '</div>' : '')
      + '<div class="sub">say “roll again” or “roll 2d6”</div>'
      + '<div class="src">Fair rolls from this device’s secure random numbers.</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll a 20 sided die'],
  nearMisses: ['what is a die', 'dice game rules', 'how many sides'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
