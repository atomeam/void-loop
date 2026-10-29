/**
 * riddle skill — a random riddle
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a riddle", "random riddle", "another riddle".
 */
const RIDDLES = [
  { q: 'What has keys but can\'t open locks?', a: 'A piano' },
  { q: 'What has a head, a tail, is brown, and has no legs?', a: 'A penny' },
  { q: 'What gets wetter as it dries?', a: 'A towel' },
  { q: 'What has many teeth but can\'t bite?', a: 'A comb' },
  { q: 'What can you catch but not throw?', a: 'A cold' },
  { q: 'What has a neck but no head?', a: 'A bottle' }
];

export function isRiddle(text) {
  return /^(?:please\\s+)?(?:(?:tell\\s+me\\s+|give\\s+me\\s+|random|a|another)\\s+(?:a\\s+)?riddle|(?:riddle)(?:\\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
  showPage((p) => { p.innerHTML = '<h2>A riddle</h2><p style="font-size:22px">' + esc(r.q) + '</p><div class="sub">answer: ' + esc(r.a) + '</div><div class="sub">say “another riddle” for one more</div>'; });
  return 'riddle';
}

export default {
  name: 'riddle',
  examples: ['tell me a riddle', 'random riddle', 'give me a riddle', 'another riddle'],
  nearMisses: ['what is a riddle', 'riddle me this', 'solve this riddle'],
  match(lower, text) { return isRiddle(text); },
  run,
  suite() {
    const ok = isRiddle('tell me a riddle') && isRiddle('random riddle') && !isRiddle('what is a riddle');
    return { ok, got: 'match works' };
  }
};
