/**
 * affirm skill — give a short affirmation. "give me an affirmation", "daily affirmation", "affirm me".
 * Client-side only. Empty surface stays empty.
 */
const PHRASES = [
  'You are exactly where you need to be.',
  'Small steps still move the mountain.',
  'Today is a fresh page.',
  'You have what it takes.',
  'Progress over perfection.'
];

export function affirmOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:give\s+me\s+(?:an?\s+)?)?affirmation$|^(?:daily\s+)?affirmation$|^affirm\s+me$/.test(t);
}

function pick() {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

async function run(text, api) {
  if (!affirmOf(text)) return 'none';
  const { showPage, esc } = api;
  const line = pick();
  showPage((p) => {
    p.innerHTML = '<h2>Affirmation</h2><p style="font-size:20px;line-height:1.5;font-weight:400">' + esc(line) + '</p><div class="sub">say it again for another</div>';
  });
  return 'affirm';
}

export default {
  name: 'affirm',
  examples: ['give me an affirmation', 'daily affirmation', 'affirm me'],
  nearMisses: ['what is an affirmation', 'affirm the truth', 'negative affirmation'],
  match(lower, text) { return affirmOf(text); },
  run,
  suite() {
    const ok = affirmOf('give me an affirmation') && affirmOf('daily affirmation') && !affirmOf('what is an affirmation') && PHRASES.includes(pick());
    return { ok };
  },
};
