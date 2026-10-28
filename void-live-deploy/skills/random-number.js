/**
 * random-number skill — generate a random integer, optionally in a range
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a random number", "random number between 1 and 100", "pick a number from 5 to 20".
 */
export function isRandomNumber(text) {
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:a\s+)?|pick\s+(?:a\s+)?|generate\s+(?:a\s+)?)?(?:random\s+)?number(?:\s+(?:between|from|in)\s+(\d+)\s+(?:and|to|-)\s+(\d+))?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseRange(text) {
  const m = String(text || '').match(/(?:between|from|in)\s+(\d+)\s+(?:and|to|-)\s+(\d+)/i);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [1, 100];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const [lo, hi] = parseRange(text);
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  showPage((el) => {
    el.innerHTML = '<h2>Random number</h2><p style="font-size:48px;font-weight:700;text-align:center;margin:12px 0">' + n + '</p>'
      + '<div class="sub">from ' + lo + ' to ' + hi + ' · say “another random number” for a new one</div>';
  });
  return 'random-number';
}

export default {
  name: 'random-number',
  examples: ['give me a random number', 'random number between 1 and 100', 'pick a number from 5 to 20', 'another random number'],
  nearMisses: ['what is a random number', 'random fact', 'tell me a fact'],
  match(lower, text) { return isRandomNumber(text); },
  run,
  suite() {
    const ok = isRandomNumber('give me a random number') && isRandomNumber('random number between 1 and 100') && !isRandomNumber('random fact');
    return { ok, got: 'match works' };
  }
};
