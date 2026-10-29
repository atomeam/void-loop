/**
 * random skill — roll dice or pick a random number in a range
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a dice", "random number between 1 and 100", "d20", "roll 2d6"
 */
export function isRandom(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:dice|d\d{1,3}|die)|(?:pick|give\s+me\s+)?(?:a\s+)?random\s+(?:number|num)(?:\s+between\s+\d+\s+and\s+\d+)?|d\d{1,3}|roll\s+\d+d\d{1,3})$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseAsk(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '');
  let min = 1, max = 6, n = 1, sides = 6;
  const range = /between\s+(\d+)\s+and\s+(\d+)/.exec(t);
  if (range) { min = +range[1]; max = +range[2]; if (min > max) [min, max] = [max, min]; }
  else {
    const dice = /(\d+)?d(\d{1,3})/.exec(t);
    if (dice) { n = +(dice[1] || 1); sides = +dice[2]; max = sides; }
    else if (/d20/.test(t)) { sides = 20; max = 20; }
    else if (/dice|die/.test(t)) { sides = 6; max = 6; }
  }
  return { min, max, n, sides };
}

function roll(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
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
      + '<div class="sub">say “roll again” or a new range for another</div>';
  });
  return 'random';
}

export default {
  name: 'random',
  examples: ['roll a dice', 'random number between 1 and 100', 'd20', 'roll 2d6', 'pick a random number'],
  nearMisses: ['what is random', 'random thoughts', 'roll the camera'],
  match(lower, text) { return isRandom(text); },
  run,
  suite() {
    const ok = isRandom('roll a dice') && isRandom('random number between 1 and 100') && !isRandom('what is random');
    return { ok, got: 'match works' };
  }
};
