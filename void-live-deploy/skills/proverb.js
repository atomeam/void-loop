/**
 * proverb skill — a random proverb or saying
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a proverb", "random proverb", "wise saying".
 */
export function isProverb(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:proverb|saying)|(?:random|another)\s+(?:proverb|saying)|proverb(?:\s+please)?|(?:(?:tell|give)\s+(?:me\s+)?)?(?:an?\s+)?(?:wise|old|famous)\s+saying)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const PROVERBS = [
  'A stitch in time saves nine.',
  'Actions speak louder than words.',
  'Better late than never.',
  'Don\'t count your chickens before they hatch.',
  'Every cloud has a silver lining.',
  'Fortune favors the bold.',
  'Honesty is the best policy.',
  'Look before you leap.',
  'Practice makes perfect.',
  'The early bird catches the worm.',
  'Two wrongs don\'t make a right.',
  'Where there\'s a will, there\'s a way.',
  'You can lead a horse to water, but you can\'t make it drink.',
  'Absence makes the heart grow fonder.',
  'Beauty is in the eye of the beholder.'
];

function run(text, api) {
  const { showPage, esc } = api;
  const p = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
  showPage((el) => {
    el.innerHTML = `<h2>A proverb</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">${esc(p)}</p><div class="sub">say “another proverb” for one more</div>`;
  });
  return 'proverb';
}

export default {
  name: 'proverb',
  examples: ['tell me a proverb', 'random proverb', 'wise saying', 'another proverb', 'an old saying', 'tell me an old saying'],
  nearMisses: ['what is a proverb', 'proverbs from the bible', 'quote'],
  match(lower, text) { return isProverb(text); },
  run,
  suite() {
    const ok = isProverb('tell me a proverb') && isProverb('random proverb') && !isProverb('what is a proverb');
    return { ok, got: 'match works' };
  }
};
