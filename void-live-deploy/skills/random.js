/**
 * random skill — dice written the way players write them: "d20", "2d6", "3d8"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * The stage's own chance cards (void.html chanceOf: crypto, the 3D die, the /random/ page) already answer "roll a dice", "roll 2 dice",
 * "roll 3d6", "roll a d20" and "pick a random number between 1 and 100", and skills are asked before them, so this one takes only the
 * bare notation they leave (tools/toolkit.test.mjs holds the random-number asks for the stage).
 */
export function isRandom(text) {
  return /^(?:please\s+)?\d{0,2}\s*d\s*\d{1,3}$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

// a range ("between 1 and 100", "from -5 to 5") is one number in it; a random number with no range is 1 to 100; dice ("d20", "roll 2d6",
// "roll 3 dice", "roll a die") are up to 20 of them, each 1 to its sides (6 when the ask names none)
export function parseAsk(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/(\d)\s+d(?=\s*\d)/, '$1d').replace(/(^|\s|\d)d\s+(\d)/, '$1d$2');
  const range = /(?:between|from)\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)/.exec(t);
  if (range) { let min = +range[1], max = +range[2]; if (min > max) [min, max] = [max, min]; return { min, max, n: 1, sides: 0 }; }
  if (/random\s+(?:number|num)/.test(t)) return { min: 1, max: 100, n: 1, sides: 0 };
  const dice = /(?:^|\s)(\d{1,2})?\s*d(\d{1,3})$/.exec(t), many = /roll\s+(\d{1,2})\s+(?:dice|die)/.exec(t);
  const n = Math.min(20, Math.max(1, dice ? +(dice[1] || 1) : many ? +many[1] : 1)), sides = dice ? Math.max(2, +dice[2]) : 6;
  return { min: 1, max: sides, n, sides };
}

// a whole number from min to max, both included: crypto.getRandomValues where there is one, without the modulo bias
export function roll(min, max) {
  const span = max - min + 1, c = globalThis.crypto;
  if (!c || !c.getRandomValues || span > 0xffffffff) return min + Math.floor(Math.random() * span);
  const cut = 0x100000000 - (0x100000000 % span), buf = new Uint32Array(1);
  do c.getRandomValues(buf); while (buf[0] >= cut);
  return min + (buf[0] % span);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { min, max, n, sides } = parseAsk(text);
  const results = Array.from({ length: n }, () => roll(min, max));
  const total = results.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Random</h2>'
      + '<p style="font-size:28px;font-weight:600">' + esc(results.join(', ')) + (n > 1 ? ' · total ' + total : '') + '</p>'
      + '<div class="sub">range ' + min + '–' + max + (sides ? ' · ' + n + 'd' + sides : '') + '</div>'
      + '<div class="sub">ask the same again for another roll</div>';
  });
  return 'random';
}

export default {
  name: 'random',
  examples: ['d20', '2d6', '3d8', 'd100'],
  nearMisses: ['what is random', 'roll a dice', 'roll 3d6', 'random number between 1 and 100', 'pick a random number', '3d printer'],
  match(lower, text) { return isRandom(text); },
  run,
  suite() {
    const ok = isRandom('d20') && isRandom('2d6') && !isRandom('roll a dice') && !isRandom('what is random');
    return { ok, got: 'match works' };
  }
};
