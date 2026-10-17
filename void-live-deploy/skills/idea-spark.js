/**
 * idea-spark skill — generates new growth ideas from existing tools and the frontier.
 * "spark an idea", "new growth idea", "what should void build next idea".
 * Uses existing tools list. Empty surface stays empty. Whole job is to come up with new ideas.
 */
export function ideaSparkOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:spark|generate|come up with)\s+(?:an?\s+)?(?:new\s+)?(?:growth\s+)?idea|^(?:new\s+)?idea\s+(?:for|to)\s+(?:void|growth)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!ideaSparkOf(text)) return 'none';
  const ideas = [
    'A skill that turns the miss board into a daily one-line digest on the growth card.',
    'Phone-story posters that auto-include the film\'s experiment name from /api/films.',
    'A dry-run pit-crew that lists the next queued ask without spending.',
    'Surface the weakest family from friction as a one-tap "build this" on the growth card.',
    'Link the better score trend to the will engine so low parts raise their weight.'
  ];
  showPage((p) => {
    p.innerHTML = '<h2>Idea spark</h2><div class="sub">New ideas from what exists</div><ul>' +
      ideas.map((i) => '<li>' + esc(i) + '</li>').join('') +
      '</ul><p>No open items is not an option. These use existing tools: growth card, films API, better.json, families.json.</p><div class="src">Generated in this browser. Nothing sent.</div>';
  });
  return 'idea-spark';
}

export default {
  name: 'idea-spark',
  examples: ['spark an idea', 'new growth idea', 'come up with a new idea for void'],
  nearMisses: ['idea', 'growth', 'what next'],
  match(lower, text) { return ideaSparkOf(text); },
  run,
  suite() {
    return { ok: ideaSparkOf('spark an idea') && !ideaSparkOf('hello') };
  },
};
