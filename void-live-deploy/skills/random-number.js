/**
 * random-number skill — "random number", "pick a number between 1 and 100", "random number from 1 to 10".
 * Empty surface stays empty: shows the number on a page.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function numberOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:random\s+number|pick\s+a\s+number|give\s+me\s+a\s+random\s+number)$/.test(t)) return { min: 1, max: 100 };
  const m = t.match(/^(?:please\s+)?(?:random\s+number|pick\s+a\s+number)\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)$/);
  if (m) {
    let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a > b) [a, b] = [b, a];
    if (b - a > 1000000) b = a + 1000000;
    return { min: a, max: b };
  }
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = numberOf(text);
  if (!spec) return 'none';
  const n = spec.min + Math.floor(Math.random() * (spec.max - spec.min + 1));
  showPage((p) => {
    p.innerHTML = '<h2>Random number</h2><p style="font-size:36px;font-weight:300">' + n + '</p>'
      + '<div class="sub">between ' + spec.min + ' and ' + spec.max + '</div>'
      + '<div class="sub">say “random number between 1 and 6” for another</div>';
  });
  return 'random-number';
}

export default {
  name: 'random-number',
  examples: ['random number', 'pick a number between 1 and 100', 'random number from 1 to 10'],
  nearMisses: ['what is a random number', 'number theory', 'pick a color'],
  match(lower, text) { return !!numberOf(text || lower); },
  run,
  suite() {
    const def = numberOf('random number');
    const range = numberOf('random number between 5 and 10');
    const miss = numberOf('what is a random number');
    const ok = def && def.min === 1 && def.max === 100 && range && range.min === 5 && range.max === 10 && !miss;
    return { ok, got: ok ? 'picks' : 'miss' };
  }
};
