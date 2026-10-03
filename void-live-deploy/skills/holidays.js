/**
 * holiday skill — the next public holidays in a country (Nager.Date, no key)
 * "public holidays in japan", "next holiday in canada".
 */
const CC = { us: 'US', usa: 'US', america: 'US', 'united states': 'US', uk: 'GB', britain: 'GB', 'united kingdom': 'GB', england: 'GB', canada: 'CA', japan: 'JP', france: 'FR', germany: 'DE', australia: 'AU', brazil: 'BR', mexico: 'MX', india: 'IN', italy: 'IT', spain: 'ES', ireland: 'IE', 'new zealand': 'NZ', sweden: 'SE', norway: 'NO', netherlands: 'NL', portugal: 'PT', 'south korea': 'KR', korea: 'KR' };
export function holidayListOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  // "when is the next holiday", "upcoming holidays": no country named, so this browser's own (en-GB -> GB), else the US
  if (/^(?:when(?:'s|\s+is)\s+the\s+next\s+(?:public\s+|bank\s+)?holiday|(?:the\s+)?next\s+(?:public\s+|bank\s+)?holiday|upcoming\s+(?:public\s+)?holidays|next\s+(?:public\s+)?holidays)$/.test(t)) {
    const region = (typeof navigator !== 'undefined' && /-([A-Za-z]{2})$/.exec(navigator.language || '') || [])[1];
    const cc = region ? region.toUpperCase() : 'US';
    return { cc, name: Object.keys(CC).find((k) => CC[k] === cc && k.length > 2) || cc };
  }
  const m = t.match(/^(?:public\s+holidays(?:\s+in)?|next\s+holiday\s+in|holidays\s+in)\s+(.+)$/);
  if (!m) return null;
  const name = m[1].replace(/^the\s+/, '');
  return CC[name] ? { cc: CC[name], name } : null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = holidayListOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Holidays</h2><div class="sub">…</div>'; });
  try {
    const rows = await fetch('https://date.nager.at/api/v3/NextPublicHolidays/' + q.cc).then((r) => r.json());
    if (!api._pageStill(el)) return 'holidays';
    if (!Array.isArray(rows) || !rows.length) throw 0;
    const lis = rows.slice(0, 8).map((h) => '<li><b>' + esc(h.date) + '</b> · ' + esc(h.localName || h.name) + '</li>').join('');
    el.innerHTML = '<h2>Next holidays · ' + esc(q.name) + '</h2><ul>' + lis + '</ul>'
      + '<div class="src">Source: <a href="https://date.nager.at/PublicHoliday/Country/' + q.cc + '" target="_blank" rel="noopener">Nager.Date</a></div>';
    return 'holidays';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Holidays</h2><p>The holiday list didn\'t answer. "when is christmas" still works on its own.</p>';
    return 'holidays';
  }
}
export default {
  name: 'holidays',
  examples: ['public holidays in japan', 'next holiday in canada', 'holidays in france', 'public holidays in the united states', 'when is the next holiday'],
  nearMisses: ['when is christmas', 'what is a holiday', 'weather in japan', 'map of france'],
  match(lower, text) { return !!holidayListOf(text); },
  run
};
