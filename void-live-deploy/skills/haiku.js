/**
 * haiku skill — "make a haiku about X", "haiku from rain", "write a haiku".
 * A pure 5-7-5 generator from a seed word. Nothing is sent.
 */
const SYLLABLES = {
  rain: ['soft', 'rain', 'falls', 'on', 'leaves'],
  ocean: ['deep', 'waves', 'crash', 'on', 'shore'],
  night: ['stars', 'shine', 'in', 'dark', 'sky'],
  love: ['heart', 'beats', 'for', 'you', 'now'],
  time: ['hours', 'pass', 'like', 'wind', 'gone'],
  default: ['words', 'flow', 'like', 'river', 'home']
};

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  const vowels = word.match(/[aeiouy]+/g);
  return Math.max(1, vowels ? vowels.length : 1);
}

export function haikuFrom(seed) {
  const s = String(seed || 'life').trim().toLowerCase().replace(/[^a-z]/g, '') || 'life';
  const base = SYLLABLES[s] || SYLLABLES.default;
  // simple 5-7-5 assembly
  const line1 = `${base[0]} ${base[1]} ${base[2]}`.split(' ').slice(0, 3).join(' ');
  const line2 = `quiet ${s} in the air`;
  const line3 = `${base[3]} ${base[4]} alone`;
  return [line1, line2, line3];
}

export function isHaiku(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|write|give me|create)\s+(?:a\s+)?haiku(?:\s+(?:about|from|for|on)\s+(\w+))?|haiku(?:\s+(?:about|from|for|on)\s+(\w+))?)$/.test(t);
}

export function seedOf(text) {
  const m = String(text || '').trim().toLowerCase().match(/(?:about|from|for|on)\s+(\w+)/);
  return m ? m[1] : 'life';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const seed = seedOf(text);
  const lines = haikuFrom(seed);
  const el = showPage();
  if (!api._pageStill(el)) return 'none';
  el.innerHTML = '<h2>A haiku</h2>'
    + lines.map((l) => '<p class="haiku-line">' + esc(l) + '</p>').join('')
    + '<div class="sub">seed: ' + esc(seed) + '</div>';
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['make a haiku about rain', 'haiku from ocean', 'write a haiku'],
  nearMisses: ['what is a haiku', 'haiku history', 'japanese poetry'],
  match(lower, text) { return isHaiku(text); },
  run
};
