/**
 * dice skill — "roll a d20", "roll 2d6 + 3", "dice", "roll the dice".
 * Rolls standard polyhedral dice in this browser. Nothing is sent or kept.
 */
export function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(\d*)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (m) return { n: Math.max(1, Math.min(20, +m[1] || 1)), sides: Math.max(2, Math.min(100, +m[2])), mod: Math.max(0, +m[3] || 0) };
  if (/^(?:roll\s+)?(?:the\s+)?dice$/.test(t)) return { n: 1, sides: 6, mod: 0 };
  return null;
}

function roll(spec) {
  const rolls = Array.from({ length: spec.n }, () => 1 + Math.floor(Math.random() * spec.sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total: sum + spec.mod, ...spec };
}

function diceCard(res, esc) {
  const label = res.n + 'd' + res.sides + (res.mod ? ' + ' + res.mod : '');
  return '<h2>Dice · ' + esc(label) + '</h2><div class="sub">rolled in this browser</div>'
    + '<p style="font-size:1.4em">' + res.rolls.map((r) => '<b>' + esc(r) + '</b>').join(' + ') + (res.mod ? ' + ' + esc(res.mod) : '') + ' = <b style="font-size:1.6em">' + esc(res.total) + '</b></p>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseDice(text);
  if (!spec) return 'none';
  const res = roll(spec);
  const el = showPage((p) => { p.innerHTML = diceCard(res, esc); });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll the dice', '2d6 + 3', 'roll 1d100'],
  nearMisses: ['what is a d20', 'dice games', 'how do dice work'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite() {
    const s = parseDice('roll 2d6 + 3');
    const plain = parseDice('roll the dice');
    return { ok: !!(s && s.n === 2 && s.sides === 6 && s.mod === 3 && plain && plain.sides === 6 && parseDice('hello') === null) };
  },
};
