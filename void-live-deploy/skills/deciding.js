/**
 * deciding skill — new skill in the Deciding family. "decide for me", "help me decide". Empty until asked.
 * Asked by Verse (ask-20261020-2131-1).
 */
export function decideOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:help\s+me\s+)?decide(?:\s+for\s+me)?|make\s+a\s+decision|decision\s+help)$/.test(t);
}

function run(text, api) {
  if (!decideOf(text)) return 'none';
  const { showPage } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Decide</h2><p>What are the options? Empty surface until you ask more.</p>';
  });
  api.say('Deciding');
  return 'deciding';
}

export function suite() {
  return decideOf('decide for me') && !decideOf('what is a decision') ? { ok: true } : { ok: false };
}

export default {
  name: 'deciding',
  examples: ['decide for me', 'help me decide', 'make a decision'],
  nearMisses: ['what is a decision', 'decision tree', 'court decision'],
  match(lower, text) { return decideOf(text || lower); },
  run,
  suite,
};
