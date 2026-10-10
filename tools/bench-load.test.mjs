import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { percentile, latencyOf, limitFor, verdict, nextLatency, envName, LOAD_FACTOR, LOAD_SLACK_MS } from './bench-load.mjs';
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

test('the limit is the larger of the factor and the slack over the baseline', () => {
  assert.equal(limitFor({ p95: 400 }), 400 * LOAD_FACTOR);
  assert.equal(limitFor({ p95: 40 }), 40 + LOAD_SLACK_MS);
  assert.equal(limitFor(undefined), null);
  assert.equal(limitFor({ p95: 0 }), null);
});

test('inconclusive needs misses AND a p95 over the limit; no baseline is conclusive', () => {
  const baseline = { p95: 200 }, slow = { p95: 900 }, quiet = { p95: 210 };
  assert.equal(verdict({ misses: 4, latency: slow, baseline }).inconclusive, true);
  assert.match(verdict({ misses: 4, latency: slow, baseline }).line, /^inconclusive: machine under load \(p95 900ms vs baseline 200ms\); re-run alone$/);
  assert.equal(verdict({ misses: 0, latency: slow, baseline }).inconclusive, false, 'slow but nothing missed: the score is right');
  assert.equal(verdict({ misses: 4, latency: quiet, baseline }).inconclusive, false, 'misses on a quiet machine are real');
  assert.equal(verdict({ misses: 4, latency: slow, baseline: undefined }).inconclusive, false, 'no baseline yet');
  assert.equal(verdict({ misses: 4, latency: slow, baseline: { p95: 200, pages: 3, cores: 4 }, pages: 6, cores: 8 }).inconclusive, false, 'a baseline from another parallelism cannot judge this run');
  assert.equal(verdict({ misses: 4, latency: slow, baseline: { p95: 200, pages: 3, cores: 4 }, pages: 3, cores: 4 }).inconclusive, true);
  assert.equal(verdict({ misses: 4, latency: slow, baseline: { p95: 200, pages: 3, cores: 4 }, pages: 3, cores: 8 }).inconclusive, true, 'other cores, same pages: compared');
  assert.equal(verdict({ misses: 4, latency: slow, baseline: { p95: 200 }, pages: 3 }).inconclusive, false, 'a baseline that does not say its pages cannot judge');
});

test('the baseline tightens from a conclusive run at the floor, and never loosens or moves on anything else', () => {
  const floor = { score: 1985, total: 2001, latency: { ci: { p50: 300, p95: 900, n: 2000, pages: 3, cores: 4 } } };
  const good = { score: 1990, total: 2001, env: 'local', pages: 3, cores: 4, latency: { p50: 120, p95: 260, n: 1990 } };
  assert.deepEqual(nextLatency(good, floor), { ci: { p50: 300, p95: 900, n: 2000, pages: 3, cores: 4 }, local: { p50: 120, p95: 260, n: 1990, pages: 3, cores: 4 } }, 'a first baseline for an environment is recorded beside the others');
  const tighter = { ...good, env: 'ci', latency: { p50: 200, p95: 700, n: 1990 } };
  assert.equal(nextLatency(tighter, floor).ci.p95, 700);
  assert.equal(nextLatency({ ...tighter, latency: { p50: 400, p95: 1200, n: 1990 } }, floor), null, 'a slower run never loosens it');
  assert.equal(nextLatency({ ...tighter, inconclusive: true }, floor), null, 'an inconclusive run never moves it');
  assert.equal(nextLatency({ ...tighter, pages: 6, cores: 8 }, floor), null, 'a run at another parallelism never swaps the baseline');
  assert.equal(nextLatency({ ...tighter, score: 1984 }, floor), null, 'a run below the floor never moves it');
  assert.equal(nextLatency({ ...tighter, latency: { p50: 1, p95: null, n: 0 } }, floor), null);
});

// the floor tool: a conclusive fixture, an inconclusive fixture, and the floor refusing the inconclusive score
const floorFile = () => write('best.json', { score: 1773, total: 1773, date: '2026-10-07', note: 'the floor' });
const run = (result, floor, ...flags) => spawnSync(process.execPath, [join(here, 'bench-floor.mjs'), write('r.json', result), '--floor', floor, ...flags], { encoding: 'utf8' });
const conclusive = { score: 1990, total: 2001, wrong: ['a -> x'], env: 'local', pages: 3, cores: 4, latency: { p50: 110, p95: 240, n: 1990 } };

test('a conclusive run raises the floor and records the latency baseline for its environment', () => {
  const f = floorFile(), r = run(conclusive, f, '--write');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /latency baseline \(local\) is recorded at p95 240ms/);
  const after = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(after.score, 1985);
  assert.deepEqual(after.latency, { local: { p50: 110, p95: 240, n: 1990, pages: 3, cores: 4 } });
  assert.equal(after.note, 'the floor', 'the note stays');
});

test('an inconclusive run changes neither the floor nor the baseline', () => {
  const f = floorFile(), before = readFileSync(f, 'utf8');
  const slow = { ...conclusive, score: 2000, inconclusive: true, note: 'inconclusive: machine under load (p95 900ms vs baseline 240ms); re-run alone', latency: { p50: 400, p95: 900, n: 1900 } };
  const r = run(slow, f, '--write');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inconclusive result/);
  assert.equal(readFileSync(f, 'utf8'), before, 'the file is untouched');
  assert.equal(nextFloor(slow, { score: 1773, total: 1773 }), null, 'even a high score earns nothing');
});

// the real bench on two made-up asks: one answered, one not, against a made-up floor file
const asks = write('asks.json', [{ ask: 'what is 2 plus 2', want: 'skill:util|math|calc|.*' }, { ask: 'zzqx blorp wibble', want: 'skill:nothing-answers-this' }]);
const bench = (best, extra = {}) => spawnSync(process.execPath, [join(here, 'bench.mjs'), '--score'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, BENCH_ASKS: asks, BENCH_BEST: best, BENCH_PAR: '2', CI: '', ...extra } });
const lastLine = (o) => JSON.parse(o.trim().split('\n').pop());

test('bench.mjs measures latency and stays conclusive with no baseline or a generous one', () => {
  for (const latency of [undefined, { local: { p50: 1, p95: 600000 } }]) {
    const r = bench(write('b1.json', { score: 1, total: 2, latency }));
    assert.equal(r.status, 0, r.stderr);
    const res = lastLine(r.stdout);
    assert.equal(res.total, 2);
    assert.equal(res.score, 1, 'the unanswerable ask is a miss');
    assert.equal(res.env, 'local');
    assert.ok(res.latency.n >= 1 && res.latency.p95 > 0, 'latency measured: ' + JSON.stringify(res.latency));
    assert.equal(res.inconclusive, undefined);
    assert.doesNotMatch(r.stderr, /inconclusive/);
  }
});

test('bench.mjs with misses and a baseline no machine meets says inconclusive, exits 0, and writes nothing', () => {
  const last = resolve(here, 'bench.last.json'), existed = existsSync(last), kept = existed ? readFileSync(last, 'utf8') : null;
  const r = spawnSync(process.execPath, [join(here, 'bench.mjs'), '--json'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, BENCH_ASKS: asks, BENCH_BEST: write('b2.json', { score: 1, total: 2, latency: { local: { p50: 0.01, p95: 0.01 } } }), BENCH_PAR: '2', CI: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inconclusive: machine under load \(p95 \d+ms vs baseline 0ms\); re-run alone/);
  assert.match(r.stdout, /bench\.last\.json kept as it was/);
  assert.equal(existsSync(last), existed, 'no bench.last.json appeared');
  if (existed) assert.equal(readFileSync(last, 'utf8'), kept, 'a conclusive run\'s misses were not overwritten');
  const s = bench(write('b3.json', { score: 1, total: 2, latency: { local: { p50: 0.01, p95: 0.01 } } }));
  assert.equal(s.status, 0, s.stderr);
  assert.equal(lastLine(s.stdout).inconclusive, true);
  assert.match(s.stderr, /^inconclusive: machine under load/m);
  assert.match(lastLine(s.stdout).note, /re-run alone$/);
});
