/**
 * dice skill — roll dice (no key, pure local)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "dice 3d8".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:\d*d\d+|d\d+)|(?:\d+)?d\d+|dice(?:\s+roll)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text).match(/(\d*)d(\d+)/i);
  if (!m) return { n: 1, sides: 6 };
  return { n: Math.max(1, parseInt(m[1] || '1', 10)), sides: Math.max(2, parseInt(m[2], 10)) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parseDice(text);
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + (n > 1 ? ' = ' + total : '') + '</p><div class="sub">' + n + 'd' + sides + '</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'dice 3d8', 'd12'],
  nearMisses: ['what is a dice', 'dice game', 'board game'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a d20') && isDice('2d6') && !isDice('what is a dice');
    return { ok, got: 'match works' };
  }
};
