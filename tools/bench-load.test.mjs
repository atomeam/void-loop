import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { percentile, latencyOf, replayAlone, verdict, assess, nextLatency, envName, REPLAY_CAP } from './bench-load.mjs';
import { nextFloor } from './bench-floor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'bench-load-'));
const write = (name, v) => { const f = join(dir, name); writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); return f; };

test('percentile is the nearest rank, and empty lists have none', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(v, 50), 50);
  assert.equal(percentile(v, 95), 95);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([], 95), null);
  assert.deepEqual(latencyOf([10, null, 30, undefined, 20]), { n: 3, p50: 20, p95: 30 });
});

test('the environment is ci when CI is set, local otherwise', () => {
  assert.equal(envName({ CI: 'true' }), 'ci');
  assert.equal(envName({}), 'local');
});

// a canned slow run: ten asks, three missed in the parallel pass (answers took ~4 s because the machine was busy)
const slowRun = () => Array.from({ length: 10 }, (_, i) => ({ ask: 'ask ' + i, by: i === 2 || i === 5 || i === 7 ? '(none)' : 'calc', right: !(i === 2 || i === 5 || i === 7), ms: 3900 }));
const slow = { n: 10, p50: 3800, p95: 3950 }, quietBaseline = { p95: 1800, pages: 3, cores: 4, sha: 'abc', at: '2026-10-10T00:00:00Z' };

test('replayAlone replays only the misses, one by one, and splits them', async () => {
  const seen = [];
  const r = await replayAlone(slowRun(), async (i) => { seen.push(i); return i === 2; });
  assert.deepEqual(seen, [2, 5, 7], 'only the misses, in order');
  assert.deepEqual(r.load, [2]);
  assert.deepEqual(r.confirmed, [5, 7]);
});

test('past the cap the rest count as real: a run with that many misses is not a blip', async () => {
  const out = Array.from({ length: REPLAY_CAP + 5 }, (_, i) => ({ ask: 'a' + i, by: 'x', right: false }));
  let calls = 0;
  const r = await replayAlone(out, async () => { calls++; return true; });
  assert.equal(calls, REPLAY_CAP);
  assert.equal(r.load.length, REPLAY_CAP);
  assert.equal(r.confirmed.length, 5);
  assert.equal(r.unreplayed, 5);
});

test('canned slow run, every miss passes alone: inconclusive, nothing real, exit-0 shape', async () => {
  const a = await assess({ out: slowRun(), replay: async () => true, floor: { score: 10, total: 10 }, latency: slow, baseline: quietBaseline, pages: 3 });
  assert.equal(a.inconclusive, true);
  assert.equal(a.failed, false, 'the misses were load: the score they would have cost is not counted');
  assert.equal(a.score, 10);
  assert.deepEqual(a.wrong, []);
  assert.equal(a.loadMisses.length, 3);
  assert.match(a.note, /^inconclusive: machine under load \(p95 3950ms vs baseline 1800ms; 3 of 3 misses passed alone\); re-run alone$/);
});

test('canned slow run, one miss still misses alone: it is listed as real and fails the run below the floor, whatever the latency says', async () => {
  const a = await assess({ out: slowRun(), replay: async (i) => i !== 5, floor: { score: 10, total: 10 }, latency: slow, baseline: quietBaseline, pages: 3 });
  assert.deepEqual(a.wrong, ['ask 5 -> (none)'], 'ask 5 misses alone');
  assert.deepEqual(a.loadMisses, ['ask 2 -> (none)', 'ask 7 -> (none)'], 'asks 2 and 7 pass alone');
  assert.equal(a.score, 9);
  assert.equal(a.failed, true);
  assert.equal(a.inconclusive, true, 'two of the misses were load, so the numbers are not kept');
});

test('a real miss is real even when the machine looks fine; and a slow machine never turns a real miss into inconclusive', async () => {
  const quiet = { n: 10, p50: 700, p95: 900 };
  // 2 real misses, floor tolerates one
  const out = slowRun();
  const real = await assess({ out, replay: async () => false, floor: { score: 7, total: 10 }, latency: quiet, baseline: quietBaseline, pages: 3 });
  assert.equal(real.inconclusive, false, 'no load miss: conclusive');
  assert.equal(real.failed, false, '3 real misses leave 7 of 10: at the floor');
  const worse = await assess({ out, replay: async () => false, floor: { score: 8, total: 10 }, latency: slow, baseline: quietBaseline, pages: 3 });
  assert.equal(worse.inconclusive, false, 'a p95 far over the baseline does not excuse a miss that reproduces alone');
  assert.equal(worse.failed, true, '7 of 10 against a floor of 8');
  assert.equal(worse.wrong.length, 3);
});

test('mixed: one load miss, one real miss that takes the score under the floor: inconclusive and failed', async () => {
  const a = await assess({ out: slowRun(), replay: async (i) => i === 2, floor: { score: 9, total: 10 }, latency: slow, baseline: undefined, pages: 3 });
  assert.equal(a.inconclusive, true);
  assert.equal(a.failed, true);
  assert.equal(a.score, 8);
  assert.match(a.note, /^inconclusive: machine under load \(p95 3950ms; 1 of 3 misses passed alone\); re-run alone$/);
});

test('a run with no misses is conclusive and replays nothing', async () => {
  const out = slowRun().map((x) => ({ ...x, right: true }));
  let calls = 0;
  const a = await assess({ out, replay: async () => { calls++; return true; }, floor: { score: 10, total: 10 }, latency: slow, baseline: quietBaseline, pages: 3 });
  assert.equal(calls, 0);
  assert.equal(a.inconclusive, false);
  assert.equal(a.failed, false);
});

test('verdict: no load miss is conclusive; the baseline is only quoted when it was measured with the same pages', () => {
  assert.equal(verdict({ confirmed: 4, load: 0, latency: slow, baseline: quietBaseline, pages: 3 }).inconclusive, false);
  assert.match(verdict({ confirmed: 0, load: 2, latency: slow, baseline: { ...quietBaseline, pages: 6 }, pages: 3 }).line, /\(p95 3950ms; 2 of 2 misses passed alone\)/, 'a baseline from another number of pages is not quoted');
});

test('the baseline records its commit and time, tightens from a conclusive run at the floor, and never loosens or moves on anything else', () => {
  const floor = { score: 1985, total: 2001, latency: { ci: { p50: 300, p95: 900, n: 2000, pages: 3, cores: 4, sha: 'old', at: '2026-10-10T00:00:00Z' } } };
  const good = { score: 1990, total: 2001, env: 'local', pages: 3, cores: 4, sha: 'abc123', at: '2026-10-10T05:00:00Z', latency: { p50: 120, p95: 260, n: 1990 } };
  assert.deepEqual(nextLatency(good, floor), { ci: floor.latency.ci, local: { p50: 120, p95: 260, n: 1990, pages: 3, cores: 4, sha: 'abc123', at: '2026-10-10T05:00:00Z' } }, 'a first baseline is recorded beside the others, with sha and at');
  const tighter = { ...good, env: 'ci', latency: { p50: 200, p95: 700, n: 1990 } };
  assert.equal(nextLatency(tighter, floor).ci.p95, 700);
  assert.equal(nextLatency(tighter, floor).ci.sha, 'abc123');
  assert.equal(nextLatency({ ...tighter, latency: { p50: 400, p95: 1200, n: 1990 } }, floor), null, 'a slower run never loosens it');
  assert.equal(nextLatency({ ...tighter, inconclusive: true }, floor), null, 'an inconclusive run never moves it');
  assert.equal(nextLatency({ ...tighter, score: 1984 }, floor), null, 'a run below the floor never moves it');
  assert.equal(nextLatency({ ...tighter, pages: 6, cores: 8 }, floor), null, 'a run with another number of pages never swaps the baseline');
  assert.equal(nextLatency({ ...tighter, latency: { p50: 1, p95: null, n: 0 } }, floor), null);
});

test('a baseline with no sha (recorded by hand) is replaced by the next clean run, even a slower one', () => {
  const floor = { score: 1985, total: 2001, latency: { local: { p50: 1363, p95: 1808, n: 2036, cores: 4, pages: 3 } } };
  const run = { score: 2036, total: 2036, env: 'local', pages: 3, cores: 4, sha: 'f00d', at: '2026-10-10T16:00:00Z', latency: { p50: 1400, p95: 1900, n: 2036 } };
  assert.deepEqual(nextLatency(run, floor).local, { p50: 1400, p95: 1900, n: 2036, pages: 3, cores: 4, sha: 'f00d', at: '2026-10-10T16:00:00Z' });
});

// the floor tool: a conclusive fixture, an inconclusive fixture, and the floor refusing the inconclusive score
const floorFile = () => write('best.json', { score: 1773, total: 1773, date: '2026-10-07', note: 'the floor' });
const run = (result, floor, ...flags) => spawnSync(process.execPath, [join(here, 'bench-floor.mjs'), write('r.json', result), '--floor', floor, ...flags], { encoding: 'utf8' });
const conclusive = { score: 1990, total: 2001, wrong: ['a -> x'], env: 'local', pages: 3, cores: 4, sha: 'cafe', at: '2026-10-10T05:00:00Z', latency: { p50: 110, p95: 240, n: 1990 } };

test('a conclusive run raises the floor and records the latency baseline for its environment', () => {
  const f = floorFile(), r = run(conclusive, f, '--write');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /latency baseline \(local\) is recorded at p95 240ms/);
  const after = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(after.score, 1985);
  assert.deepEqual(after.latency, { local: { p50: 110, p95: 240, n: 1990, pages: 3, cores: 4, sha: 'cafe', at: '2026-10-10T05:00:00Z' } });
  assert.equal(after.note, 'the floor', 'the note stays');
});

test('an inconclusive run changes neither the floor nor the baseline', () => {
  const f = floorFile(), before = readFileSync(f, 'utf8');
  const disturbed = { ...conclusive, score: 2000, inconclusive: true, note: 'inconclusive: machine under load (p95 900ms; 2 of 2 misses passed alone); re-run alone', latency: { p50: 400, p95: 900, n: 1900 } };
  const r = run(disturbed, f, '--write');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inconclusive result/);
  assert.equal(readFileSync(f, 'utf8'), before, 'the file is untouched');
  assert.equal(nextFloor(disturbed, { score: 1773, total: 1773 }), null, 'even a high score earns nothing');
});

// the real bench on two made-up asks: one answered, one not (it misses alone too, so it is real), against a made-up floor file
const asks = write('asks.json', [{ ask: 'what is 2 plus 2', want: 'skill:util|math|calc|.*' }, { ask: 'zzqx blorp wibble', want: 'skill:nothing-answers-this' }]);
const bench = (best, extra = {}) => spawnSync(process.execPath, [join(here, 'bench.mjs'), '--score'], { encoding: 'utf8', timeout: 180000, env: { ...process.env, BENCH_ASKS: asks, BENCH_BEST: best, BENCH_PAR: '2', CI: '', ...extra } });
const lastLine = (o) => JSON.parse(o.trim().split('\n').pop());

test('bench.mjs: a miss that still misses alone is real; the floor tolerates a known one and fails an unknown one', () => {
  const tolerated = bench(write('b1.json', { score: 1, total: 2 }));
  assert.equal(tolerated.status, 0, tolerated.stderr);
  const res = lastLine(tolerated.stdout);
  assert.equal(res.total, 2);
  assert.equal(res.score, 1);
  assert.deepEqual(res.wrong, ['zzqx blorp wibble -> article fallback']);
  assert.equal(res.inconclusive, undefined, 'it misses alone: not load');
  assert.equal(res.env, 'local');
  assert.ok(res.latency.n === 2 && res.latency.p95 > 0, JSON.stringify(res.latency));
  assert.match(res.sha, /^[0-9a-f]{7,40}$/, 'the result names the commit it measured');
  assert.match(res.at, /^\d{4}-\d\d-\d\dT/);
  const failed = bench(write('b2.json', { score: 2, total: 2 }));
  assert.equal(failed.status, 1, 'the real miss takes it below the floor');
  assert.equal(lastLine(failed.stdout).score, 1);
});

test('bench.mjs: a baseline far under this machine\'s speed does not make a real miss inconclusive, and nothing is cached or written', () => {
  const last = resolve(here, 'bench.last.json'), existed = existsSync(last), kept = existed ? readFileSync(last, 'utf8') : null;
  const best = write('b3.json', { score: 1, total: 2, latency: { local: { p50: 0.01, p95: 0.01, pages: 2, cores: 4, sha: 'x' } } });
  const r = bench(best);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(lastLine(r.stdout).inconclusive, undefined);
  assert.doesNotMatch(r.stderr, /inconclusive/);
  assert.equal(existsSync(last), existed, 'a --score run writes no bench.last.json');
  if (existed) assert.equal(readFileSync(last, 'utf8'), kept);
});
