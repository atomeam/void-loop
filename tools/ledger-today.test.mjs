// The growth ledger's "today" view (void-live-deploy/lib/ledger-today.js): the browser recomputes the deploy's hash chain
// (tools/ledger-proof.mjs) and shows the day's lines with their hashes. Run: node --test tools/ledger-today.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canon as toolCanon, chainOf as toolChain, proofOf } from './ledger-proof.mjs';
import { canon, chainOf, todayCheck, todayHtml, tryLinkOf, TODAY_LIMIT, PROOF_URL } from '../void-live-deploy/lib/ledger-today.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = (day, n, extra = {}) => ({ at: '2026-10-' + day + 'T0' + (n % 10) + ':00:00Z', kind: 'grow', what: 'entry ' + day + '-' + n, by: 'verse', ...extra });
const NOW = new Date('2026-10-29T12:00:00Z');

test('the browser\'s chain is the deploy\'s chain, line for line, on the real ledger', async () => {
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  assert.ok(ledger.length > 100);
  const sample = { b: [{ y: 1, x: '<&>' }], a: { d: null, c: 'é' } };
  assert.equal(canon(sample), toolCanon(sample));
  assert.deepEqual(await chainOf(ledger), toolChain(ledger));
  assert.deepEqual(await chainOf(null), []);
});

test('a ledger that matches its proof passes; a changed line, a count off or no proof is named', async () => {
  const list = [E(27, 1), E(28, 2), E(29, 3), E(29, 4)], proof = proofOf(list);
  const r = await todayCheck(list, proof, NOW);
  assert.equal(r.ok, true); assert.match(r.why, /all 4 lines match/); assert.equal(r.root, proof.root);
  const edited = list.map((e) => ({ ...e })); edited[1].what = 'quietly changed';
  const bad = await todayCheck(edited, proof, NOW);
  assert.equal(bad.ok, false); assert.match(bad.why, /^line 2 \(2026-10-28\) does not match/);
  assert.match((await todayCheck(list.slice(0, 3), proof, NOW)).why, /has 3 lines and the proof counts 4/);
  assert.equal((await todayCheck(list, null, NOW)).ok, false);
  assert.equal((await todayCheck(list, { ...proof, root: 'x' }, NOW)).ok, false);
});

test('today\'s lines come newest first with their own hashes; with none today, the newest day, said so', async () => {
  const list = [E(27, 1), E(28, 2), E(29, 3), E(29, 4)], hashes = toolChain(list);
  const r = await todayCheck(list, proofOf(list), NOW);
  assert.equal(r.day, '2026-10-29'); assert.equal(r.today, true);
  assert.deepEqual(r.rows.map((x) => [x.n, x.hash]), [[4, hashes[3]], [3, hashes[2]]]);
  const old = await todayCheck(list.slice(0, 2), proofOf(list.slice(0, 2)), NOW);
  assert.equal(old.today, false); assert.equal(old.day, '2026-10-28'); assert.deepEqual(old.rows.map((x) => x.n), [2]);
  assert.match(todayHtml(esc, old), /Nothing yet today \(UTC\)\. The newest day, 2026-10-28: 1 line\./);
  const many = Array.from({ length: TODAY_LIMIT + 3 }, (_, i) => E(29, i));
  const m = await todayCheck(many, proofOf(many), NOW);
  assert.equal(m.rows.length, TODAY_LIMIT); assert.equal(m.more, 3);
  assert.match(todayHtml(esc, m), new RegExp('Today \\(UTC, 2026-10-29\\): ' + TODAY_LIMIT + ' of ' + (TODAY_LIMIT + 3) + ' lines'));
});

test('the block escapes every entry, shows short hashes with the full one on hover, and says when the check fails', async () => {
  const list = [E(29, 1, { what: '<img src=x onerror=alert(1)> grew', kind: '"><b>' })];
  const r = await todayCheck(list, proofOf(list), NOW), html = todayHtml(esc, r, { label: { grow: 'new' } });
  assert.ok(!/<img|<b>/.test(html), html);
  assert.match(html, new RegExp('<code style="color:#8a8a92" title="line 1: ' + r.rows[0].hash + '">' + r.rows[0].hash.slice(0, 12) + '</code>'));
  assert.match(html, /data-ledger-ok="1"/); assert.match(html, /the 1 line matches <a href="\/growth\.proof\.json"/);
  const broken = todayHtml(esc, await todayCheck([{ ...list[0], what: 'changed' }], proofOf(list), NOW));
  assert.match(broken, /data-ledger-ok="0"/); assert.match(broken, /line 1 \(2026-10-29\) does not match/);
  assert.equal(todayHtml(esc, null), ''); assert.equal(todayHtml(esc, await todayCheck([], proofOf([]), NOW)), '');
});

test('a line with a try phrase links it to the stage, so the claim can be run (glassbox: proof of work, not words); the head counts them', async () => {
  const list = [E(29, 1, { try: 'fantasy name generator' }), E(29, 2), E(29, 3, { try: '<b>x</b> & "y"' }), E(28, 4, { try: 'not today' })];
  const r = await todayCheck(list, proofOf(list), NOW);
  assert.equal(r.tryable, 2, 'only the day\'s lines count');
  assert.deepEqual(r.rows.map((x) => x.tryIt), ['/?q=%3Cb%3Ex%3C%2Fb%3E%20%26%20%22y%22', '', '/?q=fantasy%20name%20generator']);
  const html = todayHtml(esc, r);
  assert.match(html, /<a href="\/\?q=fantasy%20name%20generator" data-try-line="1">try it<\/a>/);
  assert.equal((html.match(/data-try-line=/g) || []).length, 2, 'no link on a line without a phrase');
  assert.ok(!/<b>x/.test(html), html);
  assert.match(html, /data-tryable="2"/); assert.match(html, /2 of 3 lines have a phrase you can try on the stage yourself\./);
  assert.match(todayHtml(esc, await todayCheck([E(29, 1, { try: 'coin toss' })], proofOf([E(29, 1, { try: 'coin toss' })]), NOW)), /1 of 1 line has a phrase/);
  assert.equal(tryLinkOf({ try: '   ' }), ''); assert.equal(tryLinkOf({ try: 'x'.repeat(301) }), ''); assert.equal(tryLinkOf({ try: 7 }), ''); assert.equal(tryLinkOf(null), '');
  // the real ledger: every day's tryable count is the lines that carry a phrase
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8')), last = ledger[ledger.length - 1];
  const real = await todayCheck(ledger, proofOf(ledger), new Date(last.at));
  assert.equal(real.tryable, ledger.filter((e) => e.at.slice(0, 10) === real.day && tryLinkOf(e)).length);
});

test('the growth card reads the proof and fills its today slot', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/growth.js', import.meta.url), 'utf8');
  assert.equal(PROOF_URL, '/growth.proof.json');
  assert.match(src, /import \{ PROOF_URL, todayCheck, todayHtml \} from '\.\.\/lib\/ledger-today\.js'/);
  assert.match(src, /growthHead\(esc, list\) \+ '<div data-today><\/div>'/);
  assert.match(src, /fetch\(PROOF_URL, \{ cache: 'no-cache' \}\)[^\n]*todayCheck\(list, proof\)/);
});
