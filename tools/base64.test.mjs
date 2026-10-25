// lib/base64.js: RFC 4648 Base64 and Base64URL, exact for UTF-8 text (emoji, accents), plain errors on bad input, files as data: URLs
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeText, decodeText, encodeBytes, decodeBytes, textToBytes, bytesToText, hexOf, dataUrl, dataUrlParts, sizeOf, sniffCharset, CHARSETS, CHARSET_GROUPS, canEncode } from '../void-live-deploy/lib/base64.js';

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

test('dozens of character sets, as base64encode.org offers: single-byte sets round-trip, EBCDIC and DOS from their tables', () => {
  const rt = (t, cs) => { const r = encodeText(t, { charset: cs }); assert.equal(r.ok, true, cs + ': ' + r.error); assert.equal(decodeText(r.base64, cs).text, t, cs); return r.base64; };
  assert.equal(rt('café', 'windows-1252'), 'Y2Fm6Q==', 'é is 0xE9 in Windows-1252');
  assert.equal(rt('Привет', 'koi8-r'), '8NLJ18XU', 'what Python and iconv give for KOI8-R');
  assert.equal(rt('Ä', 'cp850'), 'jg==', 'Ä is 0x8E in CP850');
  assert.equal(rt('HELLO', 'ibm037'), 'yMXT09Y=', 'EBCDIC 037: H C8, E C5, L D3, O D6');
  assert.equal(rt('hello, world! [1+2] {a} \\ ^', 'ibm037').length > 0, true);
  assert.deepEqual([...textToBytes('a0 []{}', 'ibm037').bytes], [0x81, 0xf0, 0x40, 0xba, 0xbb, 0xc0, 0xd0]);
  assert.equal(rt('╔═╗ ½ ß', 'cp437'), Buffer.from([0xc9, 0xcd, 0xbb, 0x20, 0xab, 0x20, 0xe1]).toString('base64'));
  assert.equal(rt('Zażółć', 'iso-8859-2'), Buffer.from([0x5a, 0x61, 0xbf, 0xf3, 0xb3, 0xe6]).toString('base64'));
  assert.equal(rt('Țară', 'iso-8859-16'), Buffer.from([0xde, 0x61, 0x72, 0xe3]).toString('base64'), 'ISO-8859-16 from its table (Node has no decoder for it)');
  for (const [t, cs] of [['Ελληνικά', 'iso-8859-7'], ['Ελληνικά', 'windows-1253'], ['İstanbul ğış', 'iso-8859-9'], ['שלום', 'windows-1255'], ['مرحبا', 'windows-1256'], ['สวัสดี', 'windows-874'],
    ['Добрий день, ґанок', 'koi8-u'], ['Здравствуй', 'ibm866'], ['Ærø Þór', 'iso-8859-10'], ['Café ŒUVRE €', 'iso-8859-15'], ['Žąsis', 'windows-1257'], ['Grüße', 'macintosh'], ['hello', 'ascii']]) rt(t, cs);
  assert.equal(rt('hi', 'utf-16be'), 'AGgAaQ=='); assert.equal(decodeText('AGgAaQ==', 'utf-16be').text, 'hi');
  assert.equal(bytesToText(Uint8Array.from([0x80]), 'iso-8859-9').text, '\u0080', 'ISO-8859-9 keeps 0x80 to 0x9F as controls, not Windows-1254');
  assert.ok(Object.keys(CHARSETS).length >= 40, Object.keys(CHARSETS).length + ' sets');
  assert.ok(CHARSET_GROUPS.every((g) => g.sets.length), 'no empty group');
});
test('a character a set cannot hold is named with its place, never turned into ?', () => {
  assert.equal(textToBytes('Hi 😀', 'windows-1252').ok, false);
  assert.match(textToBytes('Hi 😀', 'windows-1252').error, /“😀” \(character 4\) is not in Windows-1252: choose UTF-8/);
  assert.match(textToBytes('café', 'ascii').error, /“é” \(character 4\) is not in US-ASCII/);
  assert.match(textToBytes('Жж', 'ibm037').error, /“Ж” \(character 1\) is not in EBCDIC 037/);
  assert.match(bytesToText(Uint8Array.from([0x41, 0xc8]), 'ascii').error, /byte 2 \(0xc8\) has no character in US-ASCII/);
});
test('Shift_JIS, GBK, Big5, EUC-KR and the other multi-byte sets decode, and say plainly they are decode only', () => {
  assert.equal(decodeText('grGC8YLJgr+CzQ==', 'shift_jis').text, 'こんにちは', 'こんにちは in Shift_JIS (what Python gives)');
  assert.equal(decodeText(Buffer.from([0xc4, 0xe3, 0xba, 0xc3]).toString('base64'), 'gbk').text, '你好');
  assert.equal(decodeText(Buffer.from([0xa7, 0x41, 0xa6, 0x6e]).toString('base64'), 'big5').text, '你好');
  assert.equal(decodeText(Buffer.from([0xbe, 0xc8, 0xb3, 0xe7]).toString('base64'), 'euc-kr').text, '안녕');
  assert.equal(decodeText('/w==', 'shift_jis').ok, false);
  for (const cs of ['shift_jis', 'euc-jp', 'iso-2022-jp', 'gbk', 'gb18030', 'big5', 'euc-kr']) { assert.equal(canEncode(cs), false, cs); assert.match(textToBytes('x', cs).error, /is decode only here/); }
  assert.equal(canEncode('windows-1252'), true);
});
