// "Verse reports" (lib/news-report.js and /api/answer mode 'report', a FAKE model): the deterministic drafts, the validator that throws a polish away, the
// request check, and the route's cache, caps and fallbacks. The quake cluster is made up (tools/news-fixtures.mjs). Run: node --test tools/news-report.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/news-report.js';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost, REPORT_PER_HOUR } from '../void-live-deploy/functions/api/answer.js';

const quake = [{ src: 'bbc', title: 'Strong earthquake strikes off the coast of Chile', summary: 'A magnitude 7.1 quake hit at dawn, officials said 12 people were hurt.' }, { src: 'gdn', title: 'Strong earthquake hits Chile coast, tsunami watch issued', summary: '' }, { src: 'npr', title: 'Chile coast hit by strong earthquake; 14 hurt', summary: '' }];
const SRC = R.prepare({ kind: 'cluster', items: quake });

test('the cluster draft names every source, adds a summary with its source, and flags figures the sources give differently', () => {
  assert.match(SRC.draft, /^According to BBC News, The Guardian and NPR: Strong earthquake strikes off the coast of Chile\./); assert.match(SRC.draft, /BBC News adds: A magnitude 7\.1 quake/);
  assert.match(SRC.draft, /The sources differ on the figures: BBC News gives .*12.*NPR gives 14\./); assert.deepEqual(SRC.names, ['BBC News', 'The Guardian', 'NPR']);
  assert.equal(R.disagreement([{ src: 'bbc', title: 'Nine of 12 saved' }, { src: 'npr', title: '9 of 12 saved' }]), '', 'the same figures do not disagree');
  assert.equal(R.draftCluster([{ src: 'dw', title: 'Wind farm opens', summary: '' }]), 'According to DW: Wind farm opens.');
});
test('the brief is one sentence per section, the top section twice, never more than eight, each naming its sources', () => {
  const st = (sec, title, srcs) => ({ sec, srcs, title, summary: '' }), d = R.draftBrief([st('top', 'Quake hits Chile', ['bbc', 'npr']), st('top', 'Budget vote passes', ['gdn']), st('business', 'Markets rise', ['bbc']), st('tech', 'Chip plant opens', ['ars']), st('science', 'New octopus found', ['gdn']), st('sport', 'Final ends level', ['sky'])]);
  assert.equal(d.split(/(?<=\.)\s/).length, 6); assert.match(d, /According to BBC News and NPR \(top stories\): Quake hits Chile\./); assert.match(d, /According to Ars Technica \(technology\)/);
  assert.ok(R.draftBrief(Array.from({ length: 24 }, (_, i) => st('top', 'Story ' + i, ['bbc']))).split(/(?<=\.)\s/).length <= 8);
});
test('what changed on followed topics: only stories newer than this morning that mention the topic; 06:00 local is "this morning"', () => {
  const now = new Date(2026, 9, 26, 14, 0).getTime(), m = R.morning(now); assert.equal(new Date(m).getHours(), 6); assert.equal(new Date(m).getDate(), 26); assert.equal(new Date(R.morning(new Date(2026, 9, 26, 5, 0).getTime())).getDate(), 25);
  const stories = [{ title: 'Wind farm opens', t: m + 6e4, src: 'dw', also: [{ src: 'bbc' }] }, { title: 'Old wind story', t: m - 6e4, src: 'dw' }, { title: 'Rail strike', t: m + 6e4, src: 'bbc' }];
  const f = R.changedOn(stories, ['wind'], m); assert.equal(f.length, 1); assert.deepEqual(f[0].srcs, ['dw', 'bbc']); assert.match(R.draftChanges(f), /^On wind since this morning: according to DW and BBC News, Wind farm opens\./);
});
test('the validator throws a polish away for a new number, name, date, quote, person, reporter or drifting words, and keeps a faithful one', () => {
  const ok = 'According to BBC News, The Guardian and NPR, a strong earthquake struck off the coast of Chile and a tsunami watch was issued. BBC News says a magnitude 7.1 quake hit at dawn.';
  assert.equal(R.problem(ok, SRC.source, SRC.names), '');
  const bad = (t, re) => assert.match(R.problem(t, SRC.source, SRC.names), re, t);
  bad('According to BBC News, a strong earthquake struck off the coast of Chile and 30 people were hurt.', /number not in the sources: 30/);
  bad('According to BBC News, a strong earthquake struck off the coast of Peru.', /name not in the sources: Peru/);
  bad('According to BBC News, a strong earthquake struck off the coast of Chile on Tuesday.', /date word/);
  bad('According to BBC News, dozens were hurt when a strong earthquake struck off the coast of Chile.', /number word/);
  bad('According to BBC News, a "devastating" strong earthquake struck off the coast of Chile.', /quotation/);
  bad('We are following the strong earthquake that struck off the coast of Chile, says BBC News.', /person/);
  bad('According to BBC News, our reporter saw a strong earthquake strike off the coast of Chile.', /person|reporter/);
  bad('According to BBC News, an earthquake struck. Authorities responded swiftly with comprehensive emergency measures nationwide.', /name not in the sources|words that are not/);
  bad('A strong earthquake struck off the coast of Chile and a tsunami watch was issued, and it is thought the damage is limited.', /names no source|words that are not/);
  bad('Short.', /short/);
  assert.equal(R.settle(ok, SRC.draft, SRC.source, SRC.names).polished, true); const s = R.settle('According to BBC News, 99 people were hurt in Chile.', SRC.draft, SRC.source, SRC.names); assert.equal(s.polished, false); assert.equal(s.text, SRC.draft, 'the draft is shown instead');
  assert.equal(R.settle('', SRC.draft, SRC.source, SRC.names).text, SRC.draft); assert.match(R.settle('"x"', SRC.draft, SRC.source, SRC.names).why, /.+/);
});
test('the label always says Verse wrote it, from which sources, when; never a person', () => {
  const l = R.label(['BBC News', 'NPR'], new Date(2026, 9, 26, 9, 5).getTime(), true); assert.equal(l, 'Written by Verse from BBC News and NPR · 09:05'); assert.match(R.label(['DW'], Date.now(), false), /assembled straight from the headlines/);
});
test('the request is checked: a closed list of kinds and sources, sizes capped, nothing empty', () => {
  assert.equal(R.prepare({ kind: 'poem', items: quake }).error, 'empty'); assert.equal(R.prepare({ kind: 'cluster', items: [{ src: 'evil', title: 'x' }] }).error, 'empty'); assert.equal(R.prepare({}).error, 'empty');
  const big = R.prepare({ kind: 'cluster', items: [{ src: 'bbc', title: 'T'.repeat(5000), summary: 'S'.repeat(5000) }] }); assert.ok(big.items[0].title.length <= R.LIMITS.title && big.items[0].summary.length <= R.LIMITS.summary);
  assert.equal(R.prepare({ kind: 'cluster', items: Array.from({ length: 80 }, () => quake[0]) }).items.length, R.LIMITS.items);
  assert.ok(!/</.test(R.prepare({ kind: 'cluster', items: [{ src: 'bbc', title: '<script>x</script> hi' }] }).draft), 'markup out');
});

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql) }; };
const store = new Map(); globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
const post = (env, body, ip = '203.0.113.9') => onRequestPost({ env, request: new Request('https://x/api/answer', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), waitUntil() {} }).then((r) => r.json());
const GOOD = 'According to BBC News, The Guardian and NPR, a strong earthquake struck off the coast of Chile and a tsunami watch was issued.';
test('the route: a faithful polish is shown and cached for everyone; an unfaithful one falls back to the draft; models off and the caps fall back too', async () => {
  store.clear(); const calls = []; const DB = d1(), mk = (reply) => ({ SALT: 's', DB, AI: { run: async (m, i) => { calls.push(i); return { response: reply }; } } }); // secret-scan: ok (a made-up salt)
  const a = await post(mk(GOOD), { mode: 'report', kind: 'cluster', items: quake }); assert.equal(a.polished, true); assert.equal(a.text, GOOD); assert.match(calls[0].messages[0].content, /ONLY the facts/);
  const b = await post(mk(GOOD), { mode: 'report', kind: 'cluster', items: quake }, '203.0.113.77'); assert.equal(b.cached, true); assert.equal(calls.length, 1, 'the second reader costs nothing');
  store.clear(); const c = await post(mk('According to BBC News, 99 people died.'), { mode: 'report', kind: 'cluster', items: quake }); assert.equal(c.polished, false); assert.equal(c.text, c.draft); assert.match(c.why, /number not in the sources/);
  const off = await post({ SALT: 's' }, { mode: 'report', kind: 'cluster', items: quake }); assert.equal(off.polished, false); assert.equal(off.text, off.draft); // secret-scan: ok
  store.clear(); calls.length = 0; const env = mk(GOOD), other = { ...env }; // a second edge location: its own cache, the same D1
  for (let i = 0; i < REPORT_PER_HOUR + 3; i++) await post(i % 2 ? env : other, { mode: 'report', kind: 'cluster', items: [{ src: 'bbc', title: 'Story number ' + i + ' about wind', summary: '' }, { src: 'npr', title: 'Wind story ' + i, summary: '' }] }, '198.51.100.' + i);
  assert.equal(calls.length, REPORT_PER_HOUR - 2, 'two places were taken above, so the hour\'s generations stop at the cap, across two locations'); const capped = await post(env, { mode: 'report', kind: 'cluster', items: [{ src: 'dw', title: 'Another wind headline', summary: '' }] }, '198.51.100.200'); assert.equal(capped.polished, false); assert.match(capped.why, /busy/);
  assert.equal((await post(env, { mode: 'report', kind: 'cluster', items: [] })).note, 'empty');
  store.clear(); calls.length = 0; const noDb = await post({ SALT: 's', AI: env.AI }, { mode: 'report', kind: 'cluster', items: [{ src: 'dw', title: 'A headline with no database', summary: '' }] }); assert.equal(noDb.polished, false); assert.equal(calls.length, 0, 'no D1: fail closed to the draft'); // secret-scan: ok
});
