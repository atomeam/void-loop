/**
 * riddle skill — a random riddle (static bank, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a riddle", "random riddle", "give me a riddle".
 */
const RIDDLES = [
  { q: "What has keys but can't open locks?", a: "A piano" },
  { q: "What gets wetter the more it dries?", a: "A towel" },
  { q: "What has a head, a tail, is brown, and has no legs?", a: "A penny" },
  { q: "What can travel around the world while staying in a corner?", a: "A stamp" },
  { q: "What has many teeth but can't bite?", a: "A comb" }
];

export function isRiddle(text) {
  return /^(?:please\\s+)?(?:tell\\s+(?:me\\s+)?(?:a|another|one\\s+more)\\s+riddle|(?:another|a|random)\\s+riddle|riddle(?:\\s+please)?|give\\s+me\\s+a\\s+riddle)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
  const el = showPage((p) => { p.innerHTML = '<h2>A riddle</h2><div class="sub">…</div>'; });
  if (!api._pageStill(el)) return 'riddle';
  el.innerHTML = '<h2>A riddle</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(r.q) + '</p><details><summary>Answer</summary><p>' + esc(r.a) + '</p></details><div class="sub">say “another riddle” for one more</div>';
  return 'riddle';
}

export default {
  name: 'riddle',
  examples: ['tell me a riddle', 'random riddle', 'give me a riddle', 'another riddle'],
  nearMisses: ['what is a riddle', 'riddle me this', 'solve this riddle'],
  match(lower, text) { return isRiddle(text); },
  run,
  suite() {
    const ok = isRiddle('tell me a riddle') && isRiddle('random riddle') && !isRiddle('solve this riddle');
    return { ok, got: 'match works' };
  }
};
