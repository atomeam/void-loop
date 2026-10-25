// lib/base64.js: RFC 4648 Base64 and Base64URL, exact for UTF-8 text (emoji, accents), plain errors on bad input, files as data: URLs
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeText, decodeText, encodeBytes, decodeBytes, textToBytes, bytesToText, hexOf, dataUrl, dataUrlParts, sizeOf, sniffCharset } from '../void-live-deploy/lib/base64.js';

test('the RFC 4648 test vectors (section 10), both ways', () => {
  const V = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
  for (const [t, b] of V) {
    assert.equal(encodeText(t).base64, b); assert.equal(decodeText(b).text, t);
    assert.equal(encodeText(t, { pad: false }).base64, b.replace(/=/g, '')); assert.equal(decodeText(b.replace(/=/g, '')).text, t, 'unpadded decodes too');
  }
  assert.equal(encodeText('hello').base64, 'aGVsbG8=', "the tower's question");
});
test('UTF-8 text comes back exactly: accents, emoji, scripts, a joined emoji', () => {
  for (const t of ['café crème', 'naïve façade', '日本語のテキスト', '🎉 party 👩‍👩‍👧', 'Ελληνικά', 'a\u0000b', '\r\n\t']) assert.equal(decodeText(encodeText(t).base64).text, t);
  assert.equal(encodeText('é').base64, 'w6k='); assert.equal(encodeText('😀').base64, '8J+YgA==');
  assert.equal(encodeText('Zürich').base64, 'WsO8cmljaA==', 'what Node and every standard encoder give');
  assert.equal(encodeText('Zürich').base64, Buffer.from('Zürich', 'utf8').toString('base64'));
});
test('Base64URL: - and _ instead of + and /, padding optional, decoded either way', () => {
  const bytes = Uint8Array.from([251, 255, 191, 0, 62, 63]);
  assert.equal(encodeBytes(bytes), '+/+/AD4/'); assert.equal(encodeBytes(bytes, { url: true }), '-_-_AD4_');
  assert.equal(encodeText('😀', { url: true, pad: false }).base64, '8J-YgA');
  assert.equal(decodeText('8J-YgA').text, '😀'); assert.equal(decodeBytes('8J-YgA').alphabet, 'url');
  assert.deepEqual([...decodeBytes('-_-_AD4_').bytes], [...bytes]);
  assert.equal(encodeBytes(bytes, { url: true }), Buffer.from(bytes).toString('base64url') + '', 'Node agrees (it never pads base64url, and these 6 bytes need none)');
});
test('every byte value and every length round-trips, and matches Node', () => {
  for (let n = 0; n < 70; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255);
    assert.equal(encodeBytes(b), Buffer.from(b).toString('base64')); assert.deepEqual([...decodeBytes(encodeBytes(b)).bytes], [...b]);
    assert.equal(encodeBytes(b, { url: true, pad: false }), Buffer.from(b).toString('base64url')); assert.deepEqual([...decodeBytes(encodeBytes(b, { url: true, pad: false })).bytes], [...b]);
  }
  const all = Uint8Array.from({ length: 256 }, (_, i) => i); assert.equal(encodeBytes(all), Buffer.from(all).toString('base64'));
});
test('line breaks and spaces are ignored; MIME wrapping at 76', () => {
  const long = 'x'.repeat(200), w = encodeText(long, { wrap: 76 }).base64;
  assert.ok(w.split('\n').every((l) => l.length <= 76) && w.split('\n')[0].length === 76);
  assert.equal(decodeText(w).text, long); assert.equal(decodeText(' aGVs\n bG8= ').text, 'hello');
});
test('invalid input is said plainly, never decoded into garbage', () => {
  const bad = (s) => { const r = decodeText(s); assert.equal(r.ok, false, s); return r.error; };
  assert.match(bad('aGVs*G8='), /“\*” at character 5 is not a Base64 character/);
  assert.match(bad('héllo'), /“é” at character 2/);
  assert.match(bad('a+b-'), /mixes the standard alphabet/);
  assert.match(bad('aGVsb'), /5 characters long/);
  assert.match(bad('aGVsbG8=x'), /after the = padding/);
  // padding of the wrong length is decoded anyway and said so (the owner, 2026-10-25: tolerate a missing or extra =)
  for (const off of ['aGVsbG8===', 'aGVsbG8==', 'aGVsbA=']) { const r = decodeText(off); assert.equal(r.ok, true, off); assert.match(r.note, /padding at the end was the wrong length/, off); }
  assert.equal(decodeText('aGVsbG8==').text, 'hello'); assert.equal(decodeText('aGVsbA').text, 'hell', 'no padding at all needs no note'); assert.equal(decodeText('aGVsbA').note, undefined);
  assert.equal(decodeText('aGVsbG==').text, 'hell');
  assert.match(bad('/w=='), /not UTF-8 text/, 'one byte 0xff: decodes, but is not text');
  const r = decodeText('/w=='); assert.equal(r.binary, true); assert.deepEqual([...r.bytes], [255], 'the bytes are kept, for hex and download');
  assert.ok(decodeBytes('aGVsbG9=').note, 'leftover bits that are not zero are noted');
  assert.equal(decodeText('').text, '');
});
test('data: URLs: made from a file, taken whole when pasted', () => {
  assert.equal(dataUrl(Uint8Array.from([137, 80, 78, 71]), 'image/png'), 'data:image/png;base64,iVBORw==');
  assert.deepEqual(dataUrlParts('data:text/plain;charset=utf-8;base64,aGk='), { mime: 'text/plain;charset=utf-8', body: 'aGk=' });
  assert.equal(dataUrlParts('data:text/plain,hi'), null, 'not base64');
  const r = decodeText('data:text/plain;base64,aGVsbG8='); assert.equal(r.text, 'hello'); assert.equal(r.mime, 'text/plain');
});
test('character sets: UTF-16LE and Latin-1 as base64encode.org offers, Latin-1 says what it cannot hold', () => {
  assert.equal(encodeText('hi', { charset: 'utf-16le' }).base64, 'aABpAA=='); assert.equal(decodeText('aABpAA==', 'utf-16le').text, 'hi');
  assert.equal(encodeText('café', { charset: 'latin1' }).base64, 'Y2Fm6Q=='); assert.equal(decodeText('Y2Fm6Q==', 'latin1').text, 'café');
  assert.match(textToBytes('a€', 'latin1').error, /“€” \(character 2\) is not in ISO-8859-1/);
  assert.equal(bytesToText(Uint8Array.from([0x80]), 'latin1').text, '\u0080', 'true ISO-8859-1, not windows-1252');
  assert.equal(decodeText('YQ==', 'utf-16le').ok, false);
});
test('hex and sizes', () => {
  assert.equal(hexOf(textToBytes('hé').bytes), '68 c3 a9'); assert.equal(sizeOf(1), '1 byte'); assert.equal(sizeOf(2048), '2.0 KB');
});

test('the character set is detected when decoding: a byte-order mark, then UTF-8, then UTF-16LE, else Latin-1', () => {
  const b = (...x) => new Uint8Array(x);
  assert.equal(sniffCharset(b(0xef, 0xbb, 0xbf, 0x68)), 'utf-8'); assert.equal(sniffCharset(b(0xff, 0xfe, 0x68, 0)), 'utf-16le');
  assert.equal(sniffCharset(new TextEncoder().encode('café 🎉')), 'utf-8'); assert.equal(sniffCharset(b(0x68, 0, 0x69, 0)), 'utf-16le');
  assert.equal(sniffCharset(b(0x63, 0x61, 0x66, 0xe9)), 'latin1', 'café in Latin-1 is not valid UTF-8');
  const auto = (txt, cs) => decodeText(encodeText(txt, { charset: cs }).base64, 'auto');
  assert.deepEqual([auto('café', 'utf-8').text, auto('café', 'utf-8').charset], ['café', 'utf-8']);
  assert.deepEqual([auto('hello', 'utf-16le').text, auto('hello', 'utf-16le').charset], ['hello', 'utf-16le']);
  assert.deepEqual([auto('café', 'latin1').text, auto('café', 'latin1').charset], ['café', 'latin1']);
});
