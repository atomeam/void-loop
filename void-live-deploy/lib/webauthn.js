// WebAuthn (Level 3, W3C Recommendation 2026-08-25) verification for Void's passkeys. No dependencies:
// runs on Workers (Pages Functions) and in Node 20+ (the test suite) with only WebCrypto.
// What it checks, per https://www.w3.org/TR/webauthn-3/#sctn-registering-a-new-credential and #sctn-verifying-assertion:
//   clientDataJSON: type, challenge (the one we stored), origin (exact match), not cross-origin
//   authenticatorData: rpIdHash = SHA-256(rpId), user present, user verified, BS only with BE, no trailing bytes
//   registration: attested credential data present, credential id matches, COSE key is one we can verify
//   assertion: signature over authenticatorData || SHA-256(clientDataJSON) with the stored key, userHandle matches,
//              signature counter never goes backwards (when the authenticator keeps one)
// Attestation statements aren't trusted or needed (we ask for attestation 'none'): the key is bound to the account at
// registration by the used-once challenge, and every later sign-in proves possession of that key.
// Keys: ES256 (-7), EdDSA/Ed25519 (-8, -19), RS256 (-257).

const te = new TextEncoder();
const subtle = crypto.subtle;

export function b64u(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(s)) throw new Error('bad base64url');
  const t = s.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const randomB64u = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256(bytes) { return new Uint8Array(await subtle.digest('SHA-256', typeof bytes === 'string' ? te.encode(bytes) : bytes)); }
export function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; };

// --- CBOR (RFC 8949), the subset CTAP2 uses: definite lengths only, no tags, no floats ---
export function cborDecode(buf, start = 0) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = start;
  const need = (n) => { if (p + n > u.length) throw new Error('cbor: truncated'); };
  const arg = (ai) => {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return u[p++]; }
    if (ai === 25) { need(2); const v = (u[p] << 8) | u[p + 1]; p += 2; return v; }
    if (ai === 26) { need(4); const v = ((u[p] << 24) >>> 0) + (u[p + 1] << 16) + (u[p + 2] << 8) + u[p + 3]; p += 4; return v; }
    if (ai === 27) { need(8); let v = 0; for (let i = 0; i < 8; i++) v = v * 256 + u[p + i]; p += 8; if (v > Number.MAX_SAFE_INTEGER) throw new Error('cbor: int too big'); return v; }
    throw new Error('cbor: unsupported length');
  };
  const item = (depth) => {
    if (depth > 16) throw new Error('cbor: too deep');
    need(1);
    const ib = u[p++], major = ib >> 5, ai = ib & 31;
    if (major === 7) {
      if (ai === 20) return false; if (ai === 21) return true; if (ai === 22) return null; if (ai === 23) return undefined;
      throw new Error('cbor: unsupported simple/float');
    }
    const n = arg(ai);
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (major === 2) { need(n); const v = u.slice(p, p + n); p += n; return v; }
    if (major === 3) { need(n); const v = new TextDecoder('utf-8', { fatal: true }).decode(u.subarray(p, p + n)); p += n; return v; }
    if (major === 4) { if (n > 1024) throw new Error('cbor: array too long'); const a = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
    if (major === 5) {
      if (n > 256) throw new Error('cbor: map too long');
      const m = new Map();
      for (let i = 0; i < n; i++) { const k = item(depth + 1); if (typeof k !== 'number' && typeof k !== 'string') throw new Error('cbor: bad map key'); if (m.has(k)) throw new Error('cbor: duplicate key'); m.set(k, item(depth + 1)); }
      return m;
    }
    throw new Error('cbor: tags not supported');
  };
  const value = item(0);
  return { value, end: p };
}

// --- authenticatorData ---
export function parseAuthData(ad) {
  if (!(ad instanceof Uint8Array) || ad.length < 37) throw new Error('authenticator data too short');
  const flags = ad[32];
  const out = {
    rpIdHash: ad.slice(0, 32), flags,
    up: !!(flags & 0x01), uv: !!(flags & 0x04), be: !!(flags & 0x08), bs: !!(flags & 0x10), at: !!(flags & 0x40), ed: !!(flags & 0x80),
    signCount: ((ad[33] << 24) >>> 0) + (ad[34] << 16) + (ad[35] << 8) + ad[36],
  };
  let p = 37;
  if (out.at) {
    if (ad.length < p + 18) throw new Error('attested credential data truncated');
    out.aaguid = ad.slice(p, p + 16);
    const len = (ad[p + 16] << 8) | ad[p + 17]; p += 18;
    if (len < 16 || len > 1023 || ad.length < p + len) throw new Error('bad credential id length');
    out.credentialId = ad.slice(p, p + len); p += len;
    const k = cborDecode(ad, p);
    out.cosePublicKey = ad.slice(p, k.end); out.coseKey = k.value; p = k.end;
  }
  if (out.ed) { const e = cborDecode(ad, p); p = e.end; }
  if (p !== ad.length) throw new Error('trailing bytes in authenticator data');
  if (out.bs && !out.be) throw new Error('backup state without backup eligibility');
  return out;
}

// --- COSE keys -> WebCrypto verifiers ---
export const ALGS = [-7, -8, -257]; // pubKeyCredParams, in preference order
function derToRaw(der, n) {
  // ECDSA-Sig-Value ::= SEQUENCE { r INTEGER, s INTEGER } -> r || s, each n bytes (what WebCrypto verifies)
  let p = 0;
  const len = () => { let l = der[p++]; if (l & 0x80) { const k = l & 0x7f; if (k !== 1) throw new Error('bad DER length'); l = der[p++]; } return l; };
  if (der[p++] !== 0x30) throw new Error('bad ECDSA signature');
  const total = len(); if (p + total !== der.length) throw new Error('bad ECDSA signature length');
  const int = () => {
    if (der[p++] !== 0x02) throw new Error('bad ECDSA integer');
    const l = len(); if (l < 1 || p + l > der.length) throw new Error('bad ECDSA integer length');
    let v = der.slice(p, p + l); p += l;
    while (v.length > 1 && v[0] === 0) v = v.slice(1);
    if (v.length > n) throw new Error('ECDSA integer too long');
    const o = new Uint8Array(n); o.set(v, n - v.length); return o;
  };
  const r = int(), s = int();
  if (p !== der.length) throw new Error('trailing bytes in ECDSA signature');
  return concat(r, s);
}
export async function coseVerifier(cose) {
  const m = cose instanceof Map ? cose : cborDecode(cose).value;
  if (!(m instanceof Map)) throw new Error('COSE key is not a map');
  const kty = m.get(1), alg = m.get(3);
  const bytes = (k, n) => { const v = m.get(k); if (!(v instanceof Uint8Array) || (n && v.length !== n)) throw new Error('bad COSE key parameter ' + k); return v; };
  if (kty === 2 && alg === -7) {
    if (m.get(-1) !== 1) throw new Error('only P-256 for ES256');
    const key = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(bytes(-2, 32)), y: b64u(bytes(-3, 32)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return { alg, verify: (sig, data) => subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig, 32), data) };
  }
  if (kty === 1 && (alg === -8 || alg === -19)) {
    if (m.get(-1) !== 6) throw new Error('only Ed25519 for EdDSA');
    const key = await subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: b64u(bytes(-2, 32)), ext: true }, { name: 'Ed25519' }, false, ['verify']);
    return { alg, verify: (sig, data) => subtle.verify({ name: 'Ed25519' }, key, sig, data) };
  }
  if (kty === 3 && alg === -257) {
    const n = bytes(-1), e = bytes(-2);
    if (n.length < 256) throw new Error('RSA key under 2048 bits');
    const key = await subtle.importKey('jwk', { kty: 'RSA', n: b64u(n), e: b64u(e), alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return { alg, verify: (sig, data) => subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig, data) };
  }
  throw new Error('unsupported key type ' + kty + '/' + alg);
}

// --- ceremonies ---
function clientData(credential, type, expectedChallenge, origins) {
  const raw = unb64u(String(credential.response.clientDataJSON || ''));
  let c;
  try { c = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch (_) { throw new Error('clientDataJSON unreadable'); }
  if (!c || c.type !== type) throw new Error('wrong ceremony type');
  let ch; try { ch = unb64u(String(c.challenge)); } catch (_) { throw new Error('challenge mismatch'); }
  if (!same(ch, unb64u(expectedChallenge))) throw new Error('challenge mismatch');
  if (!origins.includes(c.origin)) throw new Error('origin not allowed');
  if (c.crossOrigin === true || c.topOrigin !== undefined) throw new Error('cross-origin ceremony');
  return raw;
}
function shape(credential) {
  if (!credential || typeof credential !== 'object' || credential.type !== 'public-key' || !credential.response || typeof credential.response !== 'object') throw new Error('not a passkey credential');
  if (typeof credential.id !== 'string' || credential.id !== credential.rawId) throw new Error('credential id mismatch');
  return unb64u(credential.id);
}

// -> { credentialId, publicKey (COSE, base64url), alg, signCount, backupEligible, backedUp, transports }
export async function verifyRegistration({ credential, expectedChallenge, origins, rpId, requireUV = true }) {
  const rawId = shape(credential);
  clientData(credential, 'webauthn.create', expectedChallenge, origins);
  const att = cborDecode(unb64u(String(credential.response.attestationObject || ''))).value;
  if (!(att instanceof Map) || typeof att.get('fmt') !== 'string' || !(att.get('attStmt') instanceof Map) || !(att.get('authData') instanceof Uint8Array)) throw new Error('attestation object malformed');
  if (att.get('fmt') === 'none' && att.get('attStmt').size) throw new Error('none attestation with a statement');
  const ad = parseAuthData(att.get('authData'));
  if (!same(ad.rpIdHash, await sha256(rpId))) throw new Error('rpId mismatch');
  if (!ad.up) throw new Error('user not present');
  if (requireUV && !ad.uv) throw new Error('user not verified');
  if (!ad.at || !ad.credentialId) throw new Error('no credential in attestation');
  if (!same(ad.credentialId, rawId)) throw new Error('credential id mismatch');
  const v = await coseVerifier(ad.coseKey);
  if (!ALGS.includes(v.alg) && v.alg !== -19) throw new Error('algorithm not offered');
  const transports = Array.isArray(credential.response.transports) ? credential.response.transports.filter((t) => typeof t === 'string').slice(0, 8) : [];
  return { credentialId: b64u(rawId), publicKey: b64u(ad.cosePublicKey), alg: v.alg, signCount: ad.signCount, backupEligible: ad.be, backedUp: ad.bs, transports };
}

// stored: { publicKey (COSE, base64url), signCount, userId (base64url user handle) } -> { signCount, backedUp }
export async function verifyAuthentication({ credential, expectedChallenge, origins, rpId, stored, requireUV = true }) {
  const rawId = shape(credential);
  const cdj = clientData(credential, 'webauthn.get', expectedChallenge, origins);
  const adBytes = unb64u(String(credential.response.authenticatorData || ''));
  const ad = parseAuthData(adBytes);
  if (!same(ad.rpIdHash, await sha256(rpId))) throw new Error('rpId mismatch');
  if (!ad.up) throw new Error('user not present');
  if (requireUV && !ad.uv) throw new Error('user not verified');
  const uh = credential.response.userHandle;
  if (!uh || !same(unb64u(String(uh)), unb64u(stored.userId))) throw new Error('user handle mismatch');
  const v = await coseVerifier(unb64u(stored.publicKey));
  const sig = unb64u(String(credential.response.signature || ''));
  const ok = await v.verify(sig, concat(adBytes, await sha256(cdj))).catch(() => false);
  if (!ok) throw new Error('bad signature');
  const before = Number(stored.signCount) || 0;
  if ((ad.signCount || before) && ad.signCount <= before) throw new Error('signature counter went backwards');
  return { credentialId: b64u(rawId), signCount: ad.signCount, backedUp: ad.bs };
}
