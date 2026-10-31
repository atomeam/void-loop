/**
 * distance skill — how far one place is from another, as the crow flies (Open-Meteo places, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "distance from London to Paris", "how far is Tokyo from Osaka", "how far from New York to Boston", "is nyc → london".
 * Short names people type (nyc, la, sf, dc, ldn, brum) become the city the place search knows (ALIASES).
 */
// the short names people type for a city, as the place search knows it (it finds nothing for "nyc" or "ldn")
export const ALIASES = {
  nyc: 'New York', ny: 'New York', 'new york city': 'New York', 'the big apple': 'New York', la: 'Los Angeles', sf: 'San Francisco',
  'san fran': 'San Francisco', dc: 'Washington', 'washington dc': 'Washington', philly: 'Philadelphia', vegas: 'Las Vegas',
  nola: 'New Orleans', atl: 'Atlanta', chi: 'Chicago', 'chi-town': 'Chicago', bos: 'Boston', ldn: 'London', brum: 'Birmingham',
  manc: 'Manchester', edi: 'Edinburgh', glasgae: 'Glasgow', hk: 'Hong Kong', kl: 'Kuala Lumpur', bkk: 'Bangkok', cdmx: 'Mexico City'
};
// words that lead or trail an ask but are no part of a place: "is nyc", "from London", "London please" ("the" stays: The Hague)
const LEAD = /^(?:(?:is|it|how|far|distance|from|frm|to|between|whats|what's|what|of)\s+)+/i, TRAIL = /\s+(?:please|pls|plz|distance|away)$/i;
/** A place as the place search wants it: lead words off, the dots of "D.C." or "L.A." gone, a short name made the city it stands for. */
export function placeName(p) {
  let s = String(p || '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(LEAD, '').replace(TRAIL, '').trim();
  const key = s.toLowerCase().replace(/\./g, '').replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIASES[key] || s;
}
// "nyc → london": a bare arrow is a distance only when both ends are words, never a unit or a currency ("usd → eur", "kg -> lb")
const NOT_PLACE = /^(?:[a-z]{3}|usd|eur|gbp|jpy|btc|eth|kg|kgs|g|lb|lbs|oz|km|mi|miles?|kilomet(?:er|re)s?|meters?|metres?|m|cm|mm|ft|feet|inch(?:es)?|in|yards?|celsius|fahrenheit|kelvin|[cfk]|mph|kph|km\/h|liters?|litres?|l|ml|gallons?|cups?|bits?|bytes?|kb|mb|gb|tb|hours?|minutes?|seconds?|days?|weeks?|years?|dollars?|euros?|pounds?|yen|bitcoin|binary|decimal|hex|roman|morse|base\s*\d+)$/i;
const ARROW = /\s*(?:→|⟶|->|=>|➡️?|➜)\s*/;
export function placesOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const out = (a, b, extra) => { const p = { a: placeName(a), b: placeName(b), ...extra }; return p.a && p.b ? p : null; };
  const lead = /^(?:(?:is|how\s+far(?:\s+is(?:\s+it)?)?|(?:what(?:'s| is)\s+the\s+)?distance(?:\s+(?:from|frm|between))?)\s+)/i;
  if (ARROW.test(t) && !/\d/.test(t)) {
    const [x, y, ...rest] = t.split(ARROW);
    if (!rest.length && x && y) {
      const a = placeName(x), b = placeName(y);
      // with a lead word ("is", "how far", "distance") the arrow is surely a distance; bare, each end must be a short name Verse
      // knows or a capitalised name ("Paris → Rome"), and neither a unit nor a currency, so "hello → world" stays with other skills
      const place = (raw, p) => /^[\p{L}][\p{L} .,'-]*$/u.test(p) && (ALIASES[raw.trim().toLowerCase().replace(/\./g, '')] || (/^\p{Lu}/u.test(raw.trim()) && !NOT_PLACE.test(p)));
      if (a && b && (lead.test(x) || (place(x, a) && place(y, b)))) return { a, b };
    }
  }
  const m = t.match(/^(?:what(?:'s| is)\s+the\s+)?distance\s+(?:from|frm|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i) // "distance frm Lyon to Turin"
    || t.match(/^how\s+far\s+(?:is\s+(?:it\s+)?)?(?:(?:from|frm)\s+)?(.+?)\s+to\s+(.+)$/i); // "how far is nyc to london": "is" is no part of the place
  if (m) return out(m[1], m[2]);
  const n = t.match(/^how\s+far\s+(?:away\s+)?is\s+(.+?)\s+(?:from|frm)\s+(.+)$/i); // the separator mistyped
  if (n) return out(n[2], n[1]);
  const q = t.match(/^(.+?)\s+to\s+(.+?)\s+distance$/i); // "Lyon to Turin distance"
  if (q) return out(q[1], q[2]);
  const k = t.match(/^(?:how many\s+)?(?:km|kilomet(?:er|re)s?|miles?|mi)\s+from\s+(.+?)\s+to\s+(.+)$/i); // "how many km from Lyon to Turin", "km from Lyon to Turin"
  if (k) return out(k[1], k[2]);
  const f = t.match(/^how\s+long\s+(?:is\s+(?:the|a)\s+flight|does\s+it\s+take\s+to\s+fly)\s+from\s+(.+?)\s+to\s+(.+)$/i); // "how long is the flight from London to New York"
  if (f) return out(f[1], f[2], { flight: true });
  // "flight distance from London to Paris", "air distance New York to Tokyo": the same crow-flies distance, with the flight time
  const g = t.match(/^(?:what(?:'s| is)\s+the\s+)?(?:flight|flying|air)\s+distance\s+(?:(?:from|frm|between)\s+)?(.+?)\s+(?:to|and)\s+(.+)$/i);
  if (g) return out(g[1], g[2], { flight: true });
  return null;
}
// a rough nonstop flight time: about 800 km/h cruising plus half an hour for climb and descent
export function flightTime(d) {
  const mins = Math.round((d / 800 + 0.5) * 60 / 5) * 5;
  return 'About ' + (mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + (mins % 60) + ' min' : '') : mins + ' min');
}
export async function geo(name) {
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=' + encodeURIComponent(name.split(',')[0])).then((r) => r.json());
  return ((g && g.results) || []).sort((x, y) => (y.population || 0) - (x.population || 0))[0] || null;
}
export function km(a, b) {
  const R = 6371.0088, rad = (d) => d * Math.PI / 180;
  const dl = rad(b.latitude - a.latitude), dn = rad(b.longitude - a.longitude);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = placesOf(text);
  if (!q) return 'none';
  const title = q.a + ' → ' + q.b;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  try {
    const [a, b] = await Promise.all([geo(q.a), geo(q.b)]);
    if (!api._pageStill(el)) return 'distance';
    if (!a || !b) { el.innerHTML = '<h2>' + esc(title) + '</h2><p>I couldn\'t find “' + esc(!a ? q.a : q.b) + '”. Try a city name.</p>'; return 'none'; }
    const d = km(a, b), mi = d * 0.621371;
    const lab = (r) => r.name + (r.country ? ', ' + r.country : '');
    el.innerHTML = '<h2>' + esc(a.name + ' → ' + b.name) + '</h2><div class="sub">' + esc(lab(a)) + ' to ' + esc(lab(b)) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(Math.round(d).toLocaleString()) + ' km</div>'
      + '<p style="color:#8a8a8a">' + esc(Math.round(mi).toLocaleString()) + ' miles, in a straight line (roads are longer)</p>'
      + (q.flight ? '<p>' + esc(flightTime(d)) + ' in the air, roughly: airliner speed plus half an hour for take-off and landing. A real schedule depends on winds and the route.</p>' : '')
      + '<p class="dir-links">Route: <a href="https://www.openstreetmap.org/directions?from=' + a.latitude + '%2C' + a.longitude + '&to=' + b.latitude + '%2C' + b.longitude + '" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.google.com/maps/dir/?api=1&origin=' + a.latitude + '%2C' + a.longitude + '&destination=' + b.latitude + '%2C' + b.longitude + '" target="_blank" rel="noopener">Google Maps</a></p>'
      + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (places) · great-circle distance</div>';
    return 'distance';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>The place service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'distance',
  examples: ['distance from London to Paris', 'how far is Tokyo from Osaka', 'how far from New York to Boston', 'how far is nyc to london', 'is nyc → london', 'nyc -> la'],
  nearMisses: ['how far is the moon', 'distance learning', 'map of Paris', 'time difference between London and Tokyo', 'usd → eur', '5 km -> miles', 'celsius -> fahrenheit', 'kg → lb'],
  match(lower, text) { const p = placesOf(text); return !!p && !/\b(moon|sun|mars|space|stars?)\b/i.test(p.a + ' ' + p.b); },
  run
};
