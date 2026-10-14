/**
 * affirmation skill — a short positive affirmation (pure, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me an affirmation", "affirmation", "positive affirmation".
 */
const AFFIRM = [
  'I am enough.',
  'I trust the process.',
  'I am growing every day.',
  'I choose kindness toward myself.',
  'My best is enough.',
  'I am open to good things.',
  'I release what I cannot control.',
  'I am stronger than I think.',
  'Today is a fresh start.',
  'I am worthy of rest.'
];
export function affirmationOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  return /^(?:please\s+)?(?:give\s+me\s+(?:an\s+|a\s+)?(?:positive\s+)?affirmation|affirmation|(?:a\s+)?positive\s+affirmation|say\s+an\s+affirmation)$/.test(t);
}
async function run(text, api) {
  if (!affirmationOf(text)) return 'none';
  const { showPage, esc } = api;
  const line = AFFIRM[Math.floor(Math.random() * AFFIRM.length)];
  showPage((el) => {
    el.innerHTML = '<h2>Affirmation</h2><p style="font-size:26px;line-height:1.4;font-weight:300">' + esc(line) + '</p><div class="sub">say “affirmation” for another</div>';
  });
  return 'affirmation';
}
export default {
  name: 'affirmation',
  examples: ['give me an affirmation', 'affirmation', 'positive affirmation'],
  nearMisses: ['what is an affirmation', 'affirmation definition', 'positive thinking'],
  match(lower, text) { return affirmationOf(text); },
  run,
  suite() {
    const ok = affirmationOf('give me an affirmation') && affirmationOf('affirmation') && !affirmationOf('what is an affirmation');
    return { ok, got: ok ? 'pass' : 'parser fail' };
  }
};
