// Text encodings family (owner, 2026-11-03: each new bot is made from ones Verse already has): one bot for every pair of eight ways to
// write text (plain text, Base64, Base64url, hex, binary, percent-encoding, HTML numeric entities, \u escapes), built from base64-bot,
// url-decoder and base-converter. Every bot is checked, never by its own first answer: a round trip on varied text (accents, emoji,
// punctuation) through the bot and its reverse, a known answer for "Hé!" from the published encodings of its UTF-8 bytes
// (48 C3 A9 21), and a refusal of input that is not in its source encoding.
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const bytesOf = (s) => [...enc.encode(String(s))], textOf = (b) => dec.decode(new Uint8Array(b));
const b64 = (b) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => { const t = String(s).replace(/\s+/g, ''); if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t) || t.length % 4 === 1) throw new Error('not Base64'); return [...atob(t)].map((c) => c.charCodeAt(0)); };
export const CODECS = {
  text: { name: 'plain text', to: (s) => String(s), from: (s) => String(s) },
  base64: { name: 'Base64', to: (s) => b64(bytesOf(s)), from: (s) => textOf(unb64(s)) },
  base64url: { name: 'Base64url', to: (s) => b64(bytesOf(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), from: (s) => { const t = String(s).trim(); if (!/^[A-Za-z0-9_-]*$/.test(t)) throw new Error('not Base64url'); return textOf(unb64(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4))); } },
  hex: { name: 'hex', to: (s) => bytesOf(s).map((x) => x.toString(16).padStart(2, '0')).join(''), from: (s) => { const t = String(s).replace(/[\s:]|0x/gi, ''); if (!/^([0-9a-f]{2})*$/i.test(t)) throw new Error('not hex'); return textOf(t.match(/../g) ? t.match(/../g).map((h) => parseInt(h, 16)) : []); } },
  binary: { name: 'binary', to: (s) => bytesOf(s).map((x) => x.toString(2).padStart(8, '0')).join(' '), from: (s) => { const t = String(s).trim().split(/\s+/).filter(Boolean); if (!t.every((x) => /^[01]{8}$/.test(x))) throw new Error('not binary bytes'); return textOf(t.map((x) => parseInt(x, 2))); } },
  percent: { name: 'percent-encoding', to: (s) => encodeURIComponent(String(s)), from: (s) => decodeURIComponent(String(s)) },
  html: { name: 'HTML numeric entities', to: (s) => [...String(s)].map((c) => '&#' + c.codePointAt(0) + ';').join(''), from: (s) => { const t = String(s).trim(); if (!/^(&#(\d+|x[0-9a-f]+);)*$/i.test(t)) throw new Error('not numeric entities'); return t.replace(/&#(x?)([0-9a-f]+);/gi, (_, x, n) => String.fromCodePoint(parseInt(n, x ? 16 : 10))); } },
  unicode: { name: '\\u escapes', to: (s) => [...String(s)].map((c) => { const n = c.codePointAt(0); return n > 0xffff ? '\\u{' + n.toString(16) + '}' : '\\u' + n.toString(16).padStart(4, '0'); }).join(''), from: (s) => { const t = String(s).trim(); if (!/^(\\u([0-9a-f]{4}|\{[0-9a-f]{1,6}\}))*$/i.test(t)) throw new Error('not \\u escapes'); return t.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16))); } },
};
// "Hé!" (UTF-8 48 C3 A9 21) in each encoding, written out by hand from the published rules (RFC 4648, RFC 3986, HTML, ECMAScript)
export const KNOWN = { text: 'Hé!', base64: 'SMOpIQ==', base64url: 'SMOpIQ', hex: '48c3a921', binary: '01001000 11000011 10101001 00100001', percent: 'H%C3%A9!', html: '&#72;&#233;&#33;', unicode: '\\u0048\\u00e9\\u0021' };
const SAMPLES = ['Hello, Verse!', 'Lakeland, FL 33801', 'café ñandú', '🚀 to the moon 🌕', 'a+b/c=d?&%', '', ' x ', '日本語のテキスト'];
const FROM = ['bots/base64-bot', 'bots/url-decoder', 'bots/base-converter'];
export function encodings() {
  const out = [], ids = Object.keys(CODECS);
  for (const a of ids) for (const b of ids) if (a !== b) {
    const f = (s) => CODECS[b].to(CODECS[a].from(s)), back = (s) => CODECS[a].to(CODECS[b].from(s));
    out.push({ id: a + '-to-' + b, cat: 'encodings', family: 'text encodings', job: 'Rewrites ' + CODECS[a].name + ' as ' + CODECS[b].name, from: FROM, run: f, sample: KNOWN[a],
      checks: [
        ['round trip on varied text', () => SAMPLES.every((t) => CODECS[a].from(back(f(CODECS[a].to(t)))) === t)],
        ['known answer for "Hé!"', () => f(KNOWN[a]) === KNOWN[b]],
        ['refuses what is not ' + CODECS[a].name, () => a === 'text' ? true : (() => { try { f('%%not valid%%'); return false; } catch (_) { return true; } })()],
      ] });
  }
  return out;
}
