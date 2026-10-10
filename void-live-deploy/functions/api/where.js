// Where is this connection, roughly? Cloudflare already knows a coarse place for every request (request.cf, city level). The sky world
// and the sunrise, moon and aurora answers use it so a visitor does not have to type a city. Hostile read: it takes no input at all,
// writes nothing, calls no model and sends back only what the caller's own connection already says about itself, rounded to a tenth of
// a degree (about 11 km); the guard's per-connection limit covers it, and it is never cached, so one visitor's place is not served to another.
const round1 = (x) => Math.round(Number(x) * 10) / 10;
export function onRequestGet({ request }) {
  const cf = (request && request.cf) || {}, lat = Number(cf.latitude), lon = Number(cf.longitude), ok = Number.isFinite(lat) && Number.isFinite(lon);
  return Response.json({ ok, lat: ok ? round1(lat) : null, lon: ok ? round1(lon) : null, city: String(cf.city || '').slice(0, 80), country: String(cf.country || '').slice(0, 2), timezone: String(cf.timezone || '').slice(0, 60) },
    { headers: { 'cache-control': 'private, no-store' } });
}
