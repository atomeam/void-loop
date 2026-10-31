import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { growthOf, ordered, summary, growthHtml, loadLedger, suite, testCandidates, unstableFamilies, heatHtml, stabilitySeries, sparkSvg, stabilityHtml, DEGRADE } from '../void-live-deploy/skills/growth.js';
import { entryProblem, ledgerProblems, appendTo, LEDGER } from './grow.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('"growth" and its plain phrasings summon the ledger; growth as a topic stays a topic', () => {
  for (const t of ['growth', 'Growth', 'growth?', 'void growth', "Verse's growth", 'show growth', 'show me the growth ledger', 'summon growth', 'how have you grown', 'how has void grown', "what's new with void", 'your growth'])
    assert.ok(growthOf(t), t);
  for (const t of ['economic growth', 'growth rate of india', 'growth mindset', 'hair growth', 'what is growth', 'population growth', 'how do plants grow', 'growth hormone', 'grow a tree'])
    assert.equal(growthOf(t), false, t);
});

test('newest first, filtered by kind, with counts and the oldest day', () => {
  const list = [{ at: '2026-10-01T10:00:00Z', by: 'a', kind: 'grow', what: 'one' }, { at: '2026-10-03T10:00:00Z', by: 'b', kind: 'fix', what: 'two' },
    { at: 'bad', by: 'c', kind: 'grow', what: 'undated' }, { at: '2026-10-02T10:00:00Z', by: 'c', kind: 'grow', what: 'three' }, null, { kind: 'grow' }];
  assert.deepEqual(ordered(list).map((e) => e.what), ['two', 'three', 'one', 'undated']);
  assert.deepEqual(ordered(list, 'fix').map((e) => e.what), ['two']);
  assert.deepEqual(summary(list), { total: 4, since: '', byKind: { fix: 1, grow: 3 } });
  assert.equal(summary(list.slice(0, 2)).since, '2026-10-01');
  assert.deepEqual(ordered('nope'), []);
});

test('the page escapes everything from the ledger, links only https refs, and pages 40 at a time', () => {
  const list = Array.from({ length: 45 }, (_, i) => ({ at: '2026-10-0' + (1 + (i % 9)) + 'T10:00:00Z', by: 'x', kind: 'build', what: 'item ' + i }));
  list.push({ at: '2026-10-09T11:00:00Z', by: '<i>', kind: 'grow', what: '<script>alert(1)</script>', ref: 'javascript:alert(1)' });
  list.push({ at: '2026-10-09T12:00:00Z', by: 'y', kind: 'fix', what: 'linked', ref: 'https://github.com/atomeam/void-loop/pull/1' });
  const h = growthHtml(esc, list, '', 40);
  assert.ok(!h.includes('<script>') && !h.includes('<i>') && !h.includes('javascript:'));
  assert.ok(h.includes('href="https://github.com/atomeam/void-loop/pull/1"'));
  assert.ok(h.includes('47 changes') && h.includes('show 7 more') && h.includes('data-kind="grow"'));
  assert.ok(!growthHtml(esc, list, '', 80).includes('data-more'));
  assert.ok(growthHtml(esc, list, 'fix', 40).includes('linked') && !growthHtml(esc, list, 'fix', 40).includes('item 0'));
  assert.ok(growthHtml(esc, [], '', 40).includes('Nothing here yet'));
  const long = growthHtml(esc, [{ at: '2026-10-09T12:00:00Z', by: 'y', kind: 'fix', what: 'word '.repeat(100) }], '', 40);
  assert.ok(long.includes('<details>'));
});

test('loadLedger reads the list and refuses anything else', async () => {
  const ok = (body) => async () => ({ ok: true, json: async () => body });
  assert.equal((await loadLedger(ok([{ a: 1 }]))).length, 1);
  await assert.rejects(loadLedger(ok({})), /not a list/);
  await assert.rejects(loadLedger(async () => ({ ok: false, status: 404 })), /404/);
});

test('grow.mjs: entries are checked, appended one per line, and the real ledger is valid', () => {
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x' }), null);
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', ref: 'https://a-to-mind.com' }), null);
  assert.match(entryProblem({ at: '2026-10-09', by: 'claude', kind: 'grow', what: 'x' }), /"at"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'Claude Bot', kind: 'grow', what: 'x' }), /"by"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'shipped', what: 'x' }), /"kind"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: ' ' }), /"what"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', ref: 'http://x' }), /"ref"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', extra: 1 }), /unknown field/);
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', show: 'sticky notes look like real paper', try: 'sticky note buy milk' }), null);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', show: 'x'.repeat(71) }), /"show"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', try: 'two\nasks' }), /"try"/);
  const e = { at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'fix', what: 'y' };
  assert.equal(appendTo('[\n]\n', e), '[\n  {"at": "2026-10-09T15:00:00Z", "by": "claude", "kind": "fix", "what": "y"}\n]\n');
  assert.equal(JSON.parse(appendTo('[\n  {"a": 1}\n]\n', e)).length, 2);
  const real = JSON.parse(readFileSync(LEDGER, 'utf8'));
  assert.deepEqual(ledgerProblems(real), []);
  assert.ok(real.length >= 160);
  assert.ok(suite().ok);
});

test('velocity (asked by Verse, 2026-10-12): new or better changes this week against the week before, and whether that is speeding up, steady, slowing or stalled', async () => {
  const { velocity, growthHead } = await import('../void-live-deploy/skills/growth.js');
  const now = Date.parse('2026-10-12T12:00:00Z'), d = (n, kind = 'grow') => ({ at: new Date(now - n * 864e5).toISOString(), kind, what: 'x' });
  assert.deepEqual(velocity([d(1), d(2), d(3, 'build'), d(9)], now), { week: 3, before: 1, trend: 'speeding up' });
  assert.equal(velocity([d(1), d(8), d(9), d(10)], now).trend, 'slowing');
  assert.equal(velocity([d(1), d(2), d(8), d(9)], now).trend, 'steady');
  assert.equal(velocity([d(8), d(9)], now).trend, 'stalled');
  assert.equal(velocity([d(1, 'fix'), d(2, 'idea'), d(8)], now).week, 0, 'fixes and ideas are not new skills');
  assert.match(growthHead(esc, [d(1), d(9)], now), /This week 1 new or better, the week before 1: steady/);
});

test('the Site Test card suggests what to test next: the lowest-rated skills, failing first, each with its own ask (asked by Verse, 2026-10-17)', () => {
  const fam = { families: [
    { name: 'Time', count: { proven: 1 }, skills: [{ name: 'timer', tier: 'proven', failing: ['set a timer'] }, { name: 'clock', tier: 'proven' }] },
    { name: 'Words and the world', count: { proven: 0 }, skills: [{ name: 'define', tier: 'experiment' }, { name: 'poster', tier: 'tested' }, { name: 'quiet', tier: 'experiment' }] },
  ] };
  const guide = { pages: [{ kind: 'skill', name: 'timer', examples: ['timer', 'set a timer for 5 minutes'] }, { kind: 'skill', name: 'define', examples: ['define hubris'] }, { kind: 'skill', name: 'poster', examples: ['make a poster'] }, { kind: 'chapter', name: 'quiet' }] };
  const c = testCandidates(fam, guide);
  assert.deepEqual(c.map((x) => x.name), ['timer', 'define', 'poster'], 'failing first, then experiment before tested; a skill with no ask in the book is left out (quiet), proven and passing ones never appear (clock)');
  assert.equal(c[0].ask, 'set a timer for 5 minutes'); assert.equal(c[0].failing, 1); assert.equal(c[1].family, 'Words and the world');
  assert.equal(testCandidates(fam, guide, 1).length, 1);
  assert.deepEqual(testCandidates(null, null), []); assert.deepEqual(testCandidates(fam, null), []);
});

test('the Site Test heat map ranks families least stable first: failing skills, then unsure ones (tested, experiment or weathered) (asked by Verse)', () => {
  const today = Date.parse('2026-10-17T12:00:00Z');
  const fam = { families: [
    { name: 'Body and mind', skills: [{ name: 'heart', tier: 'proven', last_tested: '2026-10-17' }, { name: 'sleep', tier: 'proven', last_tested: '2026-10-16' }] },
    { name: 'Time', skills: [{ name: 'timer', tier: 'proven', failing: ['set a timer'], last_tested: '2026-10-17' }, { name: 'clock', tier: 'proven', last_tested: '2026-10-17' }] },
    { name: 'Words and the world', skills: [{ name: 'define', tier: 'experiment', last_tested: '2026-10-17' }, { name: 'poster', tier: 'proven', last_tested: '2026-09-01' }, { name: 'book', tier: 'proven', last_tested: '2026-10-17' }] },
    { name: 'Empty', skills: [] },
  ] };
  const r = unstableFamilies(fam, today);
  assert.deepEqual(r.map((x) => x.name), ['Time', 'Words and the world', 'Body and mind'], 'failing first, then by heat; a family with no skills is left out');
  assert.deepEqual([r[0].failing, r[0].unsure, r[0].n], [1, 0, 2]); assert.deepEqual([r[1].failing, r[1].unsure], [0, 2], 'an experiment and a skill untested since September are unsure');
  assert.equal(r[2].heat, 0); assert.ok(r[0].heat > r[1].heat);
  const esc = (s) => String(s).replace(/</g, '&lt;'), html = heatHtml(esc, [{ name: '<b>x', n: 2, failing: 1, unsure: 0, heat: 1 }]);
  assert.match(html, /data-family="&lt;b>x"/); assert.match(html, /1 failing · 0 of 2 unsure/); assert.equal(heatHtml(esc, []), '');
});

test('the stability trend: a point a day per family from void.better.json, today from families.json lowered by recent failures on main (asked by Verse)', () => {
  const now = Date.parse('2026-10-17T20:00:00Z');
  const fam = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'timer', tier: 'proven' }, { name: 'clock', tier: 'proven' }] }, { id: 'words', name: 'Words <b>', skills: [{ name: 'define', tier: 'proven' }] }] };
  const rows = [{ at: '2026-10-15T09:00:00Z', families: [{ id: 'time', health: 70 }] }, { at: '2026-10-16T09:00:00Z', families: [{ id: 'time', health: 60 }, { id: 'words', health: 90 }] }, { at: '2026-10-16T18:00:00Z', families: [{ id: 'time', health: 80 }] }, { at: '2026-10-17T09:00:00Z', families: [{ id: 'time', health: 1 }] }];
  const a = { recent: [{ at: '2026-10-17T19:00:00Z', checks: [{ family: 'time' }, { family: 'time' }] }, { at: '2026-10-10T00:00:00Z', checks: [{ family: 'words' }] }] };
  const s = stabilitySeries(rows, fam, a, now), time = s.find((x) => x.id === 'time'), words = s.find((x) => x.id === 'words');
  assert.deepEqual(time.points.map((p) => p.day + ':' + p.health), ['2026-10-15:70', '2026-10-16:80', '2026-10-17:' + (100 - 2 * DEGRADE)], 'a day keeps its last row; today comes from families.json, two recent failures off');
  assert.equal(time.drop, 2 * DEGRADE); assert.equal(words.drop, 0, 'a failure a week old costs nothing'); assert.equal(words.points.length, 2);
  assert.equal(stabilitySeries(rows, fam, { recent: [{ at: '2026-10-17T19:00:00Z', checks: Array(20).fill({ family: 'time' }) }] }, now).find((x) => x.id === 'time').drop, 30, 'capped');
  assert.match(sparkSvg(time.points), /<polyline points="3\.0,[\d.]+ 36\.0,[\d.]+ 69\.0,[\d.]+"/); assert.equal(sparkSvg([]), '');
  const html = stabilityHtml((x) => String(x).replace(/</g, '&lt;'), s); assert.match(html, /Words &lt;b>/); assert.match(html, /−10 from 2 recent failures/); assert.match(html, /\(\+10\)/);
});

test('"what just shipped?" is about Verse (it came back as a Wikipedia line about the Just Cause games, 2026-10-19), and real shipping questions are left alone', () => {
  for (const q of ['what just shipped?', 'what shipped today', 'what did you just ship', 'what have you just built', 'what has shipped recently', 'What got built', 'what got shipped today']) assert.equal(growthOf(q), true, q);
  for (const q of ['what shipped to my order', 'where did my package ship', 'what have you built', 'when does the iphone ship']) assert.equal(growthOf(q), false, q);
});

test('the tester card names each run\'s failed asks as asks to tap, not only "64 of 74" (owner, 2026-10-19)', async () => {
  const { testerRows } = await import('../void-live-deploy/skills/growth.js');
  const rows = testerRows({ runs: [{ at: '2026-10-19T04:58:40Z', passed: 1, of: 2, kind: 'grow', note: 'n', failed: [{ ask: 'what are you?', why: 'missing text /Verse/' }] }, { at: '2026-10-18T04:58:40Z', passed: 2, of: 2, kind: 'grow', note: 'n' }] });
  assert.deepEqual(rows[0].failed, [{ ask: 'what are you?', why: 'missing text /Verse/' }]);
  assert.deepEqual(rows[1].failed, []);
});

test('growth entries (owner, 2026-10-28): a branch writes its own file, the fold adds each once in time order and removes the files', async () => {
  const { mkdtempSync, writeFileSync: w, readFileSync: r, readdirSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { entryName, entryText, foldInto, writesEntryFile } = await import('./grow.mjs'), { fold } = await import('./growth-fold.mjs');
  assert.equal(writesEntryFile({ branch: 'box/x', env: {} }), true);
  assert.equal(writesEntryFile({ branch: 'main', env: {} }), false);
  assert.equal(writesEntryFile({ branch: 'HEAD', env: {} }), false);
  assert.equal(writesEntryFile({ branch: 'box/x', env: { GROWTH_LEDGER: '1' } }), false);
  assert.equal(writesEntryFile({ branch: 'box/x', args: ['--ledger'], env: {} }), false);
  assert.equal(writesEntryFile({ branch: 'main', args: ['--entry'], env: {} }), true);
  const a = { at: '2026-10-28T20:00:00Z', by: 'box', kind: 'build', what: 'a' }, b = { at: '2026-10-28T19:00:00Z', by: 'grok', kind: 'fix', what: 'b' };
  assert.match(entryName(a), /^20261028T200000Z-box-[0-9a-f]{8}\.json$/);
  assert.notEqual(entryName(a), entryName({ ...a, what: 'other' }));
  const base = '[\n  {"at": "2026-10-01T00:00:00Z", "by": "x", "kind": "grow", "what": "old"}\n]\n';
  const once = foldInto(base, [a, b]);
  assert.deepEqual(JSON.parse(once).map((e) => e.what), ['old', 'b', 'a']);
  assert.equal(foldInto(once, [a, b]), once);
  const d = mkdtempSync(join(tmpdir(), 'gfold-')), dir = join(d, 'entries'), led = join(d, 'ledger.json');
  mkdirSync(dir); w(led, base); w(join(dir, entryName(a)), entryText(a)); w(join(dir, entryName(b)), entryText(b)); w(join(dir, 'README.md'), 'x');
  assert.deepEqual(fold({ ledger: led, dir, dry: true }), { folded: 2, files: 2 });
  assert.equal(r(led, 'utf8'), base);
  assert.deepEqual(fold({ ledger: led, dir }), { folded: 2, files: 2 });
  assert.equal(JSON.parse(r(led, 'utf8')).length, 3);
  assert.deepEqual(readdirSync(dir), ['README.md']);
  w(join(dir, 'bad.json'), '{"what": 1}');
  assert.throws(() => fold({ ledger: led, dir }), /bad\.json/);
});

// owner, 2026-10-30 ("How Verse has grown" card): each "Verse hardened itself" entry showed twice (cut short, then in full), six of them
// in a row read the same, and "Last spurt" said "Verse hardened itself" six times
import { entryText, hardenedHead, ownerHtml } from '../void-live-deploy/skills/growth.js';
const hard = (i, at) => ({ at, by: 'grow-self', kind: 'grow', what: `Verse hardened itself: 'ask ${i}', 'other ${i}' for skill-${i}, tool${i}.  Why these: tab (no benchmark ask, evidence tier: checked, ${i} failed runs name it). New phrases: “ask ${i}” now opens skill-${i}; “other ${i}” now opens tool${i}. Did not route: heads or tails ${i}.` });
const six = [0, 1, 2, 3, 4, 5].map((i) => hard(i, '2026-10-30T0' + i + ':00:00Z'));
const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"');

test('a run of hardening entries on one day is one block with its count, and each entry shows once', () => {
  const h = growthHtml(esc, six, '', 40);
  assert.equal((h.match(/data-hardened-group="6"/g) || []).length, 1, 'one block for the six');
  assert.equal((plain(h).match(/Verse hardened itself/g) || []).length, 1, 'the words "Verse hardened itself" once, with the count');
  assert.match(plain(h), /Verse hardened itself 6 times:/);
  for (let i = 0; i < 6; i++) {
    assert.equal(plain(h).split('Better at skill ' + i + ' and tool' + i).length - 1, 1, 'entry ' + i + ' once');
    assert.equal(plain(h).split('heads or tails ' + i).length - 1, 1, 'its details once');
  }
  assert.doesNotMatch(h, /…/, 'no cut copy with an ellipsis');
});

test('one hardening entry alone is not grouped, and a long plain entry shows each word once', () => {
  const one = growthHtml(esc, [hard(7, '2026-10-30T07:00:00Z'), { at: '2026-10-30T08:00:00Z', by: 'y', kind: 'fix', what: 'Fixed the clock. ' + Array.from({ length: 40 }, (_, i) => 'Sentence number ' + i + ' says one thing.').join(' ') }], '', 40);
  assert.doesNotMatch(one, /data-hardened-group/);
  assert.match(plain(one), /Better at skill 7 and tool7: “ask 7” now opens skill-7; “other 7” now opens tool7\./);
  for (const i of [0, 12, 39]) assert.equal(plain(one).split('Sentence number ' + i + ' says').length - 1, 1, 'sentence ' + i + ' once');
  assert.match(entryText(esc, 'word '.repeat(100)), /<details>/);
});

test('the older benchmark form keeps its line, and "Last spurt" names what got better, each name once', () => {
  assert.equal(hardenedHead('Verse hardened itself: 9 benchmark ask(s) for calendar-file, clock, web4'), 'Better at calendar file, clock and web4: 9 more ways of asking answered right');
  const twice = [...six, { ...hard(0, '2026-10-30T07:00:00Z') }];
  const o = plain(ownerHtml(esc, { families: [] }, twice, {}));
  assert.doesNotMatch(o, /Verse hardened itself/);
  assert.match(o, /Last spurt: 7 new/);
  assert.match(o, /Better at skill 0 and tool0 \(2 times\)/);
});

test('the real ledger: no hardening entry shows its words twice on the card', () => {
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const h = plain(growthHtml(esc, ledger, '', 200));
  for (const e of ordered(ledger).slice(0, 200).filter((x) => /^Verse hardened itself/.test(x.what))) {
    const why = /Why these: (.{20,60}?)[;.]/.exec(e.what);
    if (why) assert.ok(h.split(why[1]).length - 1 <= ordered(ledger).slice(0, 200).filter((x) => x.what.includes(why[1])).length, e.at);
  }
});
