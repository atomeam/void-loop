// Passkeys for Void (plan item 6): no passwords, no email, nothing on the surface. The person asks Void
// ("remember me", "sign in", "sign out", "forget me") and the page runs one of these steps.
// POST { step: 'create-options' }            -> { publicKey }  creation options (JSON form, WebAuthn L3 parseCreationOptionsFromJSON)
//                                                with a Bearer session: adds a passkey to that Void instead of making a new one
// POST { step: 'create', credential }        -> { token, userId, credentialId }  (credential = PublicKeyCredential.toJSON())
// POST { step: 'get-options' }               -> { publicKey }  request options (discoverable: no allowCredentials)
// POST { step: 'get', credential }           -> { token, userId }  | 404 { error: 'unknown passkey', credentialId }
// POST { step: 'sign-out' }  (Bearer)        -> ends that session
// POST { step: 'forget' }    (Bearer)        -> deletes every passkey, session, synced byte, tier row and public /@name page of that Void -> { userId, credentialIds }
// POST { step: 'tier' }      (Bearer)        -> { tier: 'free' | 'paid' }  (plan item 12; no row or a read error = free)
// POST { step: 'owner' }   (Bearer key or owner session) -> 200 { owner: true, renewed? } | 401. No D1 needed.
// POST { step: 'owner-bind', credentialId } (Bearer READ_TOKEN only) -> that passkey becomes the owner's login.
//   'get' with an owner passkey also returns { owner: { token, expires } }, an owner session (never READ_TOKEN).
// Every challenge is stored in D1, good for 5 minutes, and deleted before it's checked, so it can only be used once.
// Origin and rpId are a-to-mind.com; signatures are verified with WebCrypto (lib/webauthn.js).
import { verifyRegistration, verifyAuthentication, randomB64u, unb64u, ALGS } from '../../lib/webauthn.js';
import { ownerOk, ownerKeyOk, mintOwnerSession, OWNER_SESSION_PREFIX } from '../../lib/guard.js';
import { RP_NAME, CHALLENGE_TTL_MS, rp, ensureTables, bad, good, session, newSession, newUserId, brake, tierOf } from '../../lib/void-me.js';

async function mintChallenge(env, kind, userId) {
  const id = randomB64u(32), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM void_passkey_challenges WHERE expires < ?').bind(now),
    env.DB.prepare('INSERT INTO void_passkey_challenges (id, kind, user_id, expires) VALUES (?, ?, ?, ?)').bind(id, kind, userId || null, now + CHALLENGE_TTL_MS),
  ]);
  return id;
}
// The challenge the browser signed, taken out of D1 exactly once. Anything else -> null.
async function takeChallenge(env, credential, kinds) {
  let c = null;
  try { c = JSON.parse(new TextDecoder().decode(unb64u(String(credential.response.clientDataJSON)))).challenge; } catch (_) { return null; }
  if (typeof c !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(c)) return null;
  const row = await env.DB.prepare('SELECT kind, user_id, expires FROM void_passkey_challenges WHERE id = ?').bind(c).first();
  if (!row) return null;
  const del = await env.DB.prepare('DELETE FROM void_passkey_challenges WHERE id = ?').bind(c).run();
  if (!del.meta || del.meta.changes !== 1) return null; // someone else used it first
  if (!kinds.includes(row.kind) || Number(row.expires) <= Date.now()) return null;
  return { challenge: c, userId: row.user_id, kind: row.kind };
}

async function createOptions(request, env) {
  const r = rp(env), me = await session(request, env);
  if (!me && brake(request, Number(env.PASSKEY_BRAKE) || 20)) return bad(429, 'slow down');
  const userId = me ? me.userId : newUserId();
  const existing = me ? ((await env.DB.prepare('SELECT id FROM void_passkeys WHERE user_id = ?').bind(userId).all()).results || []) : [];
  const challenge = await mintChallenge(env, me ? 'add' : 'create', userId);
  return good({ publicKey: {
    rp: { id: r.id, name: RP_NAME },
    user: { id: userId, name: 'My Void', displayName: 'My Void' },
    challenge,
    pubKeyCredParams: ALGS.map((alg) => ({ type: 'public-key', alg })),
    timeout: CHALLENGE_TTL_MS,
    attestation: 'none',
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    excludeCredentials: existing.map((x) => ({ type: 'public-key', id: x.id })),
    hints: ['client-device', 'hybrid'],
    extensions: { credProps: true },
  } });
}

async function create(request, env, b) {
  const r = rp(env), cred = b.credential;
  const ch = cred && cred.response ? await takeChallenge(env, cred, ['create', 'add']) : null;
  if (!ch) return bad(400, 'passkey not verified: challenge unknown, used or expired');
  let v;
  try { v = await verifyRegistration({ credential: cred, expectedChallenge: ch.challenge, origins: r.origins, rpId: r.id }); } catch (e) { return bad(400, 'passkey not verified: ' + e.message); }
  const me = await session(request, env);
  // 'add' (another passkey for a Void you're signed in to) needs that same session; 'create' makes a new Void
  if (ch.kind === 'add' ? !me || me.userId !== ch.userId : !!me) return bad(400, 'passkey not verified: session changed');
  const now = new Date().toISOString();
  const stmts = [env.DB.prepare('INSERT INTO void_passkeys (id, user_id, public_key, alg, sign_count, transports, backed_up, at, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(v.credentialId, ch.userId, v.publicKey, v.alg, v.signCount, JSON.stringify(v.transports), v.backedUp ? 1 : 0, now, now)];
  const s = me ? null : await newSession(env, ch.userId);
  if (s) stmts.push(s.stmt);
  try { await env.DB.batch(stmts); } catch (e) { if (/UNIQUE|constraint/i.test(String(e && e.message))) return bad(409, 'passkey already registered'); throw e; }
  return good({ ok: true, userId: ch.userId, credentialId: v.credentialId, added: !!me, ...(s ? { token: s.token, expires: s.expires } : {}), rpId: r.id });
}

async function getOptions(request, env) {
  const r = rp(env);
  if (brake(request, Number(env.PASSKEY_BRAKE) || 20)) return bad(429, 'slow down');
  const challenge = await mintChallenge(env, 'get', null);
  return good({ publicKey: { challenge, rpId: r.id, timeout: CHALLENGE_TTL_MS, userVerification: 'required', allowCredentials: [], hints: ['client-device', 'hybrid'] } });
}

async function get(request, env, b) {
  const r = rp(env), cred = b.credential;
  const ch = cred && cred.response ? await takeChallenge(env, cred, ['get']) : null;
  if (!ch) return bad(400, 'passkey not verified: challenge unknown, used or expired');
  const row = typeof cred.id === 'string' ? await env.DB.prepare('SELECT user_id, public_key, alg, sign_count FROM void_passkeys WHERE id = ?').bind(cred.id).first() : null;
  if (!row) return bad(404, 'unknown passkey', { credentialId: typeof cred.id === 'string' ? cred.id.slice(0, 1400) : null, rpId: r.id });
  let v;
  try { v = await verifyAuthentication({ credential: cred, expectedChallenge: ch.challenge, origins: r.origins, rpId: r.id, stored: { publicKey: row.public_key, signCount: row.sign_count, userId: row.user_id } }); } catch (e) { return bad(400, 'passkey not verified: ' + e.message); }
  // the counter only moves forward: a concurrent sign-in with the same counter loses
  const upd = await env.DB.prepare('UPDATE void_passkeys SET sign_count = ?, backed_up = ?, used = ? WHERE id = ? AND sign_count = ?')
    .bind(v.signCount, v.backedUp ? 1 : 0, new Date().toISOString(), v.credentialId, row.sign_count).run();
  if (!upd.meta || upd.meta.changes !== 1) return bad(409, 'passkey used twice at once');
  const s = await newSession(env, row.user_id);
  await s.stmt.run();
  const owner = await ownerFor(env, cred.id); // a passkey the owner bound also brings an owner session
  return good({ ok: true, userId: row.user_id, credentialId: cred.id, token: s.token, expires: s.expires, rpId: r.id, ...(owner ? { owner } : {}) });
}

// Owner login (2026-10-03). Only the owner key itself (READ_TOKEN, constant-time) can bind a passkey as the owner's login: a stranger
// can never promote their own passkey, and a copied owner session can't make itself permanent.
async function ownerFor(env, credentialId) {
  try {
    const row = await env.DB.prepare('SELECT id FROM void_owner_passkeys WHERE id = ?').bind(credentialId).first();
    return row ? await mintOwnerSession(env, credentialId) : null;
  } catch (_) { return null; } // fails closed: not the owner
}
async function ownerBind(request, env, b) {
  if (!(await ownerKeyOk(request, env))) return bad(401, 'no');
  const id = typeof b.credentialId === 'string' && /^[A-Za-z0-9_-]{16,1400}$/.test(b.credentialId) ? b.credentialId : '';
  if (!id) return bad(400, 'which passkey?');
  const row = await env.DB.prepare('SELECT user_id, public_key, alg, sign_count FROM void_passkeys WHERE id = ?').bind(id).first();
  if (!row) return bad(404, 'unknown passkey');
  await env.DB.prepare('INSERT INTO void_owner_passkeys (id, at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').bind(id, new Date().toISOString()).run();
  return good({ ok: true, owner: true });
}
// The key or an owner session -> 200, and a session comes back renewed (30 more days). Anything else is a 401, which lib/guard.js
// counts per connection (10 wrong keys a minute and every /api call from it waits).
async function ownerStep(request, env) {
  if (!(await ownerOk(request, env))) return bad(401, 'no');
  const t = (request.headers.get('authorization') || '').slice(7);
  return good({ ok: true, owner: true, ...(t.startsWith(OWNER_SESSION_PREFIX) ? { renewed: await mintOwnerSession(env, null, Date.now(), t.split('.')[2]) } : {}) });
}

async function signOut(request, env) {
  const me = await session(request, env);
  if (!me) return good({ ok: true, note: 'not signed in' });
  await env.DB.prepare('DELETE FROM void_sessions WHERE id = ?').bind(me.sid).run();
  return good({ ok: true });
}

async function tier(request, env) {
  const me = await session(request, env);
  if (!me) return bad(401, 'not signed in');
  return good({ tier: await tierOf(env, me.userId) });
}

async function forget(request, env) {
  const me = await session(request, env);
  if (!me) return bad(401, 'not signed in');
  const ids = ((await env.DB.prepare('SELECT id FROM void_passkeys WHERE user_id = ?').bind(me.userId).all()).results || []).map((x) => x.id);
  await env.DB.batch([ // one transaction: all of it goes, or none of it
    env.DB.prepare('DELETE FROM void_owner_passkeys WHERE id IN (SELECT id FROM void_passkeys WHERE user_id = ?)').bind(me.userId),
    env.DB.prepare('DELETE FROM void_mine WHERE user_id = ?').bind(me.userId),
    env.DB.prepare('DELETE FROM void_passkeys WHERE user_id = ?').bind(me.userId),
    env.DB.prepare('DELETE FROM void_passkey_challenges WHERE user_id = ?').bind(me.userId),
    env.DB.prepare('DELETE FROM void_sessions WHERE user_id = ?').bind(me.userId),
    env.DB.prepare('DELETE FROM void_accounts WHERE user_id = ?').bind(me.userId),
    env.DB.prepare('DELETE FROM void_pages WHERE user_id = ?').bind(me.userId), // a public /@name page goes too: nothing of a forgotten Void stays up
  ]);
  return good({ ok: true, userId: me.userId, credentialIds: ids, rpId: rp(env).id });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 20000)); } catch (_) { return bad(400, 'bad json'); }
  if (!b || typeof b !== 'object') return bad(400, 'bad json');
  try {
    if (b.step === 'owner') return await ownerStep(request, env); // works even when D1 doesn't
    await ensureTables(env);
    if (b.step === 'create-options') return await createOptions(request, env);
    if (b.step === 'create') return await create(request, env, b);
    if (b.step === 'get-options') return await getOptions(request, env);
    if (b.step === 'get') return await get(request, env, b);
    if (b.step === 'sign-out') return await signOut(request, env);
    if (b.step === 'forget') return await forget(request, env);
    if (b.step === 'tier') return await tier(request, env);
    if (b.step === 'owner-bind') return await ownerBind(request, env, b);
    return bad(400, 'unknown step');
  } catch (_) { return bad(503, 'passkeys unavailable'); } // fails closed: nobody is signed in, nothing is saved
}
