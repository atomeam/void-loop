// hashes (lib/hash.js, skills/util.js): "md5 of hello", "sha256 hash generator". 2026-10-30: both fell to an article that answered nothing.
// The digests are checked against the published test vectors (RFC 1321 for MD5, FIPS 180-4 for SHA) and against coreutils for UTF-8 text.
//   node --test tools/hash.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { utilOf } from '../void-live-deploy/skills/util.js';
import { ALGOS, algoOf, digestHex, md5, toHex } from '../void-live-deploy/lib/hash.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the digests match the published test vectors and coreutils', async () => {
  // RFC 1321 section A.5
  for (const [s, h] of [['', 'd41d8cd98f00b204e9800998ecf8427e'], ['a', '0cc175b9c0f1b6a831c399e269772661'], ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'], ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a']]) {
    assert.equal(toHex(md5(new TextEncoder().encode(s))), h, 'md5 ' + s); assert.equal(await digestHex('md5', s), h, 'digestHex md5 ' + s);
  }
  // FIPS 180-4 examples for "abc"
  assert.equal(await digestHex('sha1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(await digestHex('sha256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal((await digestHex('sha384', 'abc')).slice(0, 16), 'cb00753f45a35e8b');
  assert.equal((await digestHex('sha512', 'abc')).slice(0, 16), 'ddaf35a193617aba');
  // text is its UTF-8 bytes: echo -n 'café' | md5sum
  assert.equal(await digestHex('md5', 'café'), '07117fe4a1ebd544965dc19573183da2');
  assert.equal(await digestHex('nope', 'abc').catch(() => 'refused'), 'refused');
  assert.deepEqual(ALGOS.map((a) => a.id), ['md5', 'sha1', 'sha256', 'sha384', 'sha512']);
  for (const [w, id] of [['MD5', 'md5'], ['sha-256', 'sha256'], ['SHA_512', 'sha512'], ['sha3', null]]) assert.equal(algoOf(w), id, w);
});

test('the asks: a hash of a text, the tool by its name, and what is not a hash', () => {
  for (const [a, want] of [['md5 of hello', { kind: 'hash', algo: 'md5', s: 'hello' }], ['sha256 hash of Hello World', { kind: 'hash', algo: 'sha256', s: 'Hello World' }],
    ['sha1 hello', { kind: 'hash', algo: 'sha1', s: 'hello' }], ['hash of hello world', { kind: 'hash', algo: 'sha256', s: 'hello world' }], ['hash "abc"', { kind: 'hash', algo: 'sha256', s: 'abc' }],
    ['what is the md5 of abc?', { kind: 'hash', algo: 'md5', s: 'abc' }], ['checksum of abc', { kind: 'hash', algo: 'sha256', s: 'abc' }], ['sha512 "Hi"', { kind: 'hash', algo: 'sha512', s: 'Hi' }],
    ['sha256 hash generator', { kind: 'hashmaker', algo: 'sha256' }], ['md5 generator', { kind: 'hashmaker', algo: 'md5' }], ['online hash calculator', { kind: 'hashmaker', algo: 'sha256' }],
    ['sha-256 online', { kind: 'hashmaker', algo: 'sha256' }], ['hash text', { kind: 'hashmaker', algo: 'sha256' }]]) assert.deepEqual(utilOf(a), want, a);
  for (const a of ['hash browns', 'hash brown casserole', 'hash table', 'hash rate', 'md5 vs sha256', 'what is md5', 'md5 decrypt', 'sha256 algorithm', 'corned beef hash']) assert.equal(utilOf(a), null, a);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
});

test('run: the asked hash is first and big, the others listed, the text escaped', async () => {
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dataset: {} };
  const said = await skill.run('md5 of <b>hi</b>', { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true });
  assert.notEqual(said, 'none');
  const h = el.innerHTML;
  assert.ok(h.startsWith('<h2>MD5</h2>') && h.includes('&lt;b&gt;hi&lt;/b&gt;') && !h.includes('<b>hi'), h);
  assert.ok(h.includes(await digestHex('md5', '<b>hi</b>')) && h.includes(await digestHex('sha512', '<b>hi</b>')), 'every digest is of the whole text');
  assert.ok(h.indexOf('SHA-1') > h.indexOf(await digestHex('md5', '<b>hi</b>')), 'the asked hash comes first');
  assert.ok(h.includes('never sent anywhere') && h.includes('broken for security'), h);
});

test('run: the hash generator fills every hash as you type, and an older answer never overwrites a newer one', async () => {
  const handlers = {}, codes = ALGOS.map((a) => ({ dataset: { algo: a.id }, textContent: '' }));
  const box = { value: '', addEventListener: (ev, f) => { handlers[ev] = f; } };
  const el = { innerHTML: '', querySelector: (s) => (s === '.util-in' ? box : null), querySelectorAll: (s) => (s === 'code[data-algo]' ? codes : []), addEventListener() {}, dataset: {} };
  await skill.run('sha256 hash generator', { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true });
  assert.ok(el.innerHTML.startsWith('<h2>Hash generator</h2>') && el.innerHTML.includes('<textarea'), el.innerHTML);
  assert.ok(el.innerHTML.indexOf('data-algo="sha256"') < el.innerHTML.indexOf('data-algo="md5"'), 'the named hash leads');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(codes.find((c) => c.dataset.algo === 'md5').textContent, 'd41d8cd98f00b204e9800998ecf8427e', 'the empty text is painted at once');
  box.value = 'a'; const first = handlers.input(); box.value = 'abc'; const second = handlers.input();
  await Promise.all([first, second]);
  assert.equal(codes.find((c) => c.dataset.algo === 'md5').textContent, '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(codes.find((c) => c.dataset.algo === 'sha256').textContent, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
