// /api/holidays?cc=FR: the next public holidays in one country, from Nager.Date (skills/holidays.js). 2026-10-30: on a-to-mind.com
// "holidays in france" said "The holiday list didn't answer." while the same Nager.Date address opened by hand gave the list, so the page
// now asks Verse's own address and Verse asks Nager.Date.
// WHAT A STRANGER COULD MAKE THIS DO: ask Nager.Date for one country by its two letters (the host and the path are fixed here, the caller
// picks only the two letters). A list is kept on the edge for six hours; a failure is never cached. No model, no KV, no database, no write.
const UPSTREAM = 'https://date.nager.at/api/v3/NextPublicHolidays/';
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=21600' : 'no-store' } });
/** the country code a request names, or '' when it is not two letters. Pure. */
export const ccIn = (url) => { const c = String(new URL(url).searchParams.get('cc') || '').trim().toUpperCase(); return /^[A-Z]{2}$/.test(c) ? c : ''; };
/** Nager.Date's rows cut to what the page shows: { date, localName, name }, at most 20, dates as YYYY-MM-DD. Pure. */
export function rowsOf(j) {
  const s = (v) => String(v == null ? '' : v).replace(/[\p{C}]/gu, ' ').trim().slice(0, 120);
  return (Array.isArray(j) ? j : []).filter((h) => h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.date || ''))).slice(0, 20)
    .map((h) => ({ date: String(h.date), localName: s(h.localName), name: s(h.name) }));
}
export async function lookHolidays(cc, fetchFn = fetch) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 5000);
  try {
    const r = await fetchFn(UPSTREAM + cc, { headers: { accept: 'application/json', 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)' }, signal: c.signal, cf: { cacheTtlByStatus: { '200-299': 21600, '300-599': 0 } } });
    if (!r.ok) return { ok: false, kind: r.status === 404 ? 'missing' : 'away' };
    const rows = rowsOf(await r.json());
    return rows.length ? { ok: true, cc, rows } : { ok: false, kind: 'missing' };
  } catch (_) { return { ok: false, kind: 'away' }; } finally { clearTimeout(t); }
}
export async function onRequestGet({ request, fetchFn = fetch }) {
  const cc = ccIn(request.url);
  if (!cc) return reply({ ok: false, kind: 'missing', say: 'send ?cc= with a two-letter country code, like FR' }, 400);
  const out = await lookHolidays(cc, fetchFn);
  return reply(out, out.ok ? 200 : out.kind === 'missing' ? 404 : 502);
}
