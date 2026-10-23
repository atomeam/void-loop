/**
 * proverb skill — a random proverb
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a proverb", "random proverb", "wise saying".
 */
const PROVERBS = [
  "A stitch in time saves nine.",
  "Actions speak louder than words.",
  "Better late than never.",
  "Don't count your chickens before they hatch.",
  "Every cloud has a silver lining.",
  "Fortune favors the bold.",
  "Honesty is the best policy.",
  "If it ain't broke, don't fix it.",
  "Knowledge is power.",
  "Look before you leap.",
  "Practice makes perfect.",
  "The early bird catches the worm.",
  "Two heads are better than one.",
  "When in Rome, do as the Romans do.",
  "You can't have your cake and eat it too."
];

export function isProverb(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:wise\s+)?proverb|(?:another|a|random|wise)\s+proverb|proverb(?:\s+please)?|give\s+me\s+a\s+proverb|wise\s+saying)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const p = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
  showPage((el) => {
    el.innerHTML = '<h2>A proverb</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">"' + esc(p) + '"</p><div class="sub">say “another proverb” for one more</div>';
  });
  return 'proverb';
}

export default {
  name: 'proverb',
  examples: ['tell me a proverb', 'random proverb', 'wise saying', 'another proverb'],
  nearMisses: ['what is a proverb', 'bible verses', 'stock proverbs'],
  match(lower, text) { return isProverb(text); },
  run,
  suite() {
    const ok = isProverb('tell me a proverb') && isProverb('random proverb') && !isProverb('stock quotes');
    return { ok, got: 'match works' };
  }
};
