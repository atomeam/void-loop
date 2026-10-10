/**
 * goal-rules — frontier #18 ("Can you make it do this?"): a goal is a list of conditions on the fields a source card
 * already declares in its observations (void.observations.v1). Checking reads that document alone: no mesh, no state
 * internals, no per-explainer adapter. Each goal also carries its source's control ranges, so a test can prove the goal
 * is reachable with the visitor's own controls (reachable() below; required tests in tools/goal.test.mjs). Pure.
 */

export const SCHEMA = 'void.observations.v1';

// goals by the source's stage kind; each condition names an observation id, a comparison (eq, lte, gte on numbers with a
// tolerance in the observation's own unit; is on a word) and a target
export const GOALS = {
  moon: [
    {
      id: 'waxing-half',
      text: 'Move the Moon to a waxing phase with half its face lit',
      conditions: [{ id: 'illuminatedFraction', cmp: 'eq', target: 0.5, tolerance: 0.03 }, { id: 'waxingOrWaning', cmp: 'is', target: 'waxing' }],
      controls: { orbitAngleDegrees: { min: 0, max: 359, step: 1 } },
      hint: 'The half of the Moon facing the Sun is always lit; how much of that half we see depends on where the Moon is on its orbit. Waxing means the lit part grows from night to night.',
    },
  ],
  lock: [
    {
      id: 'ready',
      text: 'Choose the key and bring the lock to ready',
      conditions: [{ id: 'mechanismState', cmp: 'is', target: 'ready' }],
      controls: { keyPreset: { values: ['matching', 'one-mismatch', 'several-mismatch'] }, insertionFraction: { min: 0, max: 1, step: 0.05 } },
      hint: 'The plug can turn only when every pin pair splits exactly at the shear line. Try each key all the way in and watch how many pairs line up.',
    },
  ],
  gears: [
    {
      id: 'half-speed',
      text: 'Make the driven gear turn half as fast as the driver',
      conditions: [{ id: 'drivenTurnsPerDriverTurn', cmp: 'eq', target: 0.5, tolerance: 0.01 }],
      controls: { driverTeeth: { min: 12, max: 48, step: 1 }, drivenTeeth: { min: 12, max: 48, step: 1 } },
      hint: 'Meshing teeth are the same size, so the gear with more teeth turns fewer times. What tooth counts make one gear turn once while the other turns twice?',
    },
    {
      id: 'twice-as-fast',
      text: 'Make the driven gear turn twice as fast as the driver',
      conditions: [{ id: 'drivenTurnsPerDriverTurn', cmp: 'eq', target: 2, tolerance: 0.01 }],
      controls: { driverTeeth: { min: 12, max: 48, step: 1 }, drivenTeeth: { min: 12, max: 48, step: 1 } },
      hint: 'A gear with fewer teeth than the one driving it has to spin faster to keep up, tooth for tooth.',
    },
  ],
};

export const goalsFor = (kind) => GOALS[kind] || [];
export const goalOf = (kind, id) => goalsFor(kind).find((g) => g.id === id) || null;
/** the goal to set: the first one the source does not already meet (a goal met before you touch anything is no goal) */
export const nextGoal = (kind, doc) => goalsFor(kind).find((g) => check(g, doc).status !== 'met') || null;

const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v));

/** one condition against one observation item: { ok, say } */
function judge(c, item) {
  const v = item.value, label = item.label || c.id, tol = c.tolerance || 0;
  const shown = item.displayValue != null ? item.displayValue : fmt(v);
  const want = c.cmp === 'lte' ? 'at most ' + fmt(c.target) : c.cmp === 'gte' ? 'at least ' + fmt(c.target) : fmt(c.target) + (tol ? ' (±' + fmt(tol) + ')' : '');
  if (c.cmp === 'is') { const ok = v === c.target; return { ok, say: label + ' is ' + shown + (ok ? ' ✓' : ', the goal is ' + c.target) }; } // text: the same word
  const ok = c.cmp === 'lte' ? v <= c.target + tol : c.cmp === 'gte' ? v >= c.target - tol : Math.abs(v - c.target) <= tol;
  const way = ok ? '' : (c.cmp === 'eq' ? (v > c.target ? ' · too high' : ' · too low') : '');
  return { ok, say: label + ' is ' + shown + (ok ? ' ✓ (the goal: ' + want + ')' : ', the goal is ' + want + way) };
}

/**
 * Check a goal against an observations document.
 *   -> { status: 'met' | 'not-yet' | 'invalid', rows: [{ id, ok, say }], errors: [] }
 */
export function check(goal, doc) {
  const errors = [];
  if (!goal || !Array.isArray(goal.conditions) || !goal.conditions.length) errors.push('no goal');
  if (!doc || doc.schema !== SCHEMA || !Array.isArray(doc.items)) errors.push('not a ' + SCHEMA + ' document');
  if (errors.length) return { status: 'invalid', rows: [], errors };
  const rows = goal.conditions.map((c) => {
    const item = doc.items.find((i) => i && i.id === c.id);
    const want = c.cmp === 'is' ? 'string' : 'number';
    if (!item || typeof item.value !== want || (want === 'number' && !Number.isFinite(item.value))) { errors.push('the source has no ' + (want === 'number' ? 'number' : 'word') + ' for ' + c.id); return { id: c.id, ok: false, say: c.id + ' is not on the source card' }; }
    return { id: c.id, ...judge(c, item) };
  });
  if (errors.length) return { status: 'invalid', rows, errors };
  return { status: rows.every((r) => r.ok) ? 'met' : 'not-yet', rows, errors };
}

/** every setting inside a goal's declared controls ({ min, max, step } ranges or { values } choices), as { name: value } */
export function* settings(controls) {
  const names = Object.keys(controls || {});
  const rec = function* (i, acc) {
    if (i === names.length) { yield { ...acc }; return; }
    const c = controls[names[i]];
    if (Array.isArray(c.values)) { for (const v of c.values) yield* rec(i + 1, { ...acc, [names[i]]: v }); return; } // a choice: each value
    const { min, max, step = 1 } = c;
    for (let v = min; v <= max + 1e-9; v += step) yield* rec(i + 1, { ...acc, [names[i]]: Math.round(v * 1e9) / 1e9 });
  };
  yield* rec(0, {});
}

/** a setting inside the goal's controls that meets it, through the source's own observe(setting), or null */
export function reachable(goal, observe) {
  for (const s of settings(goal.controls)) if (check(goal, observe(s)).status === 'met') return s;
  return null;
}
