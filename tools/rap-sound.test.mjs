// How Verse's raps sound and look (owner, 2026-10-30: "improve verse spoken voice so it sound good rapping , also the beats are terrible it
// should also start making music videos for its songs"): the produced beat's events (lib/rap-beat.js), the voice cut, placed and stretched onto
// the grid (lib/rap-voice.js), the voice route (functions/api/rapvoice.js), the song's plan and mix (lib/rap-song.js), and what each picture of
// the music video shows (lib/rap-video.js). The sound itself is made by Web Audio in the browser; everything here is the arithmetic behind it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { settingsOf, beatFor, timingOf, fromLink, voiceText, STYLES } from '../void-live-deploy/lib/rap.js';
import { beatEvents, seventhOf, stepTime, SWING } from '../void-live-deploy/lib/rap-beat.js';
import { chunksOf, placeBar, stretch, buildVocal, fetchVoice, envelopeOf, splitBar } from '../void-live-deploy/lib/rap-voice.js';
import { planOf, mixStems, wavStereo, evenWords, RATE } from '../void-live-deploy/lib/rap-song.js';
import { fft, bandsOf, kickPulse, frameState, linesOf } from '../void-live-deploy/lib/rap-video.js';
import { RAP_LINK } from './tower-probes.mjs';

const SAMPLE = fromLink(RAP_LINK.split('?')[1]).rap;
const sine = (f, sec, rate, amp = 0.5) => Float32Array.from({ length: Math.round(sec * rate) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / rate));
// a spoken bar stand-in: `n` voiced bursts (a 180 Hz tone shaped like a syllable) with short quiet gaps between them
function bursts(n, rate, on = 0.16, off = 0.06, lead = 0.1) {
  const out = new Float32Array(Math.round((lead * 2 + n * (on + off)) * rate));
  for (let k = 0; k < n; k++) { const a = Math.round((lead + k * (on + off)) * rate), m = Math.round(on * rate); for (let i = 0; i < m; i++) out[a + i] = 0.4 * Math.sin(Math.PI * i / m) * Math.sin(2 * Math.PI * 180 * i / rate); }
  return out;
}
const crossings = (x) => { let c = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) c++; return c; };

test('the beat: sorted events, swing on the off 16ths, an intro without kicks and an outro of music alone', () => {
  for (const style of Object.keys(STYLES)) {
    const s = settingsOf({ topic: 'pizza', style }), beat = beatFor(s), p = beatEvents(beat, { measures: 6 });
    assert.equal(p.swing, SWING[style] || 0.5, style);
    for (let i = 1; i < p.events.length; i++) assert.ok(p.events[i].t >= p.events[i - 1].t, style + ': events in time order');
    const inMeasure = (e, m) => e.t >= m * p.measure - 0.01 && e.t < (m + 1) * p.measure - 0.01;
    assert.ok(!p.events.some((e) => inMeasure(e, 0) && /kick|snare|clap|808|sub/.test(e.kind)), style + ': the intro has no kick, snare or bass');
    assert.ok(p.events.some((e) => inMeasure(e, 0) && e.kind === 'hat'), style + ': the intro has hats');
    assert.ok(p.events.every((e) => !inMeasure(e, 5) || /keys|pad|bell|pluck/.test(e.kind)), style + ': the outro is the music alone');
    assert.ok(p.events.some((e) => e.kind === 'crash' && inMeasure(e, 1)), style + ': a crash where the rap starts');
    assert.deepEqual(p.kicks, p.events.filter((e) => e.kind === 'kick').map((e) => e.t));
    const eight = p.events.some((e) => e.kind === '808'), sub = p.events.some((e) => e.kind === 'sub');
    assert.equal(eight, ['trap', 'drill', 'melodic'].includes(style), style + ': 808 only for trap, drill and melodic');
    assert.equal(sub, !eight, style + ': a sub bass otherwise');
    for (const e of p.events.filter((x) => x.kind === '808')) assert.ok(e.midi >= 28 && e.midi <= 39, '808 in its octave');
  }
  assert.equal(stepTime(2, 0.1, 0.58), 0.2, 'an on 16th is not moved'); assert.ok(Math.abs(stepTime(1, 0.1, 0.58) - 0.116) < 1e-9, 'an off 16th is late by the swing');
  const trap = beatEvents(beatFor(settingsOf({ topic: 'pizza', style: 'trap' })), { measures: 4 });
  const lastBeat = trap.events.filter((e) => e.kind === 'hat' && e.t >= trap.measure + 12 * trap.sp - 1e-6 && e.t < 2 * trap.measure - 1e-6);
  assert.ok(lastBeat.length >= 7, 'a trap roll on the last beat of an odd measure');
});

test('chords are sevenths with a ninth, from the piece\'s own scale', () => {
  const beat = beatFor(settingsOf({ topic: 'pizza' })), t = seventhOf(beat, beat.chords[0]);
  assert.equal(t.length, 5); assert.equal(t[0], beat.chords[0].root);
  for (let i = 1; i < 5; i++) assert.ok(t[i] > t[i - 1], 'stacked upward');
});

test('the voice is cut at its dips, one cut per syllable boundary, the silence at both ends left out', () => {
  const rate = 16000, x = bursts(5, rate), cut = chunksOf(x, rate, 5);
  assert.equal(cut.length, 6, 'five syllables found');
  for (let k = 1; k < 5; k++) { const expect = (0.1 + k * 0.22 - 0.03) * rate; assert.ok(Math.abs(cut[k] - expect) < 0.04 * rate, 'cut ' + k + ' in the gap'); }
  assert.ok(cut[0] > 0.05 * rate && cut[5] < x.length, 'the lead silence is left out');
  assert.ok(chunksOf(x, rate, 3).length <= 4, 'never more pieces than asked');
  assert.equal(chunksOf(new Float32Array(rate), rate, 4), null, 'silence has no syllables');
  assert.ok(envelopeOf(x, rate).env.length > 100);
});

test('syllables are placed on the grid: in order, inside the bar, the last on the snare', () => {
  for (const nat of [[0, 0.2, 0.35, 0.6, 0.8, 1.1, 1.3, 1.5, 1.8, 2.0], [0, 0.1, 0.2], [0], Array.from({ length: 20 }, (_, i) => i * 0.1)]) {
    const s = placeBar(nat, { end: 12, slotSec: 0.17 });
    assert.equal(s.length, nat.length); assert.equal(s[s.length - 1], 12, 'the rhyme lands on beat 4');
    for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], 'in order');
    assert.ok(s[0] >= 0, 'inside the bar');
  }
  const sixteenths = placeBar([0, 0.2, 0.4, 0.6], { end: 12, slotSec: 0.17 }); assert.ok(sixteenths.every(Number.isInteger), 'a roomy bar sits on 16ths');
  assert.ok(placeBar(Array.from({ length: 20 }, (_, i) => i * 0.1), { end: 12 }).some((x) => !Number.isInteger(x)), 'a packed bar goes to 32nds');
  assert.equal(placeBar([0, 0.1], { end: 4 })[1], 4, 'a double-time bar ends on its own snare');
});

test('stretching keeps the pitch and changes the length', () => {
  const rate = 16000, x = sine(200, 0.5, rate);
  for (const ratio of [0.7, 1.25]) {
    const y = stretch(x, ratio, rate);
    assert.equal(y.length, Math.round(x.length * ratio));
    const f = crossings(y.subarray(400, y.length - 400)) / 2 / ((y.length - 800) / rate);
    assert.ok(Math.abs(f - 200) < 12, 'still 200 Hz at ' + ratio + ' (got ' + f.toFixed(1) + ')');
  }
  assert.equal(stretch(new Float32Array(10), 2, rate).length, 20, 'a short sound is resampled');
});

test('a whole vocal is built on the beat: each bar starts on its measure, the rhyme is doubled, the words get times', () => {
  const s = settingsOf({ topic: 'pizza' }), plan = planOf(SAMPLE, s), rate = 16000;
  const clips = plan.timing.map((b, i) => (i === 3 ? null : bursts(Math.max(2, Math.min(10, voiceText(b.text).split(' ').length)), rate)));
  const v = buildVocal(clips, plan.timing, plan.beat, 'steady', rate, plan.seconds);
  assert.equal(v.voiced, plan.timing.length - 1, 'a bar with no voice stays silent');
  assert.equal(v.main.length, Math.ceil(plan.seconds * rate));
  for (const b of v.bars) { const t = plan.timing.find((x) => x.bar === b.bar); assert.ok(b.at[0] >= t.at - 1e-6 && b.at[b.at.length - 1] <= t.at + t.len, 'bar ' + b.bar + ' inside its measure'); }
  const sum = (a, from, to) => { let q = 0; for (let i = Math.round(from * rate); i < Math.round(to * rate); i++) q += Math.abs(a[i]); return q; };
  assert.equal(sum(v.main, 0, plan.timing[0].at - 0.01), 0, 'nothing in the count-in');
  assert.ok(sum(v.dub, 0, plan.seconds) > 0 && sum(v.dub, 0, plan.seconds) < sum(v.main, 0, plan.seconds) / 2, 'the double is the rhyme words only');
  const t3 = plan.timing[3]; assert.equal(sum(v.main, t3.at + 0.3, t3.at + t3.len - 0.3), 0, 'the silent bar');
  assert.ok(v.words.every((w, i) => i === 0 || w.bar !== v.words[i - 1].bar || w.at >= v.words[i - 1].at), 'words in order within a bar');
  assert.equal(evenWords(plan.timing).length, plan.timing.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0));
});

test('ad-libs come off the main line: what is rapped, what is shouted behind it, and where each lands', () => {
  const a = splitBar('Pull up to the spot [skrrt] and the night is mine (yeah, yeah)');
  assert.equal(a.main, 'Pull up to the spot and the night is mine');
  assert.deepEqual(a.adlibs, [{ text: 'skrrt', at: 5 }, { text: 'yeah, yeah', at: 10 }], 'one inside the bar lands with the word after it, one at the end after the last word');
  assert.deepEqual(a.tokens.map((t) => t.adlib), [-1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, 1, 1]);
  assert.deepEqual(splitBar('[yeah yeah yeah]').adlibs, [], 'a bar that is all ad-lib is rapped as it is'); assert.equal(splitBar('[yeah yeah yeah]').main, '[yeah yeah yeah]');
  assert.deepEqual(splitBar('no ad-libs here').adlibs, []); assert.deepEqual(splitBar('a bar [!!]').adlibs, [], 'an ad-lib with nothing to say is not one');
  // on the beat: the ad-lib is on its own track, not in the main vocal, after the rhyme, and its words are lit in order with the rest
  const s = settingsOf({ topic: 'pizza', style: 'trap' }), r = { title: 'T', sections: [{ name: 'Verse 1', bars: Array.from({ length: 8 }, (_, i) => (i === 2 ? 'Pull up to the spot and the night is mine [skrrt]' : SAMPLE.sections[0].bars[i])) }] };
  const plan = planOf(r, s), rate = 16000, clips = plan.timing.map((b) => bursts(Math.max(2, Math.min(10, voiceText(splitBar(b.text).main).split(' ').length)), rate));
  const lib = bursts(1, rate), v = buildVocal(clips, plan.timing, plan.beat, 'steady', rate, plan.seconds, plan.timing.map((_, i) => (i === 2 ? [lib] : [])));
  const sum = (x, from, to) => { let q = 0; for (let i = Math.max(0, Math.round(from * rate)); i < Math.min(x.length, Math.round(to * rate)); i++) q += Math.abs(x[i]); return q; };
  const b2 = plan.timing[2], last = v.bars.find((b) => b.bar === 2).at.slice(-1)[0];
  assert.ok(sum(v.adlib, 0, plan.seconds) > 0, 'the ad-lib is on its track'); assert.equal(sum(v.adlib, 0, b2.at), 0, 'and nowhere before its bar');
  assert.equal(sum(v.adlib, b2.at, last + 1e-3), 0, 'it comes after the rhyme lands');
  const w2 = v.words.filter((w) => w.bar === 2); assert.equal(w2.length, 11, 'every word as written has a time'); assert.ok(w2.every((w, i) => i === 0 || w.at >= w2[i - 1].at), 'in order');
});

test('the voice is fetched bar by bar, and a resting voice stops the asking', async () => {
  const asked = [];
  const ok = await fetchVoice(['first bar here', 'second (yeah) bar', '', 'third bar [yeah]'], { fetchFn: async (u) => { asked.push(u); return new Response(new Uint8Array([1, 2, 3])); }, decode: async (b) => new Float32Array(b.byteLength), concurrency: 1 });
  // an ad-lib is not said inside the bar: it is asked on its own, once for the whole song however often it comes
  assert.equal(asked.length, 4, 'an empty bar is not asked, a repeated ad-lib is asked once');
  assert.match(asked[1], /^\/api\/rapvoice\?t=second%20bar$/); assert.match(asked[2], /^\/api\/rapvoice\?t=yeah$/); assert.match(asked[3], /^\/api\/rapvoice\?t=third%20bar$/);
  assert.equal(ok.clips[0].length, 3); assert.equal(ok.clips[2], null); assert.equal(ok.note, '3 of 4 bars came back');
  assert.equal(ok.adlibClips[1].length, 1); assert.equal(ok.adlibClips[3][0], ok.adlibClips[1][0], 'the same ad-lib, the same sound'); assert.equal(ok.adlibClips[0].length, 0);
  let n = 0;
  const off = await fetchVoice(['a b', 'c d', 'e f', 'g h'], { fetchFn: async () => { n++; return Response.json({ note: 'voice resting' }, { status: 503 }); }, decode: async () => new Float32Array(1), concurrency: 1 });
  assert.equal(n, 1, 'one refusal is enough'); assert.equal(off.note, 'voice resting');
  assert.equal(voiceText('Yo, it’s [bad] & “good”, ok'), "Yo, it's bad and good, ok");
});

test('the voice route: cleaned bars only, cached for everyone, capped per day, and honest when the model is off or fails', async () => {
  const { onRequestGet, audioOf, VOICE_PER_DAY } = await import('../void-live-deploy/functions/api/rapvoice.js');
  const store = new Map(); globalThis.caches = { default: { match: async (r) => { const h = store.get(r.url); return h ? h.clone() : undefined; }, put: async (r, res) => { store.set(r.url, res.clone()); } } };
  const db = new DatabaseSync(':memory:'), stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  let calls = 0; const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
  const env = { DB: { prepare: (sql) => stmt(sql) }, AI: { run: async (m, o) => { calls++; assert.equal(m, '@cf/myshell-ai/melotts'); assert.equal(o.lang, 'en'); return { audio: Buffer.from(mp3).toString('base64') }; } } };
  const get = (q, e = env) => onRequestGet({ request: new Request('https://a-to-mind.com/api/rapvoice?t=' + encodeURIComponent(q)), env: e });
  try {
    assert.equal((await get('')).status, 400); assert.equal((await get('   ')).status, 400);
    const a = await get('Pizza in the oven, cheese on top'); assert.equal(a.status, 200); assert.equal(a.headers.get('content-type'), 'audio/mpeg'); assert.deepEqual(new Uint8Array(await a.arrayBuffer()), mp3); assert.equal(calls, 1);
    const b = await get('Pizza in the oven, cheese on top'); assert.equal(b.headers.get('x-verse-voice'), 'cached'); assert.equal(calls, 1, 'a bar said once is not asked again');
    assert.equal((await get('another bar', { ...env, VOID_ANSWER_MODELS: 'off' })).status, 503);
    const fail = await get('a bar that fails', { ...env, AI: { run: async () => { throw new Error('boom'); } } }); assert.equal(fail.status, 503); assert.equal((await fail.json()).note, 'voice busy');
    assert.ok(VOICE_PER_DAY > 0 && VOICE_PER_DAY * 0.05 < 10000 * 0.5, 'a day of voice stays well inside the free allowance');
    assert.equal((await audioOf(new Uint8Array([1]))).length, 1); assert.equal(await audioOf(null), null); assert.equal(await audioOf({ audio: '' }), null);
  } finally { delete globalThis.caches; }
});

test('the song: its plan covers every bar and the tail, the mix never clips, the WAV is stereo', () => {
  const s = settingsOf({ topic: 'pizza', style: 'trap' }), plan = planOf(SAMPLE, s);
  const last = plan.timing[plan.timing.length - 1]; assert.ok(plan.measures * plan.measure >= last.at + last.len, 'every bar inside the song');
  assert.ok(plan.seconds > plan.measures * plan.measure);
  const n = 4800, loud = [Float32Array.from({ length: n }, () => 0.9), Float32Array.from({ length: n }, () => -0.9)], vox = [Float32Array.from({ length: n }, () => 0.8), Float32Array.from({ length: n }, () => -0.8)];
  const [L, R] = mixStems(loud, vox); assert.ok(L.every((x) => x <= 1 && x > 0) && R.every((x) => x >= -1 && x < 0), 'under full scale');
  const [l2] = mixStems(loud, null, { beatLevel: 0.5 }); assert.ok(Math.abs(l2[0] - 0.45) < 1e-6, 'a quiet mix is left as it is');
  const w = wavStereo(L, R, RATE), v = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.subarray(0, 4)), 'RIFF'); assert.equal(v.getUint16(22, true), 2, 'two channels'); assert.equal(v.getUint32(24, true), 48000); assert.equal(w.length, 44 + n * 4);
});

test('the music video: a title through the count-in, each bar with its words lit in time, an end card, a spectrum that hears the song', () => {
  const s = settingsOf({ topic: 'pizza' }), plan = planOf(SAMPLE, s), words = evenWords(plan.timing), t0 = plan.timing[0];
  assert.equal(frameState(plan.timing, words, plan.seconds, 0).phase, 'title');
  // just before the first bar starts (inside the 50 ms lead), the picture is still the title: there is no bar yet to draw (the live crash of 2026-10-30)
  const lead = frameState(plan.timing, words, plan.seconds, t0.at - 0.02); assert.equal(lead.phase, 'title'); assert.equal(lead.bar, -1);
  for (let t = 0; t < plan.seconds; t += 1 / 30) { const f = frameState(plan.timing, words, plan.seconds, t); assert.ok(f.phase !== 'bar' || plan.timing[f.bar], 'a bar frame at ' + t.toFixed(3) + ' s has a bar'); }
  const mid = frameState(plan.timing, words, plan.seconds, t0.at + t0.len / 2); assert.equal(mid.phase, 'bar'); assert.equal(mid.bar, 0); assert.ok(mid.lit > 0 && mid.lit < t0.text.split(' ').length + 1);
  const b5 = plan.timing[5]; assert.equal(frameState(plan.timing, words, plan.seconds, b5.at + 0.01).bar, 5);
  assert.equal(frameState(plan.timing, words, plan.seconds, plan.seconds - 0.1).phase, 'outro');
  assert.equal(frameState(plan.timing, words, plan.seconds, plan.seconds).progress, 1);
  const re = new Float64Array(8).fill(0), im = new Float64Array(8); re[0] = 1; fft(re, im); assert.ok(Array.from(re).every((x) => Math.abs(x - 1) < 1e-12), 'an impulse is flat');
  const x = sine(1000, 0.2, RATE), bands = bandsOf(x, x, RATE, 0.1), top = bands.indexOf(Math.max(...bands)), f0 = Math.exp(Math.log(40) + (Math.log(12000) - Math.log(40)) * top / bands.length);
  assert.ok(f0 > 600 && f0 < 1300, 'a 1 kHz tone lights the 1 kHz band (' + f0.toFixed(0) + ')');
  assert.ok(Math.max(...bandsOf(new Float32Array(RATE), new Float32Array(RATE), RATE, 0.5)) === 0, 'silence is dark');
  assert.equal(kickPulse([1, 2], 0.5), 0); assert.ok(kickPulse([1, 2], 1.01) > 0.9); assert.ok(kickPulse([1, 2], 1.5) < 0.02);
  const lines = linesOf(['aaa', 'bb', 'cccc', 'd'], (w) => w.length * 10, 60, 10); assert.deepEqual(lines.map((l) => l.map((w) => w.w)), [['aaa', 'bb'], ['cccc', 'd']]);
});

test('the rap page says what it does now, and hands its video on', async () => {
  const fs = await import('node:fs'), rd = (f) => fs.readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
  const page = rd('rap/index.html');
  assert.match(page, /<meta name="verse-handoff" content="in: text; out: text, music, video">/);
  assert.match(page, /music video/i); assert.match(page, /Verse's own voice/);
  const stage = rd('lib/rap-stage.js'); for (const b of ["'Save the song'", "'Make the video'", "'Voice: Verse'"]) assert.ok(stage.includes(b), b);
  const { TYPES } = await import('./handoff-scan.mjs'); assert.ok(TYPES.video > 0, 'a video is a type a page can hand on');
});
