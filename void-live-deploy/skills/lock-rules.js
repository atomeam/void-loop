/**
 * pin-lock rules — explainer.pin-lock (domains/void.explainers.md §3): a cutaway pin-tumbler lock, an explanation of
 * normal operation, not a lock-picking simulator. One authoritative state (the key preset, how far it is in, the plug's
 * angle); every pin height, the mechanism state, the explanation and the observations derive from it. Pure: no DOM, no
 * three.js; the required tests are in tools/explainers.test.mjs.
 *
 * Invented, dimensionless demonstration profile (no real key codes): five pin pairs at positions 0..4 from the lock face.
 * Key pin i has length KEY_PIN[i]; a cut lifts it by its depth number. The pair is aligned when lift + KEY_PIN[i] lands
 * exactly on the shear line (SHEAR): then the key pin sits wholly in the plug and the driver pin wholly in the housing.
 * Too low, the driver pin crosses the gap; too high, the key pin does. Either blocks the plug.
 *
 * Exactly five public states: withdrawn, inserting, ready, blocked, turned. Full insertion is a condition, not a state:
 * at insertion 1 the lock is ready or blocked straight away (turned once a ready plug leaves its start angle).
 */
export const PINS = 5, SHEAR = 6, DRIVER = 3, SPRING_TOP = 13, MAX_ANGLE = 90;
export const KEY_PIN = [3, 5, 2, 4, 3];                  // invented key-pin lengths
const MATCH = KEY_PIN.map((k) => SHEAR - k);              // the cuts that set every pair at the shear line: [3, 1, 4, 2, 3]
export const PRESETS = {
  'matching': { label: 'matching', cuts: MATCH.slice() },
  'one-mismatch': { label: 'one-mismatched-cut', cuts: MATCH.map((c, i) => (i === 2 ? c - 2 : c)) },
  'several-mismatch': { label: 'several-mismatched-cuts', cuts: MATCH.map((c, i) => (i === 0 ? c + 1 : i === 2 ? c - 2 : i === 3 ? c + 2 : c)) },
};
export const STATES = ['withdrawn', 'inserting', 'blocked', 'ready', 'turned'];
const STATE_LABEL = { withdrawn: 'Withdrawn', inserting: 'Inserting', blocked: 'Blocked', ready: 'Ready', turned: 'Turned' };
const PRESENTATIONS = ['normal', 'discovery'];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round3 = (x) => Math.round(x * 1000) / 1000;

export function check(p = {}) {
  if (p.keyPreset !== undefined && !PRESETS[p.keyPreset]) return { ok: false, why: 'The key is one of the demonstration keys: matching, one mismatched cut, or several mismatched cuts.' };
  if (p.insertionFraction !== undefined && !(Number.isFinite(p.insertionFraction) && p.insertionFraction >= 0 && p.insertionFraction <= 1)) return { ok: false, why: 'Insertion is a fraction from 0 to 1.' };
  if (p.cutawayAmount !== undefined && !(Number.isFinite(p.cutawayAmount) && p.cutawayAmount >= 0 && p.cutawayAmount <= 1)) return { ok: false, why: 'The cutaway is a fraction from 0 to 1.' };
  if (p.presentation !== undefined && !PRESENTATIONS.includes(p.presentation)) return { ok: false, why: 'presentation is normal or discovery.' };
  return { ok: true, why: '' };
}

export function create(p = {}) {
  const c = check(p); if (!c.ok) throw new Error(c.why);
  return { v: 1, cardId: p.cardId || 'pin-lock', revision: 0, keyPreset: p.keyPreset ?? 'matching', insertion: p.insertionFraction ?? 0, angle: 0,
    lastAttempt: null, cutawayAmount: p.cutawayAmount ?? 0.6, showShearLine: true, showLabels: true, presentation: p.presentation ?? 'normal' };
}
const bump = (s, x) => ({ ...s, ...x, revision: s.revision + 1 });

// ---- pins: where each pair sits, from the key's position alone ----
/** the key cut under pin i, or null where the blade has not reached it (positions in pin spacings; the tip leads) */
export function cutUnder(s, i) {
  const depth = s.insertion * PINS, u = i + 0.5 + PINS - depth; // pin i in the key's own coordinates, from the bow
  if (i + 0.5 > depth || u < 0 || u >= PINS) return null;
  return PRESETS[s.keyPreset].cuts[Math.floor(u)];
}
export const lift = (s, i) => cutUnder(s, i) ?? 0;
export const keyPinTop = (s, i) => lift(s, i) + KEY_PIN[i];
export const aligned = (s, i) => cutUnder(s, i) !== null && keyPinTop(s, i) === SHEAR;
export const alignedPinCount = (s) => { let n = 0; for (let i = 0; i < PINS; i++) if (aligned(s, i)) n++; return n; };
/** the first pair that stops the plug, and which pin crosses the shear line there */
export function obstruction(s) {
  for (let i = 0; i < PINS; i++) if (!aligned(s, i)) return { pin: i, crossing: keyPinTop(s, i) > SHEAR ? 'key pin' : 'driver pin' };
  return null;
}
export const fullyInserted = (s) => s.insertion === 1;

/** one of exactly five states; full insertion is classified straight away as ready or blocked */
export function mechanismState(s) {
  if (s.angle !== 0) return 'turned';
  if (s.insertion === 0) return 'withdrawn';
  if (!fullyInserted(s)) return 'inserting';
  return obstruction(s) ? 'blocked' : 'ready';
}
export const canRotate = (s) => fullyInserted(s) && !obstruction(s);
/** the hypothetical the quiz asks: fully in at the start angle, would this key turn the plug? */
export const keyCanTurn = (keyPreset) => !obstruction({ keyPreset, insertion: 1, angle: 0 });

// ---- actions ----
export function setKey(s, keyPreset) { return PRESETS[keyPreset] && s.angle === 0 && s.insertion === 0 ? bump(s, { keyPreset, lastAttempt: null }) : s; }
/** moving the key in or out; pulling it out needs the plug back at its start angle */
export function setInsertion(s, f) {
  if (!Number.isFinite(f) || s.angle !== 0) return s;
  return bump(s, { insertion: round3(clamp01(f)), lastAttempt: null });
}
/** a turn attempt: only a fully inserted, aligned plug rotates; anything else stays at 0 and says why */
export function turnTo(s, deg) {
  if (!Number.isFinite(deg)) return s;
  const want = Math.max(0, Math.min(MAX_ANGLE, deg));
  if (canRotate(s)) return bump(s, { angle: want, lastAttempt: null });
  if (want === 0) return s.lastAttempt ? bump(s, { lastAttempt: null }) : s;
  return bump(s, { lastAttempt: !fullyInserted(s) ? { reason: 'not-fully-inserted' } : { reason: 'misaligned', ...obstruction(s) } });
}
export const turnBy = (s, deg) => turnTo(s, s.angle + deg);
export function reset(s) { return { ...create({ keyPreset: s.keyPreset, cutawayAmount: s.cutawayAmount, presentation: s.presentation, cardId: s.cardId }), revision: s.revision + 1 }; }
// display only: no revision, no state change
export function setCutaway(s, x) { return Number.isFinite(x) ? { ...s, cutawayAmount: clamp01(x) } : s; }
export function setPresentation(s, presentation) { return PRESENTATIONS.includes(presentation) ? { ...s, presentation } : s; }

// ---- pose: every component's position, from the state (the 3D and the flat drawing both read this) ----
/** heights in pin units from the plug's floor; the plug turns about its axis, carrying the key and the key pins with it */
export function pose(s) {
  const pairs = [];
  for (let i = 0; i < PINS; i++) {
    // the driver pin rests on the key pin (springs push it down); once the plug turns, it waits in the housing at the shear line
    const db = s.angle ? SHEAR : keyPinTop(s, i);
    pairs.push({ i, keyPin: { bottom: lift(s, i), length: KEY_PIN[i], angle: s.angle }, driverPin: { bottom: db, length: DRIVER, angle: 0 },
      spring: { bottom: db + DRIVER, length: SPRING_TOP - (db + DRIVER) }, aligned: aligned(s, i) });
  }
  return { plug: { angle: s.angle }, key: { insertion: s.insertion, angle: s.angle, cuts: PRESETS[s.keyPreset].cuts.slice() }, pairs, shearLine: SHEAR, cutaway: s.cutawayAmount };
}

// ---- words ----
const pct = (f) => Math.round(f * 100);
export function explanation(s) {
  const st = mechanismState(s), o = obstruction(s);
  if (st === 'withdrawn') return 'With no key in, the springs push every driver pin down across the shear line, the gap between the plug and the housing, so the plug cannot turn.';
  if (st === 'inserting') return 'The key is ' + pct(s.insertion) + '% of the way in. Until it is fully inserted, its cuts are not under the pins they were made for, so the plug cannot turn.';
  if (st === 'blocked') return 'Pin pair ' + (o.pin + 1) + ' is misaligned: its ' + o.crossing + ' still crosses the shear line, so the plug cannot turn. The right key lifts every pair so the boundary between key pin and driver pin sits exactly on the shear line.';
  if (st === 'ready') return 'All five pin pairs meet at the shear line: each key pin sits wholly in the plug and each driver pin wholly in the housing, so nothing crosses the gap and the plug can turn.';
  return 'The plug has turned ' + Math.round(s.angle) + '°, carrying the key and the key pins with it; the driver pins stay above the shear line in the housing. Turn it back to the start to take the key out.';
}
/** why the last turn attempt failed, naming the obstructing pin */
export function attemptNote(s) {
  const a = s.lastAttempt;
  if (!a) return null;
  return a.reason === 'not-fully-inserted' ? 'It will not turn: the key is not fully inserted.' : 'It will not turn: pin pair ' + (a.pin + 1) + ' is blocking (its ' + a.crossing + ' crosses the shear line).';
}

/** the observations port: void.observations.v1 (domains/void.learning.md); prompts describe this snapshot */
export function observations(s) {
  const st = mechanismState(s), n = alignedPinCount(s), key = PRESETS[s.keyPreset].label, ip = pct(s.insertion), can = keyCanTurn(s.keyPreset) ? 'yes' : 'no';
  return {
    schema: 'void.observations.v1',
    source: { cardId: s.cardId, revision: s.revision },
    items: [
      { id: 'alignedPinCount', label: 'Aligned pin pairs', value: n, valueType: 'number', unit: 'pins', meaning: 'Pin pairs whose key-pin/driver-pin boundary sits exactly on the shear line (0 to 5)', displayValue: String(n),
        assessment: { enabled: true, prompt: 'With the ' + key + ' key inserted ' + ip + '% of the way, how many pin pairs are aligned at the shear line?', answerLabel: String(n), tolerance: 0 } },
      { id: 'mechanismState', label: 'Lock state', value: st, valueType: 'text', meaning: 'Which of the five states the lock is in', displayValue: STATE_LABEL[st],
        assessment: { enabled: true, prompt: 'With the ' + key + ' key inserted ' + ip + '% of the way and the plug at ' + Math.round(s.angle) + '°, what state is the lock in?', answerLabel: STATE_LABEL[st],
          options: STATES.map((id) => ({ id, label: STATE_LABEL[id] })), answerId: st } },
      { id: 'canTurn', label: 'Can this key turn it', value: can, valueType: 'text', meaning: 'Whether this key, fully inserted at the starting angle, lets the plug turn', displayValue: can === 'yes' ? 'Yes' : 'No',
        assessment: { enabled: true, prompt: 'If this demonstration key is fully inserted and the plug is at its starting angle, will the plug be allowed to turn?', answerLabel: can === 'yes' ? 'Yes' : 'No',
          options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], answerId: can } },
      { id: 'keyPreset', label: 'Key', value: s.keyPreset, valueType: 'text', meaning: 'Which demonstration key (an input)', displayValue: key.replace(/-/g, ' ') },
      { id: 'insertionFraction', label: 'Insertion', value: s.insertion, valueType: 'number', unit: 'fraction', meaning: 'How far the key is in, 0 to 1 (an input)', displayValue: ip + '%' },
      { id: 'plugAngleDegrees', label: 'Plug angle', value: s.angle, valueType: 'number', unit: 'degrees', meaning: 'How far the plug has turned from its start (an input)', displayValue: Math.round(s.angle) + '°' },
    ],
  };
}

/** what the card draws for this presentation: discovery hides the answer, never the inputs or the way to investigate */
export function view(s) {
  const discovery = s.presentation === 'discovery';
  return {
    inputs: { keyPreset: s.keyPreset, insertionFraction: s.insertion, plugAngleDegrees: s.angle },
    controls: ['key', 'insertion', 'turn', 'cutaway', 'shear-line', 'reset'].concat(discovery ? ['reveal-rule'] : []),
    readouts: discovery ? [] : [{ label: 'Aligned pin pairs', value: alignedPinCount(s) + ' of 5' }, { label: 'State', value: STATE_LABEL[mechanismState(s)] }],
    explanation: discovery ? null : explanation(s),
    note: discovery ? null : attemptNote(s),
    notes: ['Demonstration profile: invented, dimensionless pins and cuts, not a real key.'],
  };
}
