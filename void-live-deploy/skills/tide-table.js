/**
 * tide-table skill — a tide chart for any harbour.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tide table for lisbon", "high tide in any harbour".
 * Shows a simple next-high/low card. Uses no key. Empty surface stays empty.
 * New idea from the growth ledger.
 */
export function harbourOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:tide\s+table\s+for\s+|high\s+tide\s+in\s+|tides?\s+(?:for|in|at)\s+)(.+)$/i);
  return m ? m[1].trim() : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const h = harbourOf(text);
  if (!h) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Tide table</h2><div class="sub">for ' + esc(h) + '…</div>'; });
  // Free NOAA-style sample; real harbour lookup is a later step. Empty until asked.
  const sample = { high: '14:22', low: '08:15', height: '1.8 m' };
  el.innerHTML = '<h2>Tide table · ' + esc(h) + '</h2><div class="sub">next high ' + sample.high + ' · next low ' + sample.low + ' · ' + sample.height + '</div>'
    + '<div class="src">Sample times · harbour lookup ships next · no key</div>';
  return 'tide-table';
}

export function suite() {
  const ok = harbourOf('tide table for lisbon') === 'lisbon' && harbourOf('weather') === null;
  return { ok, got: ok ? '' : 'harbourOf' };
}

export default {
  name: 'tide-table',
  examples: ['tide table for lisbon', 'high tide in any harbour'],
  nearMisses: ['weather', 'calendar'],
  suite,
  match(lower, text) { return !!harbourOf(text || lower); },
  run
};
