// Verse's recorded bass and electric guitar (lib/rap-strings.js; owner, 2026-10-30: real music in every genre, not oscillators): every take
// the module names is on disk as a clean 24 kHz mono 16-bit recording that starts on its pluck, fades to silence, sits at the level the
// module says and sounds at its own pitch; a note plays the nearest take within 1.5 semitones, a fast chug alternates between the two
// palm-muted takes, and a page fetches only what its song plays. Run: node --test tools/rap-strings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASS, BASS_ROOTS, HELD, MUTE, MUTE_ROOTS, HELD_SECONDS, MUTE_SECONDS, HARD, bassPath, guitarPath, bassTake, guitarTake, stringsTakesFor, loadStrings } from '../void-live-deploy/lib/rap-strings.js';
import { arrange } from '../void-live-deploy/lib/arrange.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy'), RATE = 24000;
const fileOf = (path) => resolve(ROOT, '.' + path);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function readWav(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(p + 8), channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') data = buf.subarray(p + 8, p + 8 + n);
    p += 8 + n + (n % 2);
  }
  assert.ok(fmt && data, 'fmt and data chunks');
  const out = new Float32Array(data.length / 2 / fmt.channels);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2 * fmt.channels) / 32768;
  return { ...fmt, data: out };
}
/** the fundamental of x in Hz: the shortest lag between 25 Hz and 1200 Hz whose autocorrelation peak is within 15% of the strongest one, so
 *  a peak at two or three periods (a strong harmonic) never reads as a lower note */
function fundamental(x) {
  const lo = Math.floor(RATE / 1200), hi = Math.ceil(RATE / 25), n = x.length - hi; let mean = 0; for (const v of x) mean += v / x.length;
  const ac = (lag) => { let s = 0; for (let i = 0; i < n; i++) s += (x[i] - mean) * (x[i + lag] - mean); return s; };
  const acs = new Float64Array(hi + 1); let top = lo; for (let l = lo; l <= hi; l++) { acs[l] = ac(l); if (acs[l] > acs[top]) top = l; }
  let best = top; for (let l = lo + 1; l < top; l++) if (acs[l] >= acs[l - 1] && acs[l] >= acs[l + 1] && acs[l] > 0.85 * acs[top]) { best = l; break; }
  const a = acs[best - 1], b = acs[best], c = acs[best + 1], den = a - 2 * b + c;
  return RATE / (best + (den < 0 ? 0.5 * (a - c) / den : 0));
}
const ALL = [
  ...BASS_ROOTS.flatMap((r) => ['soft', 'hard'].map((l) => ({ path: bassPath(r, l), root: r, level: BASS[r][l], seconds: HELD_SECONDS }))),
  ...HELD.map((r) => ({ path: guitarPath(r, 'held'), root: r, level: 1, seconds: HELD_SECONDS })),
  ...MUTE_ROOTS.flatMap((r) => [0, 1].map((i) => ({ path: guitarPath(r, 'mute' + (i + 1)), root: r, level: MUTE[r][i], seconds: MUTE_SECONDS }))),
];

test('every take is on disk: 24 kHz, mono, 16-bit, starting on its pluck, faded to silence, as long and as loud as the module says', () => {
  assert.equal(ALL.length, 8 * 2 + 12 + 9 * 2);
  for (const t of ALL) {
    assert.ok(existsSync(fileOf(t.path)), t.path + ' is on disk');
    const w = readWav(readFileSync(fileOf(t.path)));
    assert.deepEqual([w.format, w.channels, w.rate, w.bits], [1, 1, RATE, 16], t.path + ': PCM, mono, 24 kHz, 16-bit');
    let peak = 0; for (const v of w.data) peak = Math.max(peak, Math.abs(v));
    const first = w.data.findIndex((x) => Math.abs(x) > peak * 0.05);
    assert.ok(first <= 0.004 * RATE, t.path + ': the pluck lands at ' + (first / RATE * 1000).toFixed(1) + ' ms');
    assert.ok(Math.abs(w.data[0]) < 0.01 && Math.abs(w.data[w.data.length - 1]) < 0.01, t.path + ': no click at either end');
    assert.ok(Math.abs(w.data.length / RATE - t.seconds) < 0.01, t.path + ': ' + t.seconds + ' s long');
    assert.ok(Math.abs(peak / 0.89 - t.level) < 0.01, t.path + ': level ' + t.level + ' matches the file (' + (peak / 0.89).toFixed(3) + ')');
  }
});

// a plucked string rings a little sharp while it swings wide, so the pitch is read once the attack has passed
test('every take sounds its own note, within 35 cents', () => {
  for (const t of ALL) {
    const x = readWav(readFileSync(fileOf(t.path))).data, from = Math.round(0.05 * RATE), f = fundamental(x.subarray(from, from + Math.round((t.seconds > 1 ? 0.4 : 0.15) * RATE)));
    const cents = 1200 * Math.log2(f / hz(t.root));
    assert.ok(Math.abs(cents) < 35, t.path + ': heard ' + f.toFixed(1) + ' Hz for ' + hz(t.root).toFixed(1) + ' Hz (' + cents.toFixed(0) + ' cents)');
  }
});

test('a note plays the nearest take, never more than 1.5 semitones away, in the layer its velocity calls for', () => {
  for (let m = 22; m <= 47; m++) { const k = bassTake(m); assert.ok(Math.abs(m - k.root) <= 1.5 + (m < 24 || m > 45 ? 2 : 0), 'bass ' + m); assert.ok(Math.abs(k.rate - 2 ** ((m - k.root) / 12)) < 1e-12); }
  assert.equal(bassTake(33, 0.9).layer, 'hard'); assert.equal(bassTake(33, 0.45).layer, 'soft'); assert.equal(bassTake(33, HARD).layer, 'hard');
  assert.ok(Math.abs(bassTake(33, 0.45).gain - 0.45 / BASS[33].soft) < 1e-12, 'the soft take is brought to its velocity'); assert.ok(bassTake(30, 0.69).gain <= 2.5, 'never more than 2.5 times');
  for (let m = 38; m <= 75; m++) { const k = guitarTake(m); assert.equal(k.kind, 'held'); assert.ok(Math.abs(m - k.root) <= 2, 'guitar ' + m); }
  assert.equal(guitarTake(44, { muted: true, n: 0 }).path, guitarPath(43, 'mute1')); assert.equal(guitarTake(44, { muted: true, n: 1 }).path, guitarPath(43, 'mute2'));
  assert.equal(guitarTake(44, { muted: true, n: 7 }).kind, 'mute2'); assert.equal(guitarTake(44, { muted: true, n: -1 }).kind, 'mute2');
  assert.equal(guitarTake(70, { muted: true }).kind, 'held', 'a mute above the muted range rings held');
  assert.ok(Math.abs(guitarTake(46, { muted: true, n: 0 }).gain * MUTE[46][0] - 1) < 1e-12, 'the two muted takes are evened out');
});

test('a heavy song names only takes on disk, and every part it plays is among them', () => {
  for (const ask of ['make a heavy metal song', 'an angry punk riff', 'a brutal djent breakdown']) {
    const p = arrange(ask), paths = stringsTakesFor(p);
    for (const path of paths) assert.ok(existsSync(fileOf(path)), ask + ': ' + path);
    for (const n of p.bass) assert.ok(paths.includes(bassTake(n.midi, n.soft ? 0.45 : 0.9).path), ask + ' bass ' + n.midi);
    for (const n of p.melody) assert.ok(paths.includes(guitarTake(n.midi).path), ask + ' lead ' + n.midi);
    for (const n of p.guitar) for (const m of n.open ? [n.midi, n.midi + 7, n.midi + 12] : [n.midi]) assert.ok(paths.includes(guitarTake(m, { muted: !n.open, n: 0 }).path) && paths.includes(guitarTake(m, { muted: !n.open, n: 1 }).path), ask + ' guitar ' + m);
    assert.ok(paths.length < ALL.length, ask + ': fetches ' + paths.length + ' of ' + ALL.length + ' takes, not all of them');
  }
});

test('the takes load once per page, and a take that will not load is tried again next time', async () => {
  const seen = []; let fail = true;
  const fetchFn = async (u) => { seen.push(u); if (u.includes('/bass/') && fail) return { ok: false, status: 503 }; return { ok: true, arrayBuffer: async () => u }; };
  const decode = async (b) => ({ decoded: b });
  const paths = [guitarPath(40, 'held'), bassPath(24, 'soft')];
  await assert.rejects(loadStrings(paths, { fetchFn, decode }), /503/);
  fail = false;
  const a = await loadStrings(paths, { fetchFn, decode }), b = await loadStrings(paths, { fetchFn, decode });
  assert.equal(a.buffers.get(paths[0]), b.buffers.get(paths[0]), 'the same decoded take is shared'); assert.deepEqual(a.buffers.get(paths[1]), { decoded: paths[1] });
  assert.equal(seen.filter((u) => u === paths[0]).length, 1, 'fetched once'); assert.equal(seen.filter((u) => u === paths[1]).length, 2, 'the failed take is fetched again');
});

test('both folders say where the sound comes from and under what license', () => {
  for (const f of ['bass', 'guitar']) {
    const c = readFileSync(resolve(ROOT, 'sounds', f, 'CREDITS.md'), 'utf8');
    assert.match(c, /Karoryfer Lecolds/); assert.match(c, /CC0 1\.0/); assert.match(c, /tools\/instruments\.py/); assert.match(c, /https:\/\/github\.com\/sfzinstruments\/karoryfer\./);
  }
});
