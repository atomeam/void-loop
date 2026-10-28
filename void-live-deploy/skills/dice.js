/**
 * dice skill — roll dice. "roll a d20", "roll 2d6", "roll dice"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:(\d+)\s*)?d(\d+)|roll\s+dice|dice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parse(text) {
  const m = String(text).toLowerCase().match(/(\d+)?\s*d(\d+)/);
  if (!m) return { n: 1, sides: 6 };
  return { n: Math.min(20, parseInt(m[1] || 1, 10)), sides: Math.min(100, parseInt(m[2], 10)) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parse(text);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = `<h2>Dice</h2><p style="font-size:28px">${esc(rolls.join(' + '))} = ${total}</p><div class="sub">${n}d${sides}</div>`;
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll dice'],
  nearMisses: ['dice game', 'what is a die'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a d20') && isDice('roll 2d6') && !isDice('play dice');
    return { ok, got: 'match works' };
  }
};
