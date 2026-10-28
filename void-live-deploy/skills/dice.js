/**
 * dice skill — roll dice, classic or NdM
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a dice", "roll 2d6", "d20", "roll 3d8 + 2".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:dice|die)|(?:roll\s+)?(\d*)d(\d+)(?:\s*\+\s*(\d+))?|d(\d+))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let m = t.match(/(\d*)d(\d+)(?:\s*\+\s*(\d+))?/i);
  if (m) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sides = parseInt(m[2], 10);
    const mod = m[3] ? parseInt(m[3], 10) : 0;
    return { n: Math.max(1, Math.min(n, 20)), sides: Math.max(2, Math.min(sides, 100)), mod };
  }
  m = t.match(/d(\d+)/i);
  if (m) return { n: 1, sides: parseInt(m[1], 10), mod: 0 };
  return { n: 1, sides: 6, mod: 0 };
}

function roll({ n, sides, mod }) {
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + mod;
  return { rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseDice(text);
  const { rolls, sum } = roll(spec);
  const label = spec.n + 'd' + spec.sides + (spec.mod ? '+' + spec.mod : '');
  showPage((el) => {
    el.innerHTML = '<h2>Dice roll</h2><p style="font-size:36px;font-weight:700;text-align:center;margin:8px 0">' + sum + '</p>'
      + '<div class="sub">' + esc(label) + ' · ' + rolls.join(' + ') + (spec.mod ? ' + ' + spec.mod : '') + '</div>'
      + '<div class="sub">say “roll again” or another dice ask for a new roll</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a dice', 'roll 2d6', 'd20', 'roll 3d8 + 2'],
  nearMisses: ['roll a ball', 'dice game', 'what is a d20'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a dice') && isDice('roll 2d6') && isDice('d20') && !isDice('roll a ball');
    return { ok, got: 'match works' };
  }
};
