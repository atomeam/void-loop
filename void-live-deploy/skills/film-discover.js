/**
 * film-discover skill - structured JSON film metadata (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "film discovery skill returns JSON film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery", "discover films", "film metadata", "show film json".
 * Returns a persistent card with JSON of sample / Void film metadata. Empty stage stays empty until asked.
 * Pure matching; no network.
 */
const ASKS = /^(?:please\s+)?(?:(?:show|give|get|open|discover)\s+(?:me\s+)?)?(?:the\s+)?(?:film\s+)?(?:discovery|metadata|json)(?:\s+for\s+films?)?(?:\s+please)?$|^discover\s+films$|^film\s+discovery\s+skill$/i;

export function wantsDiscover(text) {
  return ASKS.test(String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
}

const SAMPLE = [
  { title: 'Void Experiment 001', year: 2026, director: 'V01D', runtime: '1:12', genre: 'experimental', tags: ['void', 'daily', 'browser'] },
  { title: 'Growth Tree', year: 2026, director: 'V01D', runtime: '0:45', genre: 'documentary', tags: ['growth', 'ledger'] },
  { title: 'Convert Card', year: 2026, director: 'V01D', runtime: '0:30', genre: 'demo', tags: ['units', 'stage'] }
];

function run(text, api) {
  const { showPage, esc } = api;
  const json = JSON.stringify(SAMPLE, null, 2);
  showPage((el) => {
    el.innerHTML = '<h2>Film discovery</h2><div class="sub">JSON film metadata</div><pre style="background:rgba(255,255,255,.06);padding:12px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.4">' + esc(json) + '</pre><div class="src">Structured metadata for discovery (asked by Void)</div>';
  });
  return 'film-discover';
}

export default {
  name: 'film-discover',
  examples: [
    'film discovery',
    'discover films',
    'film metadata',
    'show film json',
    'film discovery skill'
  ],
  nearMisses: [
    'films',
    'voids films',
    'best films of 2025',
    'how to film',
    'movie recommendations'
  ],
  match(lower, text) { return wantsDiscover(text || lower); },
  run,
};
