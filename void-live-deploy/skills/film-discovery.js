/**
 * film-discovery skill — returns structured JSON film metadata.
 * "discover films", "film discovery", "film metadata json".
 * Empty surface stays empty. No external calls; returns a small curated sample as JSON.
 * Matches the ask for structured film metadata output.
 */
const SAMPLE = [
  { title: 'Void Experiment 001', year: 2026, director: 'V01D', runtime: 42, genres: ['experimental', 'short'], status: 'daily' },
  { title: 'Growth Tree', year: 2026, director: 'V01D', runtime: 18, genres: ['documentary', 'animation'], status: 'reviewed' },
  { title: 'Stage Summons', year: 2026, director: 'V01D', runtime: 27, genres: ['interactive', 'demo'], status: 'pending' },
];

export function wantsDiscovery(lower) {
  return /^(?:(?:show|get|return|give\s+me)\s+(?:the\s+)?)?(?:film\s+discovery|discover\s+films?|film\s+metadata(?:\s+json)?|json\s+film\s+metadata)(?:\s+please)?$/i.test(String(lower || '').trim());
}

export function metadata() {
  return { films: SAMPLE, count: SAMPLE.length, asOf: '2026-10-14', source: 'void-internal' };
}

function run(text, api) {
  const { showPage, esc } = api;
  const data = metadata();
  showPage((el) => {
    el.innerHTML = '<h2>Film discovery</h2><div class="sub">structured metadata</div>'
      + '<pre style="background:#111;padding:12px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.4">' + esc(JSON.stringify(data, null, 2)) + '</pre>'
      + '<div class="src">Internal sample. Empty stage stays empty.</div>';
  });
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: ['film discovery', 'discover films', 'film metadata json'],
  nearMisses: ['films', 'voids films', 'best films of 2025', 'where do I watch the films'],
  match(lower) { return wantsDiscovery(lower); },
  run,
  suite() {
    const m = metadata();
    return { ok: m.count === 3 && m.films[0].title.includes('Void'), got: m.count };
  }
};
