/**
 * dice skill — roll dice: "roll a dice", "roll 2d6", "roll the dice".
 * Shows the result on a page. Empty surface stays empty.
 */
export function parseRoll(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?)?(?:dice|die)(?:\s+(\d+)d(\d+))?$/);
  if (!m) return null;
  const n = m[1] ? +m[1] : 1;
  const sides = m[2] ? +m[2] : 6;
  if (n < 1 || n > 100 || sides < 2 || sides > 100) return null;
  return { n, sides };
}

export function roll(n, sides) {
  let total = 0, faces = [];
  for (let i = 0; i < n; i++) {
    const f = 1 + Math.floor(Math.random() * sides);
    faces.push(f);
    total += f;
  }
  return { faces, total };
}

function run(text, api) {
  const p = parseRoll(text);
  if (!p) return 'none';
  const { showPage, esc } = api;
  const r = roll(p.n, p.sides);
  const desc = p.n === 1 ? `a d${p.sides}` : `${p.n}d${p.sides}`;
  showPage((el) => {
    el.innerHTML = `<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">${esc(r.faces.join(' + '))}${p.n > 1 ? ' = ' + r.total : ''}</p><div class="sub">rolled ${esc(desc)} · say “roll 2d6” for another</div>`;
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a dice', 'roll the dice', 'roll 2d6', 'roll 3d8'],
  nearMisses: ['what is a dice', 'dice game', 'yahtzee'],
  match(lower, text) { return !!parseRoll(text || lower); },
  run,
};
