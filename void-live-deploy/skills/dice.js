/**
 * dice skill — roll dice or flip a coin (pure, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "roll a die", "roll 2d6", "flip a coin", "roll 3 dice".
 * Empty surface stays empty: no match returns none, no page.
 */
function parseRoll(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|(?:roll\s+)?(?:a\s+)?d6|roll\s+\d*d\d+|flip\s+(?:a\s+)?coin|heads\s+or\s+tails)$/.test(t)) {
    const m = t.match(/(\d*)d(\d+)/) || t.match(/roll\s+(\d+)\s+(?:die|dice)/);
    let n = 1, sides = 6;
    if (m) {
      n = m[1] ? parseInt(m[1], 10) : 1;
      sides = parseInt(m[2], 10);
    } else if (/coin|heads/.test(t)) {
      sides = 2;
    }
    if (n < 1 || n > 100 || sides < 2 || sides > 100) return null;
    return { n, sides, coin: sides === 2 };
  }
  return null;
}

function roll(n, sides) {
  const rolls = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  return { rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseRoll(text);
  if (!q) return 'none';
  const r = roll(q.n, q.sides);
  const title = q.coin ? 'Coin flip' : (q.n > 1 ? q.n + 'd' + q.sides : 'd' + q.sides);
  showPage((p) => {
    let html = '<h2>' + esc(title) + '</h2>';
    if (q.coin) {
      html += '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + (r.rolls[0] === 1 ? 'Heads' : 'Tails') + '</div>';
    } else {
      html += '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + r.sum + '</div>';
      if (q.n > 1) html += '<p style="color:#8a8a8a">' + r.rolls.join(' + ') + '</p>';
    }
    html += '<div class="sub">say “roll again” or another roll</div>';
    p.innerHTML = html;
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'flip a coin', 'roll 3 dice'],
  nearMisses: ['dice game', 'what is a die', 'roll of film', 'coin collection'],
  match(lower, text) { return !!parseRoll(text); },
  run,
  suite() {
    // one check: parse a known ask and that a roll stays in range
    const q = parseRoll('roll 2d6');
    if (!q || q.n !== 2 || q.sides !== 6) return { ok: false, got: 'parse failed' };
    const r = roll(q.n, q.sides);
    if (r.rolls.length !== 2 || r.rolls.some((x) => x < 1 || x > 6) || r.sum !== r.rolls[0] + r.rolls[1]) return { ok: false, got: 'roll out of range' };
    return { ok: true };
  }
};
