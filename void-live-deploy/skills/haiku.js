/**
 * haiku skill: write a short haiku. "write a haiku", "haiku about the void", "make a haiku about rain".
 * Empty surface stays empty. Static templates, no network.
 */
const TEMPLATES = {
  void: ['blank stage waits', 'one quiet line appears', 'nothing until asked'],
  rain: ['soft drops on the pane', 'the world turns a quieter grey', 'then the sky clears'],
  moon: ['half the disc is lit', 'the other half still waiting', 'drag it and see'],
  default: ['a small card appears', 'words settle in five and seven', 'then five again'],
};

function subjectOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/(?:haiku|poem)\s+(?:about|on|for)\s+(?:the\s+)?([a-z ]{2,30})/);
  if (m) return m[1].trim();
  if (/void|blank|empty/.test(t)) return 'void';
  if (/rain|storm/.test(t)) return 'rain';
  if (/moon|night/.test(t)) return 'moon';
  return 'default';
}

function haikuFor(subject) {
  const lines = TEMPLATES[subject] || TEMPLATES.default;
  return lines;
}

function run(text, api) {
  const sub = subjectOf(text);
  const lines = haikuFor(sub);
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = `<h2>haiku${sub !== 'default' ? ' · ' + esc(sub) : ''}</h2>
      <p style="font-style:italic;line-height:1.6">${lines.map(l => esc(l)).join('<br>')}</p>
      <div class="src">Source: static templates · as of 2026-10</div>`;
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: [
    'write a haiku',
    'haiku about the void',
    'make a haiku about rain',
    'haiku about the moon',
  ],
  nearMisses: [
    'what is a haiku',
    'haiku poem history',
    'how to write a haiku',
  ],
  match(lower, text) {
    const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
    if (/what is|history|how to|wikipedia|poem history/.test(t)) return false;
    return /^(?:(?:please\s+)?(?:write|make|give me|create)\s+(?:a\s+|me\s+)?haiku(?:\s+(?:about|on|for)\s+(?:the\s+)?[a-z ]{2,30})?|haiku(?:\s+(?:about|on|for)\s+(?:the\s+)?[a-z ]{2,30})?)$/.test(t);
  },
  run,
};
