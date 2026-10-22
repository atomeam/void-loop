/**
 * random-num skill — pick a random integer (pure, no external)
 * "random number", "pick a number between 1 and 10", "roll 1 to 6"
 */
export function parseRandom(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^random(?:\s+number)?$/.test(t)) return { min: 1, max: 100 };
  let m = t.match(/^(?:pick\s+a\s+|roll\s+a\s+)?(?:random\s+)?number\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)$/);
  if (m) return { min: +m[1], max: +m[2] };
  m = t.match(/^(?:roll|pick)\s+(\d+)\s+to\s+(\d+)$/);
  if (m) return { min: +m[1], max: +m[2] };
  return null;
}

export function randomBetween(min, max) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const p = parseRandom(text);
  if (!p) { showPage((el) => { el.innerHTML = '<h2>Random number</h2><p>Say <b>random number</b> or <b>pick a number between 1 and 10</b>.</p>'; }); return 'random-num'; }
  const n = randomBetween(p.min, p.max);
  showPage((el) => { el.innerHTML = '<h2>Random number</h2><p style="font-size:32px;font-weight:700">' + n + '</p><div class="sub">between ' + p.min + ' and ' + p.max + '</div>'; });
  return 'random-num';
}

export default {
  name: 'random-num',
  examples: ['random number', 'pick a number between 1 and 10', 'roll 1 to 6'],
  nearMisses: ['what is a random number', 'pi', 'calculate 5'],
  match(lower, text) { return !!parseRandom(text || lower); },
  run,
  suite() {
    const p = parseRandom('pick a number between 1 and 10');
    const ok = !!p && p.min === 1 && p.max === 10 && randomBetween(1, 1) === 1 && !parseRandom('what is a random number');
    return { ok };
  },
};
