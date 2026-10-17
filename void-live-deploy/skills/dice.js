/**
 * dice skill - roll dice, flip coins, pick random numbers (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d6", "roll 2d20", "flip a coin", "random number between 1 and 100",
 * "roll dice", "d4", "2d6 + 3".
 * Shows the rolls and the total. Better than a bare number: clear dice notation
 * and the individual faces so you can see what happened.
 */
function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/\b(?:dice|roll|coin|random)\b/.test(t) === false && !/\bd\d+\b/.test(t)) return null;
  if (/\b(?:dicey|dice tower|rolling hills|coin toss culture|random access|random house)\b/.test(t)) return null;

  // coin
  if (/\b(?:flip|toss|flip a|heads or tails)\b.*\bcoin\b|\bcoin\s+(?:flip|toss)\b/.test(t)) {
    return { kind: 'coin', n: 1, sides: 2, mod: 0, label: 'coin' };
  }

  // NdS[+M]
  let m = t.match(/\b(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\b/);
  if (m) {
    const n = Math.max(1, Math.min(100, parseInt(m[1] || '1', 10)));
    const sides = Math.max(2, Math.min(1000, parseInt(m[2], 10)));
    let mod = 0;
    if (m[3] && m[4]) mod = (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10);
    return { kind: 'dice', n, sides, mod, label: (m[1] || '') + 'd' + m[2] + (m[3] ? m[3] + m[4] : '') };
  }

  // random number between A and B
  m = t.match(/\brandom\s+(?:number\s+)?(?:between\s+|from\s+)?(\d+)\s+(?:and|to|-)\s+(\d+)\b/);
  if (m) {
    let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a > b) [a, b] = [b, a];
    return { kind: 'range', n: 1, sides: b - a + 1, mod: a - 1, label: a + '–' + b };
  }

  // plain "roll a dice", "roll dice", "d6"
  if (/\b(?:roll\s+(?:a\s+)?(?:dice|die)|d6)\b/.test(t) && !/\bwhat\s+is\b/.test(t)) {
    return { kind: 'dice', n: 1, sides: 6, mod: 0, label: 'd6' };
  }

  return null;
}

function roll(q) {
  const faces = [];
  for (let i = 0; i < q.n; i++) faces.push(1 + Math.floor(Math.random() * q.sides));
  const sum = faces.reduce((a, b) => a + b, 0) + q.mod;
  return { faces, sum, total: sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseDice(text);
  if (!q) return 'none';
  const r = roll(q);
  const title = q.kind === 'coin' ? 'Coin flip' : q.kind === 'range' ? 'Random number' : 'Dice';
  const page = showPage((el) => {
    let html = '<h2>' + esc(title) + '</h2>';
    html += '<div class="src">' + esc(q.label) + '</div>';
    if (q.kind === 'coin') {
      html += '<p style="font-size:48px;margin:12px 0">' + (r.faces[0] === 1 ? 'Heads' : 'Tails') + '</p>';
    } else if (q.kind === 'range') {
      html += '<p style="font-size:48px;margin:12px 0">' + r.sum + '</p>';
    } else {
      html += '<p style="font-size:28px;margin:8px 0">' + r.faces.join(' + ') + (q.mod ? (q.mod > 0 ? ' + ' : ' − ') + Math.abs(q.mod) : '') + ' = <strong>' + r.sum + '</strong></p>';
      html += '<div style="font-size:14px;opacity:0.7">faces: ' + r.faces.join(', ') + '</div>';
    }
    el.innerHTML = html;
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d20', 'flip a coin', 'random number between 1 and 100', 'roll dice'],
  nearMisses: ['dice tower', 'rolling hills', 'what is a dice', 'coin toss culture'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite() {
    const d6 = parseDice('roll a d6');
    const two = parseDice('roll 2d20');
    const coin = parseDice('flip a coin');
    const rng = parseDice('random number between 1 and 100');
    const miss = parseDice('what is a dice');
    const ok = d6 && d6.sides === 6 && d6.n === 1
      && two && two.n === 2 && two.sides === 20
      && coin && coin.kind === 'coin'
      && rng && rng.kind === 'range'
      && miss === null;
    return { ok, got: ok ? 'dice parses' : 'miss' };
  }
};
