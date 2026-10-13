/**
 * dice skill — roll dice or pick a random number (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2 dice", "random number between 1 and 100", "roll 1d20".
 */
function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?die|roll\s+a\s+dice|dice)$/.test(t)) return { sides: 6, count: 1 };
  let m = t.match(/^roll\s+(\d+)\s+dice?$/);
  if (m) return { sides: 6, count: Math.min(10, +m[1] || 1) };
  m = t.match(/^roll\s+(\d+)d(\d+)$/);
  if (m) return { sides: +m[2], count: Math.min(10, +m[1] || 1) };
  m = t.match(/^(?:random|pick a )\s+number(?:\s+between\s+|\s+from\s+)?(\d+)\s+(?:and|to)\s+(\d+)$/);
  if (m) return { min: +m[1], max: +m[2], count: 1 };
  m = t.match(/^random number$/);
  if (m) return { min: 1, max: 100, count: 1 };
  return null;
}
function roll(q) {
  if (q.min != null) {
    const lo = Math.min(q.min, q.max), hi = Math.max(q.min, q.max);
    return { results: [Math.floor(Math.random() * (hi - lo + 1)) + lo], label: lo + ' to ' + hi };
  }
  const results = [];
  for (let i = 0; i < q.count; i++) results.push(Math.floor(Math.random() * q.sides) + 1);
  const sum = results.reduce((a, b) => a + b, 0);
  return { results, sum, label: q.count + 'd' + q.sides };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const r = roll(q);
  showPage((el) => {
    const nums = r.results.map(n => '<span style="font-size:48px;font-weight:300;margin:0 8px">' + n + '</span>').join('');
    el.innerHTML = '<h2>Dice</h2><div style="text-align:center;margin:12px 0">' + nums + '</div>'
      + (r.sum != null && r.results.length > 1 ? '<div class="sub">sum ' + r.sum + '</div>' : '')
      + '<div class="sub">' + esc(r.label) + ' · say “roll again” for another</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2 dice', 'random number between 1 and 100', 'roll 1d20'],
  nearMisses: ['what is a die', 'dice game', 'random thought', 'roll out the red carpet'],
  match(lower, text) { return !!diceOf(text); },
  run
};
