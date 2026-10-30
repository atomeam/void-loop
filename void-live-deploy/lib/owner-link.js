// One owner identity in the browser (owner, 2026-10-30: "make it to where i have access to everything stop locking me out of things").
// The owner signs in once with their passkey. Every page that reads the owner token (a2m.void.owner.v1) calls ownerLink() first: when
// this browser has no owner token, or its owner session is about to run out, and it is signed in to a Verse account (a2m.void.me.v1),
// the page asks /api/passkey 'owner' with the account session. The server answers only for the owner's own account (lib/guard.js
// ownerAccountSession) and returns a fresh owner session, which is kept here. The owner key itself, when this browser has it, stays.
// A browser that holds the owner key itself and is signed in binds that account as the owner's once ('owner-bind-account'), so after one
// "unlock" the account is the owner everywhere it signs in. Nothing changes for anyone else: a member's account gets a 401 once per tab.
const OWNER_KEY = 'a2m.void.owner.v1', ME_KEY = 'a2m.void.me.v1', NOT_OWNER = 'a2m.void.owner.no', BOUND = 'a2m.void.owner.bound', DAY_MS = 864e5;

const read = (store, k) => { try { return store.getItem(k) || ''; } catch (_) { return ''; } };
const meToken = () => { try { return (JSON.parse(read(localStorage, ME_KEY) || 'null') || {}).token || ''; } catch (_) { return ''; } };
const expiry = (t) => parseInt(String(t).split('.')[1], 36) || 0;
// true when the token here is the key, or an owner session with more than a day left
export const ownerFresh = (t, now = Date.now()) => !!t && (!t.startsWith('vo1.') || expiry(t) - now > DAY_MS);

let running = null;
/** -> the owner token this browser now holds ('' when it is not the owner's) */
export function ownerLink() {
  if (!running) running = link().finally(() => { running = null; });
  return running;
}
async function link() {
  const had = read(localStorage, OWNER_KEY), me = meToken();
  if (had && !had.startsWith('vo1.')) { if (me) await bindAccount(had, me); return had; }
  if (ownerFresh(had)) return had;
  if (!me || read(sessionStorage, NOT_OWNER) === me.slice(0, 12)) return had;
  try {
    const r = await fetch('/api/passkey', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + me }, body: JSON.stringify({ step: 'owner' }), cache: 'no-store' });
    if (r.status === 401) { try { sessionStorage.setItem(NOT_OWNER, me.slice(0, 12)); } catch (_) {} return had; }
    if (r.status !== 200) return had;
    const j = await r.json().catch(() => null);
    const t = j && j.session && typeof j.session.token === 'string' ? j.session.token : '';
    if (!/^vo1\./.test(t) || read(localStorage, OWNER_KEY) !== had) return read(localStorage, OWNER_KEY);
    try { localStorage.setItem(OWNER_KEY, t); } catch (_) { return had; }
    try { dispatchEvent(new CustomEvent('verse-owner', { detail: { owner: true } })); } catch (_) {}
    return t;
  } catch (_) { return had; }
}
// the key is here and this browser is signed in: make that account the owner's, once per tab
async function bindAccount(key, me) {
  if (read(sessionStorage, BOUND) === me.slice(0, 12)) return;
  try {
    const r = await fetch('/api/passkey', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ step: 'owner-bind-account', session: me }), cache: 'no-store' });
    if (r.status === 200) { try { sessionStorage.setItem(BOUND, me.slice(0, 12)); } catch (_) {} }
  } catch (_) {}
}
