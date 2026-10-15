/**
 * haiku skill — daily void haiku. "void haiku", "a haiku about emptiness", "daily haiku".
 * Generates a short haiku on the theme of the void. Empty surface stays empty.
 */
const HAIKU = [
  ['the stage stays blank', 'until someone asks', 'then something appears'],
  ['empty page holds', 'every possible card', 'waiting for a word'],
  ['no sign-in needed', 'just type and watch it grow', 'nothing is stored'],
];

export function haikuOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:daily\s+)?(?:void\s+)?haiku$/.test(t)) return true;
  if (/^(?:give\s+me\s+)?(?:a\s+)?haiku\s+(?:about\s+)?(?:the\s+)?(?:void|emptiness|nothing)$/.test(t)) return true;
  if (/^write\s+(?:a\s+)?haiku$/.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!haikuOf(text)) return 'none';
  const [a, b, c] = HAIKU[Math.floor(Math.random() * HAIKU.length)];
  showPage((el) => {
    el.innerHTML = '<h2>A void haiku</h2><p style="font-style:italic;line-height:1.6">' + esc(a) + '<br>' + esc(b) + '<br>' + esc(c) + '</p><div class="src">Generated here. Empty stage stays empty until asked.</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['void haiku', 'a haiku about emptiness', 'daily haiku', 'write a haiku'],
  nearMisses: ['what is a haiku', 'write a poem', 'films', 'make a sticky'],
  match(lower, text) { return haikuOf(text); },
  run,
  suite() {
    return { ok: haikuOf('void haiku') && haikuOf('daily haiku') && !haikuOf('hello') };
  },
};
