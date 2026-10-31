/**
 * holiday skill — the next public holidays in a country (Nager.Date, no key)
 * "public holidays in japan", "next holiday in canada".
 */
const CC = { us: 'US', usa: 'US', america: 'US', 'united states': 'US', uk: 'GB', britain: 'GB', 'united kingdom': 'GB', england: 'GB', canada: 'CA', japan: 'JP', france: 'FR', germany: 'DE', australia: 'AU', brazil: 'BR', mexico: 'MX', india: 'IN', italy: 'IT', spain: 'ES', ireland: 'IE', 'new zealand': 'NZ', sweden: 'SE', norway: 'NO', netherlands: 'NL', portugal: 'PT', 'south korea': 'KR', korea: 'KR' };
// the list comes from Verse's own address (functions/api/holidays.js), which asks Nager.Date: the page asking Nager.Date itself got no answer on a-to-mind.com (2026-10-30)
export const holidaysUrl = (cc) => '/api/holidays?cc=' + encodeURIComponent(cc);
export function holidayListOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  // "when is the next holiday", "upcoming holidays": no country named, so this browser's own (en-GB -> GB), else the US
  // "is today a holiday", "is it a bank holiday today", "holidays today": the same list, with a line saying whether today is one
  // ("is tomorrow a holiday", "is it a holiday tomorrow": the same for tomorrow)
  const d = t.match(/^is\s+(today|tomorrow|it)\s+a\s+(?:public\s+|bank\s+|federal\s+|national\s+)?holiday(?:\s+(today|tomorrow))?$|^(?:any\s+)?(?:public\s+|bank\s+)?holidays?\s+(today|tomorrow)$/);
  const when = d && (d[2] || d[3] || (d[1] === 'it' ? 'today' : d[1]));
  const today = !!when;
  if (today || /^(?:when(?:'s|\s+is)\s+the\s+next\s+(?:public\s+|bank\s+)?holiday|(?:the\s+)?next\s+(?:public\s+|bank\s+)?holiday|upcoming\s+(?:public\s+)?holidays|next\s+(?:public\s+)?holidays)$/.test(t)) {
    const region = (typeof navigator !== 'undefined' && /-([A-Za-z]{2})$/.exec(navigator.language || '') || [])[1];
    const cc = region ? region.toUpperCase() : 'US';
    return { cc, name: Object.keys(CC).find((k) => CC[k] === cc && k.length > 2) || cc, today, when: when || '' };
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
    const out = await fetch(holidaysUrl(q.cc)).then((r) => r.json());
    const rows = out && out.ok ? out.rows : null;
    if (!api._pageStill(el)) return 'holidays';
    if (!Array.isArray(rows) || !rows.length) throw 0;
    const lis = rows.slice(0, 8).map((h) => '<li><b>' + esc(h.date) + '</b> · ' + esc(h.localName || h.name) + '</li>').join('');
    let todayLine = '';
    if (q.today) {
      const d = new Date(); if (q.when === 'tomorrow') d.setDate(d.getDate() + 1);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const hit = rows.find((h) => h.date === iso);
      todayLine = '<p>' + (hit ? 'Yes: ' + (q.when === 'tomorrow' ? 'tomorrow' : 'today') + ' is ' + esc(hit.localName || hit.name) + '.' : 'No, ' + (q.when === 'tomorrow' ? 'tomorrow' : 'today') + ' is not a public holiday in ' + esc(q.name) + '.') + '</p>';
    }
    el.innerHTML = '<h2>Next holidays · ' + esc(q.name) + '</h2>' + todayLine + '<ul>' + lis + '</ul>'
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
