// Void's shared regression suite. Every agent runs this before deploying:  node tools/test_void.mjs
// Serves void-live-deploy locally, stubs the network, and checks every ask we support.
// Add a check here whenever you add an ask. Exit code 1 = something broke; deploy.ps1 stops.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';

const exe = [process.env.VOID_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const results = [];
const check = (name, ok, got) => { results.push({ name, ok: !!ok, got }); };
// Poll instead of guessing a delay: the shared box is often busy, fixed sleeps flake.
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };
// Voice stubs: a fake SpeechRecognition that "hears" window.__said, and speechSynthesis that records what it would say.
const VOICE_STUB = () => {
  class FakeRec {
    start(track) { window.__recTrack = !!track; setTimeout(() => { const r = Object.assign([{ transcript: window.__said || 'make a counter' }], { isFinal: true }); if (this.onresult) this.onresult({ results: [r] }); if (this.onend) this.onend(); }, 50); }
    stop() { if (this.onend) this.onend(); }
    abort() {}
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  window.__spoken = [];
  if (window.speechSynthesis) { speechSynthesis.speak = (u) => window.__spoken.push(u.text); speechSynthesis.cancel = () => {}; }
};
const queued = []; // build targets the page POSTed to /api/queue (stubbed)
const NO_MIC_ELEMENT = () => { delete window.HTMLMicrophoneElement; };
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

// Plan item 7 (confirm line): /api/approval is the real Pages Function, run here against an in-memory D1,
// with a stand-in email executor so we can see exactly when an action runs.
const approvalFn = await import(new URL('../void-live-deploy/functions/api/approval.js', import.meta.url).href);
const OWNER = 'test-owner-key-0123456789';
function memoryD1({ broken = false } = {}) {
  // Like D1: the tables don't exist until /api/approval makes them; broken = the database can't be reached.
  const approvals = new Map(), ledger = [], tables = new Set();
  const need = (t) => { if (broken) throw new Error('D1 unavailable'); if (!tables.has(t)) throw new Error('no such table: ' + t); };
  const exec = (sql, a) => {
    if (broken) throw new Error('D1 unavailable');
    const made = /^CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/.exec(sql);
    if (made) { tables.add(made[1]); return { meta: { changes: 0 } }; }
    if (/^INSERT INTO void_approvals/.test(sql)) { need('void_approvals'); approvals.set(a[0], { state: a[1], record: a[2] }); return { meta: { changes: 1 } }; }
    if (/^UPDATE void_approvals .*AND state = 'pending'/.test(sql)) { need('void_approvals'); const r = approvals.get(a[3]); if (!r || r.state !== 'pending') return { meta: { changes: 0 } }; approvals.set(a[3], { state: a[0], record: a[1] }); return { meta: { changes: 1 } }; }
    if (/^UPDATE void_approvals/.test(sql)) { need('void_approvals'); approvals.set(a[3], { state: a[0], record: a[1] }); return { meta: { changes: 1 } }; }
    if (/^INSERT INTO void_ledger/.test(sql)) { need('void_ledger'); ledger.push({ id: a[0], approval_id: a[1], kind: a[2] }); return { meta: { changes: 1 } }; }
    throw new Error('unexpected sql: ' + sql);
  };
  const first = (sql, a) => { if (/^SELECT state, record FROM void_approvals/.test(sql)) { need('void_approvals'); return approvals.get(a[0]) || null; } throw new Error('unexpected sql: ' + sql); };
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => exec(sql, a), first: async () => first(sql, a) });
  return { approvals, ledger, tables, prepare: (sql) => stmt(sql), batch: async (list) => list.map((q) => exec(q.sql, q.a)) };
}
const gate = { env: { READ_TOKEN: OWNER, DB: memoryD1() }, calls: [], ran: [] };
approvalFn.executors['email.send'] = async (args) => { gate.ran.push(args); return { id: 'sent-' + gate.ran.length }; };
async function approvalRoute(r) {
  const q = r.request(), h = await q.allHeaders();
  if (q.method() === 'POST') gate.calls.push(JSON.parse(q.postData() || '{}'));
  const request = new Request(q.url(), { method: q.method(), headers: { authorization: h.authorization || '', 'content-type': 'application/json' }, body: q.method() === 'POST' ? q.postData() : undefined });
  const res = await (q.method() === 'POST' ? approvalFn.onRequestPost : approvalFn.onRequestGet)({ request, env: gate.env });
  return r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
}

// Plan item 6 (your Void follows you): /api/passkey and /api/mine are the real Pages Functions, run here against an
// in-memory D1. The browser side uses Chromium's WebAuthn virtual authenticator (CDP), so every passkey is real ES256
// and every signature is verified by lib/webauthn.js exactly as it will be live. The page must be on localhost for WebAuthn.
const passkeyFn = await import(new URL('../void-live-deploy/functions/api/passkey.js', import.meta.url).href);
const mineFn = await import(new URL('../void-live-deploy/functions/api/mine.js', import.meta.url).href);
const wa = await import(new URL('../void-live-deploy/lib/webauthn.js', import.meta.url).href);
const localBase = base.replace('127.0.0.1', 'localhost'), localOrigin = localBase.replace(/\/$/, '');
function memoryMeD1({ broken = false } = {}) {
  // Like D1: no tables until the functions make them; broken = the database can't be reached. batch() is all-or-nothing.
  const T = { passkeys: new Map(), challenges: new Map(), sessions: new Map(), mine: new Map() }, tables = new Set();
  const need = (t) => { if (broken) throw new Error('D1 unavailable'); if (!tables.has(t)) throw new Error('no such table: ' + t); };
  const ch = (n) => ({ meta: { changes: n } });
  const delWhere = (map, f) => { let n = 0; for (const [k, v] of map) if (f(v)) { map.delete(k); n += 1; } return ch(n); };
  const run = (sql, a) => {
    if (broken) throw new Error('D1 unavailable');
    const made = /^CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/.exec(sql);
    if (made) { tables.add(made[1]); return ch(0); }
    if (/^DELETE FROM void_passkey_challenges WHERE expires < \?$/.test(sql)) { need('void_passkey_challenges'); return delWhere(T.challenges, (v) => v.expires < a[0]); }
    if (/^INSERT INTO void_passkey_challenges \(id, kind, user_id, expires\) VALUES/.test(sql)) { need('void_passkey_challenges'); if (T.challenges.has(a[0])) throw new Error('UNIQUE constraint failed'); T.challenges.set(a[0], { kind: a[1], user_id: a[2], expires: a[3] }); return ch(1); }
    if (/^DELETE FROM void_passkey_challenges WHERE id = \?$/.test(sql)) { need('void_passkey_challenges'); return ch(T.challenges.delete(a[0]) ? 1 : 0); }
    if (/^DELETE FROM void_passkey_challenges WHERE user_id = \?$/.test(sql)) { need('void_passkey_challenges'); return delWhere(T.challenges, (v) => v.user_id === a[0]); }
    if (/^INSERT INTO void_passkeys \(id, user_id, public_key, alg, sign_count, transports, backed_up, at, used\) VALUES/.test(sql)) { need('void_passkeys'); if (T.passkeys.has(a[0])) throw new Error('UNIQUE constraint failed: void_passkeys.id'); T.passkeys.set(a[0], { id: a[0], user_id: a[1], public_key: a[2], alg: a[3], sign_count: a[4], transports: a[5], backed_up: a[6], at: a[7], used: a[8] }); return ch(1); }
    if (/^UPDATE void_passkeys SET sign_count = \?, backed_up = \?, used = \? WHERE id = \? AND sign_count = \?$/.test(sql)) { need('void_passkeys'); const r = T.passkeys.get(a[3]); if (!r || r.sign_count !== a[4]) return ch(0); Object.assign(r, { sign_count: a[0], backed_up: a[1], used: a[2] }); return ch(1); }
    if (/^DELETE FROM void_passkeys WHERE user_id = \?$/.test(sql)) { need('void_passkeys'); return delWhere(T.passkeys, (v) => v.user_id === a[0]); }
    if (/^INSERT INTO void_sessions \(id, user_id, at, expires\) VALUES/.test(sql)) { need('void_sessions'); T.sessions.set(a[0], { user_id: a[1], at: a[2], expires: a[3] }); return ch(1); }
    if (/^DELETE FROM void_sessions WHERE id = \?$/.test(sql)) { need('void_sessions'); return ch(T.sessions.delete(a[0]) ? 1 : 0); }
    if (/^DELETE FROM void_sessions WHERE user_id = \?$/.test(sql)) { need('void_sessions'); return delWhere(T.sessions, (v) => v.user_id === a[0]); }
    if (/^INSERT INTO void_mine \(user_id, data, rev, updated\) VALUES \(\?, \?, 1, \?\) ON CONFLICT\(user_id\) DO NOTHING$/.test(sql)) { need('void_mine'); if (T.mine.has(a[0])) return ch(0); T.mine.set(a[0], { data: a[1], rev: 1, updated: a[2] }); return ch(1); }
    if (/^UPDATE void_mine SET data = \?, rev = rev \+ 1, updated = \? WHERE user_id = \? AND rev = \?$/.test(sql)) { need('void_mine'); const r = T.mine.get(a[2]); if (!r || r.rev !== a[3]) return ch(0); Object.assign(r, { data: a[0], rev: r.rev + 1, updated: a[1] }); return ch(1); }
    if (/^DELETE FROM void_mine WHERE user_id = \?$/.test(sql)) { need('void_mine'); return ch(T.mine.delete(a[0]) ? 1 : 0); }
    throw new Error('unexpected sql: ' + sql);
  };
  const first = (sql, a) => {
    if (broken) throw new Error('D1 unavailable');
    if (/^SELECT kind, user_id, expires FROM void_passkey_challenges WHERE id = \?$/.test(sql)) { need('void_passkey_challenges'); return T.challenges.get(a[0]) || null; }
    if (/^SELECT user_id, public_key, alg, sign_count FROM void_passkeys WHERE id = \?$/.test(sql)) { need('void_passkeys'); return T.passkeys.get(a[0]) || null; }
    if (/^SELECT user_id, expires FROM void_sessions WHERE id = \?$/.test(sql)) { need('void_sessions'); return T.sessions.get(a[0]) || null; }
    if (/^SELECT data, rev, updated FROM void_mine WHERE user_id = \?$/.test(sql)) { need('void_mine'); return T.mine.get(a[0]) || null; }
    throw new Error('unexpected sql: ' + sql);
  };
  const all = (sql, a) => {
    if (broken) throw new Error('D1 unavailable');
    if (/^SELECT id FROM void_passkeys WHERE user_id = \?$/.test(sql)) { need('void_passkeys'); return { results: [...T.passkeys.values()].filter((v) => v.user_id === a[0]).map((v) => ({ id: v.id })) }; }
    throw new Error('unexpected sql: ' + sql);
  };
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => run(sql, a), first: async () => first(sql, a), all: async () => all(sql, a) });
  const clone = () => Object.fromEntries(Object.entries(T).map(([k, m]) => [k, new Map([...m].map(([x, v]) => [x, { ...v }]))]));
  return { ...T, T, tables, prepare: (sql) => stmt(sql), batch: async (list) => { const snap = clone(); try { return list.map((q) => run(q.sql, q.a)); } catch (e) { for (const k of Object.keys(T)) { T[k].clear(); for (const [x, v] of snap[k]) T[k].set(x, v); } throw e; } } };
}
const meEnv = { DB: memoryMeD1(), PASSKEY_RP_ID: 'localhost', PASSKEY_ORIGINS: localOrigin, PASSKEY_BRAKE: 100000 };
async function meRoute(r) {
  const q = r.request(), h = await q.allHeaders(), u = new URL(q.url());
  const request = new Request(q.url(), { method: q.method(), headers: { authorization: h.authorization || '', 'content-type': 'application/json' }, body: /^(POST|PUT)$/.test(q.method()) ? q.postData() : undefined });
  const fn = u.pathname === '/api/passkey' ? passkeyFn.onRequestPost : q.method() === 'GET' ? mineFn.onRequestGet : mineFn.onRequestPut;
  const res = await fn({ request, env: meEnv });
  return r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
}
// Direct calls, and a software authenticator for the rules a browser won't break on purpose (wrong origin, bad signature, ...).
const callMe = async (fn, env, body, token, method = 'POST', headers = {}) => {
  const res = await fn({ request: new Request('http://localhost/api/x', { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body == null ? undefined : JSON.stringify(body) }), env });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const pk = (env, body, token, headers) => callMe(passkeyFn.onRequestPost, env, body, token, 'POST', headers);
const te = new TextEncoder();
const cat = (...xs) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of xs) { out.set(x, o); o += x.length; } return out; };
function cbor(v) {
  const out = [];
  const head = (mj, n) => { if (n < 24) out.push((mj << 5) | n); else if (n < 256) out.push((mj << 5) | 24, n); else if (n < 65536) out.push((mj << 5) | 25, n >> 8, n & 255); else out.push((mj << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255); };
  const enc = (x) => {
    if (typeof x === 'number') { if (x >= 0) head(0, x); else head(1, -1 - x); }
    else if (typeof x === 'string') { const b = te.encode(x); head(3, b.length); out.push(...b); }
    else if (x instanceof Uint8Array) { head(2, x.length); for (const y of x) out.push(y); }
    else if (x instanceof Map) { head(5, x.size); for (const [k, y] of x) { enc(k); enc(y); } }
    else throw new Error('cbor enc');
  };
  enc(v); return new Uint8Array(out);
}
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
async function softKey(alg) {
  const S = crypto.subtle;
  if (alg === -7) {
    const k = await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const j = await S.exportKey('jwk', k.publicKey);
    const der = (raw) => { const int = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); if (b[0] & 0x80) b = cat(new Uint8Array([0]), b); return cat(new Uint8Array([2, b.length]), b); }; const body = cat(int(raw.slice(0, 32)), int(raw.slice(32))); return cat(new Uint8Array([0x30, body.length]), body); };
    return { cose: new Map([[1, 2], [3, -7], [-1, 1], [-2, wa.unb64u(j.x)], [-3, wa.unb64u(j.y)]]), sign: async (d) => der(new Uint8Array(await S.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privateKey, d))) };
  }
  if (alg === -8) {
    const k = await S.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); const j = await S.exportKey('jwk', k.publicKey);
    return { cose: new Map([[1, 1], [3, -8], [-1, 6], [-2, wa.unb64u(j.x)]]), sign: async (d) => new Uint8Array(await S.sign({ name: 'Ed25519' }, k.privateKey, d)) };
  }
  const k = await S.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']); const j = await S.exportKey('jwk', k.publicKey);
  return { cose: new Map([[1, 3], [3, -257], [-1, wa.unb64u(j.n)], [-2, wa.unb64u(j.e)]]), sign: async (d) => new Uint8Array(await S.sign({ name: 'RSASSA-PKCS1-v1_5' }, k.privateKey, d)) };
}
async function softRegister(env, { alg = -7, origin = localOrigin, rpId = 'localhost', uv = true, token, type = 'webauthn.create', challenge } = {}) {
  const o = await pk(env, { step: 'create-options' }, token);
  const key = await softKey(alg), credId = crypto.getRandomValues(new Uint8Array(32));
  const cdj = te.encode(JSON.stringify({ type, challenge: challenge || o.body.publicKey.challenge, origin, crossOrigin: false }));
  const authData = cat(await wa.sha256(rpId), new Uint8Array([0x01 | (uv ? 0x04 : 0) | 0x40]), u32(0), new Uint8Array(16), new Uint8Array([0, credId.length]), credId, cbor(key.cose));
  const credential = { id: wa.b64u(credId), rawId: wa.b64u(credId), type: 'public-key', response: { clientDataJSON: wa.b64u(cdj), attestationObject: wa.b64u(cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))), transports: ['internal'] }, clientExtensionResults: {} };
  const res = await pk(env, { step: 'create', credential }, token);
  return { key, credId, userId: o.body && o.body.publicKey && o.body.publicKey.user.id, options: o, credential, res };
}
async function softLogin(env, reg, { origin = localOrigin, rpId = 'localhost', uv = true, counter = 0, tamper = false, userId } = {}) {
  const o = await pk(env, { step: 'get-options' });
  const cdj = te.encode(JSON.stringify({ type: 'webauthn.get', challenge: o.body.publicKey.challenge, origin, crossOrigin: false }));
  const ad = cat(await wa.sha256(rpId), new Uint8Array([0x01 | (uv ? 0x04 : 0)]), u32(counter));
  const sig = await reg.key.sign(cat(ad, await wa.sha256(cdj)));
  if (tamper) sig[sig.length - 1] ^= 1;
  const credential = { id: wa.b64u(reg.credId), rawId: wa.b64u(reg.credId), type: 'public-key', response: { clientDataJSON: wa.b64u(cdj), authenticatorData: wa.b64u(ad), signature: wa.b64u(sig), userHandle: userId || reg.userId }, clientExtensionResults: {} };
  return { credential, res: await pk(env, { step: 'get', credential }) };
}
async function authenticator(t, creds = []) {
  const cdp = await t.ctx.newCDPSession(t.p);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  // backup-eligible + backed up = a synced passkey (Google Password Manager, iCloud Keychain, ...)
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, defaultBackupEligibility: true, defaultBackupState: true } });
  for (const c of creds) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential: c });
  return { cdp, creds: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials };
}
// Record the WebAuthn Level 3 signal calls the page makes.
const SIGNAL_SPY = () => {
  window.__signals = [];
  const P = window.PublicKeyCredential; if (!P) return;
  for (const n of ['signalUnknownCredential', 'signalAllAcceptedCredentials']) { const f = P[n]; P[n] = async (o) => { window.__signals.push({ n, o }); try { return f ? await f.call(P, o) : undefined; } catch (_) {} }; }
};

async function fresh(...inits) {
  const at = inits[0] && typeof inits[0] === 'object' && inits[0].base ? inits.shift().base : base;
  const ctx = await browser.newContext();
  for (const init of inits) await ctx.addInitScript(init);
  await ctx.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/, (r) => {
    const u = r.request().url();
    if (u.includes('translate.googleapis.com')) return r.fulfill(json([[['hola', 'hello']]]));
    if (u.includes('/w/api.php')) return r.fulfill(json({ query: { search: [{ title: 'Black hole' }] } }));
    if (u.includes('/page/summary/')) return r.fulfill(json({ title: 'Black hole', extract: 'A region of spacetime.', timestamp: '2026-09-20T10:00:00Z' }));
    if (u.includes('geocoding-api.open-meteo.com')) return r.fulfill(json({ results: [{ name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, population: 500000 }, { name: 'Lisbon', admin1: 'Ohio', country: 'United States', latitude: 40.7, longitude: -80.7, population: 2800 }] }));
    if (u.includes('api.open-meteo.com')) return r.fulfill(json({ current: { temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5 }, daily: { temperature_2m_max: [24], temperature_2m_min: [15], precipitation_probability_max: [10] }, hourly: { time: Array.from({ length: 8 }, (_, i) => '2026-09-27T1' + i + ':00'), temperature_2m: Array(8).fill(20), precipitation_probability: Array(8).fill(5), weather_code: Array(8).fill(1) } }));
    if (u.includes('frankfurter')) return r.fulfill(json({ amount: 100, base: 'USD', date: '2026-09-26', rates: { EUR: 92 } }));
    return r.fulfill({ status: 204, body: '' });
  });
  await ctx.route(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\//, (r) => {
    const u = r.request().url();
    if (u.includes('/api/will')) return r.fulfill(json({ at: '2026-09-27T23:00:00Z', wants: [{ kind: 'people asked', title: 'learn x', i_want: 'I want to answer every question about tides.', because: 'asked 9 times' }] }));
    if (u.includes('/api/answer')) {
      const ask = JSON.parse(r.request().postData() || '{}').ask || '';
      if (false) {}
      if (/busy/.test(ask)) return r.fulfill(json({ answer: null, sources: [], note: 'model busy' }));
      return r.fulfill(json({ answer: 'Sunlight scatters off air molecules, and blue light scatters most [1].', sources: [{ title: 'Rayleigh scattering', url: 'https://en.wikipedia.org/wiki/Rayleigh_scattering' }] }));
    }
    if (u.includes('/api/queue')) {
      const b = JSON.parse(r.request().postData() || '{}'); if (b.target) queued.push(b.target);
      const it = { id: 'q1', target: b.target || 'next', state: 'queued', note: '' };
      return r.fulfill(json({ item: it, items: [it], heartbeat: new Date().toISOString() }));
    }
    if (u.includes('/api/approval')) return approvalRoute(r);
    if (/\/api\/(passkey|mine)$/.test(new URL(u).pathname)) return meRoute(r);
    return r.fulfill({ status: 204, body: '' });
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(at); await p.waitForTimeout(700);
  const ask = async (t, w = 450) => { await p.fill('#input', t); await p.keyboard.press('Enter'); await p.waitForTimeout(w); };
  const state = () => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('a2m.void.state.v1') || '{}')));
  const page = () => p.$eval('.vpage.on', (e) => e.innerText).catch(() => '');
  const whisper = () => p.$eval('#whisper', (e) => e.textContent);
  return { ctx, p, ask, state, page, whisper, errors };
}

try {
  let t = await fresh();
  check('surface is empty on arrival', (await t.p.$$eval('#stage > *', (d) => d.length)) === 0 && !(await t.page()));
  check('noscript text stays hidden', !(await t.p.evaluate(() => document.body.innerText)).includes('It needs JavaScript'));
  await t.ask('make a clock'); check('make a clock', (await t.state()).some((x) => x.kind === 'clock'));
  await t.ask('make a 5 minute timer'); await t.ask('make a 2 minute timer');
  check('second timer adds (007)', (await t.state()).filter((x) => x.kind === 'timer').length === 2);
  await t.ask('add a sticky that says a'); await t.ask('another note that says b');
  check('second sticky adds (007)', (await t.state()).filter((x) => x.kind === 'sticky').length === 2);
  await t.ask('make all the timers red'); check('make all the timers red', (await t.state()).filter((x) => x.kind === 'timer').every((x) => x.color === '#ff5c5c'));
  await t.ask('clear all the notes'); check('clear all the notes', !(await t.state()).some((x) => x.kind === 'sticky') && (await t.state()).some((x) => x.kind === 'timer'));
  await t.ask('undo'); check('undo brings the group back', (await t.state()).filter((x) => x.kind === 'sticky').length === 2);
  await t.ask('make everything blue'); check('make everything blue', (await t.state()).every((x) => !x.color || /6aa8ff|9ec8ff/.test(x.color)));
  await t.ask('menu'); const menu = await t.page(); check('menu lists skills', /Menu/.test(menu) && /map/.test(menu) && /translate/.test(menu) && /weather/.test(menu), menu.slice(0, 80));
  await t.ask('close');
  await t.ask('what is a black hole', 300); await until(async () => /as of/.test(await t.page()), 5000); const art = await t.page(); check('page about anything, dated', /Black hole/.test(art) && /last edited/.test(art) && /as of/.test(art), art.slice(0, 120));
  await t.ask('translate hello to Spanish', 1200); const tr = await t.page(); check('translate', /hola/.test(tr) && /Google Translate/.test(tr), tr.slice(0, 80));
  await t.ask('keep this'); check('keep this', (await t.state()).some((x) => x.kind === 'kept'));
  await t.ask('call this spanish hello'); check('call this', (await t.state()).some((x) => x.kind === 'kept' && x.name === 'spanish hello'));
  await t.p.reload(); await t.p.waitForTimeout(700); check('kept card survives reload', (await t.p.$$eval('.kept-card', (d) => d.length)) === 1);
  await t.ask('map of Lisbon', 1200); const mp = await t.page(); check('map of Lisbon picks Portugal', /Lisbon/.test(mp) && /Portugal/.test(mp) && (await t.p.$$eval('.vpage iframe', (d) => d.length)) === 1, mp.slice(0, 80));
  await t.ask('weather in Lisbon', 1200); check('weather', /20°|68°/.test(await t.page()));
  await t.ask('5 miles in km', 700); check('calculation', /8\.05/.test(await t.page()));
  await t.ask('make my void deep blue'); check('your look', /01040f/.test(await t.p.evaluate(() => localStorage.getItem('a2m.void.look.v1') || '')));
  await t.ask('why is the sky blue', 900); const an = await t.page(); check('answer engine answers with sources', /blue light scatters/.test(an) && /Rayleigh scattering/.test(an) && /as of/.test(an), an.slice(0, 120));
  await t.ask('why is the model busy', 600); check('answer engine busy -> article excerpt', await until(async () => /Black hole/.test(await t.page()), 5000));
  await t.ask('what do you want to be?', 300); check('will: Void says what it wants', await until(async () => /I want to answer every question about tides/.test(await t.page()), 4000));
  await t.ask('update yourself', 0); check('build asks are owner-only', await until(async () => /owner/.test(await t.whisper()), 3000));
  await t.p.fill('#input', 'tim'); await t.p.waitForTimeout(150); check('hints while typing', (await t.p.$$eval('#hints div', (d) => d.map((x) => x.textContent))).some((h) => /timer/.test(h)));
  check('no script errors', t.errors.length === 0, t.errors.join(' | '));
  await t.ctx.close();

  t = await fresh();
  await t.p.goto(base + '?q=' + encodeURIComponent('make a clock')); await t.p.waitForTimeout(1200);
  check('?q= link runs the ask', (await t.state()).some((x) => x.kind === 'clock'));
  await t.ctx.close();

  // Plan item 4: Void everywhere you already are (app install, address bar, share sheet, voice, read aloud).
  t = await fresh(VOICE_STUB);
  const man = await t.p.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const icons = await Promise.all(m.icons.map((i) => fetch(i.src).then((r) => r.ok)));
    return { m, icons };
  }).catch((e) => ({ err: String(e) }));
  check('installable app: manifest, icons, opens to the input', man.m && man.m.display === 'standalone' && man.m.icons.some((i) => i.sizes === '512x512' && /maskable/.test(i.purpose)) && man.icons.every(Boolean) && (await t.p.evaluate(() => document.activeElement && document.activeElement.id)) === 'input', JSON.stringify(man).slice(0, 160));
  const os = await t.p.evaluate(async () => { const l = document.querySelector('link[rel=search][type="application/opensearchdescription+xml"]'); return l ? (await fetch(l.href)).text() : ''; });
  check('address bar search (OpenSearch) runs a Void ask', /template="https:\/\/a-to-mind\.com\/\?q=\{searchTerms\}"/.test(os), os.slice(0, 120));
  check('service worker registers (opens offline)', await until(() => t.p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!(r && (r.active || r.waiting || r.installing)))), 6000));
  check('voice: plain mic icon on arrival (no "Use microphone" on the empty surface)', await t.p.evaluate(() => { const m = document.getElementById('mic'); return !!m && m.tagName === 'BUTTON' && !document.querySelector('microphone') && !/use microphone/i.test(document.body.innerText); }));
  await t.p.click('#mic');
  check('voice: the first tap listens and a spoken ask runs', await until(async () => (await t.state()).some((x) => x.kind === 'counter'), 5000));
  const micAfter = await t.p.evaluate(() => ({ el: 'HTMLMicrophoneElement' in window, tag: document.getElementById('mic') && document.getElementById('mic').tagName, n: document.querySelectorAll('#mic').length }));
  await t.p.evaluate(() => { window.__said = 'make a list'; document.getElementById('mic').dispatchEvent(new Event('stream')); });
  check('voice: <microphone> element takes over after the first tap (Chrome 153+)', micAfter.el && micAfter.tag === 'MICROPHONE' && micAfter.n === 1 && await until(async () => (await t.state()).some((x) => x.kind === 'list'), 5000), JSON.stringify(micAfter));
  await t.ask('what is a black hole', 300); await until(async () => /region of spacetime/.test(await t.page()), 5000);
  await t.ask('read it aloud', 200);
  const spoken = await t.p.evaluate(() => window.__spoken.join(' '));
  check('read it aloud reads the open page', /region of spacetime/.test(spoken) && !/as of|last edited/i.test(spoken.replace(/Black hole/, '')), spoken.slice(0, 120));
  await t.p.goto(base + '?share_text=' + encodeURIComponent('make a clock'));
  const sharedAsk = await until(async () => (await t.state()).some((x) => x.kind === 'clock'), 6000);
  await t.p.goto(base + '?share_title=Example&share_url=' + encodeURIComponent('https://example.com/a'));
  const sharedLink = await until(async () => (await t.state()).some((x) => x.kind === 'link' && /example\.com/.test(x.url)), 6000);
  check('share to Void: words run, a link becomes a card', sharedAsk && sharedLink && !/share_/.test(t.p.url()), t.p.url());
  await t.p.evaluate(() => localStorage.setItem('a2m.void.owner.v1', 'test-owner-key-0123456789'));
  await t.ask('build helper/everywhere', 0);
  check('owner can queue a helper branch build', await until(() => queued.includes('helper/everywhere'), 4000), queued.join(','));
  const errs1 = t.errors.slice();
  await t.ctx.close();

  t = await fresh(VOICE_STUB, NO_MIC_ELEMENT);
  const fb = await t.p.evaluate(() => { const m = document.getElementById('mic'); return m && m.tagName; });
  if (fb === 'BUTTON') await t.p.click('#mic');
  check('voice fallback: plain mic button still works (and stays a button)', fb === 'BUTTON' && await until(async () => (await t.state()).some((x) => x.kind === 'counter'), 5000) && (await t.p.evaluate(() => document.getElementById('mic').tagName)) === 'BUTTON', fb);
  check('no script errors (everywhere)', !errs1.length && !t.errors.length, errs1.concat(t.errors).join(' | '));
  await t.ctx.close();

  // Plan item 5: WebMCP. A stub document.modelContext records registrations; /tools.json is served like production.
  t = await fresh(() => { window.__tools = {}; document.modelContext = { registerTool: async (d) => { window.__tools[d.name] = d; } }; });
  await t.ctx.route(/\/tools\.json$/, (r) => r.fulfill(json({ tools: [
    { name: 'stage', description: 'Put a thing on the stage.', examples: ['make a clock'] },
    { name: 'calculate', description: 'Arithmetic and conversion.', examples: ['5 miles in km'] },
    { name: 'weather', description: 'Weather.', examples: ['weather in Tokyo'] }] })));
  await t.p.reload(); await t.p.waitForTimeout(300);
  const names = await until(async () => { const n = await t.p.evaluate(() => Object.keys(window.__tools).sort()); return n.length >= 4 && n; }, 6000);
  const schemaOk = await t.p.evaluate(() => { const d = window.__tools.void_calculate; return !!d && d.inputSchema.required[0] === 'ask' && d.annotations.readOnlyHint === true && /5 miles in km/.test(d.description); }).catch(() => false);
  check('WebMCP: tools declared from /tools.json', names && ['void_ask', 'void_calculate', 'void_stage', 'void_weather'].every((n) => names.includes(n)) && schemaOk, String(names));
  const calc = await t.p.evaluate(() => window.__tools.void_calculate.execute({ ask: '5 miles in km' })).catch((e) => 'ERR ' + e);
  const made = await t.p.evaluate(() => window.__tools.void_stage.execute({ ask: 'make a clock' })).catch((e) => 'ERR ' + e);
  check('WebMCP: an agent call runs the ask and returns the result', /8\.05/.test(calc) && /clock/.test(made) && (await t.state()).some((x) => x.kind === 'clock'), calc.slice(0, 80) + ' | ' + made);
  const owner = await t.p.evaluate(() => window.__tools.void_ask.execute({ ask: 'update yourself' }));
  check('WebMCP: owner-only asks never run from an agent', /owner/.test(owner) && t.errors.length === 0, owner + ' ' + t.errors.join(' | '));
  const idAsks = await t.p.evaluate(async () => [await window.__tools.void_ask.execute({ ask: 'forget me' }), await window.__tools.void_ask.execute({ ask: 'sign in' })]);
  check('WebMCP: agents cannot sign in or forget anyone (item 6)', idAsks.every((x) => /person at the screen/.test(x)), idAsks.join(' | '));
  await t.ctx.close();

  // Plan item 7: the confirm line. One plain line before a send/book/spend; No, no answer or a changed request = it doesn't run.
  t = await fresh();
  const sent = (type) => gate.calls.filter((c) => c.type === type);
  const lastDecision = () => sent('a2m.approval.decision').slice(-1)[0] || {};
  await t.ask('send an email to jane@x.com saying hi', 700);
  check('confirm line: visitors cannot send', /owner/.test(await t.whisper()) && gate.calls.length === 0, await t.whisper());
  await t.p.evaluate((k) => localStorage.setItem('a2m.void.owner.v1', k), OWNER);
  await t.ask('send an email to jane@x.com saying hi', 900);
  check('confirm line shows before a send (item 7)', (await t.whisper()) === 'Send this email to jane@x.com? Yes / No' && sent('a2m.approval.requested').length === 1 && gate.ran.length === 0, await t.whisper());
  await t.ask('no', 800);
  check('confirm line: no = it does not run', /^ok, nothing sent$/.test(await t.whisper()) && lastDecision().decision === 'reject' && !!lastDecision().reason && gate.ran.length === 0, await t.whisper());
  await t.ask('send an email to jane@x.com saying hi', 900); await t.p.click('#whisper [data-vc="yes"]'); await t.p.waitForTimeout(800);
  check('confirm line: yes runs it once', gate.ran.length === 1 && gate.ran[0].to === 'jane@x.com' && (await t.whisper()) === 'sent', await t.whisper());
  gate.env.CONFIRM_TTL_MS = 1200;
  await t.ask('buy 2 bags of coffee for $24', 900); const buyLine = await t.whisper();
  await t.p.waitForTimeout(1600); const timedOut = await t.whisper();
  await t.ask('yes', 800);
  check('confirm line: no answer = timeout, nothing runs', buyLine === 'Buy 2 bags of coffee for $24? Yes / No' && timedOut === 'no answer, nothing spent' && /expired/.test(await t.whisper()) && lastDecision().decision === 'timeout' && !sent('a2m.approval.decision').some((c) => c.decision === 'approve' && /coffee/.test(JSON.stringify(gate.env.DB.approvals.get(c.approvalId)))), buyLine + ' | ' + timedOut);
  gate.env.CONFIRM_TTL_MS = 60000;
  await t.ask('send an email to jane@x.com saying hi', 900);
  for (const row of gate.env.DB.approvals.values()) if (row.state === 'pending') { const rec = JSON.parse(row.record); rec.argsSnapshot.to = 'mallory@evil.test'; row.record = JSON.stringify(rec); } // the paused request changes underneath
  await t.ask('yes', 900);
  check('confirm line: changed request fails hard', gate.ran.length === 1 && /request changed, nothing sent/.test(await t.whisper()) && gate.env.DB.ledger.slice(-1)[0].kind === 'failed', await t.whisper());
  const asked = sent('a2m.approval.requested').length;
  await t.ask('what is a black hole', 900); await t.ask('weather in Lisbon', 1200); await t.ask('how do I send an email', 900); await t.ask('make a clock');
  check('confirm line: read-only asks are never gated', sent('a2m.approval.requested').length === asked && !/Yes \/ No/.test(await t.whisper()) && (await t.state()).some((x) => x.kind === 'clock') && t.errors.length === 0, t.errors.join(' | '));
  const call = (body) => approvalFn.onRequestPost({ request: new Request('http://127.0.0.1/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + OWNER }, body: JSON.stringify(body) }), env: gate.env }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  const rq = await call({ type: 'a2m.approval.requested', toolName: 'email.send', args: { to: 'a@b.c', body: 'x' } });
  const noReason = await call({ type: 'a2m.approval.decision', approvalId: rq.body.approvalId, decision: 'reject', actor: 'owner' });
  const escNoReason = await call({ type: 'a2m.approval.decision', approvalId: rq.body.approvalId, decision: 'escalate', actor: 'owner', reason: ' ' });
  const wrongFp = await call({ type: 'a2m.approval.decision', approvalId: rq.body.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: 'sha256:0000' });
  const replay = await call({ type: 'a2m.approval.decision', approvalId: rq.body.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: rq.body.argsFingerprint });
  const readOnly = await call({ type: 'a2m.approval.requested', toolName: 'weather', args: { place: 'Lisbon' } });
  const v0 = ['approvalId', 'runId', 'orgId', 'workflowId', 'stepId', 'toolName', 'argsFingerprint', 'argsSnapshot', 'policyVersion', 'policyRuleId', 'budgetImpact', 'requestedAt', 'requestedBy', 'expiresAt', 'correlateKey'].every((k) => k in rq.body) && rq.body.correlateKey === rq.body.approvalId
    && ['decision', 'actor', 'reason', 'decidedAt', 'ledgerEntryId'].every((k) => k in wrongFp.body);
  check('confirm line: server rules (reason, fingerprint, once, read-only, v0 fields)', noReason.status === 400 && escNoReason.status === 400 && wrongFp.status === 409 && wrongFp.body.ran === false && replay.status === 409 && readOnly.status === 400 && gate.ran.length === 1 && v0,
    [noReason.status, escNoReason.status, wrongFp.status, replay.status, readOnly.status, gate.ran.length, v0].join(','));
  // The deploy doesn't run tools/d1/void_approvals.sql: the tables appear on first use; a database that can't make them fails closed.
  const madeAll = ['void_approvals', 'void_ledger', 'void_ledger_at'].every((x) => gate.env.DB.tables.has(x));
  const good = gate.env.DB, ranBefore = gate.ran.length, askedBefore = sent('a2m.approval.requested').length;
  gate.env.DB = memoryD1({ broken: true });
  await t.ask('send an email to jane@x.com saying hi', 900); const brokenLine = await t.whisper();
  const brokenApi = await call({ type: 'a2m.approval.requested', toolName: 'email.send', args: { to: 'a@b.c', body: 'x' } });
  gate.env.DB = good;
  check('confirm line: tables made on first use; missing table fails closed', madeAll && /couldn't ask for a yes, nothing sent/.test(brokenLine) && !/Yes \/ No/.test(brokenLine) && brokenApi.status === 503 && gate.ran.length === ranBefore && sent('a2m.approval.requested').length === askedBefore + 1,
    [madeAll, brokenLine, brokenApi.status, gate.ran.length].join(' | '));
  await t.ctx.close();

  {
  // Plan item 6: your Void follows you. Passkeys only (no password, no email), asked for in words, nothing on the surface.
  const db = () => meEnv.DB;
  const meOf = (x) => x.p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.me.v1') || 'null'));
  const lookOf = (x) => x.p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.look.v1') || '{}'));
  const serverData = () => { const rows = [...db().mine.values()]; return rows.length === 1 ? JSON.parse(rows[0].data) : null; };
  const A = await fresh({ base: localBase }, SIGNAL_SPY);
  const surface = await A.p.evaluate(() => ({ stage: document.querySelectorAll('#stage > *').length, text: document.body.innerText, clickable: Array.from(document.querySelectorAll('button, a, [role=button], microphone')).filter((e) => e.offsetParent !== null).map((e) => e.id || e.tagName) }));
  check('passkeys: nothing added to the empty surface', surface.stage === 0 && !/sign in|passkey|remember me|log in|account|password|email/i.test(surface.text) && surface.clickable.every((x) => x === 'go' || x === 'mic'), JSON.stringify(surface).slice(0, 200));
  const authA = await authenticator(A);
  await A.ask('make a clock'); await A.ask('make my void purple');
  await A.ask('what is a black hole', 300); await until(async () => /region of spacetime/.test(await A.page()), 5000); await A.ask('keep this');
  await A.ask('remember me', 0);
  const remembered = await until(async () => /remembered/.test(await A.whisper()), 10000);
  const meA = await meOf(A), pkRow = [...db().passkeys.values()][0];
  check('remember me makes a passkey, verified server-side (ES256, used-once challenge)', remembered && db().passkeys.size === 1 && (await authA.creds()).length === 1 && pkRow.alg === -7 && pkRow.backed_up === 1 && ![...db().challenges.values()].some((c) => c.kind === 'create') && meA && /^[A-Za-z0-9_-]{43}$/.test(meA.token) && meA.userId === pkRow.user_id && ![...db().sessions.keys()].includes(meA.token),
    [remembered, db().passkeys.size, pkRow && pkRow.alg, db().challenges.size, JSON.stringify(meA)].join(' | '));
  const synced = await until(() => { const d = serverData(); return d && Object.values(d.state).some((x) => x.kind === 'clock') && Object.values(d.state).some((x) => x.kind === 'kept' && /region of spacetime/.test(x.html)) && d.look.bg === '#07020f' && d; }, 6000);
  check('your stage, look and kept cards sync to the server', !!synced, JSON.stringify(serverData()).slice(0, 160));
  const credsA = await authA.creds();
  const B = await fresh({ base: localBase }, SIGNAL_SPY);
  // the same passkey, synced to a second device (each copy's counter starts ahead, so the server's counter check stays happy)
  await authenticator(B, credsA.map((c) => ({ ...c, signCount: 100 })));
  await B.ask('sign in', 0);
  const inB = await until(async () => /welcome back/.test(await B.whisper()), 10000);
  const bState = await B.state();
  const bBg = await B.p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--void-bg').trim());
  check('sign in on another device brings your stage, look and kept cards', inB && bState.some((x) => x.kind === 'clock') && bState.some((x) => x.kind === 'kept') && (await B.p.$$eval('.kept-card', (d) => d.length)) === 1 && (await lookOf(B)).bg === '#07020f' && bBg === '#07020f' && db().passkeys.size === 1,
    [inB, bState.map((x) => x.kind).join(','), bBg, await B.whisper()].join(' | '));
  await B.ask('add a sticky that says from the other device');
  const upB = await until(() => { const d = serverData(); return d && Object.values(d.state).some((x) => x.kind === 'sticky' && /from the other device/.test(x.text)); }, 6000);
  await A.p.reload();
  const followed = await until(async () => (await A.state()).some((x) => x.kind === 'sticky' && /from the other device/.test(x.text)), 6000);
  check('a change on one device follows to the other', upB && followed, [upB, followed].join(' | '));
  const C = await fresh({ base: localBase });
  await authenticator(C, credsA.map((c) => ({ ...c, signCount: 200 })));
  const immediate = await C.p.evaluate(async () => !!(PublicKeyCredential.getClientCapabilities && (await PublicKeyCredential.getClientCapabilities()).immediateGet));
  await C.ask('remember me', 0);
  const cDone = await until(async () => /welcome back|remembered/.test(await C.whisper()) && (await C.whisper()), 10000);
  check('remember me on a device that already has your passkey signs in (no second Void)', !immediate || (/welcome back/.test(cDone) && db().passkeys.size === 1 && (await C.state()).some((x) => x.kind === 'clock')), [immediate, cDone, db().passkeys.size].join(' | '));
  await C.ctx.close();
  const sessionsBefore = db().sessions.size;
  await B.ask('sign out', 0);
  const outB = await until(async () => /signed out/.test(await B.whisper()), 6000);
  check('sign out: your Void leaves this device and stays on the server', outB && !(await meOf(B)) && (await B.state()).length === 0 && !(await B.p.evaluate(() => localStorage.getItem('a2m.void.look.v1'))) && db().sessions.size === sessionsBefore - 1 && !!serverData(), [outB, (await B.state()).length, db().sessions.size, sessionsBefore].join(' | '));
  await A.ask('forget me', 300);
  const forgetLine = await A.whisper();
  await A.ask('no', 300);
  const keptAfterNo = /ok, kept/.test(await A.whisper()) && db().passkeys.size === 1 && !!serverData();
  await A.ask('forget me', 300); await A.p.click('#whisper [data-vf="yes"]');
  const forgot = await until(async () => /forgotten/.test(await A.whisper()), 6000);
  const sigA = await A.p.evaluate(() => window.__signals.filter((x) => x.n === 'signalAllAcceptedCredentials'));
  check('forget me asks first, then deletes every passkey, session and synced byte', forgetLine === 'Forget your Void on every device? Yes / No' && keptAfterNo && forgot && db().passkeys.size === 0 && db().mine.size === 0 && db().sessions.size === 0 && !(await meOf(A)) && (await A.state()).some((x) => x.kind === 'clock') && sigA.length === 1 && sigA[0].o.userId === meA.userId && sigA[0].o.allAcceptedCredentialIds.length === 0,
    [forgetLine, keptAfterNo, forgot, db().passkeys.size, db().mine.size, db().sessions.size, JSON.stringify(sigA)].join(' | '));
  await B.ask('sign in', 0);
  const refused = await until(async () => /forgotten/.test(await B.whisper()), 8000);
  const sigB = await B.p.evaluate(() => window.__signals.filter((x) => x.n === 'signalUnknownCredential'));
  check('a forgotten passkey is refused, and the browser is told (signalUnknownCredential)', refused && !(await meOf(B)) && sigB.length === 1 && sigB[0].o.credentialId === credsA[0].credentialId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') && sigB[0].o.rpId === 'localhost', [refused, JSON.stringify(sigB)].join(' | '));
  const meErrs = A.errors.concat(B.errors);
  await A.ctx.close(); await B.ctx.close();

  // Server rules, with a software authenticator (things a real browser won't do on purpose).
  const env6 = { DB: memoryMeD1(), PASSKEY_RP_ID: 'localhost', PASSKEY_ORIGINS: localOrigin, PASSKEY_BRAKE: 100000 };
  const r1 = await softRegister(env6);
  const l1 = await softLogin(env6, r1);
  const replay = await pk(env6, { step: 'get', credential: l1.credential });
  const kindSwap = await softRegister(env6, { challenge: (await pk(env6, { step: 'get-options' })).body.publicKey.challenge });
  const cOld = await pk(env6, { step: 'get-options' }); env6.DB.challenges.get(cOld.body.publicKey.challenge).expires = Date.now() - 1;
  check('passkeys: a challenge works once, for its own ceremony, within 5 minutes', r1.res.status === 200 && l1.res.status === 200 && replay.status === 400 && /challenge/.test(replay.body.error) && kindSwap.res.status === 400 && !env6.DB.challenges.has(cOld.body.publicKey.challenge) === false && (await softLogin(env6, r1)).res.status === 200,
    [r1.res.status, l1.res.status, replay.status, kindSwap.res.status].join(','));
  const evilReg = await softRegister(env6, { origin: 'https://evil.example' });
  const evilLogin = await softLogin(env6, r1, { origin: 'https://a-to-mind.com.evil.example' });
  const rpReg = await softRegister(env6, { rpId: 'evil.example' });
  const rpLogin = await softLogin(env6, r1, { rpId: 'a-to-mind.com' });
  const prod = { DB: memoryMeD1() };
  const prodOpts = await pk(prod, { step: 'create-options' });
  const prodLocal = await softRegister(prod, { origin: localOrigin, rpId: 'a-to-mind.com' });
  const prodOk = await softRegister(prod, { origin: 'https://a-to-mind.com', rpId: 'a-to-mind.com' });
  const wwwReg = await softRegister(prod, { origin: 'https://www.a-to-mind.com', rpId: 'a-to-mind.com' });
  check('passkeys: origin and rpId must be a-to-mind.com (anything else refused)', evilReg.res.status === 400 && /origin/.test(evilReg.res.body.error) && evilLogin.res.status === 400 && rpReg.res.status === 400 && /rpId/.test(rpReg.res.body.error) && rpLogin.res.status === 400
    && prodOpts.body.publicKey.rp.id === 'a-to-mind.com' && prodOpts.body.publicKey.authenticatorSelection.userVerification === 'required' && prodLocal.res.status === 400 && prodOk.res.status === 200 && wwwReg.res.status === 400,
    [evilReg.res.status, evilLogin.res.status, rpReg.res.status, rpLogin.res.status, prodOpts.body.publicKey.rp.id, prodLocal.res.status, prodOk.res.status, wwwReg.res.status].join(','));
  const badSig = await softLogin(env6, r1, { tamper: true });
  const noUV = await softLogin(env6, r1, { uv: false });
  const noUVReg = await softRegister(env6, { uv: false });
  const wrongUser = await softLogin(env6, r1, { userId: wa.b64u(new Uint8Array(16)) });
  const r2 = await softRegister(env6);
  const c5 = await softLogin(env6, r2, { counter: 5 }), c5again = await softLogin(env6, r2, { counter: 5 }), c3 = await softLogin(env6, r2, { counter: 3 }), c6 = await softLogin(env6, r2, { counter: 6 });
  const stranger = await softLogin(env6, { ...r1, credId: crypto.getRandomValues(new Uint8Array(32)) });
  check('passkeys: bad signature, no user verification, wrong user or a counter going back is refused', badSig.res.status === 400 && /signature/.test(badSig.res.body.error) && noUV.res.status === 400 && noUVReg.res.status === 400 && wrongUser.res.status === 400 && c5.res.status === 200 && c5again.res.status === 400 && c3.res.status === 400 && c6.res.status === 200 && stranger.res.status === 404,
    [badSig.res.status, noUV.res.status, noUVReg.res.status, wrongUser.res.status, c5.res.status, c5again.res.status, c3.res.status, c6.res.status, stranger.res.status].join(','));
  const ed = await softRegister(env6, { alg: -8 }), rsa = await softRegister(env6, { alg: -257 });
  check('passkeys: Ed25519 and RS256 passkeys verify too', ed.res.status === 200 && rsa.res.status === 200 && (await softLogin(env6, ed)).res.status === 200 && (await softLogin(env6, rsa)).res.status === 200 && (await softLogin(env6, rsa, { tamper: true })).res.status === 400,
    [ed.res.status, rsa.res.status].join(','));
  const tok = l1.res.body.token;
  const add = await softRegister(env6, { token: tok });
  const addNoSession = await (async () => { const o = await pk(env6, { step: 'create-options' }, tok); const x = await softRegister(env6, { challenge: o.body.publicKey.challenge }); return x.res; })();
  check('passkeys: add a passkey needs your session; a new one never joins someone else', add.res.status === 200 && add.res.body.added === true && !add.res.body.token && add.userId === r1.userId && [...env6.DB.passkeys.values()].filter((x) => x.user_id === r1.userId).length === 2 && addNoSession.status === 400,
    [add.res.status, add.res.body && add.res.body.added, addNoSession.status].join(','));
  const mine = (method, body, token) => callMe(method === 'GET' ? mineFn.onRequestGet : mineFn.onRequestPut, env6, body, token, method);
  const m0 = await mine('GET', null, null), m1 = await mine('GET', null, tok);
  const w1 = await mine('PUT', { data: { state: { a: { id: 'a', kind: 'clock', x: 1, y: 2 } }, look: { bg: '#000000' } }, baseRev: 0 }, tok);
  const w1again = await mine('PUT', { data: { state: {}, look: {} }, baseRev: 0 }, tok);
  const w2 = await mine('PUT', { data: { state: {}, look: {} }, baseRev: 1 }, tok);
  const big = await mine('PUT', { data: { state: { a: { kind: 'kept', html: 'x'.repeat(950000) } }, look: {} }, baseRev: 2 }, tok);
  const junk = await mine('PUT', { data: { state: 'nope', look: {} }, baseRev: 2 }, tok);
  await pk(env6, { step: 'sign-out' }, tok);
  const afterOut = await mine('GET', null, tok);
  check('passkeys: sync needs a live session; a stale write gets 409 with the newer copy', m0.status === 401 && m1.status === 200 && m1.body.data === null && w1.status === 200 && w1.body.rev === 1 && w1again.status === 409 && w1again.body.rev === 1 && w1again.body.data.state.a.kind === 'clock' && w2.status === 200 && w2.body.rev === 2 && big.status === 413 && junk.status === 400 && afterOut.status === 401,
    [m0.status, m1.status, w1.status, w1again.status, w2.status, big.status, junk.status, afterOut.status].join(','));
  const brakeEnv = { DB: memoryMeD1(), PASSKEY_BRAKE: 3 };
  const braked = []; for (let i = 0; i < 4; i++) braked.push((await pk(brakeEnv, { step: 'get-options' }, null, { 'cf-connecting-ip': '203.0.113.9' })).status);
  check('passkeys: anonymous challenge minting is braked per connection', braked.join(',') === '200,200,200,429', braked.join(','));
  // The deploy doesn't run tools/d1/void_passkeys.sql: tables appear on first use; a database that can't make them fails closed.
  const madeMe = ['void_passkeys', 'void_passkeys_user', 'void_passkey_challenges', 'void_sessions', 'void_sessions_user', 'void_mine'].every((x) => meEnv.DB.tables.has(x));
  const goodMe = meEnv.DB; meEnv.DB = memoryMeD1({ broken: true });
  const E = await fresh({ base: localBase });
  const authE = await authenticator(E);
  await E.ask('make a clock'); await E.ask('remember me', 0);
  const brokenMsg = await until(async () => /aren't available/.test(await E.whisper()) && (await E.whisper()), 8000);
  const brokenApi = [(await pk(meEnv, { step: 'create-options' })).status, (await callMe(mineFn.onRequestGet, meEnv, null, 'x'.repeat(43), 'GET')).status];
  check('passkeys: tables made on first use; missing D1 fails closed', madeMe && /nothing saved/.test(brokenMsg) && !(await meOf(E)) && (await authE.creds()).length === 0 && brokenApi.join(',') === '503,503' && (await E.state()).some((x) => x.kind === 'clock'),
    [madeMe, brokenMsg, brokenApi.join(',')].join(' | '));
  meEnv.DB = goodMe;
  check('no script errors (passkeys)', !meErrs.length && !E.errors.length, meErrs.concat(E.errors).join(' | '));
  await E.ctx.close();
  }
} catch (e) {
  check('suite ran to the end', false, String(e && e.message));
}
await browser.close(); server.close();
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'pass ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + (r.got || '')));
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
