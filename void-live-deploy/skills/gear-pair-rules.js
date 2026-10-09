/**
 * gear-pair rules — explainer.gear-pair (domains/void.explainers.md): two external meshing gears. One authoritative state
 * (tooth counts, the driver's travel, and when autoplay started); every angle, the ratio, the geometry, the explanation
 * and the observations are derived from it on demand, never accumulated per frame. Pure: no DOM, no three.js, so the
 * required tests (tools/explainers.test.mjs) run in node and the card and the 3D scene read the same numbers.
 *
 *   Δθ_driven = −Δθ_driver × (N_driver / N_driven)
 *
 * Angles are degrees, from +x, counter-clockwise; the driver sits at the origin and the driven gear at +x, centerDistance
 * away. Travel is the angle turned since the start; the pose adds each gear's starting phase (teeth entering gaps).
 */
export const PITCH_DIAMETER_PER_TOOTH = 0.004; // metres of pitch diameter per tooth: constant for the demonstration profile
export const TEETH_MIN = 12, TEETH_MAX = 48;
const PRESENTATIONS = ['normal', 'discovery'];

/** Is this a supported set of parameters? { ok, why } (why is a sentence a visitor can read). */
export function check(p = {}) {
  for (const k of ['driverTeeth', 'drivenTeeth']) {
    if (p[k] === undefined) continue;
    if (!Number.isInteger(p[k]) || p[k] < TEETH_MIN || p[k] > TEETH_MAX) return { ok: false, why: (k === 'driverTeeth' ? 'The driver' : 'The driven gear') + ' needs a whole number of teeth from ' + TEETH_MIN + ' to ' + TEETH_MAX + '.' };
  }
  for (const k of ['driverAngleDegrees', 'driverSpeedDegreesPerSecond']) if (p[k] !== undefined && !Number.isFinite(p[k])) return { ok: false, why: k + ' must be a number.' };
  if (p.presentation !== undefined && !PRESENTATIONS.includes(p.presentation)) return { ok: false, why: 'presentation is normal or discovery.' };
  return { ok: true, why: '' };
}

export function create(p = {}) {
  const c = check(p); if (!c.ok) throw new Error(c.why);
  return { v: 1, cardId: p.cardId || 'gear-pair', revision: 0, driverTeeth: p.driverTeeth ?? 16, drivenTeeth: p.drivenTeeth ?? 32,
    base: p.driverAngleDegrees ?? 0, playing: false, t0: 0, speed: p.driverSpeedDegreesPerSecond ?? 30,
    presentation: p.presentation ?? 'normal', showLabels: p.showLabels ?? true };
}
const bump = (s, x) => ({ ...s, ...x, revision: s.revision + 1 });

// ---- motion: derived from the state and the time asked about ----
export const isPlaying = (s) => !!s.playing;
/** the driver's travel in degrees at time t (seconds); while paused, time does not move it */
export const driverTravel = (s, t) => (s.playing && Number.isFinite(t) ? s.base + s.speed * (t - s.t0) : s.base);
export const drivenTravel = (s, t) => -driverTravel(s, t) * s.driverTeeth / s.drivenTeeth;
export const play = (s, t) => (s.playing ? s : bump(s, { playing: true, t0: t }));
export const pause = (s, t) => (s.playing ? bump(s, { playing: false, base: driverTravel(s, t) }) : s);
export const setSpeed = (s, speed, t) => (Number.isFinite(speed) ? bump(s, { base: driverTravel(s, t), t0: t, speed }) : s);
/** turn the driver by hand (either direction); while autoplay runs the hand turn adds to it */
export const turnDriver = (s, deg) => (Number.isFinite(deg) ? bump(s, { base: s.base + deg }) : s);
/** drag the driven gear to a travel: the driver follows by the inverse ratio, the other way */
export const setDrivenTravel = (s, deg, t) => (Number.isFinite(deg) ? bump(s, { base: -deg * s.drivenTeeth / s.driverTeeth, playing: false, t0: Number.isFinite(t) ? t : s.t0 }) : s);
export function setTeeth(s, p) { const c = check(p); return c.ok ? bump(s, { driverTeeth: p.driverTeeth ?? s.driverTeeth, drivenTeeth: p.drivenTeeth ?? s.drivenTeeth }) : s; }
export function setPresentation(s, presentation) { return PRESENTATIONS.includes(presentation) ? { ...s, presentation } : s; } // display only: no revision

// ---- the relationship ----
export const ratio = (s) => s.driverTeeth / s.drivenTeeth;        // driven turns per driver turn, a positive magnitude
export const signedRatio = (s) => -ratio(s);                        // negative: external gears turn opposite ways
export const inverseRatio = (s) => s.drivenTeeth / s.driverTeeth;  // driver turns per driven turn
export const direction = () => 'opposite';

/** pitch radii and centre distance from the tooth counts (tooth size is the same on both gears), and the driven gear's
 * starting phase so a driver tooth enters a driven gap at the contact point */
export function geometry(s) {
  const driverPitchRadius = s.driverTeeth * PITCH_DIAMETER_PER_TOOTH / 2, drivenPitchRadius = s.drivenTeeth * PITCH_DIAMETER_PER_TOOTH / 2;
  return { driverPitchRadius, drivenPitchRadius, centerDistance: driverPitchRadius + drivenPitchRadius, drivenPhaseDegrees: 180 - 180 / s.drivenTeeth, toothAngleDriver: 360 / s.driverTeeth, toothAngleDriven: 360 / s.drivenTeeth };
}
export function pose(s, t) {
  const g = geometry(s);
  return { driverAngleDegrees: driverTravel(s, t), drivenAngleDegrees: g.drivenPhaseDegrees + drivenTravel(s, t), centerDistance: g.centerDistance };
}
const frac = (x) => x - Math.floor(x);
/** at the contact point a driver tooth meets a driven gap: the two tooth phases there always sum to half a tooth */
export function meshed(s, t) {
  const p = pose(s, t);
  const u1 = frac((0 - p.driverAngleDegrees) * s.driverTeeth / 360), u2 = frac((180 - p.drivenAngleDegrees) * s.drivenTeeth / 360);
  const d = frac(u1 + u2);
  return Math.abs(d - 0.5) < 1e-6;
}

// ---- words and numbers ----
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const num = (x) => String(Math.round(x * 1000) / 1000);
const turns = (x) => (Number.isInteger(x) && x < WORDS.length ? WORDS[x] : num(x)) + (x === 1 ? ' turn' : ' turns');

/** what the card says: both labelled quantities, never a bare "2:1" */
export function explanation(s) {
  const a = s.driverTeeth, b = s.drivenTeeth;
  const lead = b >= a
    ? 'The ' + a + '-tooth gear makes ' + turns(b / a) + ' while the ' + b + '-tooth gear makes one turn in the opposite direction.'
    : 'The ' + a + '-tooth gear makes one turn while the ' + b + '-tooth gear makes ' + turns(a / b) + ' in the opposite direction.';
  return lead + ' Meshing teeth are the same size, so each gear turns in inverse proportion to its tooth count. Driven turns per driver turn: '
    + num(ratio(s)) + '. Driver turns per driven turn: ' + num(inverseRatio(s)) + '.';
}

/** the observations port: void.observations.v1 (domains/void.learning.md); prompts describe this snapshot */
export function observations(s) {
  const a = s.driverTeeth, b = s.drivenTeeth, g = geometry(s), r = ratio(s);
  return {
    schema: 'void.observations.v1',
    source: { cardId: s.cardId, revision: s.revision },
    items: [
      { id: 'drivenTurnsPerDriverTurn', label: 'Driven turns per driver turn', value: r, valueType: 'number', unit: 'turns-per-turn',
        meaning: 'How many turns the driven gear makes for one turn of the driver (a positive ratio)', displayValue: num(r),
        assessment: { enabled: true, prompt: 'With a ' + a + '-tooth driver and a ' + b + '-tooth driven gear, how many turns does the driven gear make per driver turn?', answerLabel: num(r), tolerance: 0.01 } },
      { id: 'rotationDirection', label: 'Direction', value: 'opposite', valueType: 'text', meaning: 'Whether the two gears turn the same way or opposite ways', displayValue: 'Opposite',
        assessment: { enabled: true, prompt: 'Do the two gears turn in the same or opposite direction?', answerLabel: 'Opposite',
          options: [{ id: 'same', label: 'Same' }, { id: 'opposite', label: 'Opposite' }], answerId: 'opposite' } },
      { id: 'drivenTurnsPerDriverTurnSigned', label: 'Driven turns per driver turn, signed', value: -r, valueType: 'number', unit: 'turns-per-turn',
        meaning: 'The same ratio with its direction: negative means the driven gear turns the opposite way', displayValue: num(-r) },
      { id: 'driverTeeth', label: 'Driver teeth', value: a, valueType: 'number', unit: 'teeth', meaning: 'Tooth count of the driver (an input)', displayValue: String(a) },
      { id: 'drivenTeeth', label: 'Driven teeth', value: b, valueType: 'number', unit: 'teeth', meaning: 'Tooth count of the driven gear (an input)', displayValue: String(b) },
      { id: 'centerDistance', label: 'Centre distance', value: Math.round(g.centerDistance * 1e6) / 1e3, valueType: 'number', unit: 'mm',
        meaning: 'Distance between the two shafts: the sum of the pitch radii', displayValue: num(g.centerDistance * 1000) + ' mm' },
    ],
  };
}

/** what the card draws for this presentation: discovery hides the answer, never the inputs or the way to investigate */
export function view(s) {
  const discovery = s.presentation === 'discovery';
  return {
    inputs: { driverTeeth: s.driverTeeth, drivenTeeth: s.drivenTeeth },
    controls: ['driver-teeth', 'driven-teeth', 'turn', 'play-pause', 'speed', 'labels'].concat(discovery ? ['reveal-rule'] : []),
    readouts: discovery ? [] : [{ label: 'Driven turns per driver turn', value: num(ratio(s)) }, { label: 'Driver turns per driven turn', value: num(inverseRatio(s)) }],
    explanation: discovery ? null : explanation(s),
    notes: ['Simplified demonstration profile, not a manufacturing model.'],
  };
}
