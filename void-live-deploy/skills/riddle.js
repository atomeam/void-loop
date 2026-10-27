/**
 * riddle skill — a random riddle
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a riddle", "random riddle", "a riddle please".
 */
const RIDDLES = [
  { q: 'What has keys but can\'t open locks?', a: 'A piano' },
  { q: 'What gets wetter the more it dries?', a: 'A towel' },
  { q: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', a: 'An echo' },
  { q: 'The more you take, the more you leave behind. What am I?', a: 'Footsteps' },
  { q: 'What has a head, a tail, is brown, and has no legs?', a: 'A penny' }
];

export function isRiddle(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+riddle|(?:another|a|random)\s+riddle|riddle(?:\s+please)?|give\s+me\s+a\s+riddle)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
  const el = showPage((p) => {
    p.innerHTML = '<h2>A riddle</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(r.q) + '</p>'
      + '<details style="margin-top:12px"><summary style="cursor:pointer">Show answer</summary><p style="font-size:18px;margin-top:8px">' + esc(r.a) + '</p></details>'
      + '<div class="sub">say “another riddle” for one more</div>';
  });
  return 'riddle';
}

export default {
  name: 'riddle',
  examples: ['tell me a riddle', 'random riddle', 'a riddle', 'another riddle'],
  nearMisses: ['what is a riddle', 'riddle me this joke', 'puzzle game'],
  match(lower, text) { return isRiddle(text); },
  run,
  suite() {
    const ok = isRiddle('tell me a riddle') && isRiddle('random riddle') && !isRiddle('what is a riddle');
    return { ok, got: 'match works' };
  }
};
