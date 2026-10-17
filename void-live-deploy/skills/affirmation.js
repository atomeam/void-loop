/**
 * affirmation skill — daily affirmation card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "daily affirmation", "give me an affirmation", "affirmation card".
 * Shows a simple positive affirmation card. Empty surface stays empty.
 */
const AFFIRMATIONS = [
  'I am capable of handling whatever comes my way.',
  'I choose progress over perfection.',
  'My efforts are enough.',
  'I trust myself to make good decisions.',
  'I am growing every day.',
  'I deserve good things.',
  'I am present and focused.',
  'I release what I cannot control.',
];

export function affirmationOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:give me|show|get)\s+(?:a\s+)?(?:daily\s+)?)?affirmation(?:\s+card)?$/.test(t)
    || /^(?:daily\s+)?affirmation(?:\s+please)?$/.test(t);
}

function todayIndex() {
  const d = new Date();
  return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % AFFIRMATIONS.length;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!affirmationOf(text)) return 'none';
  const line = AFFIRMATIONS[todayIndex()];
  showPage((p) => {
    p.innerHTML = '<h2>Daily affirmation</h2><p style="font-size:1.2em;line-height:1.4;margin:16px 0">' + esc(line) + '</p>'
      + '<div class="src">A new one each day. Drawn locally.</div>';
  });
  return 'affirmation';
}

export default {
  name: 'affirmation',
  examples: ['daily affirmation', 'give me an affirmation', 'affirmation card'],
  nearMisses: ['what is an affirmation', 'motivation', 'positive thinking'],
  match(lower, text) { return affirmationOf(text); },
  run,
  suite() {
    return { ok: affirmationOf('daily affirmation') && !affirmationOf('hello world') };
  },
};
