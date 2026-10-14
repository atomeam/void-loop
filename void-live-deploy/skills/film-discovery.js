/**
 * film-discovery skill — structured film discovery returning JSON film metadata
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery", "film metadata", "json film", "discover films".
 * Returns a JSON object with film metadata. Empty surface stays empty.
 */
export const FILMS = [
  { title: 'The Void Experiment', year: 2026, director: 'V01D', genre: 'experimental', runtime: '2 min', note: 'Built and shot by Void itself' },
  { title: 'Stage Lights', year: 2026, director: 'A-to-Mind', genre: 'short', runtime: '1 min', note: 'Daily film from the stage' },
  { title: 'Magnetize', year: 2026, director: 'MIT collab', genre: 'science', runtime: '3 min', note: 'The magnetize step' }
];

export function wantsFilmDiscovery(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:film\s+discovery|film\s+metadata|json\s+film|discover\s+films|film\s+json|show\s+film\s+metadata)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsFilmDiscovery(text)) return 'none';
  const meta = { films: FILMS, count: FILMS.length, source: 'Void film discovery' };
  showPage((el) => {
    el.innerHTML = '<h2>Film discovery</h2><pre style="white-space:pre-wrap;font-size:13px;line-height:1.4">' + esc(JSON.stringify(meta, null, 2)) + '</pre><div class="src">Structured JSON film metadata</div>';
  });
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: ['film discovery', 'film metadata', 'json film', 'discover films', 'show film metadata'],
  nearMisses: ['best films of 2025', 'watch films', 'film a timer', 'horror movies'],
  match(lower, text) { return wantsFilmDiscovery(text || lower); },
  run
};
