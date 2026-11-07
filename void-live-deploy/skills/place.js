/**
 * place skill — street map of any place. Open-Meteo geocoding + OpenStreetMap embed, no key.
 * Contract: { name, examples, match(lower, text), run(text, api) }
 */
import { placeTries } from '../lib/where.js';
import { km } from './distance.js';
function placeOf(text) {
  const t = text.trim().replace(/^[¿¡]+/, '').replace(/[?!.]+$/, '');
  const m = t.match(/^(?:show\s+(?:me\s+)?)?(?:a\s+|the\s+)?(?:street\s+)?map\s+(?:of|for)\s+(.+)$/i)
    || t.match(/^(?:mu[eé]strame|mostrar|ver)\s+(.+?)\s+en\s+(?:un\s+)?mapa$/i) // Spanish: "muéstrame Kioto en un mapa"
    || t.match(/^mapa\s+(?:de|del|de\s+la)\s+(.+)$/i) // Spanish: "mapa de kioto"
    || t.match(/^d[oó]nde\s+(?:est[aá]|queda|se\s+encuentra)\s+(.+)$/i) // Spanish: "¿dónde está Kioto?"
    || t.match(/^where\s+(?:is|are|'s)\s+(.+)$/i)
    || t.match(/^(?:streets|neighbou?rhood|area)\s+(?:around|near|of)\s+(.+)$/i)
    || t.match(/^show\s+(?:me\s+)?(.+?)\s+on\s+(?:a\s+|the\s+)?map$/i)
    || t.match(/^(.+?)\s+(?:street\s+)?map$/i);
  if (!m) return null;
  const p = m[1].replace(/^(the\s+)/i, '').trim();
  if (!p || /^(everything|the map|you|i|my \w+|(?:(?:show|open|give|draw)(?: me)? )?(?:the |your |(?:verse|void)'?s |(?:verse|v01d)'?s )?(?:code |import |skill )?dependenc(?:y|ies))$/i.test(p)) return null; // "dependency map" is the deps card, not a street map
  if (/^(?:great\s+circle|flight|flights|flight\s+route|air\s+route)$/i.test(p)) return null; // "great circle map" is the flights map, not a place called "great circle"
  // "what is a map", "how to read a map": a question about maps, not a place called "what is a"
  if (/^(?:what|what'?s|whats|who|whom|whose|why|how|which|when|is|are|was|were|do|does|did|can|could|should|would|will)\b/i.test(p)) return null;
  // "area of a circle with radius 5": geometry, not a neighbourhood
  if (/^(?:a|an|the)?\s*\d+(?:\.\d+)?\s*(?:ft|feet|m|in|cm)?\s*(?:by|x|×)\s*\d/i.test(p)) return null; // "area of a 10 by 12 rectangle"
  if (/^(?:a|an|the)?\s*(?:circle|triangle|rectangle|square|sphere|cylinder|cone|cube|trapezoid|parallelogram|polygon|hexagon|pentagon|ellipse|rhombus)\b/i.test(p)) return null;
  return p;
}

// "how do I get to Kyoto", "directions to Kyoto": the map plus a route link (OpenStreetMap, or Google Maps), from wherever you are
function directionsTo(text) {
  const m = text.trim().replace(/[?!.]+$/, '').match(/^(?:(?:how\s+(?:do\s+i|can\s+i|to)\s+get\s+to)|directions\s+to|route\s+to|take\s+me\s+to|navigate\s+to|get\s+me\s+to)\s+(.+)$/i);
  if (!m) return null;
  const p = m[1].replace(/^(the\s+)/i, '').trim();
  return p && !/^(work|home|school|bed|sleep|the point|it|there|here)$/i.test(p) ? p : null;
}

const label = (r) => r.name + (r.admin1 && r.admin1 !== r.name ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');

const kmText = (n) => (n >= 100 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1)) + ' km';
/** the route a directions card says out loud: a road distance when the router answered, otherwise the straight line, otherwise the map's own name. Pure. */
export function routeWords(road, straight) {
  if (road && Number.isFinite(road.km) && road.km > 0 && Number.isFinite(road.min)) return kmText(road.km) + ' by road, about ' + road.min + ' min from near you.';
  if (Number.isFinite(straight) && straight >= 0) return kmText(straight) + ' in a straight line from near you (roads are longer).';
  return 'Route on openstreetmap.org.';
}
/** the Wikipedia page that is this place: the one whose title shares the most of the asked words, and the one Wikipedia ranked first on a tie. Pure. */
export function wikiHit(pages, q) {
  const words = String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const list = Array.isArray(pages) ? pages : Object.values(pages || {});
  const scored = list.filter((p) => p && p.title && p.coordinates && p.coordinates[0]).map((p) => {
    const title = String(p.title).toLowerCase();
    return { p, hit: words.filter((w) => title.includes(w)).length, index: Number(p.index) || 99 };
  }).filter((s) => s.hit > 0).sort((a, b) => b.hit - a.hit || a.index - b.index);
  const best = scored[0], c = best && best.p.coordinates[0];
  if (!c || !Number.isFinite(+c.lat) || !Number.isFinite(+c.lon)) return null;
  return { name: best.p.title, admin1: '', country: '', latitude: +c.lat, longitude: +c.lon, population: 0 };
}

async function meteoPlaces(place) {
  let rs = [];
  for (const q of placeTries(place)) {
    const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&name=' + encodeURIComponent(q)).then((r) => r.json()); // void-review: ok: tried in order, stops at the first name that resolves (a fallback, not a batch)
    rs = (g.results || []).sort((a, b) => (b.population || 0) - (a.population || 0));
    if (rs.length) break;
  }
  return rs;
}
async function wikiPlace(q) {
  const j = await fetch('https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=8&prop=coordinates&format=json&origin=*&gsrsearch=' + encodeURIComponent(q), { headers: { accept: 'application/json' } }).then((r) => r.json());
  return wikiHit(j && j.query && j.query.pages, q);
}
async function originOf() {
  try {
    const j = await fetch('/api/where').then((r) => r.json());
    if (j && j.ok && Number.isFinite(+j.lat) && Number.isFinite(+j.lon)) return { lat: +j.lat, lon: +j.lon };
  } catch (_) {}
  return null;
}
async function roadOf(origin, r) {
  if (!origin || !r) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 2500);
  try {
    const u = 'https://router.project-osrm.org/route/v1/driving/' + origin.lon + ',' + origin.lat + ';' + r.longitude + ',' + r.latitude + '?overview=false';
    const j = await fetch(u, { signal: ctl.signal, headers: { accept: 'application/json' } }).then((x) => x.json());
    const leg = j && j.routes && j.routes[0];
    if (!leg || !Number.isFinite(leg.distance) || leg.distance <= 0 || !Number.isFinite(leg.duration)) return null;
    return { km: leg.distance / 1000, min: Math.max(1, Math.round(leg.duration / 60)) };
  } catch (_) { return null; } finally { clearTimeout(t); }
}
async function routeFor(origin, r) {
  const road = await roadOf(origin, r);
  const straight = origin ? km({ latitude: origin.lat, longitude: origin.lon }, r) : NaN;
  return routeWords(road, straight);
}

function draw(el, r, others, api, dir, route, origin) {
  const { esc } = api;
  const zoomSpan = r.population > 1000000 ? 0.18 : r.population > 100000 ? 0.08 : 0.03;
  const bbox = [r.longitude - zoomSpan, r.latitude - zoomSpan * 0.6, r.longitude + zoomSpan, r.latitude + zoomSpan * 0.6].join(',');
  const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + r.latitude + ',' + r.longitude;
  const big = 'https://www.openstreetmap.org/?mlat=' + r.latitude + '&mlon=' + r.longitude + '#map=' + (zoomSpan > 0.1 ? 11 : zoomSpan > 0.05 ? 13 : 15) + '/' + r.latitude + '/' + r.longitude;
  const alt = others.filter((o) => o !== r).slice(0, 4);
  el.innerHTML = '<h2>' + esc(r.name) + '</h2><div class="sub">' + esc(label(r).split(', ').slice(1).join(', ')) + '</div>'
    + '<iframe title="map" src="' + src + '" style="width:100%;height:340px;border:0;border-radius:10px;margin:8px 0;filter:saturate(.85)" loading="lazy"></iframe>'
    + (alt.length ? '<div class="sub">Several places share this name; others: ' + alt.map((o, i) => '<a href="#" data-alt="' + i + '">' + esc(label(o)) + '</a>').join(' · ') + '</div>' : '')
    + (dir ? '<p class="dir-route">' + esc(route || 'Route on openstreetmap.org.') + '</p><p class="dir-links">Directions: <a href="https://www.openstreetmap.org/directions?to=' + r.latitude + '%2C' + r.longitude + '" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.google.com/maps/dir/?api=1&destination=' + r.latitude + '%2C' + r.longitude + '" target="_blank" rel="noopener">Google Maps</a> <span class="sub">(starts from where you are)</span></p>' : '')
    + '<div class="src">Source: <a href="' + big + '" target="_blank" rel="noopener">OpenStreetMap</a></div>';
  el.querySelectorAll('[data-alt]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const next = alt[+a.dataset.alt];
    if (!dir) { draw(el, next, others, api, dir, '', origin); return; }
    routeFor(origin, next).then((line) => draw(el, next, others, api, dir, line, origin)).catch(() => draw(el, next, others, api, dir, route, origin));
  }));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const dir = directionsTo(text);
  const place = dir || placeOf(text);
  if (!place) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place) + '</h2><div class="sub">…</div>'; });
  // the whole world: no lookup, the full map
  if (/^(the\s+)?(world|earth|globe|planet)$/i.test(place.trim())) {
    el.innerHTML = '<h2>The world</h2>'
      + '<iframe title="map" src="https://www.openstreetmap.org/export/embed.html?bbox=-170,-58,170,75&amp;layer=mapnik" style="width:100%;height:340px;border:0;border-radius:10px;margin:8px 0;filter:saturate(.85)" loading="lazy"></iframe>'
      + '<div class="src">Source: <a href="https://www.openstreetmap.org/#map=2/20/0" target="_blank" rel="noopener">OpenStreetMap</a></div>';
    return 'place';
  }
  let rs = [], down = false;
  try { rs = await meteoPlaces(place); } catch (_) { down = true; }
  if (!rs.length) {
    try { const w = await wikiPlace(place); if (w) rs = [w]; }
    catch (_) { down = true; }
  }
  if (!api._pageStill(el)) return 'place';
  if (!rs.length) {
    el.innerHTML = down
      ? '<h2>' + esc(place) + '</h2><p>The map service didn\'t answer just now. Ask again in a moment.</p>'
      : '<h2>' + esc(place) + '</h2><p>I couldn\'t find that place yet. Try a city or town name, like "map of Lisbon".</p>';
    if (!down && api.reportMiss) api.reportMiss(text);
    return 'none';
  }
  try {
    const origin = dir ? await originOf() : null;
    const route = dir ? await routeFor(origin, rs[0]) : '';
    if (!api._pageStill(el)) return 'place';
    draw(el, rs[0], rs, api, !!dir, route, origin);
    return 'place';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(place) + '</h2><p>The map service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'place',
  examples: ['map of Lisbon', 'where is Kyoto', 'streets around Penn Station', 'Paris map', 'show Tokyo on a map', 'how do I get to Kyoto', 'directions to the Louvre', 'mapa de Kioto'],
  match(lower, text) { return !!(directionsTo(text) || placeOf(text)); },
  run
};
