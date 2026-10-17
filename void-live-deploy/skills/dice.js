/**
 * dice skill: roll any number of dice. "roll a die", "roll dice", "roll 2d6", "roll a d20".
 * Empty stage stays empty; the page shows the rolls and the sum. Nothing is kept.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:roll|throw|toss)\s+(?:a\s+|the\s+|some\s+)?(?:dice|die|d6|2d6|d20|dice for me|a die)$/.test(t) || /^roll\s+\d+d\d+$/.test(t);
}

export function parseRoll(text) {
  const m = String(text || '').match(/(\d+)d(\d+)/i);
  if (m) return { n: Math.min(+m[1], 20), sides: Math.max(2, Math.min(+m[2], 100)) };
  return { n: 1, sides: 6 };
}

async function run(text, api) {
  if (!diceOf(text)) return 'none';
  const { n, sides } = parseRoll(text);
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p>' + esc(rolls.join(' + ')) + ' = <b>' + sum + '</b> (' + n + 'd' + sides + ')</p><p class="src">Rolled in this browser. Nothing is kept or sent.</p>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll a d20', 'roll 3d8'],
  nearMisses: ['what is a die', 'dice games', 'how to roll dice'],
  match(lower, text) { return diceOf(text); },
  run,
  suite() {
    const ok = diceOf('roll a die') && diceOf('roll 2d6') && !diceOf('what is dice') && parseRoll('roll 2d6').n === 2 && parseRoll('roll 2d6').sides === 6;
    return { ok, got: ok ? 'matcher and parser' : 'failed' };
  }
};
