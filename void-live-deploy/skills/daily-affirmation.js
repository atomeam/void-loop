/**
 * daily-affirmation skill — a fresh positive affirmation on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "daily affirmation", "give me an affirmation", "positive thought for today".
 * Empty surface stays empty.
 */
const AFFIRMATIONS = [
  'I am capable of more than I know.',
  'Today I choose kindness for myself.',
  'I grow stronger with every challenge.',
  'My mind is clear and focused.',
  'I am enough, exactly as I am.',
  'Progress, not perfection.',
  'I attract positive energy.',
  'I trust the process.',
  'I am resilient.',
  'Today is a good day to begin again.',
];

export function affirmationOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:give me|show me|daily|a)\s+)?(?:an?\s+)?(?:daily\s+)?affirmation(?:\s+for\s+today)?$|positive\s+(?:thought|affirmation)/.test(t) ? true : null;
}

function pick() {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return AFFIRMATIONS[seed % AFFIRMATIONS.length];
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!affirmationOf(text)) return 'none';
  const phrase = pick();
  showPage((el) => {
    el.innerHTML = '<h2>Daily affirmation</h2><div class="sub" style="font-size:18px;line-height:1.4;margin:12px 0">' + esc(phrase) + '</div><div class="src">A new one each day, kept in this browser.</div>';
  });
  return 'daily-affirmation';
}

export default {
  name: 'daily-affirmation',
  examples: ['daily affirmation', 'give me an affirmation', 'positive thought for today'],
  nearMisses: ['affirmative action', 'what is an affirmation', 'feelings', 'breath'],
  match(lower, text) { return !!affirmationOf(text); },
  run,
  suite() {
    return { ok: affirmationOf('daily affirmation') === true && affirmationOf('hello') === null && pick().length > 5 };
  },
};
