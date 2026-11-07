// Verse masters its own song by ear (owner, 2026-10-30: "teach it to listen to other rap and compare for itself"). The Compare button already
// scores a song card against real songs of its kind (lib/genre-score.js). Here Verse also acts on that score: it renders the song, finds the master
// (level, sub, low end, middle, presence, air, width) that brings the mix closest to the reference with the same fitMix() the rap songs use
// (lib/rap-ears.js), renders the song again through that master and scores it again. It keeps the master only when the new score is higher, and
// keeps it for that kind of song on this device, so Play, Save as WAV and the next song of that kind play through it.
// The master plays live in Web Audio (withMaster): the same filters as master() in lib/rap-ears.js (shelves at 60 Hz, 3 kHz and 9 kHz, bells at
// 125 Hz and 800 Hz), the side signal for width, the gain and a limiter. Any schedule function plays through it unchanged, because the song's
// context is handed over with its destination swapped for the master's input.
// Pure parts (isFlat, masterOnly, remasterLine, loadTune, saveTune) are tested in tools/genre-master.test.mjs; withMaster and masteredOAC with a
// mock context there too.
import { fitMix, listen, windowOf, mixWhy, TUNE0 } from './rap-ears.js';
import { RATE, scoreOf } from './genre-score.js';

const FIELDS = ['gain', 'sub', 'low', 'mid', 'presence', 'air', 'width'];

/** the master fields of a tune (no tempo, no swing), rounded to 0.1 dB. Pure. */
export function masterOnly(tune) {
  const t = { ...TUNE0, ...(tune || {}) }, out = {};
  for (const k of FIELDS) out[k] = Math.round((Number(t[k]) || 0) * 10) / 10;
  return out;
}

/** true when a tune changes nothing on the master. Pure. */
export const isFlat = (tune) => FIELDS.every((k) => Math.abs((tune && Number(tune[k])) || 0) < 0.05);

/** a context that plays through a live master for `tune`: the same context, with its destination swapped for the master's input. A flat tune
 *  gives the context back as it is. The input has the destination's channel count, so a mono render (the WAV) stays mono. */
export function withMaster(ctx, tune) {
  const t = masterOnly(tune);
  if (!ctx || isFlat(t)) return ctx;
  const dest = ctx.destination, chans = (dest && dest.channelCount) || 2, input = ctx.createGain();
  try { input.channelCount = chans; input.channelCountMode = 'explicit'; } catch (_) { /* a context that fixes the count */ }
  let last = input;
  const eq = (type, f, gain, q) => { if (!gain) return; const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.gain.value = gain; if (q) n.Q.value = q; last.connect(n); last = n; };
  eq('lowshelf', 60, t.sub); eq('peaking', 125, t.low, 0.8); eq('peaking', 800, t.mid, 0.6); eq('highshelf', 3000, t.presence); eq('highshelf', 9000, t.air);
  if (t.width && chans > 1 && ctx.createChannelSplitter && ctx.createChannelMerger) {
    // mid and side: L' = L(1+k)/2 + R(1-k)/2, R' = L(1-k)/2 + R(1+k)/2, with k the side's gain
    const k = Math.pow(10, t.width / 20), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    last.connect(split);
    for (const [from, to, v] of [[0, 0, (1 + k) / 2], [1, 0, (1 - k) / 2], [0, 1, (1 - k) / 2], [1, 1, (1 + k) / 2]]) { const g = ctx.createGain(); g.gain.value = v; split.connect(g, from); g.connect(merge, 0, to); }
    last = merge;
  }
  const level = ctx.createGain(); level.gain.value = Math.pow(10, t.gain / 20); last.connect(level);
  // the limiter: a louder master never clips
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.08;
  level.connect(lim); lim.connect(dest);
  return new Proxy(ctx, { get(target, prop) { if (prop === 'destination') return input; const v = Reflect.get(target, prop); return typeof v === 'function' ? v.bind(target) : v; } });
}

/** an OfflineAudioContext class whose contexts play through the master for `tune`; OAC itself for a flat tune or none. */
export function masteredOAC(OAC, tune) {
  if (!OAC || !tune || isFlat(tune)) return OAC;
  return class extends OAC { constructor(...a) { super(...a); return withMaster(this, tune); } };
}

/** render the song offline at 44.1 kHz stereo through the master for `tune`: { L, R }, or null. */
export async function renderSong(p, OAC, schedule, instruments = {}, tune = null) {
  if (!OAC) return null;
  const sec = p.steps * (60 / p.bpm / 4) + 2.6, ctx = new OAC(2, Math.ceil(sec * RATE), RATE);
  schedule(withMaster(ctx, tune), p, 0, instruments);
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  return { L, R };
}

const measure = (s) => listen(s.L, s.R, RATE, windowOf(s.L.length / RATE));

/** Verse masters the song by ear against the reference for `key`: { before, after, tune, better } (before and after are scoreOf() results;
 *  tune is the master to keep: the new one when it scored higher, else `tune0`). Null when there is no reference or no offline render. */
export async function remaster(p, OAC, schedule, instruments, refs, key, tune0 = null) {
  const g = refs && refs.genres && refs.genres[key];
  if (!g || !g.average || !OAC) return null;
  const start = tune0 && !isFlat(tune0) ? masterOnly(tune0) : null;
  const raw = await renderSong(p, OAC, schedule, instruments, null); if (!raw) return null;
  const now = start ? await renderSong(p, OAC, schedule, instruments, start) : raw;
  const before = scoreOf(measure(now), refs, key);
  const fit = masterOnly(fitMix(raw.L, raw.R, RATE, g.average, start || TUNE0).tune);
  const same = JSON.stringify(fit) === JSON.stringify(start || masterOnly(TUNE0));
  const after = same ? before : scoreOf(measure(await renderSong(p, OAC, schedule, instruments, fit)), refs, key);
  const better = !!(before && after && after.score > before.score);
  return { before, after: better ? after : before, tune: better ? fit : start, better };
}

/** one plain sentence on what the mastering did. Pure. */
export function remasterLine(r, label = 'this kind of') {
  if (!r || !r.before) return '';
  if (!r.better) return 'Verse tried mastering it by ear against them, and no master it found came closer, so it kept the mix as it is.';
  return 'Verse mastered it by ear against them: from ' + r.before.score + ' to ' + r.after.score + ' of 100. ' + mixWhy(r.tune).join(' ')
    + ' Play and Save as WAV use this master now, and so does every ' + label + ' song Verse makes on this device.';
}

export const tuneKey = (key) => 'verse.music.master.' + key;

/** the master kept for a kind of song on this device, or null. */
export function loadTune(key, store = globalThis.localStorage) {
  try { const v = store && key && JSON.parse(store.getItem(tuneKey(key)) || 'null'); return v && typeof v === 'object' && !isFlat(v) ? masterOnly(v) : null; } catch (_) { return null; }
}

/** keep a master for a kind of song on this device. */
export function saveTune(key, tune, store = globalThis.localStorage) {
  try { if (store && key && tune && !isFlat(tune)) store.setItem(tuneKey(key), JSON.stringify(masterOnly(tune))); } catch (_) { /* a browser with no storage */ }
}
