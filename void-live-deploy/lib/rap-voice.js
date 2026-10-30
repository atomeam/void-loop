// Verse's voice on the beat (owner, 2026-10-30: "improve verse spoken voice so it sound good rapping"). Each bar is said by a real speech model
// (functions/api/rapvoice.js, MeloTTS) and comes back as plain speech at its own pace. Here it is made to rap:
//   1. cut into syllables: the speech's loudness is followed in 5 ms steps and cut at its deepest dips, as many cuts as the bar has syllables
//   2. placed on the grid: the syllables keep the order and the shape of the spoken rhythm, but each one starts on a 16th of the beat (a 32nd
//      when the bar is packed), with the beat's own swing, and the bar's last syllable, its rhyme, lands on the snare (beat 4; beat 2 or 4 for
//      a double-time bar, which takes half a measure)
//   3. stretched to fit: each syllable is made longer or shorter to reach the next one without changing its pitch (WSOLA: overlapped windows,
//      each placed where it best continues the last), never past 0.6 to 1.3 times, so the voice stays a voice
//   4. given weight: syllables on the snare and on the beat are louder, the rhyme loudest, and the rhyme is doubled (the ad-lib track a rapper
//      records on the end word), for lib/rap-song.js to pan left and right
//   5. ad-libs on their own track: words in brackets or parentheses ("[skrrt]", "(yeah)") are not rapped in the main line. Each is said on its
//      own and put on a quieter, panned ad-lib track: one in the middle of a bar lands with the word after it, one at the end answers the rhyme
// Everything here is pure arithmetic on Float32Arrays (tested in tools/rap-sound.test.mjs) but fetchVoice(), which asks the route for the bars.
import { voiceText, barSyllables, syllablesOf } from './rap.js';
import { SWING } from './rap-beat.js';

export const VOICE_URL = '/api/rapvoice';
const SPEED = { steady: 0.92, double: 0.8, laid: 1 }; // how much faster than it was spoken a bar is rapped: rap is quicker than talk

/** the loudness of a sound in steps of `hop` seconds: { env, hop (samples) }. Pure. */
export function envelopeOf(x, rate, hop = 0.005, win = 0.02) {
  const h = Math.max(1, Math.round(rate * hop)), half = Math.max(1, Math.round(rate * win / 2)), n = Math.max(1, Math.ceil(x.length / h)), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { const c = i * h, a = Math.max(0, c - half), b = Math.min(x.length, c + half); let s = 0; for (let j = a; j < b; j++) s += x[j] * x[j]; env[i] = Math.sqrt(s / Math.max(1, b - a)); }
  return { env, hop: h };
}

/** a spoken bar cut into `want` syllables (fewer when the speech has fewer dips): [from, cut, cut, ..., to] in samples, the silence at both
 *  ends left out; null for silence. Pure. */
export function chunksOf(x, rate, want) {
  const { env, hop } = envelopeOf(x, rate); let peak = 0; for (let i = 0; i < env.length; i++) if (env[i] > peak) peak = env[i];
  if (!(peak > 1e-4)) return null;
  let a = 0, b = env.length - 1; const on = peak * 0.06;
  while (a < b && env[a] < on) a++; while (b > a && env[b] < on) b--;
  const from = Math.max(0, a * hop - Math.round(rate * 0.01)), to = Math.min(x.length, (b + 1) * hop + Math.round(rate * 0.04));
  const gap = Math.max(2, Math.round(0.07 * rate / hop)), span = Math.max(3, Math.round(0.12 * rate / hop)), cands = [];
  for (let i = a + 2; i < b - 1; i++) {
    if (!(env[i] <= env[i - 1] && env[i] <= env[i + 1] && env[i] <= env[i - 2] && env[i] <= env[i + 2])) continue;
    let l = 0, r = 0; for (let j = Math.max(a, i - span); j < i; j++) l = Math.max(l, env[j]); for (let j = i + 1; j <= Math.min(b, i + span); j++) r = Math.max(r, env[j]);
    const score = (Math.min(l, r) - env[i]) / peak; if (score > 0.05) cands.push({ i, score });
  }
  cands.sort((p, q) => q.score - p.score);
  const picked = [];
  for (const c of cands) { if (picked.length >= Math.max(0, want - 1)) break; if (c.i - a < gap / 2 || b - c.i < gap / 2) continue; if (picked.every((p) => Math.abs(p - c.i) >= gap)) picked.push(c.i); }
  picked.sort((p, q) => p - q);
  return [from, ...picked.map((i) => Math.max(from + 1, Math.min(to - 1, i * hop))), to];
}

/** the grid slot each syllable starts on, from where it started when spoken (`nat`, seconds from the first): the last lands on `end`; the others
 *  keep the spoken shape, on 16ths (32nds when packed, an even spread past that), in order, all inside the bar. Pure. */
export function placeBar(nat, { end = 12, slotSec = 0.17, speed = 0.92 } = {}) {
  const k = nat.length; if (!k) return []; if (k === 1) return [end];
  const span = nat[k - 1] - nat[0];
  let g = 1; if (k - 1 > end) g = 0.5; if ((k - 1) * g > end) g = end / (k - 1);
  const first = Math.max(0, Math.min(end - (k - 1) * g, end - (span * speed) / slotSec)), out = []; let prev = -Infinity;
  for (let i = 0; i < k; i++) {
    const ideal = i === k - 1 ? end : first + (span > 0 ? (nat[i] - nat[0]) / span : i / (k - 1)) * (end - first);
    let s = Math.round(ideal / g) * g; s = Math.max(s, prev + g); s = Math.min(s, end - (k - 1 - i) * g);
    s = Math.round(s * 1e6) / 1e6; out.push(s); prev = s;
  }
  return out;
}

/** a sound made `ratio` times as long without changing its pitch (WSOLA, `win` second windows, 30 ms unless asked). Short or nearly
 *  unchanged sounds are resampled. Pure. */
export function stretch(x, ratio, rate, win = 0.03) {
  const n = x.length, outLen = Math.max(1, Math.round(n * ratio)), N = Math.max(64, Math.round(rate * win) & ~1);
  if (n < N * 2 || Math.abs(ratio - 1) < 0.03) { const y = new Float32Array(outLen); for (let i = 0; i < outLen; i++) { const p = i * (n - 1) / Math.max(1, outLen - 1), j = Math.floor(p), f = p - j; y[i] = (x[j] || 0) * (1 - f) + (x[Math.min(n - 1, j + 1)] || 0) * f; } return y; }
  const Hs = N >> 1, Ha = Hs / ratio, tol = Math.round(rate * 0.008), w = new Float32Array(N); for (let j = 0; j < N; j++) w[j] = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / N);
  const out = new Float32Array(outLen + N), norm = new Float32Array(outLen + N); let prev = 0;
  for (let m = 0; m * Hs < outLen; m++) {
    let pos = Math.round(m * Ha);
    if (m > 0) {
      const nat = Math.min(n - Hs, prev + Hs), lo = Math.max(0, pos - tol), hi = Math.min(n - N, pos + tol); let best = Math.max(0, Math.min(n - N, pos)), bc = -Infinity;
      for (let q = lo; q <= hi; q += 2) { let c = 0; for (let j = 0; j < Hs; j += 4) c += x[q + j] * x[nat + j]; if (c > bc) { bc = c; best = q; } }
      pos = best;
    }
    pos = Math.max(0, Math.min(n - N, pos));
    const o = m * Hs; for (let j = 0; j < N; j++) { out[o + j] += x[pos + j] * w[j]; norm[o + j] += w[j]; }
    prev = pos;
  }
  const y = new Float32Array(outLen); for (let i = 0; i < outLen; i++) y[i] = norm[i] > 1e-3 ? out[i] / norm[i] : out[i];
  return y;
}

/** `x` resampled to `n` samples (linear). Pure. */
export function resample(x, n) {
  const y = new Float32Array(n), m = x.length;
  for (let i = 0; i < n; i++) { const p = i * (m - 1) / Math.max(1, n - 1), j = Math.floor(p), f = p - j; y[i] = (x[j] || 0) * (1 - f) + (x[Math.min(m - 1, j + 1)] || 0) * f; }
  return y;
}

/** `x` moved `semis` semitones up or down, the same length and in time with it: stretched by the pitch ratio, then resampled back. Going
 *  down, the resample widens the stretch's windows by the same ratio, so they start that much narrower and a syllable's attack stays sharp. Pure. */
export function pitchShift(x, semis, rate) {
  if (!semis) return Float32Array.from(x);
  const f = 2 ** (semis / 12);
  return resample(stretch(x, f, rate, 0.03 * Math.min(1, f)), x.length);
}

/** the pitch of the loudest 60 ms of `x` in Hz (YIN), or null when nothing in [lo, hi] is clearly pitched. Pure. */
export function pitchOf(x, rate, { lo = 70, hi = 500 } = {}) {
  const N = Math.min(x.length, Math.round(rate * 0.06)), hop = Math.round(rate * 0.01); if (N < (rate / lo) * 2) return null;
  let e = 0, at = 0; for (let i = 0; i + N <= x.length; i += hop) { let s = 0; for (let j = i; j < i + N; j += 4) s += x[j] * x[j]; if (s > e) { e = s; at = i; } }
  const seg = x.subarray(at, at + N), tMin = Math.floor(rate / hi), tMax = Math.min(Math.floor(rate / lo), N >> 1), W = N - tMax;
  const cm = new Float32Array(tMax + 2); cm[0] = 1; let run = 0;
  for (let t = 1; t <= tMax + 1; t++) { let d = 0; for (let j = 0; j < W; j++) { const q = seg[j] - seg[j + t]; d += q * q; } run += d; cm[t] = run ? (d * t) / run : 1; }
  let T = -1; for (let t = tMin; t <= tMax; t++) if (cm[t] < 0.15) { while (t + 1 <= tMax && cm[t + 1] < cm[t]) t++; T = t; break; }
  if (T < 0) { let m = Infinity; for (let t = tMin; t <= tMax; t++) if (cm[t] < m) { m = cm[t]; T = t; } if (m > 0.4) return null; }
  const a = cm[T - 1], b = cm[T], c = cm[T + 1] ?? b, den = a - 2 * b + c;
  return rate / (T + (den > 0 ? (0.5 * (a - c)) / den : 0));
}

/** Verse's signature (owner, 2026-10-30: "verse can have a good sounding distinct haunting voice"): the lead an octave down (the shadow under
 *  every word) and an octave up (the ghost in the hall), both in time with it. Built from Verse's own synthetic voice, never anyone else's. Pure. */
export function shadowsOf(x, rate) {
  return { low: pitchShift(x, -12, rate), halo: pitchShift(x, 12, rate) };
}

const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); };
const swingOf = (slot, slotSec, swing) => (Number.isInteger(slot) && slot % 2 === 1 ? (swing - 0.5) * 2 * slotSec : 0);

/** a bar split into what is rapped and its ad-libs: { main, adlibs: [{ text, at (index of the bar's main word it lands with; the main word
 *  count when it ends the bar) }], tokens: [{ w, adlib (index into adlibs, or -1) }] }. The ad-libs are the words in brackets or parentheses.
 *  A bar that is all ad-lib is rapped as it is, with no ad-libs. Pure. */
export function splitBar(bar) {
  const t = String(bar || ''), tokens = [], adlibs = []; let main = 0, open = -1;
  for (const w of t.split(/\s+/).filter(Boolean)) {
    const starts = /^[[(]/.test(w);
    if (open < 0 && starts) { adlibs.push({ text: '', at: main }); open = adlibs.length - 1; }
    if (open >= 0) { tokens.push({ w, adlib: open }); adlibs[open].text += (adlibs[open].text ? ' ' : '') + w.replace(/[[\]()]/g, ''); if (/[\])][^A-Za-z0-9]*$/.test(w)) open = -1; continue; }
    tokens.push({ w, adlib: -1 }); if (voiceText(w)) main++;
  }
  const said = adlibs.filter((a) => voiceText(a.text));
  if (!main || !said.length) return { main: t, adlibs: [], tokens: tokens.map((k) => ({ w: k.w, adlib: -1 })) };
  const keep = adlibs.map((a) => (voiceText(a.text) ? said.indexOf(a) : -1));
  return { main: tokens.filter((k) => k.adlib < 0).map((k) => k.w).join(' '), adlibs: said, tokens: tokens.map((k) => ({ w: k.w, adlib: k.adlib < 0 ? -1 : keep[k.adlib] })) };
}

/** where a spoken bar really ends: the last moment its loudness is above 1.5% of its peak, and 80 ms more. The cut for syllables stops at 6%,
 *  which drops the quiet end of a last word (an "s", a "t", a breath out) and is heard as the voice cutting off. Never before `from`. Pure. */
export function endOf(x, rate, from = 0) {
  const { env, hop } = envelopeOf(x, rate); let peak = 0; for (let i = 0; i < env.length; i++) if (env[i] > peak) peak = env[i];
  let b = env.length - 1; while (b > 0 && env[b] < peak * 0.015) b--;
  return Math.min(x.length, Math.max(from, (b + 1) * hop + Math.round(rate * 0.08)));
}

/** the rap's vocal: every spoken bar (clips[i], mono at `rate`, or null) cut, placed and stretched onto the beat at timing[i] (lib/rap.js timingOf),
 *  and its ad-libs (adlibClips[i][j], said on their own, splitBar order) on their own track. Returns { main, dub (the doubled rhyme words),
 *  adlib (the ad-lib track), words: [{ bar, i (the word's place in the bar as written), at }], bars: [{ bar, at: [syllable starts] }], voiced }. Pure. */
export function buildVocal(clips, timing, beat, flow, rate, seconds, adlibClips = []) {
  const len = Math.ceil(seconds * rate), main = new Float32Array(len), dub = new Float32Array(len), adlib = new Float32Array(len), words = [], bars = [];
  const slotSec = 60 / beat.bpm / 4, swing = beat.swing ?? (SWING[beat.rapStyle] || 0.5), dbl = flow === 'double', end = dbl ? 4 : 12, speed = SPEED[flow] || SPEED.steady;
  const snares = new Set((beat.drums.snare || []).map((s) => s % 16));
  let voiced = 0;
  timing.forEach((b, bi) => {
    const clip = clips[bi]; if (!clip || !clip.length) return;
    const sp = splitBar(b.text), text = voiceText(sp.main), want = Math.max(1, Math.min(32, barSyllables(text))), cut = chunksOf(clip, rate, want); if (!cut) return;
    const level = rms(clip.subarray(cut[0], cut[cut.length - 1])), lift = level > 1e-4 ? Math.min(8, 0.12 / level) : 1;
    const k = cut.length - 1, nat = cut.slice(0, k).map((c) => (c - cut[0]) / rate), slots = placeBar(nat, { end, slotSec, speed });
    const grid = slots.map((s) => b.at + s * slotSec + swingOf(s, slotSec, swing)), offset = dbl ? (b.bar % 2) * 8 : 0;
    const f = k > 1 && nat[k - 1] > 0 ? Math.max(0.5, Math.min(1.5, (grid[k - 1] - grid[0]) / nat[k - 1])) : 1;
    // The voice is warped, not chopped: the syllables that land on a beat (and the first and the rhyme) are anchors on the grid, and the
    // speech between two anchors is stretched as one piece to fill the gap. No syllable is cut short, every join is a crossfade of the same
    // continuous speech, and the bar's last word rings out to its natural end (owner, 2026-10-30: "the voice cuts off").
    const anchors = [0]; for (let i = 1; i < k - 1; i++) if (Number.isInteger(slots[i]) && slots[i] % 4 === 0 && grid[i] - grid[anchors[anchors.length - 1]] >= slotSec * 1.5) anchors.push(i); if (k > 1) anchors.push(k - 1);
    const E = Math.round(rate * 0.008), at = new Array(k).fill(0), tailEnd = endOf(clip, rate, cut[k]);
    const room = Math.max(0.12, b.at + b.len + 0.3 - grid[k - 1]), segs = [];
    for (let q = 0; q < anchors.length; q++) {
      const a = anchors[q], last = q === anchors.length - 1, s0 = cut[a], s1 = last ? tailEnd : cut[anchors[q + 1]], srcLen = (s1 - s0) / rate;
      const want = last ? Math.min(srcLen * Math.max(0.85, Math.min(1.15, f)), room) : grid[anchors[q + 1]] - grid[a];
      const ratio = Math.max(0.55, Math.min(1.8, want / Math.max(1e-3, srcLen)));
      for (let i = a; i < (last ? k : anchors[q + 1]); i++) at[i] = grid[a] + (cut[i] - s0) / rate * ratio;
      segs.push({ a, last, s0, s1, ratio });
    }
    const gainAt = (t) => { let i = 0; while (i < k - 1 && at[i + 1] <= t) i++; const abs = (offset + Math.round(slots[i])) % 16; return i === k - 1 ? 1.3 : snares.has(abs) && Number.isInteger(slots[i]) ? 1.22 : abs % 4 === 0 && Number.isInteger(slots[i]) ? 1.12 : 1; };
    for (const sg of segs) {
      const pre = sg.a === 0 ? 0 : Math.min(E, sg.s0), post = sg.last ? 0 : Math.min(E, clip.length - sg.s1);
      const y = stretch(clip.subarray(sg.s0 - pre, sg.s1 + post), sg.ratio, rate), lead = Math.round(pre * sg.ratio), o = Math.round(grid[sg.a] * rate) - lead;
      const fin = sg.a === 0 ? Math.min(y.length, Math.round(rate * 0.003)) : Math.max(1, 2 * lead), fout = sg.last ? Math.min(y.length, Math.round(rate * 0.04)) : Math.max(1, 2 * Math.round(post * sg.ratio));
      const fadeIn = (j) => (j < fin ? 0.5 - 0.5 * Math.cos(Math.PI * j / fin) : 1), fadeOut = (j) => (j >= y.length - fout ? 0.5 - 0.5 * Math.cos(Math.PI * (y.length - j) / fout) : 1);
      const rhymeFrom = Math.round(at[k - 1] * rate);
      for (let j = 0; j < y.length && o + j < len; j++) {
        if (o + j < 0) continue;
        const v = y[j] * lift * gainAt((o + j) / rate) * fadeIn(j) * fadeOut(j);
        main[o + j] += v; if (o + j >= rhymeFrom) dub[o + j] += v;
      }
    }
    // each word lights when its first syllable starts: the word's place among the bar's syllables, spread over the syllables found
    const ws = text.split(' ').filter(Boolean), syl = ws.map((w) => Math.max(1, syllablesOf(w))), total = syl.reduce((p, q) => p + q, 0); let before = 0;
    const wordAt = ws.map((w, wi) => { const t = at[Math.min(k - 1, Math.floor(before / total * k))]; before += syl[wi]; return t; });
    // the ad-libs: one inside the bar comes in with the main word after it, one at the end answers the rhyme two 16ths after it lands
    const tail = Math.min(at[k - 1] + 2 * slotSec, b.at + b.len - 0.12), libAt = sp.adlibs.map((a) => (a.at < wordAt.length ? wordAt[a.at] : tail));
    sp.adlibs.forEach((a, j) => {
      const clip2 = (adlibClips[bi] || [])[j]; if (!clip2 || !clip2.length) return;
      const lv = rms(clip2), g = (lv > 1e-4 ? Math.min(8, 0.12 / lv) : 1) * 0.9, o = Math.round(libAt[j] * rate), room = Math.max(0.15, b.at + b.len + 0.3 - libAt[j]);
      let y = clip2.length / rate > room ? stretch(clip2, Math.max(0.6, room / (clip2.length / rate)), rate) : clip2; if (y.length > room * rate) y = y.subarray(0, Math.round(room * rate));
      const fin = Math.min(y.length, Math.round(rate * 0.005)), fout = Math.min(y.length, Math.round(rate * 0.03));
      for (let q = 0; q < y.length && o + q < len; q++) { if (o + q < 0) continue; adlib[o + q] += y[q] * g * (q < fin ? q / fin : 1) * (q >= y.length - fout ? (y.length - q) / fout : 1); }
    });
    // the words as written (main words and ad-libs) in their order, each with its time
    let m = 0; sp.tokens.forEach((tk, wi) => {
      const t = tk.adlib >= 0 ? libAt[tk.adlib] : voiceText(tk.w) ? wordAt[Math.min(wordAt.length - 1, m++)] : wordAt[Math.min(wordAt.length - 1, m)];
      words.push({ bar: b.bar, i: wi, at: t });
    });
    bars.push({ bar: b.bar, at }); voiced++;
  });
  return { main, dub, adlib, words, bars, voiced };
}

/** ask the route for every bar's voice and decode it: { clips (mono Float32Arrays at the decoder's rate, null where a bar has none), adlibClips
 *  (per bar, its ad-libs in splitBar order, each asked once per song however often it comes), note }. decode(bytes) -> Float32Array. Stops at
 *  the first answer that says the voice is off or resting, so a rap never asks 30 times for nothing. */
export async function fetchVoice(texts, { fetchFn = fetch, decode, onProgress = () => {}, concurrency = 4, wait = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 3 } = {}) {
  const clips = texts.map(() => null), adlibClips = texts.map(() => []), libs = new Map(); let next = 0, done = 0, stop = null, busy = null;
  // a busy model or a full minute is asked again, after a pause; only a voice that is off or resting for the day stops the asking, so one
  // hiccup halfway through never leaves the rest of the song silent
  const ask = async (t) => {
    for (let n = 0; n < tries && !stop; n++) {
      if (n) await wait(600 * 2 ** (n - 1));
      const r = await fetchFn(VOICE_URL + '?t=' + encodeURIComponent(t));
      if (r.ok) return decode(await r.arrayBuffer());
      const j = await r.json().catch(() => ({})), note = (j && j.note) || 'voice busy';
      if (r.status === 503 && /off|resting/.test(note)) { stop = note; return null; }
      if (r.status !== 503 && r.status !== 429) return null;
      if (n === tries - 1) busy = note;
    }
    return null;
  };
  const one = async (i) => {
    const sp = splitBar(texts[i]), t = voiceText(sp.main); if (!t) return;
    clips[i] = await ask(t);
    for (const [j, a] of sp.adlibs.entries()) {
      if (stop || !clips[i]) break; const at = voiceText(a.text);
      if (!libs.has(at)) libs.set(at, ask(at).catch(() => null));
      adlibClips[i][j] = await libs.get(at);
    }
  };
  const worker = async () => { while (!stop && next < texts.length) { const i = next++; try { await one(i); } catch (_) { /* that bar stays silent */ } done++; onProgress(done, texts.length); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  const got = clips.filter(Boolean).length;
  return { clips, adlibClips, note: (stop || busy) && !got ? stop || busy : got < texts.length ? (got ? got + ' of ' + texts.length + ' bars came back' : 'no bars came back') : '' };
}
