/**
 * dice skill — roll dice: "roll a d6", "roll 2d20", "dice roll", "roll 3 dice"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/^(?:please\s+|can you\s+|could you\s+)/i, '');
  return /^(?:roll\s+(?:a\s+)?(?:\d+\s*)?d\d+|roll\s+\d+\s+dice|dice\s+roll|roll\s+dice)$/i.test(t);
}

function parseDice(text) {
  const t = String(text || '').toLowerCase();
  const m = /(\d+)?d(\d+)/i.exec(t) || /roll\s+(\d+)\s+dice/i.exec(t);
  if (!m) return { n: 1, sides: 6 };
  if (m[2]) return { n: Math.min(20, +(m[1] || 1)), sides: Math.min(100, +m[2]) };
  return { n: Math.min(20, +m[1]), sides: 6 };
}

function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parseDice(text);
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;letter-spacing:.05em">' + esc(rolls.join(', ')) + '</p>'
      + '<div class="sub">Total: ' + total + ' · ' + n + 'd' + sides + '</div>'
      + '<div class="sub">say “roll again” or “roll 2d6”</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d20', 'dice roll', 'roll 3 dice'],
  nearMisses: ['dice game', 'what is a dice', 'yahtzee'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a d6') && isDice('roll 2d20') && isDice('roll 3 dice') && !isDice('dice game');
    return { ok, got: 'match works' };
  }
};
