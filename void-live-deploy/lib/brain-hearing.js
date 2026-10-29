// brain-hearing, Verse Brain's ear, from F299 (hum crystal music box, atomeam/a-to-mind.com drafts/). Owner, 2026-10-29: "combine all the
// builds into one entity", "dont fake it". F299 was its own music box; here the same three parts are one organ of the brain:
//   1. pitch: a YIN-style detector (cumulative mean normalized difference, threshold 0.15, parabolic refine) turns a microphone frame
//      into a frequency, or 0 for silence and noise. It runs in the card (skills/verse-brain.js); only the number reaches the brain.
//   2. notes: a segmenter joins frames whose pitch stays within 0.8 semitone into one note (3 frames at least; one odd frame inside a
//      held note is skipped), so a hum becomes notes.
//   3. melody: prediction by partial matching (PPM-C, orders 0 to 3, with exclusion) over (interval, length) symbols. Before each new
//      note it guesses the next one; the note's surprise in bits goes into the workspace and the counts learn. An order-0 count runs
//      beside it, so the self can say how much the context helps and not only how well it guesses.
// The counts are slow knowledge: lib/brain-mind.js knowledgeOf keeps them between visits. Frequencies and notes are numbers only and
// are never recorded; only interval and length counts are kept.
// Pure: no DOM, no clock, no Math.random.
import { clamp } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const PHRASE = 1.5, MAXO = 3, IV = 12, DUR = 3, ALPHA = (2 * IV + 1) * DUR, MAX_CTX = 3000, A4 = 440;
export const midiOf = (f) => 69 + 12 * Math.log2(f / A4);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const nameOf = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
/** how high a note is on the card, 0 (E2) to 1 (C6). */
export const heightOf = (m) => clamp((m - 40) / 44, 0, 1);

/** the pitch of one frame of samples: { f (Hz, 0 when there is none), clarity 0..1, rms }. Finds 70 Hz to 1 kHz. Pure. */
export function detectPitch(buf, sr) {
  const n = buf.length; let rms = 0; for (let i = 0; i < n; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / n);
  if (rms < 0.012) return { f: 0, clarity: 0, rms };
  const minLag = Math.floor(sr / 1000), maxLag = Math.min(Math.floor(sr / 70), n >> 1), W = n - maxLag;
  const d = new Float32Array(maxLag + 1), cm = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + lag]; s += x * x; } d[lag] = s; }
  let run = 0; cm[minLag] = 1;
  for (let lag = minLag; lag <= maxLag; lag++) { run += d[lag]; cm[lag] = run > 0 ? (d[lag] * (lag - minLag + 1)) / run : 1; }
  let best = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) if (cm[lag] < 0.15) { while (lag + 1 < maxLag && cm[lag + 1] < cm[lag]) lag++; best = lag; break; }
  if (best < 0) { let mv = 1e9; for (let lag = minLag + 1; lag < maxLag; lag++) if (cm[lag] < mv) { mv = cm[lag]; best = lag; } if (mv > 0.35) return { f: 0, clarity: 0, rms }; }
  const a = cm[best - 1], b = cm[best], c = cm[best + 1], den = a - 2 * b + c, off = den ? (0.5 * (a - c)) / den : 0;
  return { f: sr / (best + off), clarity: 1 - cm[best], rms };
}

/** a new ear: no notes heard, empty counts. */
export function makeEar() {
  return { cur: null, lastT: -1, pending: [], prev: null, hist: [], t: [{}, {}, {}, {}], ctx: 0, o0: {}, o0n: 0,
    notes: 0, guessed: 0, hits: 0, bits: 0, bits0: 0, guess: null, last: null };
}

/** one pitch frame (Hz, 0 for none) at time t (seconds, rising). A note that ends goes to E.pending. Pure on E. */
export function hearFrame(E, f, t) {
  if (!(t > E.lastT)) return; E.lastT = t;
  const m = f > 0 && isFinite(f) ? midiOf(f) : null, cur = E.cur;
  if (m !== null && cur && Math.abs(m - cur.sum / cur.k) < 0.8) { cur.sum += m; cur.k++; cur.end = t; cur.miss = 0; return; }
  if (cur && cur.k >= 3 && !cur.miss++) return; // one odd frame (a crack, a breath of noise) does not end a held note; two do
  if (cur && cur.k >= 3) { E.pending.push({ midi: Math.round(cur.sum / cur.k), at: cur.start, dur: Math.max(0.08, cur.end - cur.start) }); if (E.pending.length > 16) E.pending.shift(); }
  E.cur = m !== null ? { sum: m, k: 1, start: t, end: t, miss: 0 } : null;
}

/** the symbol from one note to the next: interval (clamped to an octave) and length class (short, middle, long). Pure. */
export function symOf(prev, n) { const iv = Math.max(-IV, Math.min(IV, n.midi - prev.midi)); return iv + ':' + (n.dur < 0.22 ? 0 : n.dur < 0.45 ? 1 : 2); }
const ALL = []; for (let iv = -IV; iv <= IV; iv++) for (let du = 0; du < DUR; du++) ALL.push(iv + ':' + du);

/** the probability of every next symbol after hist, PPM-C with exclusion; what no order has seen shares the escape mass evenly. Pure. */
export function dist(E, hist) {
  const out = new Map(); let mass = 1;
  for (let o = Math.min(MAXO, hist.length); o >= 0; o--) {
    const m = E.t[o][hist.slice(hist.length - o).join('|')]; if (!m) continue;
    const ks = Object.keys(m).filter((k) => !out.has(k)); let tot = 0; for (const k of ks) tot += m[k];
    if (!tot) continue;
    for (const k of ks) out.set(k, (mass * m[k]) / (tot + ks.length));
    mass *= ks.length / (tot + ks.length);
  }
  const un = ALL.filter((k) => !out.has(k)); for (const k of un) out.set(k, mass / un.length);
  return out;
}
const top = (d) => { let bk = null, bp = -1; for (const [k, p] of d) if (p > bp) { bp = p; bk = k; } return bk; };

/** learn one heard note: score the guess made before it (bits, top-1 hit; order 0 beside it), then count it in every order. Pure on E.
 *  Returns { bits, bits0, hit } once there is an interval to score, else null. */
export function learnNote(E, n) {
  let r = null;
  if (E.prev && !(n.at - (E.prev.at + E.prev.dur) < PHRASE)) { E.prev = null; E.hist = []; } // a long silence starts a new phrase: no interval across it
  if (E.prev) {
    const s = symOf(E.prev, n), d = dist(E, E.hist), p = d.get(s);
    const p0 = ((E.o0[s] || 0) + 1) / (E.o0n + ALPHA); // order 0 with add-one, the baseline the context is measured against
    r = { bits: -Math.log2(p), bits0: -Math.log2(p0), hit: top(d) === s };
    E.guessed++; E.bits += r.bits; E.bits0 += r.bits0; if (r.hit) E.hits++;
    for (let o = 0; o <= MAXO && o <= E.hist.length; o++) {
      const key = E.hist.slice(E.hist.length - o).join('|'), tb = E.t[o];
      if (!tb[key]) { if (E.ctx >= MAX_CTX) continue; tb[key] = {}; E.ctx++; }
      tb[key][s] = (tb[key][s] || 0) + 1;
    }
    E.o0[s] = (E.o0[s] || 0) + 1; E.o0n++;
    E.hist.push(s); if (E.hist.length > MAXO) E.hist.shift();
  }
  E.prev = n; E.notes++; E.last = n;
  const g = top(dist(E, E.hist)); E.guess = g ? { midi: n.midi + +g.split(':')[0], dur: +g.split(':')[1] } : null;
  return r;
}

/** the counts as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf); no notes, no pitches, no times. Pure. */
export function countsOf(E) { return { t: E.t, o0: E.o0, o0n: E.o0n }; }
/** load counts kept from an earlier visit; anything that is not a table of small whole numbers is refused. Returns true when loaded. */
export function loadCounts(E, k) {
  if (!k || !Array.isArray(k.t) || k.t.length !== MAXO + 1 || typeof k.o0 !== 'object' || !(k.o0n >= 0)) return false;
  const sym = (x) => ALL.includes(x), key = (c) => c === '' || c.split('|').every(sym);
  const ok = (m) => m && typeof m === 'object' && Object.entries(m).every(([x, v]) => sym(x) && Number.isInteger(v) && v > 0 && v < 1e6);
  let ctx = 0; for (const tb of k.t) { if (!tb || typeof tb !== 'object') return false; for (const [c, m] of Object.entries(tb)) { if (!key(c) || !ok(m)) return false; ctx++; } }
  if (ctx > MAX_CTX || !ok(k.o0)) return false;
  E.t = k.t.map((tb) => Object.fromEntries(Object.entries(tb).map(([c, m]) => [c, { ...m }]))); E.ctx = ctx; E.o0 = { ...k.o0 }; E.o0n = k.o0n;
  return true;
}

/** the ear's numbers for the self: notes heard, how often the guess was right, bits a note with context and without. Pure. */
export function earOf(E) {
  const g = E.guessed || 1, r = (x) => Math.round(x * 100) / 100;
  return { notes: E.notes, guessed: E.guessed, hit: r(E.hits / g), bits: r(E.bits / g), bits0: r(E.bits0 / g) };
}

export const hearing = {
  id: 'hearing', name: 'Hearing', job: 'hears the pitch of a hum as notes, guesses the next note from the tunes it has heard, and marks a surprising note',
  want: (b) => (b.ear.pending.length ? 0.9 : 0.02),
  run(b) {
    const E = b.ear; let k = 0, last = null;
    while (E.pending.length && k < 4) { const r = learnNote(E, E.pending.shift()); k++; if (r) last = r; }
    if (!k) return 0;
    const n = E.last, x = b.focus.x, y = 0.92 - 0.84 * heightOf(n.midi);
    deposit(b.ws, 'input', x, y, 0.12, 2, 'hearing');
    if (last) deposit(b.ws, 'surprise', x, y, clamp(last.bits / Math.log2(ALPHA), 0, 1) * 0.3, 3, 'hearing'); // a note it did not expect draws attention
    b.board.ear = { x, y, midi: n.midi, note: nameOf(n.midi), next: E.guess ? nameOf(E.guess.midi) : null, bits: last ? Math.round(last.bits * 10) / 10 : null, hit: last ? last.hit : null, tick: b.ticks };
    return k;
  }
};
