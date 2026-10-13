/**
 * dice skill — roll dice, flip a coin, or pick a random number (no key)
 * "roll a d20", "roll 2d6", "flip a coin", "random number between 1 and 100"
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+|me\s+)?)?(?:(\d+)\s*)?d(\d+)(?:\s+(?:dice|die))?$/i)
    || t.match(/^(?:please\s+)?roll\s+(?:a\s+)?(\d+)[- ]sided\s+die$/i);
  if (m) {
    const count = m[1] ? parseInt(m[1], 10) : 1;
    const sides = parseInt(m[2] || m[1], 10);
    if (count >= 1 && count <= 100 && sides >= 2 && sides <= 1000) return { kind: 'dice', count, sides };
  }
  if (/^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails)$/i.test(t)) return { kind: 'coin' };
  const rn = t.match(/^(?:please\s+)?(?:random\s+number|pick\s+a\s+number)\s+(?:between\s+|from\s+)?(\d+)\s+(?:and|to)\s+(\d+)$/i);
  if (rn) {
    const a = parseInt(rn[1], 10), b = parseInt(rn[2], 10);
    if (a <= b && b - a < 1000000) return { kind: 'range', min: a, max: b };
  }
  return null;
}

function roll(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = diceOf(text);
  if (!hit) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Rolling…</h2><div class="sub">…</div>'; });
  if (!api._pageStill(el)) return 'dice';
  if (hit.kind === 'coin') {
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
    el.innerHTML = '<h2>Coin flip</h2><p style="font-size:36px;text-align:center;margin:20px 0">' + side + '</p><div class="sub">say “flip a coin” for another</div>';
    return 'dice';
  }
  if (hit.kind === 'range') {
    const n = hit.min + Math.floor(Math.random() * (hit.max - hit.min + 1));
    el.innerHTML = '<h2>Random number</h2><p style="font-size:36px;text-align:center;margin:20px 0">' + n + '</p><div class="sub">between ' + hit.min + ' and ' + hit.max + '</div>';
    return 'dice';
  }
  const { rolls, total } = roll(hit.count, hit.sides);
  const show = hit.count === 1 ? String(rolls[0]) : rolls.join(' + ') + ' = <b>' + total + '</b>';
  el.innerHTML = '<h2>Dice</h2><p style="font-size:28px;text-align:center;margin:16px 0">' + show + '</p><div class="sub">' + hit.count + 'd' + hit.sides + '</div>';
  return 'dice';
}

export function suite() {
  const d = diceOf('roll a d20');
  if (!d || d.kind !== 'dice' || d.count !== 1 || d.sides !== 20) return { ok: false, got: 'd20 parse' };
  const c = diceOf('flip a coin');
  if (!c || c.kind !== 'coin') return { ok: false, got: 'coin parse' };
  const r = diceOf('random number between 1 and 10');
  if (!r || r.kind !== 'range' || r.min !== 1 || r.max !== 10) return { ok: false, got: 'range parse' };
  return { ok: true };
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'flip a coin', 'random number between 1 and 100'],
  nearMisses: ['what is dice', 'play a dice game', 'calculate 2+2'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite
};
