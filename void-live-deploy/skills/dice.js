/**
 * dice skill — roll dice from the ask (no key; pure)
 * "roll a die", "roll dice", "roll a d20", "roll 2d6", "roll 3d8+1".
 */
export function parseRoll(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!/\b(?:roll|throw)\b/.test(t) && !/\bd\d+\b/.test(t)) return null;
  if (/\b(?:roll call|roll of|dice history|what is a die|dice tower)\b/.test(t)) return null;

  let n = 1, sides = 6, mod = 0;
  const m = t.match(/(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/) || t.match(/d\s*(\d+)/);
  if (m) {
    if (m[2]) { n = parseInt(m[1], 10) || 1; sides = parseInt(m[2], 10); mod = m[3] === '-' ? -parseInt(m[4] || '0', 10) : parseInt(m[4] || '0', 10); }
    else { sides = parseInt(m[1], 10); }
  } else if (/\bdice\b/.test(t) || /\ba die\b/.test(t) || /\bthe die\b/.test(t)) {
    sides = 6;
  } else return null;
  if (!Number.isFinite(n) || n < 1 || n > 20 || !Number.isFinite(sides) || sides < 2 || sides > 100) return null;
  return { n, sides, mod };
}

export function rollSpec(spec) {
  if (!spec) return null;
  const rolls = [];
  for (let i = 0; i < spec.n; i++) rolls.push(1 + Math.floor(Math.random() * spec.sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + spec.mod;
  return { rolls, sum, spec };
}

export function diceOf(text) {
  return !!parseRoll(text);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseRoll(text);
  if (!spec) return 'none';
  const result = rollSpec(spec);
  const el = showPage((p) => { p.innerHTML = '<h2>Dice</h2>'; });
  const rolls = result.rolls.join(', ');
  const mod = spec.mod ? (spec.mod > 0 ? '+' + spec.mod : spec.mod) : '';
  el.innerHTML = '<h2>' + esc(spec.n + 'd' + spec.sides + mod) + '</h2>'
    + '<p style="font-size:28px;line-height:1.3;font-weight:300">' + esc(rolls) + (spec.mod ? ' ' + esc(mod) : '') + '</p>'
    + '<p style="font-size:36px;margin:8px 0 0">total <strong>' + result.sum + '</strong></p>'
    + '<div class="sub">say another roll for a fresh one</div>';
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll a d20', 'roll 2d6', 'roll 3d8'],
  nearMisses: ['what is a die', 'dice history', 'roll call', 'show the map'],
  parseRoll,
  rollSpec,
  diceOf,
  match(lower, text) { return diceOf(text); },
  run
};
