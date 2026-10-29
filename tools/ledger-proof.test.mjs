// The verifiable growth ledger (tools/ledger-proof.mjs; the frontier's "absorb and connect every repo": a hash per line, a root hash, an Atom feed).
// Run: node --test tools/ledger-proof.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canon, chainOf, proofOf, verify, extendsProof, atomOf, FEED_LIMIT } from './ledger-proof.mjs';

const E = (n, extra = {}) => ({ at: '2026-10-' + String(10 + (n % 18)).padStart(2, '0') + 'T08:00:00Z', kind: 'grow', what: 'entry ' + n, ...extra });
const list = (n) => Array.from({ length: n }, (_, i) => E(i));

test('canonical JSON does not depend on key order, at any depth', () => {
  assert.equal(canon({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } }), canon({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }));
  assert.notEqual(canon({ a: 1 }), canon({ a: 2 }));
});

test('the chain changes from an edited, reordered or dropped line onward, and not before', () => {
  const base = chainOf(list(5)), edited = list(5); edited[2].what = 'changed';
  const e = chainOf(edited);
  assert.deepEqual([e[0] === base[0], e[1] === base[1], e[2] === base[2], e[4] === base[4]], [true, true, false, false]);
  const swapped = list(5); [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  assert.notEqual(chainOf(swapped)[4], base[4]);
  assert.notEqual(chainOf(list(5).filter((_, i) => i !== 1))[3], base[4]);
  assert.deepEqual(chainOf(null), []);
});

test('verify passes the ledger it was made from, in any key order, and names the first line that differs', () => {
  const l = list(4), p = proofOf(l);
  assert.equal(p.count, 4);
  assert.equal(verify(l, p).ok, true);
  assert.equal(verify(l.map((e) => JSON.parse(canon(e))), p).ok, true);
  const bad = list(4); bad[1].what = 'sneaky';
  const r = verify(bad, p);
  assert.equal(r.ok, false); assert.match(r.why, /line 2 /);
  assert.equal(verify(list(3), p).ok, false);
  assert.equal(verify(l, { ...p, root: 'x' }).ok, false);
  assert.equal(verify(l, null).ok, false);
  assert.equal(verify([], proofOf([])).ok, true);
});

test('extends: an appended ledger extends the older proof; an edit or a drop does not', () => {
  const old = proofOf(list(3)), more = proofOf(list(5));
  assert.deepEqual(extendsProof(old, more), { ok: true, why: '2 lines appended' });
  assert.equal(extendsProof(old, old).ok, true);
  assert.equal(extendsProof(more, old).ok, false);
  const edited = list(5); edited[0].what = 'rewritten';
  const r = extendsProof(old, proofOf(edited));
  assert.equal(r.ok, false); assert.match(r.why, /line 1 differs/);
  assert.equal(extendsProof(null, old).ok, false);
});

test('the Atom feed: well formed, newest first, escaped, limited, with each line hash; empty ledger still a valid feed', () => {
  const l = list(60); l[59] = E(59, { what: 'a < b & "c" \u0001', show: 'see it', try: 'ask it' });
  const x = atomOf(l, { now: new Date('2026-10-18T00:00:00Z') });
  assert.equal((x.match(/<entry>/g) || []).length, FEED_LIMIT);
  assert.equal((x.match(/<\/entry>/g) || []).length, FEED_LIMIT);
  assert.match(x, /^<\?xml/);
  assert.ok(x.includes('a &lt; b &amp; &quot;c&quot; '), 'escaped');
  assert.ok(!x.includes('\u0001'), 'control characters are dropped');
  assert.ok(x.indexOf('entry 59') < x.indexOf('entry 58'), 'newest first');
  assert.ok(!x.includes('entry 9<') && !x.includes('entry 9\n'), 'only the newest 50');
  assert.ok(x.includes('line hash: ' + chainOf(l)[59]));
  assert.ok(x.includes('Show: see it') && x.includes('Try: ask it'));
  const empty = atomOf([], { now: new Date('2026-10-18T00:00:00Z') });
  assert.match(empty, /<updated>2026-10-18T00:00:00\.000Z<\/updated>/);
  assert.ok(!empty.includes('<entry>') && empty.trim().endsWith('</feed>'));
  assert.ok(!atomOf([{ what: 'no time' }]).includes('<entry>'), 'an entry with no time is left out of the feed');
});
