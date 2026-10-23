/**
 * affirmation skill — a random positive affirmation (local list, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me an affirmation", "random affirmation", "give me an affirmation".
 */
const AFFIRMATIONS = [
  'I am capable of amazing things.',
  'I choose to be kind to myself today.',
  'My potential is limitless.',
  'I trust the process of life.',
  'I am enough, just as I am.',
  'Every day I grow stronger.',
  'I attract positive energy.',
  'I am worthy of love and respect.',
  'Challenges help me grow.',
  'I am grateful for this moment.'
];

export function isAffirmation(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:positive\s+)?affirmation|(?:another|a|random|positive)\s+affirmation|affirmation(?:\s+please)?|give\s+me\s+(?:an?\s+)?affirmation|random\s+affirmation)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const msg = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>An affirmation</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">' + esc(msg) + '</p><div class="sub">say “another affirmation” for one more</div>';
  });
  return 'affirmation';
}

export default {
  name: 'affirmation',
  examples: ['tell me an affirmation', 'random affirmation', 'give me an affirmation', 'another affirmation'],
  nearMisses: ['what is an affirmation', 'affirmation of the day news'],
  match(lower, text) { return isAffirmation(text); },
  run,
  suite() {
    const ok = isAffirmation('tell me an affirmation') && isAffirmation('random affirmation') && !isAffirmation('news affirmation');
    return { ok, got: 'match works' };
  }
};
