/**
 * dice skill — roll dice or flip a coin. "roll 2d6", "roll a d20", "flip a coin".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:\d*d\d+|dice)|flip\s+(?:a\s+)?coin|coin\s+flip|roll\s+dice)$/.test(t);
}

function rollDice(spec) {
  const m = spec.match(/(\d*)d(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1] || '1', 10), sides = parseInt(m[2], 10);
  if (n < 1 || n > 100 || sides < 2 || sides > 1000) return null;
  let total = 0, rolls = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r); total += r;
  }
  return { total, rolls, n, sides };
}

function flipCoin() {
  return Math.random() < 0.5 ? 'Heads' : 'Tails';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Dice</h2><div class="sub">rolling…</div>'; });
  const t = String(text || '').trim().toLowerCase();
  let html = '<h2>Dice roll</h2>';
  if (/coin|flip/.test(t)) {
    const res = flipCoin();
    html += '<p style="font-size:24px">' + esc(res) + '</p>';
  } else {
    const m = t.match(/(\d*d\d+)/);
    const spec = m ? m[1] : '1d6';
    const r = rollDice(spec);
    if (!r) {
      html += '<p>Say "roll 2d6" or "flip a coin".</p>';
    } else {
      html += '<p style="font-size:22px">' + r.total + ' (' + r.rolls.join(', ') + ')</p><div class="sub">' + r.n + 'd' + r.sides + '</div>';
    }
  }
  html += '<div class="sub">say “roll again” or another dice</div>';
  if (api._pageStill && !api._pageStill(el)) return 'dice';
  el.innerHTML = html;
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll 2d6', 'roll a d20', 'flip a coin', 'roll dice'],
  nearMisses: ['what is a dice', 'dice game', 'stock dice'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll 2d6') && isDice('flip a coin') && !isDice('stock dice') && !!rollDice('2d6');
    return { ok, got: 'match and roll work' };
  }
};
