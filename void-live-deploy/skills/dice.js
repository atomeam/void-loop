/**
 * dice skill — roll dice: "roll a die", "roll 2d6", "dice", "roll 1d20"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|dice|roll\s+\d+d\d+(?:\s*\+\s*\d+)?)$/.test(t) || /^roll\s+\d+\s*d\s*\d+/.test(t);
}

function parseAndRoll(text) {
  const m = String(text || '').toLowerCase().match(/(\d+)\s*d\s*(\d+)(?:\s*\+\s*(\d+))?/);
  let n = 1, sides = 6, mod = 0;
  if (m) { n = Math.min(20, parseInt(m[1], 10) || 1); sides = Math.max(2, Math.min(100, parseInt(m[2], 10) || 6)); mod = parseInt(m[3] || '0', 10) || 0; }
  else if (/die|dice/.test(text)) { n = 1; sides = 6; }
  const rolls = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  sum += mod;
  return { n, sides, mod, rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides, mod, rolls, sum } = parseAndRoll(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Dice</h2><div class="sub">…</div>'; });
  const detail = rolls.length > 1 ? ' (' + rolls.join(' + ') + (mod ? ' + ' + mod : '') + ')' : (mod ? ' + ' + mod : '');
  el.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300">' + esc(String(sum)) + '</p><div class="sub">' + n + 'd' + sides + detail + '</div><div class="sub">say “roll a die” or “roll 2d6” again</div><div class="src">Source: fair random rolls in your browser</div>';
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice', 'roll 1d20'],
  nearMisses: ['what is a die', 'die hard', 'dice game rules'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && isDice('dice') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
