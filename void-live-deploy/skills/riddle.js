/**
 * riddle skill — a random riddle, with the answer on request
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a riddle", "riddle", "another riddle".
 */
export function isRiddle(text) {
  return /^(?:please\s+)?(?:(?:tell|give|show)\s+(?:me\s+)?(?:a|an|another)\s+)?riddle(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const RIDDLES = [
  { q: 'What has keys but can’t open locks?', a: 'A piano.' },
  { q: 'What has a head, a tail, is brown, and has no legs?', a: 'A penny.' },
  { q: 'What gets wetter as it dries?', a: 'A towel.' },
  { q: 'What has a neck but no head?', a: 'A bottle.' },
  { q: 'What has many teeth but can’t bite?', a: 'A comb.' },
  { q: 'What is full of holes but still holds water?', a: 'A sponge.' },
  { q: 'What can you catch but not throw?', a: 'A cold.' },
  { q: 'What has one eye but can’t see?', a: 'A needle.' }
];

function run(text, api) {
  const { showPage, esc } = api;
  const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
  let shown = false;
  const update = (p) => {
    p.innerHTML = '<h2>Riddle</h2><p style="font-size:24px;line-height:1.45;text-align:center">' + esc(r.q) + '</p>' +
      (shown ? '<p style="font-size:20px;text-align:center;font-style:italic">' + esc(r.a) + '</p>' : '<div style="text-align:center"><button id="riddle-ans" class="g-btn">Show answer</button></div>') +
      '<div class="sub">say “another riddle” for one more</div><div class="src">Chosen here on this device.</div>';
    if (!shown) {
      p.querySelector('#riddle-ans').addEventListener('click', (e) => { e.stopPropagation(); shown = true; update(p); });
    }
  };
  showPage((p) => update(p));
  return 'riddle';
}

export default {
  name: 'riddle',
  examples: ['riddle', 'tell me a riddle', 'give me a riddle', 'another riddle'],
  nearMisses: ['what is a riddle', 'riddle me this', 'solve this riddle'],
  match(lower, text) { return isRiddle(text); },
  run,
  suite() {
    const ok = isRiddle('riddle') && isRiddle('tell me a riddle') && !isRiddle('what is a riddle');
    return { ok, got: 'match works' };
  }
};
