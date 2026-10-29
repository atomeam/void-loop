// The add-only ratchet for paid members' ideas (tools/add-only.mjs): each rule refuses what it should and lets an addition through.
// Run: node --test tools/add-only.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addOnly, parseStatus, entries } from './add-only.mjs';
import { isMemberTask } from './verse-loop.mjs';

const files = (base, head) => (side, p) => (side === 'base' ? base : head)[p] ?? null;

test('an addition passes: a new file, a longer file, a registry with one more entry, a score that rose', () => {
  const base = { 'a.js': 'x\n', 'void-live-deploy/void.asks.json': '[{"id":"a"}]', 's.json': '{"page":{"score":3}}' };
  const head = { 'a.js': 'x\ny\n', 'void-live-deploy/void.asks.json': '[{"id":"a"},{"id":"b"}]', 's.json': '{"page":{"score":4}}', 'new.js': 'z' };
  const ch = parseStatus('A\tnew.js\nM\ta.js\nM\tvoid-live-deploy/void.asks.json\nM\ts.json');
  assert.deepEqual(addOnly(ch, files(base, head)), []);
});

test('each way of taking something away is refused', () => {
  assert.match(addOnly(parseStatus('D\tvoid-live-deploy/fanfic/index.html'), files({}, {}))[0], /^deletes /);
  assert.match(addOnly(parseStatus('R100\told.js\tnew.js'), files({}, {}))[0], /^renames /);
  assert.match(addOnly(parseStatus('M\ta.js'), files({ 'a.js': '1\n2\n3\n' }, { 'a.js': '1\n' }))[0], /^shortens /);
  const t = addOnly(parseStatus('M\ttools/x.test.mjs'), files({ 'tools/x.test.mjs': "test('a', () => {\n  assert.equal(1, 1);\n});\n" }, { 'tools/x.test.mjs': "test('a', () => {\n  // gone\n});\n" }));
  assert.ok(t.some((w) => /takes 1 test line/.test(w)), t.join('; '));
  const r = addOnly(parseStatus('M\tvoid-live-deploy/void.asks.json'), files({ 'void-live-deploy/void.asks.json': '[{"id":"a"},{"id":"b"}]' }, { 'void-live-deploy/void.asks.json': '[{"id":"a"},{"id":"c"}]' }));
  assert.ok(r.some((w) => /removes \d+ entr(?:y|ies) from void-live-deploy\/void\.asks\.json/.test(w)), r.join('; '));
  const s = addOnly(parseStatus('M\tp.json'), files({ 'p.json': '{"x":{"completeness":9}}' }, { 'p.json': '{"x":{"completeness":7}}' }));
  assert.ok(s.some((w) => /drops p\.json\.x\.completeness from 9 to 7/.test(w)), s.join('; '));
});

test('entries name array items by their id, so a reorder is not a removal', () => {
  assert.deepEqual([...entries([{ id: 'b' }, { id: 'a' }])].sort(), [...entries([{ id: 'a' }, { id: 'b' }])].sort());
});

test('the lap knows a member job by the words verse-job gives it', () => {
  assert.equal(isMemberTask({ kind: 'next', n: null, text: 'Queue job abc (member: m1x): A paid member asked Verse to add this' }), true);
  assert.equal(isMemberTask({ kind: 'next', n: null, text: 'Queue job abc (feature: x): build it' }), false);
  assert.equal(isMemberTask({ kind: 'fix', check: 'x' }), false);
});
