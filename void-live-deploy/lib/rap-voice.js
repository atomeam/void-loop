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

/** a sound made `ratio` times as long without changing its pitch (WSOLA, 30 ms windows). Short or nearly unchanged sounds are resampled. Pure. */
export function stretch(x, ratio, rate) {
  const n = x.length, outLen = Math.max(1, Math.round(n * ratio)), N = Math.max(64, Math.round(rate * 0.03) & ~1);
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
    const at = slots.map((s) => b.at + s * slotSec + swingOf(s, slotSec, swing)), offset = dbl ? (b.bar % 2) * 8 : 0;
    const f = k > 1 && nat[k - 1] > 0 ? Math.max(0.5, Math.min(1.5, (at[k - 1] - at[0]) / nat[k - 1])) : 1;
    for (let i = 0; i < k; i++) {
      const src = clip.subarray(cut[i], cut[i + 1]), natLen = src.length / rate, last = i === k - 1;
      const room = last ? Math.min(natLen * f + 0.05, b.at + b.len + 0.25 - at[i]) : at[i + 1] - at[i];
      let y = stretch(src, Math.max(0.6, Math.min(1.3, room / Math.max(1e-3, natLen))), rate);
      const fit = Math.max(1, Math.round(room * rate)); if (y.length > fit) y = y.subarray(0, fit);
      const abs = (offset + Math.round(slots[i])) % 16, weight = last ? 1.3 : snares.has(abs) && Number.isInteger(slots[i]) ? 1.22 : abs % 4 === 0 && Number.isInteger(slots[i]) ? 1.12 : 1;
      const fin = Math.min(y.length, Math.round(rate * 0.003)), fout = Math.min(y.length, Math.round(rate * 0.008)), o = Math.round(at[i] * rate);
      for (let j = 0; j < y.length && o + j < len; j++) {
        if (o + j < 0) continue;
        const e = (j < fin ? j / fin : 1) * (j >= y.length - fout ? (y.length - j) / fout : 1), v = y[j] * lift * weight * e;
        main[o + j] += v; if (last) dub[o + j] += v;
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
export async function fetchVoice(texts, { fetchFn = fetch, decode, onProgress = () => {}, concurrency = 4 } = {}) {
  const clips = texts.map(() => null), adlibClips = texts.map(() => []), libs = new Map(); let next = 0, done = 0, stop = null;
  const ask = async (t) => {
    const r = await fetchFn(VOICE_URL + '?t=' + encodeURIComponent(t));
    if (!r.ok) { const j = await r.json().catch(() => ({})); if (r.status === 503 || r.status === 429) stop = (j && j.note) || 'voice busy'; return null; }
    return decode(await r.arrayBuffer());
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
  return { clips, adlibClips, note: stop && !got ? stop : got < texts.length ? (got ? got + ' of ' + texts.length + ' bars came back' : 'no bars came back') : '' };
}
