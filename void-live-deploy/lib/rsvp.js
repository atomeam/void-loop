// Replies to an invite (owner, 2026-10-25: "RSVP tracking on invites"; what Google, Outlook, Proton and Zoho do with yes / maybe / no): the
// organizer's invite link carries a reply key after #, whoever opens it says their name and yes, maybe or no, and everyone with the link sees
// who is coming. The replies live on Verse's server (functions/api/rsvp.js, D1); the organizer's own key (kept with the event in their browser)
// is the only one that can clear them. No account. Pure. Tests: tools/rsvp.test.mjs.
export const RSVP = Object.freeze({ replies: 200, name: 60, perMinute: 30, createsPerDay: 50, allCreatesPerDay: 5000, repliesPerDay: 300, body: 2000, idleDays: 400 });
export const ANSWERS = Object.freeze(['yes', 'maybe', 'no']);
/** { id, key } from a page's hash ("#rsvp=<id>.<key>"), or null. Pure. */
export function rsvpFromHash(hash) {
  const m = /(?:^#|&)rsvp=([A-Za-z0-9_-]{11})\.([A-Za-z0-9_-]{22})(?:&|$)/.exec(String(hash || ''));
  return m ? { id: m[1], key: m[2] } : null;
}
/** a reply as it may be kept: { ok, name, answer } or { ok: false, status, error }. Pure. */
export function parseReply(raw) {
  let o = raw; if (typeof raw === 'string') { if (raw.length > RSVP.body) return { ok: false, status: 413, error: 'too big' }; try { o = JSON.parse(raw); } catch (_) { return { ok: false, status: 400, error: 'not JSON' }; } }
  if (!o || typeof o !== 'object') return { ok: false, status: 400, error: 'not a reply' };
  const name = String(o.name || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RSVP.name);
  if (!name) return { ok: false, status: 400, error: 'say your name' };
  if (!ANSWERS.includes(o.answer)) return { ok: false, status: 400, error: 'yes, maybe or no' };
  return { ok: true, name, answer: o.answer };
}
/** the replies with one added or changed (one per name, whatever its case), newest last, at most RSVP.replies. Pure. */
export function withReply(list, { name, answer }, at = Date.now()) {
  const rest = (Array.isArray(list) ? list : []).filter((r) => r && String(r.name).toLowerCase() !== name.toLowerCase());
  return [...rest, { name, answer, at }].slice(-RSVP.replies);
}
/** "3 yes, 1 maybe, 1 no". Pure. */
export function tally(list, words = { yes: 'yes', maybe: 'maybe', no: 'no' }) {
  const n = { yes: 0, maybe: 0, no: 0 }; for (const r of list || []) if (n[r.answer] != null) n[r.answer]++;
  return ANSWERS.filter((a) => n[a]).map((a) => n[a] + ' ' + words[a]).join(', ');
}
