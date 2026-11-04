// The text encodings family (bots/encodings.js): 56 bots, every pair of eight ways to write text, each checked by a round trip, a known
// answer for "Hé!" and a refusal of foreign input. These tests check the checks against Node's own Buffer, an independent encoder.
// Run: node --test tools/encodings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodings, CODECS, KNOWN } from '../void-live-deploy/bots/encodings.js';
import { families, check } from '../void-live-deploy/bots/families.js';
import { BOT } from '../void-live-deploy/bots/kit.js';

test('56 bots, every one passing its checks, all in the families and listed under encodings', () => {
  const B = encodings();
  assert.equal(B.length, 56); assert.equal(new Set(B.map((b) => b.id)).size, 56);
  for (const b of B) assert.deepEqual(check(b).fails, [], b.id);
  const ids = new Set(families().map((b) => b.id)); for (const b of B) assert.ok(ids.has(b.id), b.id + ' in families()');
  assert.equal(families().filter((b) => b.id.endsWith('-to-hex')).length, families().filter((b) => b.family === 'text encodings' && b.id.endsWith('-to-hex')).length, 'no id clash with another family');
  for (const b of B) { assert.equal(b.cat, 'encodings'); for (const f of b.from) assert.ok(BOT(f.slice(5)), f + ' is a live bot'); }
});

test('the known answers and every encoder agree with Node\'s Buffer on varied text', () => {
  const buf = (s) => Buffer.from(s, 'utf8');
  assert.equal(KNOWN.base64, buf('Hé!').toString('base64')); assert.equal(KNOWN.base64url, buf('Hé!').toString('base64url')); assert.equal(KNOWN.hex, buf('Hé!').toString('hex'));
  for (const s of ['Lakeland 🌴 FL', 'naïve façade', '∑ x² ≤ 1', '']) {
    assert.equal(CODECS.base64.to(s), buf(s).toString('base64')); assert.equal(CODECS.base64url.to(s), buf(s).toString('base64url')); assert.equal(CODECS.hex.to(s), buf(s).toString('hex'));
    assert.equal(CODECS.binary.to(s), [...buf(s)].map((x) => x.toString(2).padStart(8, '0')).join(' '));
    assert.equal(CODECS.html.from(CODECS.html.to(s)), s); assert.equal(JSON.parse('"' + CODECS.unicode.to(s).replace(/\\u\{([0-9a-f]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16))) + '"'), s);
  }
});

test('a bot answers a real input and refuses one that is not its encoding', () => {
  const B = Object.fromEntries(encodings().map((b) => [b.id, b]));
  assert.equal(B['base64-to-text'].run('VmVyc2U='), 'Verse');
  assert.equal(B['hex-to-base64'].run('56 65 72 73 65'), 'VmVyc2U=');
  assert.equal(B['text-to-percent'].run('a b&c'), 'a%20b%26c');
  assert.equal(B['html-to-unicode'].run('&#x1F680;'), '\\u{1f680}');
  assert.throws(() => B['binary-to-text'].run('0101'), /not binary/);
  assert.throws(() => B['hex-to-text'].run('c3'), 'a cut UTF-8 byte is refused, never shown as a wrong letter');
});
