// shared routines — frontier #13's second piece: a routine can spread between Voids. "offer my morning as Sam" sends that
// routine's asks (only them: at most four, short, refused when one holds a secret) with the display name the person chose, to a
// list the owner reviews; nothing is shown to anyone until the owner approves it. "routines from others" shows the approved
// ones with their author. Nothing else about the person is sent or kept: no account, no address, no browser details.
// The route is functions/api/routines.js; the asks are in skills/routine.js.
import { redact } from './automation-fix.js';

export const TABLE = 'CREATE TABLE IF NOT EXISTS void_routines (id TEXT PRIMARY KEY, name TEXT, author TEXT, asks TEXT, state TEXT, at TEXT)';
export const MAX_ASKS = 4, MAX_ASK = 120, MAX_SHOWN = 50;
const NAME_RE = /^[a-z][a-z0-9' -]{1,30}$/;
const AUTHOR_RE = /^[A-Za-z0-9][A-Za-z0-9 .'_-]{0,29}$/;
const NOT_AUTHORS = /^(?:verse|void|the (?:verse|void)|owner|admin|a-to-mind|atomind)$/i; // a name that would read as Verse's own voice

const flat = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** the offer, cut to what may be shared: { name, author, asks } or { error }. Pure. */
export function cleanOffer(o) {
  if (!o || typeof o !== 'object') return { error: 'no offer' };
  const name = flat(o.name).toLowerCase(), author = flat(o.author);
  if (!NAME_RE.test(name)) return { error: 'a routine needs a short name' };
  if (!AUTHOR_RE.test(author) || NOT_AUTHORS.test(author)) return { error: 'a display name is letters, numbers and spaces, up to 30' };
  if (!Array.isArray(o.asks) || !o.asks.length || o.asks.length > MAX_ASKS) return { error: 'a routine is one to ' + MAX_ASKS + ' asks' };
  const asks = [];
  for (const a of o.asks) {
    const t = flat(a);
    if (t.length < 2 || t.length > MAX_ASK) return { error: 'each ask is 2 to ' + MAX_ASK + ' characters' };
    if (redact(t) !== t) return { error: 'an ask holds what looks like a secret, so it stays with you' };
    asks.push(t);
  }
  return { name, author, asks };
}

/** "offer my morning as Sam", "share my morning routine as Sam Lee": { name, author|null }, or null (only a routine that exists). Pure. */
export function offerAsk(text, saved = {}) {
  const m = /^(?:offer|share|publish) my (.+?)(?: routine)?(?: (?:as|by) (.+?))?\s*[.!]*$/i.exec(flat(text));
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/\s+routine$/, '');
  if (!saved || !Object.prototype.hasOwnProperty.call(saved, name)) return null;
  return { name, author: m[2] ? m[2].trim() : null };
}

/** "routines from others", "other people's routines", "shared routines". Pure. */
export function othersAsk(text) {
  const t = flat(text).toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '');
  return /^(?:show(?: me)? |see |list )?(?:(?:the )?routines (?:from|by|of) (?:others|other people)|other (?:people'?s|voids'?) routines|others'? routines|(?:the )?shared routines|routines (?:others|other people) (?:shared|offered))$/.test(t);
}

/** the same offer always gets the same id, so offering it twice is one row */
export async function offerId(o) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([o.author.toLowerCase(), o.name, ...o.asks].join('\n')));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

/** "take Sam's morning routine", "copy Ana's study": { author, name }, or null. Without the word "routine" it is taken only for
 * a pair the list of others showed (seen), so "take Sam's advice" stays an ordinary ask. Pure. */
export function takeAsk(text, seen = []) {
  const m = /^(?:take|copy|use|get|add) ([A-Za-z0-9][A-Za-z0-9 .'_-]{0,29}?)['’]s ([a-z][a-z0-9' -]{1,30}?)( routine)?$/i.exec(flat(text).replace(/[?!.]+$/, ''));
  if (!m || /^(?:my|your|our|their|his|her)$/i.test(m[1])) return null;
  const q = { author: m[1].trim(), name: m[2].toLowerCase() };
  return m[3] || findShared(seen, q) ? q : null;
}

/** the approved routine with this author (any case) and name, or null. Pure. */
export function findShared(list, q) {
  return (Array.isArray(list) ? list : []).find((r) => r && r.name === q.name && String(r.author).toLowerCase() === String(q.author).toLowerCase()) || null;
}

/** the name a taken routine is kept under: its own when free, "<author>'s <name>" when that is yours already; null when one
 * of those already holds exactly its asks (or both names are taken), so taking never replaces a routine of your own. Pure. */
export function takeName(saved, r) {
  saved = saved || {};
  const same = (n) => saved[n] && JSON.stringify(saved[n].asks) === JSON.stringify(r.asks);
  const names = [r.name, (r.author.toLowerCase() + "'s " + r.name).slice(0, 31)];
  if (names.some(same)) return null;
  return names.find((n) => !Object.prototype.hasOwnProperty.call(saved, n)) || null;
}

/** the owner's ask for what waits: "offered routines", "routines waiting", "approve routines". Pure. */
export function pendingAsk(text) {
  const t = flat(text).toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:(?:show|review|see|list) )?(?:(?:the )?(?:offered|pending|waiting) routines|routines (?:waiting|pending|offered)(?: for (?:me|review|a yes))?|routine offers|approve (?:the )?routines)$/.test(t);
}
