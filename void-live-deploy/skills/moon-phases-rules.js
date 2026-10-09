/**
 * moon-phases rules — explainer.moon-phases (domains/void.explainers.md): a small Earth and Moon with sunlight from a
 * fixed direction. One authoritative state (the Moon's orbital angle, and when autoplay started); the lit fraction, the
 * phase, waxing or waning, the Earth-view disc, the explanation and the observations are all derived from it. Pure: no
 * DOM, no three.js; the required tests are in tools/explainers.test.mjs.
 *
 *   f = (1 − cos θ) / 2        θ = orbital angle from new moon (0° new, 90° first quarter, 180° full, 270° last quarter)
 *
 * Conventions: zero is new moon, waxing comes first, the Earth view is a north-up schematic, and the right limb is lit
 * while waxing (northern-hemisphere view). Demonstration time, not astronomical time. Eclipses are not simulated.
 */
export const CONVENTIONS = { zeroAngle: 'new-moon', progression: 'waxing-first', earthView: 'north-up-schematic', waxingLitLimb: 'right' };
export const SCENE_NOTE = 'Schematic: sizes and distances not to scale. Eclipses not simulated. Right limb lit while waxing (northern-hemisphere view).';
export const SUN_DIRECTION = [1, 0, 0]; // sunlight comes from +x: the Sun is far away along +x
const PRESENTATIONS = ['normal', 'discovery'];
export const PHASES = [
  { id: 'new-moon', label: 'New moon' }, { id: 'waxing-crescent', label: 'Waxing crescent' }, { id: 'first-quarter', label: 'First quarter' }, { id: 'waxing-gibbous', label: 'Waxing gibbous' },
  { id: 'full-moon', label: 'Full moon' }, { id: 'waning-gibbous', label: 'Waning gibbous' }, { id: 'last-quarter', label: 'Last quarter' }, { id: 'waning-crescent', label: 'Waning crescent' },
];
const norm = (a) => { const r = a % 360; return r < 0 ? r + 360 : r; };
const rad = (d) => d * Math.PI / 180;

export function check(p = {}) {
  if (p.orbitAngleDegrees !== undefined && !Number.isFinite(p.orbitAngleDegrees)) return { ok: false, why: 'The orbital position is an angle in degrees.' };
  if (p.secondsPerCycle !== undefined && (!Number.isFinite(p.secondsPerCycle) || p.secondsPerCycle < 10 || p.secondsPerCycle > 120)) return { ok: false, why: 'One animated cycle takes 10 to 120 seconds.' };
  if (p.presentation !== undefined && !PRESENTATIONS.includes(p.presentation)) return { ok: false, why: 'presentation is normal or discovery.' };
  if (p.phaseName !== undefined && !PHASES.some((x) => x.id === p.phaseName)) return { ok: false, why: 'That is not one of the eight phase names.' };
  return { ok: true, why: '' };
}
const SHORTCUT = { 'new-moon': 0, 'first-quarter': 90, 'full-moon': 180, 'last-quarter': 270, 'waxing-crescent': 45, 'waxing-gibbous': 135, 'waning-gibbous': 225, 'waning-crescent': 315 };
export function create(p = {}) {
  const c = check(p); if (!c.ok) throw new Error(c.why);
  const start = p.phaseName !== undefined ? SHORTCUT[p.phaseName] : (p.orbitAngleDegrees ?? 0);
  return { v: 1, cardId: p.cardId || 'moon-phases', revision: 0, base: norm(start), playing: false, t0: 0, secondsPerCycle: p.secondsPerCycle ?? 30,
    presentation: p.presentation ?? 'normal', showSunlight: true, showEarthView: true, showLabels: true };
}
const bump = (s, x) => ({ ...s, ...x, revision: s.revision + 1 });

// ---- motion ----
export const isPlaying = (s) => !!s.playing;
export const orbitAngle = (s, t) => norm(s.playing && Number.isFinite(t) ? s.base + 360 * (t - s.t0) / s.secondsPerCycle : s.base);
export const play = (s, t) => (s.playing ? s : bump(s, { playing: true, t0: t }));
export const pause = (s, t) => (s.playing ? bump(s, { playing: false, base: orbitAngle(s, t) }) : s);
export const turnMoon = (s, deg, t) => (Number.isFinite(deg) ? bump(s, { base: norm(orbitAngle(s, t) + deg), t0: Number.isFinite(t) ? t : s.t0 }) : s);
export const setOrbit = (s, deg, t) => (Number.isFinite(deg) ? bump(s, { base: norm(deg), t0: Number.isFinite(t) ? t : s.t0 }) : s);
export const setPhase = (s, id, t) => (SHORTCUT[id] !== undefined ? setOrbit(s, SHORTCUT[id], t) : s);
export function setCycle(s, seconds, t) { const c = check({ secondsPerCycle: seconds }); return c.ok ? bump(s, { base: orbitAngle(s, t), t0: t, secondsPerCycle: seconds }) : s; }
export function setPresentation(s, presentation) { return PRESENTATIONS.includes(presentation) ? { ...s, presentation } : s; } // display only

// ---- what follows from the angle ----
export const illuminatedFraction = (s, t) => (1 - Math.cos(rad(orbitAngle(s, t)))) / 2;
export function phaseName(s, t) { const a = orbitAngle(s, t); return PHASES[Math.floor(norm(a + 22.5) / 45) % 8].id; }
/** waxing (0° < θ < 180°), waning (180° < θ < 360°), or null exactly at new or full moon, where it is undefined */
export function waxingOrWaning(s, t) { const a = orbitAngle(s, t); return a === 0 || a === 180 ? null : a < 180 ? 'waxing' : 'waning'; }
/** where the Moon sits on its orbit (Earth at the origin, the orbit in the x–z plane, counter-clockwise seen from above) */
export function moonPosition(s, t) { const a = rad(orbitAngle(s, t)); return [Math.cos(a), 0, -Math.sin(a)]; }
/** the lit hemisphere always faces the Sun, wherever the Moon is */
export const litHemisphereNormal = () => SUN_DIRECTION.slice();

/** the "view from Earth" disc, north up: from the state alone (the overview camera is never an input) */
export function earthView(s, _camera, t) {
  const a = orbitAngle(s, t), w = waxingOrWaning(s, t);
  return { fraction: illuminatedFraction(s, t), litLimb: a === 0 ? null : a === 180 ? 'both' : w === 'waxing' ? 'right' : 'left', terminatorX: Math.cos(rad(a)), waxing: w === 'waxing' };
}
/** is the point (x, y) of the unit Earth-view disc lit? Right limb while waxing; the terminator is a half-ellipse */
export function litInEarthView(s, x, y, t) {
  if (x * x + y * y > 1) return false;
  const a = orbitAngle(s, t), w = Math.sqrt(1 - y * y), c = Math.cos(rad(a));
  return a <= 180 ? x > c * w : x < -c * w;
}

const pct = (f) => Math.round(f * 100) + '%';
const label = (id) => PHASES.find((x) => x.id === id).label;
/** what the card says: never Earth's shadow; sunlight lights half the Moon and the orbit changes how much of it we see */
export function explanation(s, t) {
  const a = orbitAngle(s, t), f = illuminatedFraction(s, t), w = waxingOrWaning(s, t), name = label(phaseName(s, t));
  const where = a === 0 ? 'The Moon is between Earth and the Sun, so its lit half faces away from us and we see none of it.'
    : a === 180 ? 'The Moon is on the far side of Earth from the Sun, so we see its whole lit half.'
    : 'From Earth we see ' + pct(f) + ' of the Moon\'s near side lit' + (w === 'waxing' ? ', on the right, and the lit part grows night to night.' : ', on the left, and the lit part shrinks night to night.');
  return name + ' at ' + Math.round(a) + '° along the orbit. The Sun always lights the half of the Moon that faces it. ' + where
    + ' A "quarter" moon looks half lit: the name counts a quarter of the way round the orbit, not the lit area.';
}

/** the observations port (void.observations.v1); prompts describe this snapshot */
export function observations(s, t) {
  const a = orbitAngle(s, t), f = illuminatedFraction(s, t), ph = phaseName(s, t), w = waxingOrWaning(s, t), at = Math.round(a * 10) / 10;
  return {
    schema: 'void.observations.v1',
    source: { cardId: s.cardId, revision: s.revision },
    items: [
      { id: 'illuminatedFraction', label: 'Lit fraction', value: f, valueType: 'number', unit: 'fraction', meaning: 'How much of the Moon\'s near side is lit, seen from Earth (0 to 1)', displayValue: pct(f),
        assessment: { enabled: true, prompt: 'At the captured orbital position of ' + at + '°, what fraction of the Moon\'s near side is illuminated?', answerLabel: pct(f), tolerance: 0.02 } },
      { id: 'phaseName', label: 'Phase', value: ph, valueType: 'text', meaning: 'The named phase at this position', displayValue: label(ph),
        assessment: { enabled: true, prompt: 'At the captured orbital position of ' + at + '°, which phase is shown?', answerLabel: label(ph), options: PHASES.map((x) => ({ id: x.id, label: x.label })), answerId: ph } },
      { id: 'waxingOrWaning', label: 'Waxing or waning', value: w || 'neither', valueType: 'text', meaning: 'Whether the lit part grows or shrinks night to night (undefined exactly at new and full moon)', displayValue: w ? (w === 'waxing' ? 'Waxing' : 'Waning') : 'Neither',
        assessment: w ? { enabled: true, prompt: 'At the captured orbital position of ' + at + '°, is the lit part growing or shrinking from night to night?', answerLabel: w === 'waxing' ? 'Growing (waxing)' : 'Shrinking (waning)', options: [{ id: 'waxing', label: 'Growing (waxing)' }, { id: 'waning', label: 'Shrinking (waning)' }], answerId: w } : { enabled: false } },
      { id: 'orbitAngleDegrees', label: 'Orbital position', value: at, valueType: 'number', unit: 'degrees', meaning: 'Where the Moon is on its orbit, from new moon (an input)', displayValue: at + '°' },
    ],
  };
}

/** what the card draws for this presentation: discovery hides the answer, never the inputs or the way to investigate */
export function view(s, t) {
  const discovery = s.presentation === 'discovery', w = waxingOrWaning(s, t);
  return {
    inputs: { orbitAngleDegrees: Math.round(orbitAngle(s, t) * 10) / 10 },
    controls: ['drag-moon', 'orbit-slider', 'phase-shortcuts', 'play-pause', 'cycle-duration', 'sunlight-arrows', 'earth-view'].concat(discovery ? ['reveal-rule'] : []),
    readouts: discovery ? [] : [{ label: 'Lit fraction', value: pct(illuminatedFraction(s, t)) }, { label: 'Phase', value: label(phaseName(s, t)) }].concat(w ? [{ label: 'Night to night', value: w === 'waxing' ? 'growing (waxing)' : 'shrinking (waning)' }] : []),
    explanation: discovery ? null : explanation(s, t),
    notes: [SCENE_NOTE],
  };
}
