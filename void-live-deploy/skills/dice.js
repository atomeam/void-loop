/**
 * dice skill — roll dice on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll the dice", "roll a d20", "dice roll".
 * Shows a simple result card. Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(?:the\s+|a\s+|some\s+)?(?:dice|die|d(\d+)|(\d+)d(\d+))$/);
  return m ? { sides: +(m[1] || m[3] || 6), count: +(m[2] || 1) } : null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const d = diceOf(text);
  if (!d) return 'none';
  const rolls = Array.from({ length: d.count }, () => 1 + Math.floor(Math.random() * d.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + ' = <b>' + esc(String(total)) + '</b></p>'
      + '<div class="sub">' + esc(d.count + 'd' + d.sides) + ' · say "roll the dice" again for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll the dice', 'roll a d20', '2d6', 'dice roll'],
  nearMisses: ['what are dice', 'dice game rules', 'how to play craps'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const d = diceOf('roll a d20');
    return { ok: d && d.sides === 20 && d.count === 1 && !diceOf('hello') };
  },
};
