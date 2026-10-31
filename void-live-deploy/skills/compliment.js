/**
 * compliment skill — a random compliment
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a compliment", "compliment me", "say something nice".
 */
export function isCompliment(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+)?(?:a\s+)?compliment(?:\s+me)?|compliment\s+me|say\s+something\s+nice|tell\s+me\s+something\s+nice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const COMPLIMENTS = [
  'You have a great sense of style.',
  'Your ideas light up the room.',
  'You are a wonderful listener.',
  'Your smile is contagious.',
  'You make the world a better place just by being in it.',
  'Your creativity inspires others.',
  'You have a kind heart.'
];

function run(text, api) {
  const { showPage, esc } = api;
  const c = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Compliment</h2><p style="font-size:24px;line-height:1.45;font-style:italic;text-align:center">' + esc(c) + '</p><div class="sub">say “compliment me” for another</div><div class="src">Chosen here on this device.</div>';
  });
  return 'compliment';
}

export default {
  name: 'compliment',
  examples: ['give me a compliment', 'compliment me', 'say something nice'],
  nearMisses: ['what is a compliment', 'compliments for a letter', 'backhanded compliment'],
  match(lower, text) { return isCompliment(text); },
  run,
  suite() {
    const ok = isCompliment('give me a compliment') && isCompliment('compliment me') && !isCompliment('what is a compliment');
    return { ok, got: 'match works' };
  }
};
