/**
 * dice skill: interactive dice roller on the stage or page.
 * "roll dice", "roll 2d6", "dice roller", "roll three d20".
 * Pure parser; card shows buttons and results. Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:roll\s+)?(?:some\s+|the\s+)?dice(?:\s+roller)?(?:\s+please)?$/.test(t)) return { n: 1, s: 6 };
  const m = t.match(/^(?:please\s+)?roll\s+(\d+)\s*(?:d|dice\s+of\s+)?(\d+)(?:\s+dice)?(?:\s+please)?$/);
  if (m) return { n: Math.min(20, Math.max(1, +m[1])), s: Math.min(100, Math.max(2, +m[2])) };
  const m2 = t.match(/^(?:please\s+)?(?:roll\s+)?(\d+)d(\d+)(?:\s+please)?$/);
  if (m2) return { n: Math.min(20, Math.max(1, +m2[1])), s: Math.min(100, Math.max(2, +m2[2])) };
  return null;
}

function roll(n, s) {
  const rolls = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = 1 + Math.floor(Math.random() * s);
    rolls.push(r);
    sum += r;
  }
  return { rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = diceOf(text);
  if (!want) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roller</h2><p>Rolling ' + want.n + 'd' + want.s + '…</p>';
  });
  if (!el) return 'dice';
  const res = roll(want.n, want.s);
  el.innerHTML = '<h2>Dice roller · ' + want.n + 'd' + want.s + '</h2>'
    + '<div style="font-size:24px;margin:12px 0">' + esc(res.rolls.join(' + ')) + ' = <b>' + res.sum + '</b></div>'
    + '<button class="dice-reroll" type="button">Roll again</button>'
    + '<p class="src">Rolled in this browser. Nothing is stored or sent.</p>';
  const btn = el.querySelector('.dice-reroll');
  if (btn) btn.addEventListener('click', () => {
    const r2 = roll(want.n, want.s);
    el.querySelector('div').innerHTML = esc(r2.rolls.join(' + ')) + ' = <b>' + r2.sum + '</b>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll dice', 'roll 2d6', 'roll three d20', 'dice roller', '1d20'],
  nearMisses: ['what is a dice', 'how do dice work', 'roll a film', 'dice game'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    return { ok: diceOf('roll 2d6')?.n === 2 && diceOf('roll dice')?.s === 6 && diceOf('hello') === null };
  },
};
