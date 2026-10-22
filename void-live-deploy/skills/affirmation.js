/**
 * affirmation skill — a short, positive line when asked.
 * "give me an affirmation", "daily affirmation", "say something nice".
 * Empty surface stays empty: no ask, no card.
 */
const LINES = [
  'You are enough, right now.',
  'Small steps still move you forward.',
  'You have handled hard things before.',
  'Today is a new page.',
  'You are allowed to take a breath.',
  'Progress counts, even when it is quiet.',
  'You belong here.',
  'One kind choice at a time is enough.'
];

export function isAffirmation(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:give\s+me\s+(?:an\s+|a\s+)?affirmation|daily\s+affirmation|an\s+affirmation|say\s+something\s+nice|tell\s+me\s+something\s+nice)$/.test(t);
}

function pick() { return LINES[Math.floor(Math.random() * LINES.length)]; }

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isAffirmation(text)) return 'none';
  const line = pick();
  showPage((p) => { p.innerHTML = '<h2>An affirmation</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(line) + '</p><div class="sub">say it again for another</div>'; });
  return 'affirmation';
}

export default {
  name: 'affirmation',
  examples: ['give me an affirmation', 'daily affirmation', 'say something nice'],
  nearMisses: ['what is an affirmation', 'affirmation meaning', 'negative affirmation'],
  match(lower, text) { return isAffirmation(text); },
  run,
  suite() {
    const ok = isAffirmation('give me an affirmation') && !isAffirmation('what is an affirmation') && LINES.length > 0;
    return { ok, got: LINES[0] };
  },
};
