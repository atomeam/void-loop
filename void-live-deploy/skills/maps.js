/**
 * maps skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: the maps floor gets its page (/maps/). "directions from lisbon to porto",
 * "cycling route from berlin to potsdam", "walking directions from the louvre to notre dame" answer with a card that opens Verse's maps page with the route in the
 * link (the page asks the router there and draws it), and the same route on Google Maps. A place on its own ("map of lisbon", "directions to kyoto") stays with
 * the place skill, whose card links to the same page. Nothing is fetched here. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const MODE = { car: 'car', driving: 'car', drive: 'car', bike: 'bike', bicycle: 'bike', cycling: 'bike', cycle: 'bike', foot: 'foot', walking: 'foot', walk: 'foot' };
/** { from, to, mode } from a directions ask, or null. Pure. */
export function routeAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = /^(?:(driving|walking|cycling|bike|bicycle|car)\s+)?(?:directions|route|way)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+(?:by|on)\s+(car|bike|bicycle|foot|walking|cycling))?$/i.exec(t)
    || /^(?:how\s+do\s+i\s+)?(walk|cycle|drive|bike)\s+from\s+(.+?)\s+to\s+(.+?)()$/i.exec(t);
  if (!m) return null;
  const from = m[2].replace(/^the\s+/i, '').trim(), to = m[3].replace(/^the\s+/i, '').trim(), mode = MODE[String(m[4] || m[1] || 'car').toLowerCase()] || 'car';
  if (!from || !to || from.length > 100 || to.length > 100 || /\b(moon|mars|space)\b/i.test(from + ' ' + to)) return null;
  return { from, to, mode };
}
// the maps lane's own pages, each for the one job its site does (lib/maps-sites.js)
const PAGES = [
  [/^(?:gpx\s+)?(?:route\s+planner|plan\s+a\s+(?:cycling\s+|walking\s+|hiking\s+|bike\s+)?route|gpx\s+(?:editor|route\s+planner))$/i, '/maps/plan/', 'Route planner', 'tap the map to add points; it follows roads and paths, with the climb, an elevation profile and GPX'],
  [/^(?:what\s+are\s+)?my\s+(?:gps\s+)?coordinates$|^where\s+am\s+i\s+on\s+(?:a|the)\s+map$/i, '/maps/where/', 'Where am I?', 'your coordinates, address and accuracy'],
  [/^(?:latitude\s+and\s+longitude|lat(?:itude)?\s*(?:\/|and)\s*long?(?:itude)?|coordinates|gps\s+coordinates)\s+(?:of|for)\s+(.+)$/i, '/maps/coordinates/', 'Latitude and longitude', 'a place to coordinates, coordinates to an address, DMS and decimal'],
  [/^(?:(?:draw\s+a\s+)?radius\s+around\s+(?:a\s+)?(?:point|place)|draw\s+a\s+radius|map\s+area\s+calculator|measure\s+(?:an\s+)?area\s+on\s+the\s+map)$/i, '/maps/measure/', 'Measure on a map', 'a radius around a point, a path, an area, the elevation'],
];
/** [page with its words, name, what it does] for an ask about one of the lane's jobs, or null. Pure. */
export function pageAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  for (const [re, path, name, does] of PAGES) { const m = re.exec(t); if (m) return [path + (m[1] ? '?q=' + encodeURIComponent(m[1].trim()) : ''), name, does]; }
  return null;
}
function run(text, api) {
  const { showPage, esc } = api, pa = pageAsk(text);
  if (pa) { showPage((el) => { el.dataset.page = pa[0].replace(/\?.*$/, ''); el.innerHTML = '<h2>' + esc(pa[1]) + '</h2><p class="sub">' + esc(pa[2]) + ', on a real map, kept on your device.</p><p><a href="' + esc(pa[0]) + '" style="font-weight:600">Open the page →</a></p><div class="src">Made by Verse · OpenStreetMap data · as of 2026-10</div>'; }); return 'maps'; } // void-review: ok: fixed text and escaped
  const r = routeAsk(text); if (!r) return 'none';
  const page = '/maps/?from=' + encodeURIComponent(r.from) + '&to=' + encodeURIComponent(r.to) + (r.mode !== 'car' ? '&mode=' + r.mode : '');
  const g = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(r.from) + '&destination=' + encodeURIComponent(r.to) + '&travelmode=' + { car: 'driving', bike: 'bicycling', foot: 'walking' }[r.mode];
  const word = { car: 'by car', bike: 'by bike', foot: 'on foot' }[r.mode];
  showPage((el) => {
    el.dataset.page = '/maps/';
    el.innerHTML = '<h2>' + esc(r.from) + ' → ' + esc(r.to) + '</h2><p class="sub">Directions ' + word + ', every turn, on a real map. The route comes from a free OpenStreetMap router at free-flow speed: Verse has no live traffic, and says so.</p>' // void-review: ok: escaped
      + '<p><a href="' + esc(page) + '" style="font-weight:600">Open the route on the maps page →</a></p>'
      + '<p class="sub">Also on <a href="' + esc(g) + '" target="_blank" rel="noopener noreferrer">Google Maps ↗</a> (with its live traffic)</p>'
      + '<div class="src">Made by Verse · OpenStreetMap data · as of 2026-10</div>';
  });
  return 'maps';
}
export default {
  name: 'maps',
  examples: ['directions from lisbon to porto', 'cycling route from berlin to potsdam', 'walking directions from the louvre to notre dame', 'gpx route planner', 'my gps coordinates', 'latitude and longitude of the eiffel tower', 'radius around a point'],
  nearMisses: ['map of lisbon', 'directions to kyoto', 'distance from london to paris', 'route planning tips'],
  match(lower, text) { return !!(routeAsk(text || lower) || pageAsk(text || lower)); },
  run,
};
