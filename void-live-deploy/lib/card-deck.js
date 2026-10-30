// Verse's one card record and the binder on this device (owner, 2026-10-22: "ONE universal card system for all of Verse", "a saved cards
// collection ... sorted and filtered by kind/game/date, searchable, readable full text"; "every card you've ever gotten is playable").
// Every card Verse shows (an answer, a skill, a game's card such as a board game's deed or chance card, a store item) is one record:
//   { id, kind: 'answer'|'skill'|'game'|'board'|'store', game, t (title), k (type line), b (the full body), src (source count), rarity, at, saved }
// Every card you are shown is noted here (so your playable deck grows just by using Verse); "save" pins one in the binder. It lives only in this
// browser's localStorage, never on a server, and holds no names. Pure functions take and return plain lists; the store wrappers touch localStorage.
import { seedOf } from './game-kit.js';
import { cardFrom } from './rally-rules.js';

export const KEY = 'verse.cards.v1', MAX_SEEN = 600, BODY = 8000;
export const KINDS = ['answer', 'skill', 'collectible', 'forged', 'game', 'board', 'store'];
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const NOT_A_CARD = /^(?:…|\.\.\.|thinking|looking up|loading|searching|working on it|asking verse)/i;
/** a clean record from anything card-shaped, or null when it is still loading or has no title. Pure. */
export function recordOf(c = {}, now = 0) {
  const t = clip(c.t || c.title, 600), b = clip(c.b || c.body, BODY);
  if (!t || NOT_A_CARD.test(t) || NOT_A_CARD.test(b) || /^…$/.test(b)) return null;
  const kind = KINDS.includes(c.kind) ? c.kind : 'answer';
  return { id: 'v' + seedOf(kind + '|' + t + '|' + b.slice(0, 300)).toString(36), kind, game: clip(c.game, 40), t, k: clip(c.k || c.typeLine, 120), b,
    src: Math.max(0, Math.min(99, Math.floor(+(Array.isArray(c.src) ? c.src.length : c.src) || 0))), rarity: clip(c.rarity, 20).toLowerCase(), at: +c.at || now, saved: !!c.saved };
}
/** add or refresh a record in a list (newest first, saved ones never dropped, unsaved capped at MAX_SEEN). Pure. */
export function noteIn(list, rec) {
  if (!rec) return list;
  const had = list.find((x) => x.id === rec.id), next = [{ ...rec, saved: rec.saved || !!(had && had.saved), at: had ? Math.max(had.at, rec.at) : rec.at }, ...list.filter((x) => x.id !== rec.id)];
  let unsaved = 0; return next.filter((x) => x.saved || ++unsaved <= MAX_SEEN);
}
/** the binder's view: filter by kind, game, saved-only and a search; sort by date, name or power. Pure. */
export function view(list, { kind = '', game = '', saved = false, q = '', sort = 'date' } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const out = list.filter((x) => (!kind || x.kind === kind) && (!game || x.game === game) && (!saved || x.saved) && words.every((w) => (x.t + ' ' + x.k + ' ' + x.b + ' ' + x.game).toLowerCase().includes(w)));
  const by = { date: (a, b) => b.at - a.at, name: (a, b) => a.t.localeCompare(b.t), power: (a, b) => playOf(b).power - playOf(a).power || b.at - a.at };
  return out.sort(by[sort] || by.date);
}
/** the playable card of a record (lib/rally-rules.js cardFrom): the same record is always the same card. Pure. */
export const playOf = (r) => cardFrom({ t: r.t, b: r.b, src: r.src, rarity: r.rarity });

// the store on this device
const ls = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; } };
export function all() { try { const j = JSON.parse((ls() && ls().getItem(KEY)) || '[]'); return Array.isArray(j) ? j.filter((x) => x && x.id && x.t) : []; } catch (_) { return []; } }
const put = (list) => { try { ls() && ls().setItem(KEY, JSON.stringify(list)); } catch (_) { /* full: the oldest unsaved go first next time */ try { ls().setItem(KEY, JSON.stringify(list.filter((x) => x.saved).concat(list.filter((x) => !x.saved).slice(0, 100)))); } catch (__) {} } };
/** note a card you were shown; returns its record (or null). */
export function note(c) { const r = recordOf(c, Date.now()); if (r) put(noteIn(all(), r)); return r; }
/** save (pin) or unsave a card; a card not yet noted is noted first. Returns the new saved state. */
export function setSaved(c, on = true) { const r = recordOf(c, Date.now()); if (!r) return false; r.saved = !!on; const list = noteIn(all(), r).map((x) => (x.id === r.id ? { ...x, saved: !!on } : x)); put(list); return !!on; }
export const isSaved = (c) => { const r = recordOf(c, 0); return !!(r && all().some((x) => x.id === r.id && x.saved)); };
export const remove = (id) => put(all().filter((x) => x.id !== id));

/** the one record from any card shape Verse has (folded in, nothing removed): a share code's data ({ t, k, b, src }), a duel card
 *  ({ name, power, resistance, income, arrows, abilities }, lib/duel-rules.js), a framed card's numbers (el._vcard from lib/card-frame.js:
 *  { key, typeLine, adds, rarity }), a Rally card ({ name, type, power, ability }), or a game's card ({ title, text, game, kind }). Pure. */
export function fromAny(x = {}, now = 0) {
  if (!x || typeof x !== 'object') return null;
  if (x.t || x.title) return recordOf({ ...x, b: x.b || x.body || x.text || '' }, now);
  if (x.name && Number.isFinite(+x.resistance)) return recordOf({ kind: 'game', game: 'Verse Duel', t: x.name, k: 'Duel card', b: 'Power ' + x.power + ', Resistance ' + x.resistance + ', Income ' + (x.income || 0) + ', ' + (x.arrows || 0) + ' arrow' + (x.arrows === 1 ? '' : 's') + ((x.abilities || []).length ? '. ' + x.abilities.join(', ') + '.' : '.') }, now);
  if (x.key && (x.typeLine || x.adds)) return recordOf({ kind: x.isSkill ? 'skill' : 'answer', t: x.name || x.key, k: x.typeLine || '', b: x.adds || '', rarity: x.rarity && x.rarity.name }, now);
  if (x.name && x.type) return recordOf({ kind: 'game', game: 'Verse Rally', t: x.name, k: x.type, b: x.ability ? x.ability : 'no ability' }, now);
  return null;
}
