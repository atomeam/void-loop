/**
 * providers - one adapter per outside service Verse hands you to (food, rides, mail, social). Today every adapter is a deep link:
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
  // mail (asked by Verse, ask-20261028-1856-1: "my email" as a direct command): each opens your own inbox or a filled-in draft in your
  // own mail app; you read and send there, and Verse sees nothing. q: { to, subject, body }.
  gmail: { id: 'gmail', name: 'Gmail', kind: 'mail', order: null,
    web: (q) => (q.to || q.subject || q.body ? 'https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(q.to || '') + '&su=' + enc(q.subject || '') + '&body=' + enc(q.body || '') : 'https://mail.google.com/'),
    app: (q) => 'googlegmail://co?to=' + enc(q.to || '') + '&subject=' + enc(q.subject || '') + '&body=' + enc(q.body || '') },
  outlook: { id: 'outlook', name: 'Outlook', kind: 'mail', order: null,
    web: (q) => (q.to || q.subject || q.body ? 'https://outlook.live.com/mail/0/deeplink/compose?to=' + enc(q.to || '') + '&subject=' + enc(q.subject || '') + '&body=' + enc(q.body || '') : 'https://outlook.live.com/mail/'),
    app: (q) => 'ms-outlook://compose?to=' + enc(q.to || '') + '&subject=' + enc(q.subject || '') + '&body=' + enc(q.body || '') },
  yahoo: { id: 'yahoo', name: 'Yahoo Mail', kind: 'mail', order: null,
    web: (q) => (q.to || q.subject || q.body ? 'https://compose.mail.yahoo.com/?to=' + enc(q.to || '') + '&subject=' + enc(q.subject || '') + '&body=' + enc(q.body || '') : 'https://mail.yahoo.com/'),
    app: () => 'ymail://' },
  proton: { id: 'proton', name: 'Proton Mail', kind: 'mail', order: null,
    web: () => 'https://mail.proton.me/', app: () => 'protonmail://' },
  icloud: { id: 'icloud', name: 'iCloud Mail', kind: 'mail', order: null,
    web: () => 'https://www.icloud.com/mail/', app: () => 'message://' },
};
/** a mailto: link for a draft (your default mail app). Pure. */
export const mailto = (q = {}) => 'mailto:' + (q.to && /@/.test(q.to) ? enc(q.to).replace(/%40/g, '@') : '') + '?subject=' + enc(q.subject || '') + '&body=' + enc(q.body || '');
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
