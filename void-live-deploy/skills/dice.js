/**
 * dice skill - roll dice on the stage (new idea from growth, 2026-10-17).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice", "flip a coin".
 * Pure roll function for the suite check.
 */
export function roll(n = 1, sides = 6) {
  n = Math.max(1, Math.min(20, Math.floor(n) || 1));
  sides = Math.max(2, Math.min(100, Math.floor(sides) || 6));
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { n, sides, rolls, sum };
}

const WHEN = /^(?:(?:please\s+)?(?:roll|throw|dice|flip)\s+(?:a\s+|the\s+|some\s+)?(?:die|dice|coin|d\d+|\d+d\d+)(?:\s+please)?|roll\s+\d+d\d+|dice|flip\s+a\s+coin)$/i;

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase().trim();
  let n = 1, sides = 6, label = 'a die';
  if (/coin/.test(t)) { sides = 2; label = 'a coin'; }
  else {
    const m = t.match(/(\d+)d(\d+)/);
    if (m) { n = +m[1]; sides = +m[2]; label = `${n}d${sides}`; }
    else if (/dice/.test(t) && !/die/.test(t)) { n = 2; label = 'two dice'; }
  }
  const r = roll(n, sides);
  const faces = r.rolls.join(', ');
  showPage((el) => {
    el.innerHTML = '<h2>Roll</h2><p>' + esc(label) + ': ' + esc(faces) + (r.n > 1 ? ' (sum ' + r.sum + ')' : '') + '</p><div class="src">Rolled in this browser · nothing is sent</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice', 'flip a coin'],
  nearMisses: ['what is a die', 'board game', 'random number'],
  match(lower) { return WHEN.test(lower.trim()); },
  run,
  suite() { const r = roll(3, 6); return { ok: r.n === 3 && r.sides === 6 && r.rolls.length === 3 && r.sum >= 3 && r.sum <= 18 }; }
};
