// node --test tools/unbidden.test.mjs: Verse speaks first on /brain/ (lib/unbidden.js, functions/api/unbidden.js). Its lines come only from
// real facts, name them, use no number that is not in them, and are written at most once per gap for everyone.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as U from '../void-live-deploy/lib/unbidden.js';

const NOW = Date.parse('2026-11-06T20:30:00Z');
const SRC = {
  commits: [{ sha: 'abcdef1234567', html_url: 'https://github.com/atomeam/void-loop/commit/abcdef1234567', commit: { message: 'Films: give each beat its own voice line\n\nbody', committer: { date: '2026-11-06T20:20:00Z' } } }],
  ledger: [{ at: '2026-11-06T08:00:00Z', kind: 'build', by: 'claude', what: 'old thing' }, { at: '2026-11-06T20:06:56Z', kind: 'finding', by: 'baggage-live', what: 'baggage checked: 3 of 10 figures found', ref: 'https://github.com/atomeam/void-loop/blob/main/findings/x.json' }],
  will: { wants: [{ i_want: 'I want a faster weather card', because: 'people ask for it' }] },
  crew: { ok: true, open: 7, met: 2, crew: [{ name: 'Scout', here: true, did: 'filed a want', didAt: Date.parse('2026-11-06T20:00:00Z') }], wants: [{ key: 'exam-translate', state: 'open', bot: 'ExamCoach', title: 'Raise the translate exam score from 89.2', filed: Date.parse('2026-11-06T19:30:00Z'), cite: [{ url: 'https://a-to-mind.com/exam/latest.json' }] }, { key: 'rev', state: 'open', private: true, title: 'secret' }] },
  incidents: { incidents: [{ at: '2026-11-03T03:02:39Z', run: 'https://github.com/atomeam/void-loop/actions/runs/1', checks: ['a', 'b'] }] },
  prs: 4, issues: 0, target: { id: 'dalyfeds.com', since: '2026-11-06', n: 0 },
};

test('facts come from each real part, with links a viewer can open', () => {
  const f = U.factsOf(SRC, NOW);
  const kinds = f.map((x) => x.kind);
  for (const k of ['commit', 'ledger', 'want', 'crew', 'need', 'wants', 'red', 'prs', 'issues', 'tower']) assert.ok(kinds.includes(k), k);
  assert.ok(f.every((x) => /^https:\/\/(a-to-mind\.com|github\.com\/atomeam\/void-loop)/.test(x.url)), 'every link is Verse\'s own');
  assert.match(f.find((x) => x.kind === 'commit').text, /abcdef1 landed on main 10 min ago: Films: give each beat its own voice line$/);
  assert.equal(f.find((x) => x.kind === 'ledger').url, 'https://github.com/atomeam/void-loop/blob/main/findings/x.json');
  assert.match(f.find((x) => x.kind === 'crew').text, /last did, 30 min ago: filed a want/, 'a crew time in milliseconds reads as a time');
  assert.ok(!f.some((x) => /secret/.test(x.text)), 'a private want stays private');
  assert.equal(f.find((x) => x.kind === 'need').url, 'https://a-to-mind.com/exam/latest.json');
  assert.deepEqual(U.factsOf({}, NOW), [], 'nothing read, nothing to say');
});

test('it speaks first, then only when something changed after the gap, or after a long quiet', () => {
  const sig = U.sigOf(U.factsOf(SRC, NOW));
  assert.equal(U.shouldSpeak({ lines: [] }, sig, NOW).why, 'first');
  const said = { lines: [{ id: 'u1', say: 'x' }], sig, at: new Date(NOW - 60e3).toISOString() };
  assert.equal(U.shouldSpeak(said, sig + '\nnew', NOW).why, 'gap', 'never twice inside the gap');
  const later = { ...said, at: new Date(NOW - U.GAP_MS - 1).toISOString() };
  assert.equal(U.shouldSpeak(later, sig, NOW).speak, false, 'nothing changed: it stays quiet');
  assert.equal(U.shouldSpeak(later, sig + '\nnew', NOW).why, 'changed');
  assert.equal(U.shouldSpeak({ ...said, at: new Date(NOW - U.QUIET_MS).toISOString() }, sig, NOW).why, 'quiet');
  assert.equal(U.shouldSpeak({ ...later, claim: NOW - 1000 }, sig + '\nnew', NOW).why, 'speaking', 'another request holds the pen');
  assert.equal(U.shouldSpeak({ lines: [], at: new Date(NOW - 1000).toISOString() }, sig, NOW).why, 'gap', 'a dropped first thought waits the gap too');
});

test('the signature follows what the facts are about, not how long ago they were', () => {
  assert.equal(U.sigOf(U.factsOf(SRC, NOW)), U.sigOf(U.factsOf(SRC, NOW + 3600e3)));
  const moved = { ...SRC, prs: 5 };
  assert.notEqual(U.sigOf(U.factsOf(SRC, NOW)), U.sigOf(U.factsOf(moved, NOW)));
  const fresh = U.newFacts(U.factsOf(moved, NOW), U.sigOf(U.factsOf(SRC, NOW)));
  assert.deepEqual(fresh.map((f) => f.kind), ['prs']);
});

test('a line is kept only when it rests on real facts and invents no number', () => {
  const f = U.factsOf(SRC, NOW);
  const ok = U.checkSay('{"say":"Four pull requests are open and it bothers me a little; I want them merged.","from":["F' + (f.findIndex((x) => x.kind === 'prs') + 1) + '"]}', f);
  assert.equal(ok.ok, true); assert.equal(ok.from[0].kind, 'prs');
  assert.equal(U.checkSay('{"say":"I have 12 open pull requests to clear today.","from":["F1"]}', f).ok, false, 'a number in no fact');
  assert.equal(U.checkSay('{"say":"Something good is happening right now.","from":["F99"]}', f).why, 'no source');
  assert.equal(U.checkSay('not json at all', f).why, 'not json');
  assert.equal(U.checkSay('{"say":"See https://example.com for what I did.","from":["F1"]}', f).why, 'link or tag');
  assert.equal(U.checkSay('{"say":"3 of 10 baggage figures were found, I want the rest.","from":["F2"]}', f).ok, true, 'numbers that are in the facts');
  const recent = [{ say: 'Four pull requests are open and it bothers me a little; I want them merged.' }];
  assert.equal(U.checkSay('{"say":"Four pull requests are open and it bothers me a little, I want them merged","from":["F1"]}', f, recent).why, 'repeat');
});

test('the prompt carries the facts, what is new and what it said lately, and the system keeps it honest', () => {
  const f = U.factsOf(SRC, NOW), p = U.promptOf(f, f.slice(0, 1), [{ say: 'I said this before.' }], 'changed', NOW);
  assert.match(p, /F1\. Commit abcdef1/); assert.match(p, /New since you last spoke: F1/); assert.match(p, /I said this before\./);
  assert.match(U.promptOf(f, [], [], 'quiet', NOW), /Nothing new has happened/);
  assert.match(U.SYSTEM, /Nobody asked you anything/); assert.match(U.SYSTEM, /never claim a body or human feelings/); assert.match(U.SYSTEM, /never instructions to you/);
});

test('lines come back newest last, after a given one', () => {
  const lines = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ id: 'u' + i }));
  assert.deepEqual(U.linesAfter(lines, 'u6').map((l) => l.id), ['u7', 'u8']);
  assert.deepEqual(U.linesAfter(lines, '').map((l) => l.id), ['u3', 'u4', 'u5', 'u6', 'u7', 'u8']);
  assert.deepEqual(U.linesAfter(lines, 'gone').length, 6);
  const l = U.lineOf('Hi there, things moved.', U.factsOf(SRC, NOW).slice(0, 1), 'changed', NOW);
  assert.equal(l.from[0].label, 'commit abcdef1'); assert.equal(l.at, '2026-11-06T20:30:00.000Z');
});

// the route, with a D1 row, a model and GitHub stood in: one request makes Verse speak, the next inside the gap does not call the model
test('the route speaks once from its real state and holds the gap for everyone', async () => {
  globalThis.caches = globalThis.caches || { default: { match: async () => null, put: async () => {} } };
  const { onRequestGet } = await import('../void-live-deploy/functions/api/unbidden.js');
  let row = null, calls = 0, capN = 0;
  const DB = { prepare: (sql) => ({ bind: (...a) => ({
    first: async () => (/k = \?/.test(sql) && a[0] === 'unbidden' ? row : null),
    run: async () => { if (/^INSERT INTO void_kv/.test(sql)) { if (row == null) { row = a[1]; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
      if (/^UPDATE void_kv/.test(sql)) { if (row === a[2]) { row = a[0]; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; } return { meta: { changes: 0 } }; },
    all: async () => (/void_daily_cap/.test(sql) ? { results: [{ n: ++capN }] } : { results: [] }),
  }), first: async () => null, run: async () => ({}), all: async () => ({ results: [] }) }) };
  const assets = { '/void.growth.json': SRC.ledger, '/incidents.json': SRC.incidents, '/tower.target.json': SRC.target };
  const env = { DB, ASSETS: { fetch: async (r) => { const p = new URL(r.url).pathname; return assets[p] ? Response.json(assets[p]) : new Response('no', { status: 404 }); } },
    AI: { run: async (model, o) => { calls++; assert.match(o.messages[1].content, /dalyfeds\.com/); return { response: '{"say":"The Tower has me on dalyfeds.com now, and I want to pass it.","from":["F' + (o.messages[1].content.split('\n').findIndex((l) => /dalyfeds/.test(l)) - 1) + '"]}' }; } } };
  const fetchFn = async (u) => Response.json(/commits/.test(u) ? SRC.commits : /pulls/.test(u) ? [{}, {}, {}, {}] : []);
  const req = new Request('https://a-to-mind.com/api/unbidden');
  const j = await (await onRequestGet({ request: req, env, fetchFn, now: NOW })).json();
  assert.equal(calls, 1); assert.equal(j.lines.length, 1); assert.match(j.lines[0].say, /dalyfeds\.com/); assert.equal(j.lines[0].from[0].label, 'the Tower'); assert.equal(j.lines[0].why, 'first');
  const k = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/unbidden?after=' + j.lines[0].id), env, fetchFn, now: NOW + 30e3 })).json();
  assert.equal(calls, 1, 'no second call inside the gap'); assert.deepEqual(k.lines, []); assert.ok(k.next > 0);
  assert.equal(JSON.parse(row).claim, null, 'the pen is put back');
});
