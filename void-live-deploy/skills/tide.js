/**
 * tide skill — tide chart for any harbour.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tide chart for Sydney", "tides at the harbour", "next high tide".
 * Uses a free tides API placeholder (no key). Empty surface stays empty.
 */
export function tideOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:tide(?:s| chart)?\s+(?:for|at|in)\s+(.+)|(?:next\s+)?(?:high|low)\s+tide(?:\s+at\s+(.+))?)$/);
  return m ? (m[1] || m[2] || 'harbour').trim() : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = tideOf(text);
  if (!place) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Tide chart · ' + esc(place) + '</h2><div class="sub">looking up…</div>'; });
  // Placeholder: no real API call to avoid inventing tokens. In production use a free service.
  setTimeout(() => {
    if (!api._pageStill || !api._pageStill(el)) return;
    el.innerHTML = '<h2>Tide chart · ' + esc(place) + '</h2><p>High tide around 14:30, low around 08:15 (demo data). Full chart coming once a free tides source is wired.</p><div class="src">Demo · no external call</div>';
  }, 100);
  return 'tide';
}

export default {
  name: 'tide',
  examples: ['tide chart for Sydney', 'tides at the harbour', 'next high tide'],
  nearMisses: ['time', 'weather', 'harbour'],
  match(lower, text) { return !!tideOf(text); },
  run,
  suite() {
    return { ok: tideOf('tide chart for Sydney') === 'sydney' && tideOf('hello') === null };
  },
};
