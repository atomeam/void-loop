/**
 * eat skill - help someone get food from a real restaurant (owner, 2026-10-23: an assistant's job is to help with exactly this,
 * "order food from LoveBird in Lakeland"). Asks: "order food from lovebird in lakeland", "what's good at lovebird lakeland",
 * "lovebird lakeland menu", "what should i get at joe's pizza", "i'm hungry", "food near me".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * A named restaurant: OpenStreetMap (Nominatim, no key) finds it: address, hours, phone, website, cuisine, a map. The card gives
 * every way to order (its own site, a call, DoorDash, Uber Eats, Grubhub, Google Maps) and what people get there (the answer
 * engine, /api/answer, labelled as such: check the menu). No restaurant named: the places to eat around the visitor
 * (/api/where, Overpass), each one tap from its own card. Verse never pays or places the order itself: no card, no account.
 */
const STORES = /^(?:math|maths|school|work|sports?|games?|chess|life|coding|this|that|it|everything|nothing|amazon|ebay|walmart\.com|etsy|aliexpress|temu|shein|the internet|online|my (?:list|cart))$/i;
const NOT_MENU = /^(?:the|a|my|your|main|start|settings?|context|options?|show|open|close|hide|game|pause|verse|void|v01d|app|site|page|drop ?down|hamburger|top|side|nav(?:igation)?)$/i;
const FOOD = '(?:food|dinner|lunch|breakfast|brunch|takeout|take-out|take out|delivery|pizza|chicken|burgers?|tacos?|sushi|wings|something(?: to eat)?)';

/** the restaurant (and maybe the place) an ask names: { q } | { near: true } | null */
export function eatOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:i'?m|i am|im) (?:so |really )?(?:hungry|starving)$|^(?:food|restaurants?|places to eat|somewhere to eat|takeout|delivery) (?:near me|nearby|around here)$|^where (?:can|should) i eat(?: near me| nearby| around here)?$|^order (?:me )?(?:some )?(?:food|dinner|lunch|takeout|delivery)$/i.test(t)) return { near: true };
  let m = t.match(new RegExp('^(?:(?:can you |help me |i want to |let\'?s )?(?:order|get) (?:me )?(?:some )?' + FOOD + '? ?from|what(?:\'s| is) (?:good|best) (?:at|from)|what should i (?:get|order|eat) (?:at|from)|what to (?:get|order) (?:at|from)|menu (?:for|at|of))\\s+(.+)$', 'i'));
  if (!m) m = t.match(/^(.+?)\s+menu$/i);
  if (!m) return null;
  const q = m[1].replace(/^the\s+/i, '').trim();
  if (!q || STORES.test(q) || NOT_MENU.test(q) || q.split(' ').length > 9) return null;
  return { q };
}

const NOM = 'https://nominatim.openstreetmap.org/search?format=jsonv2&extratags=1&addressdetails=1&limit=8&q=';
const NOM_TOWN = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&featureType=settlement&q=';
const EATS = /^(?:restaurant|fast_food|cafe|food_court|bar|pub|ice_cream|bakery|deli|confectionery)$/;
const isEats = (r) => EATS.test(r.type || '') || !!(r.extratags && r.extratags.cuisine);
const saysTown = (q) => /\s(?:in|near|at|on)\s/i.test(q);

async function where() { try { const r = await fetch('/api/where'); const j = await r.json(); return j && j.ok ? j : null; } catch (_) { return null; } }

const TOWN = /\s+(?:in|near|at|on)\s+(.+)$/i;
/** the town said in the ask ("lovebird in lakeland" -> "lakeland"), or ''. Pure. */
export function townOf(q) { return ((String(q || '').match(TOWN) || [])[1] || '').trim(); }

// box: [west, north, east, south]; bounded keeps the results inside it, otherwise it only ranks them
async function search(s, box, bounded) {
  const url = NOM + encodeURIComponent(s) + (box ? '&viewbox=' + box.join(',') + (bounded ? '&bounded=1' : '') : '');
  const rs = await fetch(url, { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => []);
  return (Array.isArray(rs) ? rs : []).filter(isEats);
}

// the area of a town by name, widened a little so a place on its edge counts, or null
async function townBox(town) {
  const rs = await fetch(NOM_TOWN + encodeURIComponent(town), { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => []);
  const b = Array.isArray(rs) && rs[0] && rs[0].boundingbox; // [south, north, west, east], as text
  const [s, n, w, e] = Array.isArray(b) ? b.map(Number) : [];
  return [s, n, w, e].every(Number.isFinite) ? [w - 0.1, n + 0.1, e + 0.1, s - 0.1] : null;
}

/**
 * find the restaurant from the whole phrase ("lovebird almost famous chicken lakeland", "lovebird in lakeland"), near the visitor when no
 * town is said. A town said is kept: when the name and the town together find nothing, the name alone is looked for inside that town only,
 * never anywhere in the world (2026-10-30: "order food from lovebird in lakeland" showed a Lovebird in Pennsylvania).
 */
export async function findPlace(q, here) {
  const town = townOf(q), name = q.replace(TOWN, '');
  const near = here && !town ? [here.lon - 0.6, here.lat + 0.6, here.lon + 0.6, here.lat - 0.6] : null;
  const first = await search(town ? name + ' ' + town : q, near);
  if (first.length || !town) return first;
  const box = await townBox(town);
  return box ? search(name, box, true) : [];
}

const addrOf = (r) => { const a = r.address || {}; return [[a.house_number, a.road].filter(Boolean).join(' '), a.city || a.town || a.village || a.suburb, a.state].filter(Boolean).join(', '); };
const nameOf = (r) => r.name || (r.display_name || '').split(',')[0];
const http = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u);

/** every way to order, as [label, url]: its own site, a call, the delivery apps searched for it, the map */
export function orderLinks(name, town, tags) {
  const out = [], site = tags && (tags.website || tags['contact:website'] || tags.url), phone = tags && (tags.phone || tags['contact:phone']);
  if (site) out.push(['Its own site', http(site)]);
  if (phone) out.push(['Call ' + phone, 'tel:' + phone.replace(/[^\d+]/g, '')]);
  out.push(['DoorDash', 'https://www.doordash.com/search/store/' + encodeURIComponent(name) + '/']);
  out.push(['Uber Eats', 'https://www.ubereats.com/search?q=' + encodeURIComponent(name)]);
  out.push(['Grubhub', 'https://www.grubhub.com/search?queryText=' + encodeURIComponent(name)]);
  out.push(['Google Maps', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + (town ? ' ' + town : ''))]);
  return out;
}
const buttons = (links, esc) => links.map(([l, u]) => '<a class="g-btn" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(l) + '</a>').join(' ');

async function picks(name, town) {
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ask: 'At the restaurant "' + name + '"' + (town ? ' in ' + town : '') + ', what do people most recommend ordering? Name 3 to 5 actual menu items, one short line each with what is in it. If you do not know this restaurant, say so in one line instead of guessing.' }) });
    const j = await r.json();
    return j && typeof j.answer === 'string' ? j.answer.replace(/<[^>]*>/g, '').trim().slice(0, 900) : '';
  } catch (_) { return ''; }
}

function draw(el, r, others, api) {
  const { esc } = api, t = r.extratags || {}, a = r.address || {}, town = a.city || a.town || a.village || '';
  const name = nameOf(r), lat = +r.lat, lon = +r.lon, d = 0.006;
  el.dataset.eat = name;
  el.innerHTML = '<h2>' + esc(name) + '</h2>' // void-review: ok (every value escaped)
    + '<div class="sub">' + esc([t.cuisine && t.cuisine.replace(/[;_]/g, ' '), addrOf(r)].filter(Boolean).join(' · ')) + '</div>'
    + (t.opening_hours ? '<p><b>Hours:</b> ' + esc(t.opening_hours) + '</p>' : '<p class="sub">Hours not listed: check before you go.</p>')
    + '<p class="eat-order"><b>Order:</b> ' + buttons(orderLinks(name, town, t), esc) + '</p>'
    + '<div class="eat-picks"><b>What people get there</b><p class="sub">asking…</p></div>'
    + (Number.isFinite(lat) && Number.isFinite(lon) ? '<iframe title="map" src="https://www.openstreetmap.org/export/embed.html?bbox=' + (lon - d) + ',' + (lat - d) + ',' + (lon + d) + ',' + (lat + d) + '&amp;layer=mapnik&amp;marker=' + lat + ',' + lon + '" style="width:100%;height:220px;border:0;border-radius:10px;margin:8px 0" loading="lazy"></iframe>' : '')
    + (others.length > 1 ? '<div class="sub">Not this one? ' + others.slice(0, 4).map((o, i) => (o === r ? '' : '<a href="#" data-alt="' + i + '">' + esc(nameOf(o) + ', ' + addrOf(o)) + '</a>')).filter(Boolean).join(' · ') + '</div>' : '')
    + '<div class="src">Place: <a href="https://www.openstreetmap.org/' + esc(String(r.osm_type || 'node')) + '/' + esc(String(r.osm_id || '')) + '" target="_blank" rel="noopener">OpenStreetMap</a>. Verse finds it and every way to order; you place the order.</div>';
  el.querySelectorAll('[data-alt]').forEach((x) => x.addEventListener('click', (e) => { e.preventDefault(); draw(el, others[+x.dataset.alt], others, api); }));
  picks(name, town).then((p) => {
    const box = el.querySelector('.eat-picks'); if (!box || el.dataset.eat !== name) return;
    box.innerHTML = '<b>What people get there</b>' + (p ? '<p style="white-space:pre-line;margin:4px 0">' + esc(p) + '</p><div class="sub">From Verse\'s answer engine, not the restaurant: check the menu when you order.</div>' // void-review: ok (escaped)
      : '<p class="sub">Verse couldn\'t say just now: the menu is on its site or the delivery apps above.</p>');
  });
}

async function nearby(el, api) {
  const { esc } = api, here = await where();
  if (!here) { el.innerHTML = '<h2>Food near you</h2><p>Verse couldn\'t tell where you are. Name the place: "order food from LoveBird in Lakeland".</p>'; return; }
  const ql = '[out:json][timeout:15];node(around:2500,' + here.lat + ',' + here.lon + ')[amenity~"^(restaurant|fast_food|cafe)$"][name];out 14;';
  const j = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(ql)).then((r) => r.json()).catch(() => null);
  const ps = ((j && j.elements) || []).filter((p) => p.tags && p.tags.name);
  el.innerHTML = '<h2>Food near ' + esc(here.city || 'you') + '</h2>' // void-review: ok (escaped)
    + (ps.length ? '<p class="sub">Tap one for its hours, every way to order, and what people get there.</p><ul>' + ps.map((p, i) => '<li><a href="#" data-i="' + i + '">' + esc(p.tags.name) + '</a>' + (p.tags.cuisine ? ' <span class="sub">' + esc(p.tags.cuisine.replace(/[;_]/g, ' ')) + '</span>' : '') + '</li>').join('') + '</ul>'
      : '<p>Verse found no restaurants listed near you just now. Name one: "order food from LoveBird in Lakeland".</p>')
    + '<div class="src">Places: <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>, around your connection\'s rough location</div>';
  el.querySelectorAll('[data-i]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const p = ps[+a.dataset.i];
    draw(el, { name: p.tags.name, lat: p.lat, lon: p.lon, extratags: p.tags, address: { city: here.city }, osm_type: 'node', osm_id: p.id }, [], api);
  }));
}

async function run(text, api) {
  const e = eatOf(text);
  if (!e) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(e.q || 'Food near you') + '</h2><div class="sub">finding it…</div>'; });
  try {
    if (e.near) { await nearby(el, api); return 'eat'; }
    const rs = await findPlace(e.q, saysTown(e.q) ? null : await where());
    if (api._pageStill && !api._pageStill(el)) return 'eat';
    if (!rs.length) {
      const town = townOf(e.q), name = town ? e.q.replace(TOWN, '') : e.q;
      el.innerHTML = '<h2>' + esc(e.q) + '</h2><p>' + (town ? 'Verse couldn\'t find ' + esc(name) + ' in ' + esc(town) + ' on the map. Order through these:' // void-review: ok (escaped)
        : 'Verse couldn\'t find that restaurant on the map. Add the town ("… in Lakeland"), or order through these:') + '</p>'
        + '<p class="eat-order">' + buttons(orderLinks(name, town, null), esc) + '</p>';
      if (api.reportMiss) api.reportMiss(text);
      return 'eat';
    }
    draw(el, rs[0], rs, api);
  } catch (_) {
    el.innerHTML = '<h2>' + esc(e.q || 'Food near you') + '</h2><p>The map service didn\'t answer just now. Ask again in a moment.</p>';
  }
  return 'eat';
}

export default {
  name: 'eat',
  examples: [
    'order food from lovebird in lakeland',
    "what's good at lovebird almost famous chicken lakeland",
    'lovebird lakeland menu',
    'what should i get at lovebird',
    "i'm hungry",
    'food near me'
  ],
  nearMisses: [
    'calories in a banana',
    'map of Lisbon',
    'order from amazon',
    'show menu',
    'order of operations'
  ],
  match(lower, text) { return !!eatOf(text || lower); },
  run
};
