// Music tools (Versus' music floor, /music/; owner, 2026-10-26: "we have to have everything all the sites have"): the plain functions behind the
// page's metronome, piano, tuner, BPM counter and chord and scale finder. No audio is made here and nothing is fetched: the page's module
// (music/app.js) turns these numbers into sound with Web Audio. Everything is pure, so tools/music-tools.test.mjs can check it with no browser.

export const NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
const FLAT_OF = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
/** the pitch class (0 to 11) of a note name like "C", "f#", "Bb", "Db"; -1 when it is not one. Pure. */
export function pitchClass(name) {
  const m = /^\s*([A-Ga-g])([#♯b♭]?)\s*$/.exec(String(name || '')); if (!m) return -1;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  return (base + (/[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0) + 12) % 12;
}
/** "C#4" for MIDI 61; flats = true writes "Db4". Pure. */
export const noteName = (midi, flats = false) => { const n = NOTE_NAMES[((midi % 12) + 12) % 12]; return (flats && FLAT_OF[n] ? FLAT_OF[n] : n) + (Math.floor(midi / 12) - 1); };
/** the MIDI number of "C#4" / "Bb3" / "A4"; NaN when it is not a note. Pure. */
export function midiOf(text) { const m = /^\s*([A-Ga-g][#♯b♭]?)\s*(-?\d)\s*$/.exec(String(text || '')); if (!m) return NaN; const pc = pitchClass(m[1]); return pc < 0 ? NaN : (+m[2] + 1) * 12 + pc; }
/** the frequency of a MIDI note against A4 = `a4` Hz (440 unless set). Pure. */
export const freqOfMidi = (midi, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
/** the nearest note to a frequency: { midi, name, cents (-50..50), hz: that note's exact frequency }; null for no frequency. Pure. */
export function noteOfFreq(freq, a4 = 440) {
  if (!(freq > 0) || !(a4 > 0)) return null;
  const exact = 69 + 12 * Math.log2(freq / a4), midi = Math.round(exact);
  return { midi, name: noteName(midi), cents: Math.round((exact - midi) * 100), hz: freqOfMidi(midi, a4) };
}

// ---- the metronome ----
export const TEMPO_MIN = 20, TEMPO_MAX = 400;
export const clampBpm = (n) => Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(+n * 10) / 10 || 120));
/** the tempo word for a BPM (Largo, Andante, Allegro ...). Pure. */
export function tempoName(bpm) {
  const t = [[24, 'Larghissimo'], [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto']];
  for (const [max, name] of t) if (bpm < max) return name; return 'Prestissimo';
}
export const TEMPO_TERMS = Object.freeze([['Larghissimo', '20 to 24 BPM', 'extremely slow'], ['Grave', '25 to 40 BPM', 'very slow, solemn'], ['Largo', '40 to 60 BPM', 'broad and slow'], ['Larghetto', '60 to 66 BPM', 'rather broad'], ['Adagio', '66 to 76 BPM', 'slow and at ease'], ['Andante', '76 to 108 BPM', 'at a walking pace'], ['Moderato', '108 to 120 BPM', 'moderate'], ['Allegro', '120 to 156 BPM', 'fast and bright'], ['Vivace', '156 to 176 BPM', 'lively'], ['Presto', '176 to 200 BPM', 'very fast'], ['Prestissimo', 'over 200 BPM', 'as fast as possible']]);
export const TEMPO_PRESETS = Object.freeze([['Largo', 50], ['Adagio', 70], ['Andante', 92], ['Moderato', 114], ['Allegro', 132], ['Presto', 180]]);
/** time signatures: beats in the bar, the note that gets a beat (4 = quarter, 8 = eighth), and how the beats group (accent the first of each group). */
export const TIME_SIGS = Object.freeze({ '2/4': { beats: 2, unit: 4 }, '3/4': { beats: 3, unit: 4 }, '4/4': { beats: 4, unit: 4 }, '5/4': { beats: 5, unit: 4, groups: [3, 2] }, '6/4': { beats: 6, unit: 4 }, '7/4': { beats: 7, unit: 4, groups: [4, 3] }, '3/8': { beats: 3, unit: 8 }, '6/8': { beats: 6, unit: 8, groups: [3, 3] }, '7/8': { beats: 7, unit: 8, groups: [2, 2, 3] }, '9/8': { beats: 9, unit: 8, groups: [3, 3, 3] }, '12/8': { beats: 12, unit: 8, groups: [3, 3, 3, 3] }, '5/8': { beats: 5, unit: 8, groups: [3, 2] }, '2/2': { beats: 2, unit: 2 } });
/** subdivisions: clicks per beat and their volumes' pattern (1 = beat itself). */
export const SUBDIVISIONS = Object.freeze({ none: { n: 1, label: 'Quarter notes (none)' }, eighth: { n: 2, label: 'Eighth notes' }, triplet: { n: 3, label: 'Triplets' }, sixteenth: { n: 4, label: 'Sixteenth notes' }, quintuplet: { n: 5, label: 'Quintuplets' }, sextuplet: { n: 6, label: 'Sextuplets' }, swing: { n: 3, label: 'Swing (long-short)', skip: [1] }, offbeat: { n: 2, label: 'Off-beat only', skip: [0] } });
/** the default accent of each beat in a bar: 3 strong, 2 medium, 1 soft, 0 muted; the first beat of the bar strong and each group's first medium. Pure. */
export function defaultAccents(sig) {
  const s = TIME_SIGS[sig] || TIME_SIGS['4/4'], out = Array(s.beats).fill(1); out[0] = 3; let at = 0;
  for (const g of s.groups || []) { if (at) out[at] = 2; at += g; } return out;
}
/** how long one beat lasts in seconds at `bpm` for a signature: BPM counts the signature's note (an eighth-note beat at 6/8 still counts as one beat). Pure. */
export const beatSeconds = (bpm) => 60 / clampBpm(bpm);
/**
 * One bar as the ticks the page schedules: [{ at: seconds from the bar's start, beat, sub, level }] where level is 3, 2, 1 (the accents) or 0.4 for a
 * subdivision click, and a muted beat is left out. `accents` is one number per beat. Pure.
 */
export function barTicks(bpm, sig, sub = 'none', accents = null) {
  const s = TIME_SIGS[sig] || TIME_SIGS['4/4'], sd = SUBDIVISIONS[sub] || SUBDIVISIONS.none, acc = accents && accents.length === s.beats ? accents : defaultAccents(sig), bs = beatSeconds(bpm), out = [];
  for (let b = 0; b < s.beats; b++) for (let k = 0; k < sd.n; k++) {
    let off = k / sd.n; if (sub === 'swing') off = k === 0 ? 0 : 2 / 3; // long-short: the second click lands two thirds in
    if ((sd.skip || []).includes(k)) continue;
    const level = k === 0 ? acc[b] : 0.4; if (!level) continue;
    out.push({ at: (b + off) * bs, beat: b, sub: k, level });
  }
  return out;
}
export const barSeconds = (bpm, sig) => (TIME_SIGS[sig] || TIME_SIGS['4/4']).beats * beatSeconds(bpm);
/** tempo steps for a speed trainer: from `start` raising `step` BPM every `every` bars until `target`: [{ bar, bpm }]. Pure. */
export function rampPlan(start, target, step, every) {
  const out = [], s = clampBpm(start), t = clampBpm(target), st = Math.max(1, Math.round(step) || 1), ev = Math.max(1, Math.round(every) || 1); if (s === t) return [{ bar: 0, bpm: s }];
  for (let b = 0, v = s; ; b += ev) { out.push({ bar: b, bpm: v }); if (v === t) break; v = s < t ? Math.min(t, v + st) : Math.max(t, v - st); if (out.length > 400) break; }
  return out;
}
/** whether a bar is silent in a "play N bars, rest M bars" practice cycle (bar numbers from 0). Pure. */
export const silentBar = (bar, play, rest) => rest > 0 && play > 0 && (bar % (play + rest)) >= play;
/** the practice tempo ladder a teacher gives: start slow (60%), then 75%, 90% and the target. Pure. */
export const practiceLadder = (target) => [0.6, 0.75, 0.9, 1].map((f) => clampBpm(target * f));

// ---- tap tempo and the BPM counter ----
/**
 * The tempo of a series of taps (times in ms): the average gap of the most recent taps, after a pause longer than `resetMs` starts the count over.
 * { bpm (to one decimal) | null, taps counted, spread (ms between the shortest and longest gap) }. Pure.
 */
export function tapTempo(times, { resetMs = 2500, keep = 12 } = {}) {
  const t = (times || []).filter((x) => Number.isFinite(+x)).map(Number); let from = 0;
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] > resetMs) from = i;
  const run = t.slice(from).slice(-keep); if (run.length < 2) return { bpm: null, taps: run.length, spread: 0 };
  const gaps = run.slice(1).map((x, i) => x - run[i]), avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return { bpm: avg > 0 ? Math.round(60000 / avg * 10) / 10 : null, taps: run.length, spread: Math.round(Math.max(...gaps) - Math.min(...gaps)) };
}
/** how long each note value lasts at a tempo, in ms, plain, dotted and triplet: [{ note, ms, dotted, triplet, hz }]. Pure. */
export function noteLengths(bpm) {
  const q = 60000 / clampBpm(bpm);
  return [['1/1 whole', 4], ['1/2 half', 2], ['1/4 quarter', 1], ['1/8 eighth', 0.5], ['1/16 sixteenth', 0.25], ['1/32 thirty-second', 0.125]].map(([note, f]) => ({ note, ms: Math.round(q * f * 100) / 100, dotted: Math.round(q * f * 1.5 * 100) / 100, triplet: Math.round(q * f * 2 / 3 * 100) / 100, hz: Math.round(1000 / (q * f) * 1000) / 1000 }));
}
/** the length of a piece in bars or seconds: bars at a tempo and signature to "m:ss", and the bars a length holds. Pure. */
export function songLength(bpm, sig, bars) { const s = Math.round(barSeconds(bpm, sig) * bars); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
export const barsIn = (bpm, sig, seconds) => Math.round((seconds / barSeconds(bpm, sig)) * 10) / 10;
/** the half and double of a tempo, for a tap that landed on the wrong beat. Pure. */
export const halfDouble = (bpm) => ({ half: Math.round(bpm / 2 * 10) / 10, double: Math.round(bpm * 2 * 10) / 10 });

// ---- the piano ----
// The computer-key layout the piano sites share (virtualpiano.net's): 1 to 0, q to p, a to l, z to m are 36 white keys from C2; Shift with a key
// plays the sharp of that key's note.
const WHITE_KEYS = '1234567890qwertyuiopasdfghjklzxcvbnm';
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
/** the MIDI note a computer key plays ('q', or Digit/Key codes), with Shift for the sharp; null for a key that plays nothing. Pure. */
export function midiForKey(key, shift = false) {
  const k = String(key || '').replace(/^Digit|^Key/, '').toLowerCase(); const i = WHITE_KEYS.indexOf(k); if (k.length !== 1 || i < 0) return null;
  const midi = 36 + Math.floor(i / 7) * 12 + WHITE_STEPS[i % 7];
  return shift ? ([4, 11].includes(midi % 12) ? null : midi + 1) : midi; // there is no sharp above E or B
}
/** the key to press for a MIDI note ('q', or 'Q' for a sharp, shown as Shift+q), or ''. Pure. */
export function keyForMidi(midi) {
  for (let i = 0; i < WHITE_KEYS.length; i++) { const m = 36 + Math.floor(i / 7) * 12 + WHITE_STEPS[i % 7]; if (m === midi) return WHITE_KEYS[i]; if (m + 1 === midi && ![4, 11].includes(m % 12)) return '⇧' + WHITE_KEYS[i]; }
  return '';
}
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
/** the piano's sounds, each a plain recipe the page builds from oscillators (no sample files): harmonics (partial amplitudes), attack, decay time, sustain level, and a filter. */
export const INSTRUMENTS = Object.freeze({
  piano: { label: 'Grand piano', wave: [1, 0.5, 0.25, 0.12, 0.06, 0.03], attack: 0.004, decay: 1.6, sustain: 0.0, release: 0.35, type: 'sine', bright: 1 },
  epiano: { label: 'Electric piano', wave: [1, 0.05, 0.4, 0.02, 0.1], attack: 0.004, decay: 1.2, sustain: 0.1, release: 0.3, type: 'sine', bright: 1 },
  organ: { label: 'Organ', wave: [1, 0.8, 0.6, 0.5, 0.3, 0.2], attack: 0.015, decay: 0.1, sustain: 0.9, release: 0.08, type: 'sine', bright: 1 },
  strings: { label: 'Strings', wave: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.12], attack: 0.18, decay: 0.3, sustain: 0.8, release: 0.5, type: 'sine', bright: 1 },
  synth: { label: 'Synth lead', wave: [1, 0, 0.33, 0, 0.2, 0, 0.14], attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.15, type: 'sine', bright: 1 },
  bell: { label: 'Bell', wave: [1, 0, 0, 0.6, 0, 0.35], attack: 0.002, decay: 2.5, sustain: 0, release: 0.5, type: 'sine', bright: 1, inharmonic: true },
  flute: { label: 'Flute', wave: [1, 0.1, 0.05], attack: 0.06, decay: 0.2, sustain: 0.85, release: 0.12, type: 'sine', bright: 1 },
  guitar: { label: 'Plucked guitar', wave: [1, 0.7, 0.45, 0.3, 0.2, 0.1], attack: 0.002, decay: 1.1, sustain: 0, release: 0.2, type: 'sine', bright: 1 },
  marimba: { label: 'Marimba', wave: [1, 0, 0.1, 0.4], attack: 0.002, decay: 0.45, sustain: 0, release: 0.1, type: 'sine', bright: 1 },
  harpsichord: { label: 'Harpsichord', wave: [1, 0.9, 0.7, 0.55, 0.4, 0.3, 0.2], attack: 0.002, decay: 0.7, sustain: 0, release: 0.08, type: 'sine', bright: 1 },
  musicbox: { label: 'Music box', wave: [1, 0, 0.5, 0, 0.25], attack: 0.002, decay: 1.2, sustain: 0, release: 0.3, type: 'sine', bright: 1, inharmonic: true },
  choir: { label: 'Choir pad', wave: [1, 0.3, 0.5, 0.15, 0.1], attack: 0.3, decay: 0.3, sustain: 0.8, release: 0.7, type: 'sine', bright: 1 },
});
/**
 * Sheet music in plain letters. One token per note or rest, in order: a note ("C4", "F#4", "Bb3"), a chord in square brackets ("[C4 E4 G4]"),
 * a rest ("-"), each with a length in beats after a colon ("C4:2", default 1). "|" is a bar line (ignored). Returns the events [{ at, dur, notes }] in beats,
 * the length, and any token that is not music. Pure.
 */
export function parseSheet(text) {
  const events = [], bad = []; let at = 0;
  for (const raw of String(text || '').replace(/\[([^\]]*)\]/g, (m) => m.replace(/\s+/g, ',')).split(/\s+/).filter(Boolean)) {
    if (raw === '|') continue;
    const [body, len] = raw.split(':'), dur = len === undefined ? 1 : +len;
    if (!(dur > 0) || dur > 16) { bad.push(raw); continue; }
    if (body === '-') { at += dur; continue; }
    const names = body.replace(/^\[|\]$/g, '').split(',').filter(Boolean), notes = names.map(midiOf);
    if (!notes.length || notes.some((n) => !Number.isFinite(n) || n < 21 || n > 108)) { bad.push(raw); continue; }
    events.push({ at, dur, notes }); at += dur;
  }
  return { events, beats: at, bad };
}
/** songs in the public domain, as sheets in the plain letters parseSheet reads (the tunes are old folk and classical themes, no one's recording). */
export const SHEETS = Object.freeze([
  { id: 'ode', name: 'Ode to Joy (Beethoven)', bpm: 100, sheet: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2' },
  { id: 'twinkle', name: 'Twinkle, Twinkle, Little Star', bpm: 100, sheet: 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2' },
  { id: 'elise', name: 'Für Elise, the opening (Beethoven)', bpm: 120, sheet: 'E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 | A4:1.5 C4:0.5 E4:0.5 A4:0.5 | B4:1.5 E4:0.5 G#4:0.5 B4:0.5 | C5:1.5 E4:0.5 E5:0.5 D#5:0.5 | E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 | A4:1.5 C4:0.5 E4:0.5 A4:0.5 | B4:1.5 E4:0.5 C5:0.5 B4:0.5 | A4:3' },
  { id: 'canon', name: 'Canon in D, the bass line and chords (Pachelbel)', bpm: 80, sheet: '[D3 F#3 A3]:2 [A2 E3 A3 C#4]:2 | [B2 D3 F#3]:2 [F#2 C#3 F#3]:2 | [G2 B2 D3]:2 [D3 A3 D4]:2 | [G2 B2 D3]:2 [A2 E3 A3]:2' },
  { id: 'jingle', name: 'Jingle Bells (Pierpont)', bpm: 120, sheet: 'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:0.5 | E4:4 | F4 F4 F4:1.5 F4:0.5 | F4 E4 E4 E4:0.5 E4:0.5 | E4 D4 D4 E4 | D4:2 G4:2' },
  { id: 'lullaby', name: 'Brahms Lullaby (Brahms)', bpm: 80, sheet: 'E4:0.5 E4:0.5 | G4:2 | E4:0.5 E4:0.5 | G4:2 | E4:0.5 G4:0.5 C5 | B4 A4 | A4:0.5 G4:0.5 | D4:0.5 E4:0.5 F4 | D4:0.5 E4:0.5 F4 | D4:0.5 F4:0.5 B4 | A4 G4 | C5:3' },
]);

// ---- chords and scales ----
export const CHORD_TYPES = Object.freeze({
  '': { name: 'major', iv: [0, 4, 7] }, m: { name: 'minor', iv: [0, 3, 7] }, dim: { name: 'diminished', iv: [0, 3, 6] }, aug: { name: 'augmented', iv: [0, 4, 8] },
  sus2: { name: 'suspended 2nd', iv: [0, 2, 7] }, sus4: { name: 'suspended 4th', iv: [0, 5, 7] }, 5: { name: 'power chord', iv: [0, 7] },
  6: { name: 'major 6th', iv: [0, 4, 7, 9] }, m6: { name: 'minor 6th', iv: [0, 3, 7, 9] }, 7: { name: 'dominant 7th', iv: [0, 4, 7, 10] }, maj7: { name: 'major 7th', iv: [0, 4, 7, 11] },
  m7: { name: 'minor 7th', iv: [0, 3, 7, 10] }, mmaj7: { name: 'minor-major 7th', iv: [0, 3, 7, 11] }, dim7: { name: 'diminished 7th', iv: [0, 3, 6, 9] }, m7b5: { name: 'half-diminished 7th', iv: [0, 3, 6, 10] },
  '7sus4': { name: 'dominant 7th suspended 4th', iv: [0, 5, 7, 10] }, add9: { name: 'add 9', iv: [0, 4, 7, 14] }, madd9: { name: 'minor add 9', iv: [0, 3, 7, 14] }, 9: { name: 'dominant 9th', iv: [0, 4, 7, 10, 14] },
  maj9: { name: 'major 9th', iv: [0, 4, 7, 11, 14] }, m9: { name: 'minor 9th', iv: [0, 3, 7, 10, 14] }, 11: { name: 'dominant 11th', iv: [0, 4, 7, 10, 14, 17] }, 13: { name: 'dominant 13th', iv: [0, 4, 7, 10, 14, 21] },
  '7b9': { name: 'dominant 7th flat 9', iv: [0, 4, 7, 10, 13] }, '7#9': { name: 'dominant 7th sharp 9', iv: [0, 4, 7, 10, 15] }, '7#5': { name: 'dominant 7th sharp 5', iv: [0, 4, 8, 10] }, '7b5': { name: 'dominant 7th flat 5', iv: [0, 4, 6, 10] },
  '6/9': { name: '6 add 9', iv: [0, 4, 7, 9, 14] },
});
const spell = (pc, flats) => (flats && FLAT_OF[NOTE_NAMES[pc]] ? FLAT_OF[NOTE_NAMES[pc]] : NOTE_NAMES[pc]);
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
/** whether a root is spelt with flats ("Bb", "Eb", "F" and the minor keys that go with them). Pure. */
export const prefersFlats = (rootName, minor = false) => /b|♭/.test(rootName) || FLAT_KEYS.has(String(rootName).replace('♭', 'b') + (minor ? 'm' : ''));
/** a chord from its root name and type key: { symbol, name, notes (names), pcs (0..11), intervals }. null when the root or the type is unknown. Pure. */
export function chordOf(root, type = '') {
  const pc = pitchClass(root), t = CHORD_TYPES[type]; if (pc < 0 || !t) return null; const flats = prefersFlats(String(root).trim().replace(/^./, (c) => c.toUpperCase()));
  const pcs = t.iv.map((i) => (pc + i) % 12), rootName = spell(pc, flats);
  return { symbol: rootName + type, name: rootName + ' ' + t.name, notes: pcs.map((p) => spell(p, flats)), pcs, intervals: t.iv, root: pc };
}
/** the chord's notes as MIDI numbers, close position from `octave`, in inversion 0, 1, 2 ...; Pure. */
export function chordMidi(root, type = '', octave = 4, inversion = 0) {
  const c = chordOf(root, type); if (!c) return []; let notes = c.intervals.map((i) => (octave + 1) * 12 + c.root + i);
  for (let k = 0; k < inversion % notes.length; k++) { const low = notes.shift(); notes.push(low + 12); } return notes;
}
/** every chord that holds exactly these pitch classes (names or 0..11), best fit first: [{ symbol, name, root, bass? }]. Pure. */
export function identifyChord(pcsIn) {
  const set = [...new Set((pcsIn || []).map((p) => (typeof p === 'number' ? ((p % 12) + 12) % 12 : pitchClass(p))).filter((p) => p >= 0))].sort((a, b) => a - b); if (set.length < 2) return [];
  const out = [];
  for (let r = 0; r < 12; r++) for (const [type, t] of Object.entries(CHORD_TYPES)) {
    const have = [...new Set(t.iv.map((i) => (r + i) % 12))].sort((a, b) => a - b); if (have.length !== set.length || have.some((p, i) => p !== set[i])) continue;
    const flats = prefersFlats(NOTE_NAMES[r], /^m(?!aj)/.test(type)), root = spell(r, flats); out.push({ symbol: root + type, name: root + ' ' + t.name, root: r, type });
  }
  // the simpler, commoner chords first
  const rank = (c) => ['', 'm', '7', 'maj7', 'm7', 'sus4', 'sus2', 'dim', 'aug', '5'].indexOf(c.type); return out.sort((a, b) => (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b)));
}
export const STRINGS_STANDARD = Object.freeze([40, 45, 50, 55, 59, 64]); // E2 A2 D3 G3 B3 E4, lowest string first
/**
 * Guitar fingerings for a chord: frets for each string (null = not played) found by searching the first 12 frets for shapes that span at most four frets,
 * hold every chord tone that matters and put the root lowest. Up to `max` shapes, easiest (open, low, few muted) first: [{ frets, base, label }]. Pure.
 */
export function guitarVoicings(root, type = '', max = 4, tuning = STRINGS_STANDARD) {
  const c = chordOf(root, type); if (!c) return []; const need = new Set(c.pcs); if (c.pcs.length >= 4 && !/9|11|13/.test(type) === false) need.delete(c.pcs[2]); else if (c.pcs.length >= 4 && /^(?:7|maj7|m7|6|m6)/.test(type) === false) need.delete(c.pcs[2]);
  const strict = c.pcs.length <= 4 ? new Set(c.pcs) : need; const out = [], n = tuning.length;
  const opts = (s) => { const o = [null]; for (let f = 0; f <= 12; f++) if (c.pcs.includes((tuning[s] + f) % 12)) o.push(f); return o; };
  const lists = tuning.map((_, s) => opts(s));
  const rec = (s, cur) => {
    if (s === n) {
      const played = cur.filter((f) => f !== null); if (played.length < Math.min(4, c.pcs.length + 1) && played.length < n - 1) return;
      const fretted = played.filter((f) => f > 0); const lo = fretted.length ? Math.min(...fretted) : 0, hi = fretted.length ? Math.max(...fretted) : 0; if (hi - lo > 3) return;
      const first = cur.findIndex((f) => f !== null); if (first < 0 || (tuning[first] + cur[first]) % 12 !== c.root) return;
      for (let i = first; i < n; i++) if (cur[i] === null && i < n - 1 && cur.slice(i + 1).some((f) => f !== null)) return; // no hole in the middle
      const pcs = new Set(cur.map((f, i) => (f === null ? -1 : (tuning[i] + f) % 12))); for (const p of strict) if (!pcs.has(p)) return;
      const mutes = cur.filter((f) => f === null).length, opens = cur.filter((f) => f === 0).length;
      out.push({ frets: cur.slice(), base: lo > 2 ? lo : 1, score: hi * 3 + mutes * 2 - opens * 2 + (lo > 4 ? lo : 0) }); return;
    }
    for (const f of lists[s]) { cur.push(f); rec(s + 1, cur); cur.pop(); }
  };
  rec(0, []);
  out.sort((a, b) => a.score - b.score); const seen = new Set(), res = [];
  for (const v of out) { const k = v.frets.join(','); if (seen.has(k)) continue; seen.add(k); res.push({ frets: v.frets, base: v.base, label: v.frets.map((f) => (f === null ? 'x' : f)).join(' ') }); if (res.length >= max) break; }
  return res;
}
export const SCALE_TYPES = Object.freeze({
  major: { name: 'Major (Ionian)', iv: [0, 2, 4, 5, 7, 9, 11] }, minor: { name: 'Natural minor (Aeolian)', iv: [0, 2, 3, 5, 7, 8, 10] }, harmonicMinor: { name: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { name: 'Melodic minor', iv: [0, 2, 3, 5, 7, 9, 11] }, dorian: { name: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10] }, phrygian: { name: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11] }, mixolydian: { name: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10] }, locrian: { name: 'Locrian', iv: [0, 1, 3, 5, 6, 8, 10] },
  majorPentatonic: { name: 'Major pentatonic', iv: [0, 2, 4, 7, 9] }, minorPentatonic: { name: 'Minor pentatonic', iv: [0, 3, 5, 7, 10] }, blues: { name: 'Blues', iv: [0, 3, 5, 6, 7, 10] },
  majorBlues: { name: 'Major blues', iv: [0, 2, 3, 4, 7, 9] }, wholeTone: { name: 'Whole tone', iv: [0, 2, 4, 6, 8, 10] }, diminishedWH: { name: 'Diminished (whole-half)', iv: [0, 2, 3, 5, 6, 8, 9, 11] },
  diminishedHW: { name: 'Diminished (half-whole)', iv: [0, 1, 3, 4, 6, 7, 9, 10] }, phrygianDominant: { name: 'Phrygian dominant', iv: [0, 1, 4, 5, 7, 8, 10] }, hungarianMinor: { name: 'Hungarian minor', iv: [0, 2, 3, 6, 7, 8, 11] },
  bebopDominant: { name: 'Bebop dominant', iv: [0, 2, 4, 5, 7, 9, 10, 11] }, altered: { name: 'Altered (super Locrian)', iv: [0, 1, 3, 4, 6, 8, 10] }, lydianDominant: { name: 'Lydian dominant', iv: [0, 2, 4, 6, 7, 9, 10] },
  chromatic: { name: 'Chromatic', iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
});
/** a scale from its root and type key: { name, notes (names), pcs, intervals, steps ('W W H ...') }. null when unknown. Pure. */
export function scaleOf(root, type = 'major') {
  const pc = pitchClass(root), t = SCALE_TYPES[type]; if (pc < 0 || !t) return null; const rn = String(root).trim().replace(/^./, (c) => c.toUpperCase()), flats = prefersFlats(rn, /minor|dorian|phrygian|locrian/i.test(type) || /^minor/.test(type));
  const pcs = t.iv.map((i) => (pc + i) % 12), steps = t.iv.map((v, i) => (i < t.iv.length - 1 ? t.iv[i + 1] : 12) - v).map((d) => ({ 1: 'H', 2: 'W', 3: 'W+H' }[d] || String(d))).join(' ');
  // a seven-note scale spells each letter once where it can (C D E F G A B), otherwise by sharps or flats
  let notes = pcs.map((p) => spell(p, flats));
  if (t.iv.length === 7) { const letters = 'CDEFGAB'; const l0 = letters.indexOf(rn[0].toUpperCase()); notes = pcs.map((p, i) => { const L = letters[(l0 + i) % 7], base = pitchClass(L); const d = ((p - base + 18) % 12) - 6; return L + (d === 0 ? '' : d > 0 ? '#'.repeat(d) : 'b'.repeat(-d)); }); if (notes.some((n) => /##|bb/.test(n))) notes = pcs.map((p) => spell(p, flats)); }
  return { name: rn + ' ' + t.name, notes, pcs, intervals: t.iv, steps, root: pc };
}
/** every scale (all 12 roots, every type) that holds all of the given pitch classes, the commonest types first: [{ name, root, type }]. Pure. */
export function scalesWith(pcsIn, types = ['major', 'minor', 'majorPentatonic', 'minorPentatonic', 'dorian', 'mixolydian', 'blues', 'harmonicMinor', 'melodicMinor', 'lydian', 'phrygian', 'locrian']) {
  const set = [...new Set((pcsIn || []).map((p) => (typeof p === 'number' ? ((p % 12) + 12) % 12 : pitchClass(p))).filter((p) => p >= 0))]; if (!set.length) return [];
  const out = []; for (const type of types) for (let r = 0; r < 12; r++) { const s = SCALE_TYPES[type]; const have = new Set(s.iv.map((i) => (r + i) % 12)); if (set.every((p) => have.has(p))) out.push({ name: scaleOf(NOTE_NAMES[r], type).name, root: r, type }); }
  return out;
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/** the chords of a key, built on each step of the major or natural-minor scale: [{ roman, symbol, notes }] (triads, or sevenths). Pure. */
export function chordsInKey(root, minor = false, sevenths = false) {
  const sc = scaleOf(root, minor ? 'minor' : 'major'); if (!sc) return []; const pcs = sc.pcs; const out = [];
  for (let i = 0; i < 7; i++) {
    const stack = [0, 2, 4].concat(sevenths ? [6] : []).map((k) => pcs[(i + k) % 7]), r = stack[0], iv = stack.map((p) => (p - r + 12) % 12);
    const hit = Object.entries(CHORD_TYPES).find(([, t]) => t.iv.length === iv.length && t.iv.every((v, j) => v % 12 === iv[j])); if (!hit) continue;
    const c = chordOf(sc.notes[i].replace(/(#|b)+$/, (m) => m), hit[0]) || chordOf(NOTE_NAMES[r], hit[0]); const type = hit[0];
    const lower = type === '' || type === '7' || type === 'maj7' || type === 'aug' ? ROMAN[i] : ROMAN[i].toLowerCase(); out.push({ roman: lower + (type === 'dim' ? '°' : type === 'm7b5' ? 'ø' : '') + (sevenths && /7/.test(type) ? '7' : ''), symbol: (c ? c.symbol : NOTE_NAMES[r] + type), notes: (c ? c.notes : []) });
  }
  return out;
}
/** the chords that usually follow a chord in a key, from the common moves of pop and jazz (I to IV, V, vi; V to I ...): the roman numerals ranked. Pure. */
export function nextChords(roman) {
  const key = String(roman || '').replace(/7$/, '');
  const map = { I: ['IV', 'V', 'vi', 'ii'], ii: ['V', 'vii°', 'IV'], iii: ['vi', 'IV', 'ii'], IV: ['V', 'I', 'ii', 'vi'], V: ['I', 'vi', 'IV'], vi: ['IV', 'ii', 'V', 'iii'], 'vii°': ['I', 'iii'], i: ['iv', 'v', 'VI', 'VII'], 'ii°': ['v', 'V'], III: ['VI', 'VII', 'iv'], iv: ['v', 'i', 'VII'], v: ['i', 'VI', 'iv'], VI: ['VII', 'III', 'iv'], VII: ['i', 'III', 'VI'] };
  return map[key] || [];
}
export const PROGRESSIONS = Object.freeze([['I V vi IV', 'the pop progression (C G Am F)'], ['I vi IV V', 'the 50s progression'], ['ii V I', 'the jazz cadence'], ['I IV V', 'the three-chord blues and rock'], ['vi IV I V', 'the sensitive pop one'], ['i VII VI VII', 'minor rock'], ['i iv v i', 'minor blues'], ['I V vi iii IV I IV V', 'Pachelbel\'s canon']]);
/** the key signature of a major or minor key: { sharps: n } positive for sharps, negative for flats. Pure. */
export function keySignature(root, minor = false) {
  const pc = (pitchClass(root) + (minor ? 3 : 0)) % 12; // the relative major
  const order = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; const i = order.indexOf(pc); return i <= 6 ? i : i - 12;
}
/** the circle of fifths from C, clockwise: [{ major, minor, signature }]. Pure. */
export function circleOfFifths() {
  const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'], minors = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
  return majors.map((m, i) => ({ major: m, minor: minors[i], signature: i <= 6 ? i : i - 12 }));
}
/** transposes a chord symbol ("Am7", "F#/A#") up or down by semitones, spelling as a flat key or a sharp one. Pure. */
export function transposeSymbol(sym, steps, flats = false) {
  return String(sym || '').replace(/[A-G][#b♭]?/g, (n) => { const p = pitchClass(n); return p < 0 ? n : spell((p + steps + 120) % 12, flats); });
}

// ---- the tuner ----
export const TUNINGS = Object.freeze({
  'guitar-standard': { label: 'Guitar, standard (E A D G B E)', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  'guitar-dropd': { label: 'Guitar, drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  'guitar-dadgad': { label: 'Guitar, DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  'guitar-opeg': { label: 'Guitar, open G', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  'guitar-opend': { label: 'Guitar, open D', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  'guitar-halfdown': { label: 'Guitar, half step down', notes: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
  'guitar-7': { label: 'Guitar, 7-string', notes: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  bass4: { label: 'Bass, 4-string', notes: ['E1', 'A1', 'D2', 'G2'] },
  bass5: { label: 'Bass, 5-string', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
  ukulele: { label: 'Ukulele (G C E A)', notes: ['G4', 'C4', 'E4', 'A4'] },
  violin: { label: 'Violin (G D A E)', notes: ['G3', 'D4', 'A4', 'E5'] },
  viola: { label: 'Viola (C G D A)', notes: ['C3', 'G3', 'D4', 'A4'] },
  cello: { label: 'Cello (C G D A)', notes: ['C2', 'G2', 'D3', 'A3'] },
  mandolin: { label: 'Mandolin (G D A E)', notes: ['G3', 'D4', 'A4', 'E5'] },
  banjo: { label: 'Banjo, open G (g D G B D)', notes: ['G4', 'D3', 'G3', 'B3', 'D4'] },
  chromatic: { label: 'Any note (chromatic)', notes: [] },
});
/**
 * The pitch of a block of microphone samples, by the McLeod normalised square difference: the first strong peak, so a low note is not read an octave high.
 * { freq, clarity (0..1) } or null when the block is quiet or no pitch stands out. Pure.
 */
export function detectPitch(buf, sampleRate, { minHz = 30, maxHz = 1700, gate = 0.01, clarity = 0.9 } = {}) {
  const N = buf.length; let sum = 0; for (let i = 0; i < N; i++) sum += buf[i] * buf[i]; if (Math.sqrt(sum / N) < gate) return null;
  const tauMax = Math.min(Math.floor(sampleRate / minHz), Math.floor(N / 2)), tauMin = Math.max(2, Math.floor(sampleRate / maxHz)), W = N - tauMax, nsdf = new Float32Array(tauMax + 1);
  for (let tau = 0; tau <= tauMax; tau++) { let r = 0, m = 0; for (let i = 0; i < W; i++) { const a = buf[i], b = buf[i + tau]; r += a * b; m += a * a + b * b; } nsdf[tau] = m > 0 ? 2 * r / m : 0; }
  const peaks = []; let tau = 1; while (tau < tauMax && nsdf[tau] > 0) tau++; // skip the first lobe, the one at zero lag
  while (tau < tauMax) { while (tau < tauMax && nsdf[tau] <= 0) tau++; let best = -1; while (tau < tauMax && nsdf[tau] > 0) { if (best < 0 || nsdf[tau] > nsdf[best]) best = tau; tau++; } if (best >= tauMin && nsdf[best] > 0) peaks.push(best); }
  if (!peaks.length) return null; const top = Math.max(...peaks.map((p) => nsdf[p])); const pick = peaks.find((p) => nsdf[p] >= clarity * top); if (pick === undefined || nsdf[pick] < 0.5) return null;
  const a = nsdf[pick - 1] || 0, b = nsdf[pick], c = nsdf[pick + 1] || 0, den = a - 2 * b + c, shift = den ? 0.5 * (a - c) / den : 0;
  return { freq: sampleRate / (pick + shift), clarity: Math.min(1, nsdf[pick]) };
}
/** a smoothed reading: the median of the last few frequencies, so one stray block does not swing the needle. Pure. */
export function steadyFreq(list, n = 5) { const v = (list || []).slice(-n).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; }
/** which string of a tuning a frequency is closest to, and how far off: { index, note, cents } or null for a chromatic tuner. Pure. */
export function nearestString(freq, tuningKey, a4 = 440) {
  const t = TUNINGS[tuningKey]; if (!t || !t.notes.length || !(freq > 0)) return null; let best = null;
  t.notes.forEach((n, index) => { const m = midiOf(n); const cents = Math.round(1200 * Math.log2(freq / freqOfMidi(m, a4))); if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { index, note: n, cents }; });
  return best;
}
/** the word for a tuning reading: in tune within 5 cents, else "flat"/"sharp" by how far. Pure. */
export const tuneWord = (cents) => (Math.abs(cents) <= 5 ? 'in tune' : cents < 0 ? (cents < -25 ? 'too flat' : 'a little flat') : cents > 25 ? 'too sharp' : 'a little sharp');

// ---- setlists (the playlists of a metronome): one entry is a named tempo, signature, subdivision and accents ----
/** a setlist entry cleaned to what the metronome can play, or null. Pure. */
export function cleanEntry(e) {
  if (!e || typeof e !== 'object') return null; const sig = TIME_SIGS[e.sig] ? e.sig : '4/4', sub = SUBDIVISIONS[e.sub] ? e.sub : 'none', bpm = clampBpm(e.bpm);
  const name = String(e.name || '').replace(/[<>]/g, '').trim().slice(0, 40) || tempoName(bpm) + ' ' + bpm; return { name, bpm, sig, sub, note: String(e.note || '').replace(/[<>]/g, '').slice(0, 80) };
}
/** a setlist as a link: the entries' tempos packed into the query so a friend opens the same list. Pure. */
export function setlistToQuery(list) { return (list || []).slice(0, 30).map(cleanEntry).filter(Boolean).map((e) => [encodeURIComponent(e.name), e.bpm, e.sig.replace('/', '-'), e.sub].join('~')).join(','); }
/** the entries in a setlist link, or []. Pure. */
export function setlistFromQuery(q) {
  return String(q || '').split(',').filter(Boolean).slice(0, 30).map((p) => { const [n, b, s, u] = p.split('~'); try { return cleanEntry({ name: decodeURIComponent(n || ''), bpm: +b, sig: String(s || '').replace('-', '/'), sub: u }); } catch (_) { return null; } }).filter(Boolean);
}

// ---- the tempo of a recording (the BPM counter's "find the BPM of a file"): decoded on the device, never uploaded ----
/**
 * The tempo of mono samples: the loudness jumps (onsets) per 10 ms are compared with themselves a beat later, and the lag that lines up best between
 * 70 and 180 BPM wins, with the tempo doubled or halved into the common 80 to 160 range. { bpm, confidence 0..1 } or null for too little sound. Pure.
 */
export function bpmOfSamples(samples, sampleRate) {
  const hop = Math.max(1, Math.round(sampleRate * 0.01)), n = Math.floor(samples.length / hop); if (n < 300) return null;
  const env = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const x = samples[i * hop + j]; s += x * x; } env[i] = Math.sqrt(s / hop); }
  const flux = new Float32Array(n); let mean = 0; for (let i = 1; i < n; i++) { flux[i] = Math.max(0, env[i] - env[i - 1]); mean += flux[i]; } mean /= n; if (!(mean > 1e-6)) return null;
  for (let i = 0; i < n; i++) flux[i] -= mean;
  const minLag = Math.floor(6000 / 180), maxLag = Math.ceil(6000 / 70), ac = new Float32Array(maxLag + 2); let zero = 0; for (let i = 0; i < n; i++) zero += flux[i] * flux[i]; if (!(zero > 0)) return null;
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) { let s = 0; for (let i = 0; i + lag < n; i++) s += flux[i] * flux[i + lag]; ac[lag] = s / zero; }
  let best = minLag; for (let lag = minLag; lag <= maxLag; lag++) if (ac[lag] > ac[best]) best = lag;
  const a = ac[best - 1], b = ac[best], c = ac[best + 1], den = a - 2 * b + c, lagF = best + (den ? 0.5 * (a - c) / den : 0);
  let bpm = 6000 / lagF; while (bpm < 80) bpm *= 2; while (bpm > 160) bpm /= 2;
  return { bpm: Math.round(bpm * 10) / 10, confidence: Math.max(0, Math.min(1, ac[best])) };
}

/**
 * A recording of key presses turned into a sheet in plain letters: events [{ t (ms), midi, down }] at `bpm`, notes that start together (within 45 ms)
 * written as a chord, gaps as rests, lengths to the nearest quarter beat. '' for nothing played. Pure.
 */
export function recordingToSheet(events, bpm = 100) {
  const beat = 60000 / clampBpm(bpm), open = new Map(), notes = [];
  for (const e of (events || []).slice().sort((a, b) => a.t - b.t)) { if (e.down) { if (!open.has(e.midi)) open.set(e.midi, e.t); } else if (open.has(e.midi)) { notes.push({ s: open.get(e.midi), e: e.t, midi: e.midi }); open.delete(e.midi); } }
  const last = Math.max(0, ...(events || []).map((e) => e.t)); for (const [midi, s] of open) notes.push({ s, e: Math.max(last, s + beat), midi });
  notes.sort((a, b) => a.s - b.s || a.midi - b.midi); const q = (ms) => Math.max(0.25, Math.round(ms / beat * 4) / 4), groups = [];
  for (const n of notes) { const g = groups[groups.length - 1]; if (g && n.s - g.s <= 45) g.n.push(n); else groups.push({ s: n.s, n: [n] }); }
  const out = []; let at = groups.length ? groups[0].s : 0;
  for (const g of groups) {
    const gap = (g.s - at) / beat; if (gap >= 0.25) out.push('-:' + (Math.round(gap * 4) / 4));
    const dur = q(Math.max(...g.n.map((n) => n.e)) - g.s), names = g.n.map((n) => noteName(n.midi)); out.push((names.length > 1 ? '[' + names.join(' ') + ']' : names[0]) + (dur === 1 ? '' : ':' + dur)); at = g.s + dur * beat;
  }
  return out.join(' ');
}

// ---- a second pulse against the bar, the strobe tuner and the guitar neck (2026-10-26) ----
/** a polyrhythm's second layer: `n` evenly spaced pulses across one bar of `sig` at `bpm` (3 against the bar's 4 beats is 3:4): [{ at, level }], the first strong. [] for n outside 2 to 9. Pure. */
export function polyTicks(bpm, sig, n) { const k = Math.round(+n); if (!(k >= 2 && k <= 9)) return []; const bar = barSeconds(bpm, sig); return Array.from({ length: k }, (_, i) => ({ at: i * bar / k, level: i === 0 ? 3 : 1 })); }
/** how far a strobe's stripes move in one frame for a reading in cents: still when in tune (within 1 cent), faster the further off, to the right for sharp and left for flat, at most 14 px. Pure. */
export const strobeStep = (cents) => (!Number.isFinite(+cents) || Math.abs(cents) <= 1 ? 0 : Math.max(-14, Math.min(14, cents * 0.35)));
/** a guitar neck as a grid for a scale: map[string][fret] is 2 for the root, 1 for another note of the scale, 0 for none, frets 0 (open) to `frets`, strings lowest first. Pure. */
export function fretboardMap(pcs, rootPc, tuning = STRINGS_STANDARD, frets = 12) {
  const set = new Set(pcs); return tuning.map((open) => Array.from({ length: frets + 1 }, (_, f) => { const pc = (open + f) % 12; return pc === rootPc ? 2 : set.has(pc) ? 1 : 0; }));
}
/** the pitch classes under a hand on the neck: frets[i] is the fret held on string i (null = not played, 0 = open). Pure. */
export const fretsToPcs = (frets, tuning = STRINGS_STANDARD) => [...new Set((frets || []).map((f, i) => (f === null || f === undefined || f === '' ? null : (tuning[i] + +f) % 12)).filter((x) => x !== null))];
