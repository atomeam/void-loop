/**
 * providers - one adapter per outside service Verse hands you to (food, rides, social). Today every adapter is a deep link:
 * no account, no key, the order happens in the provider's own app. When a real ordering API exists and Adam has the
 * account, an adapter gains `order(req)` and the cards use it without changing (docs/everything-app.md, "Adapters").
 * Each: { id, name, kind, web(q), app(q), where?, order: null }. Pure (only builds URLs).
 */
const enc = encodeURIComponent;
export const WAYMO_CITIES = ['Phoenix', 'San Francisco Bay Area', 'Los Angeles', 'Dallas', 'Denver', 'Houston', 'Las Vegas', 'Miami', 'Nashville', 'Orlando', 'San Antonio', 'San Diego', 'Tampa'];
export const WAYMO_ON_UBER = ['Austin', 'Atlanta'];
export const PROVIDERS = {
  ubereats: { id: 'ubereats', name: 'Uber Eats', kind: 'food', order: null,
    web: (q) => 'https://www.ubereats.com/search?q=' + enc(q.food || '') + (q.address ? '&pl=' + enc(q.address) : ''),
    app: (q) => 'ubereats://search?q=' + enc(q.food || '') },
  doordash: { id: 'doordash', name: 'DoorDash', kind: 'food', order: null, note: 'some Phoenix-area orders are delivered by a Waymo',
    web: (q) => 'https://www.doordash.com/search/store/' + enc(q.food || 'food') + '/',
    app: (q) => 'doordash://search/store/' + enc(q.food || 'food') },
  waymo: { id: 'waymo', name: 'Waymo', kind: 'ride', order: null,
    web: () => 'https://waymo.com/rides/', app: () => 'https://waymo.com/app/' },
  uber: { id: 'uber', name: 'Uber', kind: 'ride', order: null, note: 'Waymo rides in Austin and Atlanta come through Uber',
    web: (q) => 'https://m.uber.com/ul/?action=setPickup&pickup=my_location' + (q.address ? '&dropoff[formatted_address]=' + enc(q.address) : ''),
    app: (q) => 'uber://?action=setPickup&pickup=my_location' + (q.address ? '&dropoff[formatted_address]=' + enc(q.address) : '') },
  lyft: { id: 'lyft', name: 'Lyft', kind: 'ride', order: null,
    web: () => 'https://www.lyft.com/rider', app: () => 'lyft://ridetype?id=lyft' },
};
/** the adapters of one kind */
export const ofKind = (kind) => Object.values(PROVIDERS).filter((p) => p.kind === kind);
/** where Waymo runs, for a city or in general: { city?, rides: 'waymo'|'uber'|'no', text }. Pure. */
export function waymoWhere(city) {
  const c = String(city || '').trim().toLowerCase();
  const all = 'Waymo gives rides in its own app in ' + WAYMO_CITIES.join(', ') + ', and through Uber in ' + WAYMO_ON_UBER.join(' and ') + '.';
  if (!c) return { rides: 'list', text: all };
  const hit = WAYMO_CITIES.find((x) => x.toLowerCase().startsWith(c) || c.startsWith(x.toLowerCase().split(' ')[0])) || (/\b(?:sf|scottsdale|tempe|mesa|chandler|gilbert|oakland|san jose|la)\b/.test(c) && (/sf|oakland|san jose/.test(c) ? 'San Francisco Bay Area' : /la/.test(c) ? 'Los Angeles' : 'Phoenix'));
  if (hit) return { city: hit, rides: 'waymo', text: 'Yes: Waymo runs in ' + hit + '. Open the Waymo app to ride.' + (hit === 'Phoenix' ? ' Food can come by Waymo there too, through DoorDash.' : '') };
  const u = WAYMO_ON_UBER.find((x) => x.toLowerCase() === c);
  if (u) return { city: u, rides: 'uber', text: 'Yes, through Uber: in ' + u + ' you get a Waymo by choosing it in the Uber app.' };
  return { rides: 'no', text: 'Not yet in ' + city + '. ' + all };
}
