/**
 * random skill — random number between bounds (pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random number", "random number between 1 and 100", "pick a number from 1 to 10".
 */
export function randomOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  let m = t.match(/^(?:please\s+)?(?:give\s+me\s+)?(?:a\s+)?random\s+number(?:\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+))?$/);
  if (m) {
    const lo = m[1] ? +m[1] : 1, hi = m[2] ? +m[2] : 100;
    if (lo <= hi && hi - lo < 1000000) return { lo, hi };
  }
  m = t.match(/^(?:pick|choose)\s+(?:a\s+)?number\s+(?:from|between)\s+(\d+)\s+(?:to|and)\s+(\d+)$/);
  if (m) {
    const lo = +m[1], hi = +m[2];
    if (lo <= hi && hi - lo < 1000000) return { lo, hi };
  }
  return null;
}
async function run(text, api) {
  const q = randomOf(text); if (!q) return 'none';
  const { showPage } = api;
  const n = q.lo + Math.floor(Math.random() * (q.hi - q.lo + 1));
  showPage((el) => {
    el.innerHTML = '<h2>Random number</h2><p style="font-size:48px;font-weight:200;margin:12px 0">' + n + '</p><div class="sub">from ' + q.lo + ' to ' + q.hi + '</div>';
  });
  return 'random';
}
export default {
  name: 'random',
  examples: ['random number', 'random number between 1 and 100', 'pick a number from 1 to 10'],
  nearMisses: ['what is a random number', 'random fact', 'generate a password'],
  match(lower, text) { return !!randomOf(text); },
  run,
  suite() {
    const a = randomOf('random number between 1 and 100');
    const b = randomOf('pick a number from 5 to 15');
    const ok = a && a.lo === 1 && a.hi === 100 && b && b.lo === 5 && b.hi === 15 && !randomOf('what is a random number');
    return { ok, got: ok ? 'pass' : 'parser fail' };
  }
};
