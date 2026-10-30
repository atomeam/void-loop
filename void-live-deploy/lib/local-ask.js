// The ask for local stations and the link to /local/, shared by every tool page's ask bar (lib/toolkit.js routeAsk), the stage card
// (skills/local-stations.js) and the page; kept apart from lib/local-media.js so the toolkit chain every tool page loads stays small.
/** the link that carries a place to the page: /local/?place=Boston&tab=tv. Pure. */
export function linkOf({ place = '', tab = '' } = {}) {
  const q = new URLSearchParams(); if (place) q.set('place', String(place).slice(0, 60)); if (tab === 'tv' || tab === 'radio') q.set('tab', tab);
  const s = q.toString(); return '/local/' + (s ? '?' + s : '');
}

// the ask that wants local stations, shared by the stage card (skills/local-stations.js) and the ask bar (lib/toolkit.js routeAsk)
const cleanAsk = (text) => String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const KIND = '(radio|tv|television|tv and radio|radio and tv|television and radio|radio and television)';
const PLACE = "([a-z][a-z .,'-]{1,40})";
const NEAR = "(?:near me|nearby|around me|around here|near here|where i am|in my area|in my town|in my city)";
const kindOf = (k) => (/^(?:tv|television)$/.test(k) ? 'tv' : /and/.test(k) ? 'both' : 'radio');
/** what an ask wants: { kind: 'radio' | 'tv' | 'both', place } (place '' for near me), or null when it is not an ask for local stations. Pure. */
export function localAsk(text) {
  let t = cleanAsk(text).toLowerCase().replace(/^(?:please\s+)?(?:(?:show|give|find|get|list)\s+(?:me\s+)?|play\s+|listen\s+to\s+|watch\s+)?(?:the\s+|some\s+)?/, '');
  const q = /^what\s+(?:local\s+)?(radio|tv|television)\s+(?:stations?|channels?)\s+(?:are|is)\s+(?:there\s+)?(near me|nearby|around here|in my area|(?:in|near|around)\s+([a-z][a-z .,'-]{1,40}))$/.exec(t);
  if (q) return { kind: kindOf(q[1]), place: q[3] ? q[3].trim() : '' };
  if (/^(?:what|how|why|who|when|is|are|does|do|can)\b/.test(t)) return null; // a question about radio is not an ask for stations
  if (/^(?:live\s+|local\s+)?radio$/.test(t)) return { kind: 'radio', place: '' };
  let m = new RegExp('^local\\s+' + KIND + '(?:\\s+(?:stations?|channels?))?(?:\\s+' + NEAR + '|\\s+(?:in|near|around|for)\\s+' + PLACE + ')?$').exec(t);
  if (m) return { kind: kindOf(m[1]), place: m[2] ? m[2].trim() : '' };
  m = new RegExp('^' + KIND + '(?:\\s+(?:stations?|channels?))?\\s+(?:' + NEAR + '|(?:in|near|around)\\s+' + PLACE + ')$').exec(t);
  if (m) return { kind: kindOf(m[1]), place: m[2] ? m[2].trim() : '' };
  m = new RegExp('^' + PLACE + '\\s+' + KIND + '\\s+(?:stations?|channels?)$').exec(t);
  if (m && !/^(?:live|free|internet|online|my|the|a|fm|am)$/.test(m[1].trim())) return { kind: kindOf(m[2]), place: m[1].trim() };
  return null;
}

