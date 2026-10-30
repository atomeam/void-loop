import test from 'node:test';
import assert from 'node:assert/strict';
import { cardGaps, THIN_LINE, benchedCount, tiersOf, incidentHits, rank, usable, plan, missedIn, settle, report, load, answered, UNBENCHED, PER_SKILL } from './lacks.mjs';

const guide = { pages: [
  { kind: 'skill', name: 'timer', examples: ['set a timer for 5 minutes', 'timer'] },
  { kind: 'skill', name: 'chess', examples: ['play chess', 'chess against verse', 'let us play chess', 'open a chess board', 'chess please'] },
  { kind: 'skill', name: 'pw', examples: ['generate a password'] },
  { kind: 'skill', name: 'noexamples', examples: [] },
  { kind: 'chapter', name: 'make', examples: ['x'] },
] };
const families = { families: [{ skills: [{ name: 'timer', tier: 'proven' }, { name: 'chess', tier: 'experiment' }, { name: 'pw', tier: 'tested' }] }] };
const bench = [{ ask: 'a timer', want: 'skill:timer' }, { ask: 'x', want: 'said|skill:other' }, { ask: 'y', want: 'pw' }];

test('benchmark rows are counted by skill whatever the want looks like', () => {
  const n = benchedCount(bench.concat([{ ask: 'z', want: 'skill:timer' }, { ask: 'q' }, null]));
  assert.equal(n.get('timer'), 2); assert.equal(n.get('other'), 1); assert.equal(n.get('pw'), 1); assert.equal(n.get('chess'), undefined);
  assert.equal(benchedCount(null).size, 0);
});

test('no benchmark ask and a weak tier ranks first, with its reasons; thin evidence counts; a well benched skill, one with no examples and a chapter do not appear', () => {
  const r = rank({ guide, families, bench, incidents: {} });
  assert.deepEqual(r.map((x) => x.name), ['chess', 'pw', 'timer']);
  assert.equal(r[0].score, UNBENCHED + 40);
  assert.deepEqual(r[0].reasons, ['no benchmark ask', 'evidence tier: experiment']);
  assert.deepEqual(r[1].reasons, ['only 1 benchmark ask', 'evidence tier: tested']);
  const full = rank({ guide, families, bench: bench.concat([{ ask: 'a', want: 'skill:timer' }, { ask: 'b', want: 'skill:timer' }]), incidents: {} });
  assert.ok(!full.some((x) => x.name === 'timer'));
  assert.ok(!r.some((x) => x.name === 'noexamples' || x.name === 'make'));
});

test('examples the guide quoted from a header (button labels, the owner\'s words) are never candidate asks', () => {
  const g = { pages: guide.pages.concat([{ kind: 'skill', name: 'tab', examples: ['put in the page', 'draft for me'], examplesFrom: 'header' }]) };
  const r = rank({ guide: g, families, bench, incidents: {} });
  assert.ok(!r.some((x) => x.name === 'tab'));
  const p = plan({ guide: g, families, bench, incidents: {} }, { n: 50 });
  assert.ok(p.candidates.length && !p.candidates.some((c) => c.want === 'skill:tab'));
});

test('failed runs that name a skill raise it, and only as a whole word', () => {
  const incidents = { incidents: [{ checks: ['chess: the board opens'] }, { checks: ['chessboard other'] }, { checks: ['timer: a countdown'] }] };
  const h = incidentHits(incidents, ['chess', 'timer', 'pw']);
  assert.equal(h.get('chess'), 1); assert.equal(h.get('timer'), 1); assert.equal(h.has('pw'), false);
  const r = rank({ guide, families, bench: [], incidents });
  assert.equal(r.find((x) => x.name === 'chess').score, UNBENCHED + 40 + 5);
  assert.ok(r.find((x) => x.name === 'chess').reasons.includes('1 failed run name it'));
});

test('only plain asks are tried: no links, addresses, long tokens, blanks or runs of digits', () => {
  for (const ok of ['set a timer for 5 minutes', 'a2m', 'what is 7 cubed']) assert.equal(usable(ok), true, ok);
  for (const bad of ['', ' ', 'see https://x.test', 'mail a@b.com', 'x'.repeat(40), 'a'.repeat(121), '123 456', 'two\nlines']) assert.equal(usable(bad), false, JSON.stringify(bad));
});

test('the plan takes at most three of a skill\'s examples, none already in the benchmark, none twice', () => {
  const p = plan({ guide, families, bench: [{ ask: 'play chess', want: 'skill:chess' }, { ask: 'p', want: 'skill:pw' }] }, { n: 5 });
  const chess = p.candidates.filter((c) => c.want === 'skill:chess');
  assert.equal(chess.length, PER_SKILL);
  assert.ok(!chess.some((c) => c.ask === 'play chess'), 'an ask the benchmark has is not proposed again');
  assert.equal(new Set(p.candidates.map((c) => c.ask.toLowerCase())).size, p.candidates.length);
  assert.deepEqual(p.picks.map((x) => x.name), ['timer', 'chess', 'pw']);
  assert.deepEqual(plan({ guide: {}, families: {}, bench: [] }).candidates, []);
});

test('the probe log is read exactly: a miss is a line that starts with the whole ask, not a longer ask that begins with it', () => {
  const cands = [{ ask: 'play chess', want: 'skill:chess' }, { ask: 'play chess now', want: 'skill:chess' }, { ask: 'chess please', want: 'skill:chess' }];
  const log = ' ---- ' + 'play chess now'.padEnd(42) + ' said   (wants skill:chess; misses alone)\n  ok  ' + 'play chess'.padEnd(42) + ' skill:chess\n';
  const m = missedIn(log, cands);
  assert.deepEqual([...m.keys()], ['play chess now']);
  const s = settle(cands, log);
  assert.deepEqual(s.passing.map((c) => c.ask), ['play chess', 'chess please']);
  assert.equal(s.failed[0].ask, 'play chess now'); assert.match(s.failed[0].got, /said/);
  assert.deepEqual(settle(cands, '').failed, []);
});

test('the report names every skill picked, every ask added and every ask left out', () => {
  const t = report({ picks: [{ name: 'chess', score: 140, reasons: ['no benchmark ask'] }], passing: [{ ask: 'play chess', want: 'skill:chess' }], failed: [{ ask: 'chess please', want: 'skill:chess', got: 'said' }] });
  assert.match(t, /\| chess \| 140 \| no benchmark ask \|/); assert.match(t, /`play chess` → skill:chess/); assert.match(t, /did not, and are not added[\s\S]*`chess please`/);
});

test('on the real repo files the ranking is non-empty, sorted, and its candidates are plain and new', () => {
  const d = load(), r = rank(d);
  assert.ok(r.length > 0);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  const p = plan(d, { n: 4 }), have = new Set(d.bench.map((x) => String(x.ask).toLowerCase()));
  assert.ok(p.candidates.length > 0);
  for (const c of p.candidates) { assert.ok(usable(c.ask)); assert.ok(!have.has(c.ask.toLowerCase())); assert.match(c.want, /^skill:[a-z0-9-]+$/); }
});

test('cards worth refining: a thin description, too few examples or an old brand name, worst first; a good card does not appear', () => {
  const g = { pages: [
    { kind: 'skill', name: 'good', line: 'a description that says plainly what this skill does for a person', examples: ['a', 'b', 'c'], title: 'Good' },
    { kind: 'skill', name: 'thin', line: 'short', examples: ['a'] },
    { kind: 'skill', name: 'old', line: 'V01D answers this in a sentence long enough to pass the length rule', examples: ['a', 'b', 'c'] },
    { kind: 'game', name: 'chess', line: 'x', examples: [] },
  ] };
  const r = cardGaps(g);
  assert.deepEqual(r.map((x) => x.name), ['thin', 'old']);
  assert.ok(r[0].reasons.some((x) => /description is 5 characters/.test(x)) && r[0].reasons.some((x) => /only 1 example ask$/.test(x)));
  assert.ok(r[1].reasons.includes('an old brand name on the card'));
  assert.deepEqual(cardGaps(null), []); assert.equal(THIN_LINE, 45);
  assert.equal(cardGaps(g, { limit: 1 }).length, 1);
});

test('queue (dry): plain routing gaps become probe jobs within the open limit; a link, a bad want and a repeat never do', async () => {
  const { spawnSync } = await import('node:child_process'), { writeFileSync, mkdtempSync } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'lacks-')), f = join(dir, 'failed.json');
  writeFileSync(f, JSON.stringify([
    { ask: 'fly around', want: 'skill:fly' }, { ask: 'pulse card', want: 'skill:pulse' }, { ask: 'rank pizza, tacos, sushi', want: 'skill:decide-cards' },
    { ask: 'see https://x.test', want: 'skill:fly' }, { ask: 'ok ask', want: 'rm -rf /' }, { ask: 'fly around', want: 'skill:fly' },
  ]));
  const r = spawnSync(process.execPath, [new URL('./lacks.mjs', import.meta.url).pathname, 'queue', f, '--dry', '--empty-queue'], { encoding: 'utf8', env: { ...process.env, VOID_OWNER_TOKEN: '' } });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.split('\n').filter((l) => l.startsWith('would queue'));
  const { PROBE_OPEN_MAX } = await import('./probe-asks.mjs');
  assert.equal(lines.length, Math.min(3, PROBE_OPEN_MAX), 'within the open limit, like the probe (three plain gaps here): ' + r.stdout);
  assert.match(lines[0], /probe:fly-around/); assert.doesNotMatch(r.stdout, /https|rm -rf/);
  assert.equal(spawnSync(process.execPath, [new URL('./lacks.mjs', import.meta.url).pathname, 'queue'], { encoding: 'utf8' }).status, 2);
});

test('a finished study with strong evidence moves its skill up the plan, never off it', () => {
  const base = plan({ guide, families, bench: [] }, { n: 5 }).picks.map((x) => x.name);
  const boosted = plan({ guide, families, bench: [], studyBoost: { [base[base.length - 1]]: 1000 } }, { n: 5 }).picks.map((x) => x.name);
  assert.equal(boosted[0], base[base.length - 1]); assert.deepEqual([...boosted].sort(), [...base].sort());
});

test('a row that routed must also answer before it joins the benchmark (PR #1987: routed is not answered)', async () => {
  const rows = [{ ask: 'how far is nyc to london', want: 'skill:distance' }, { ask: 'flip a coin', want: 'skill:coin' }, { ask: 'weather in paris', want: 'skill:weather' }];
  const said = { distance: { outcome: 'no answer', why: 'I couldn\'t find "is nyc"' }, coin: { outcome: 'answered' }, weather: { outcome: 'not run' } };
  const r = await answered(rows, async (name) => said[name]);
  assert.deepEqual(r.passing.map((c) => c.ask), ['flip a coin', 'weather in paris']);
  assert.deepEqual(r.silent, [{ ask: 'how far is nyc to london', want: 'skill:distance', why: 'I couldn\'t find "is nyc"' }]);
  const t = report({ picks: [], passing: r.passing, failed: [], silent: r.silent });
  assert.match(t, /routed but the card did not answer[\s\S]*how far is nyc to london/);
  assert.deepEqual((await answered(rows, async () => { throw new Error('x'); })).passing.length, 3, 'a check that cannot run keeps the row (routing only)');
});
