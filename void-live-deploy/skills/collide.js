/**
 * collide skill - flags two things that sit on the same spot (asked by Verse, 2026-10-16: "a 'collision detection' skill that flags
 * when two objects in a shared session are moved into overlapping coordinates"). Whenever a thing is set down here (void:dropped)
 * or a shared Verse moves one (void:dropped from shareMove), every pair of things whose boxes overlap gets a red dashed outline,
 * data-collision, and one line saying who overlaps whom; moved apart, the flags go. "any collisions" / "are things overlapping" /
 * "check for collisions" asks the same on demand. Pure geometry; the stage is only read and outlined, never moved.
 * "collision course", "car collisions near me" are not this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** the ask wants the overlap check. Pure. */
export const collideOf = (text) => /^(?:(?:are\s+)?(?:any|there\s+any)\s+(?:collisions|overlaps)|are\s+(?:any\s+)?(?:things|cards|my\s+things|the\s+things)\s+(?:overlapping|colliding|on\s+top\s+of\s+each\s+other)|(?:check|find|flag)\s+(?:for\s+)?(?:the\s+)?(?:collisions|overlaps|overlapping\s+things)|any\s+collisions)$/.test(CLEAN(text));

/** two boxes {x,y,w,h} share area. Pure. */
export const overlaps = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** every overlapping pair of ids from boxes { id: box }, each pair once. Pure. */
export function pairsOf(boxes) {
  const ids = Object.keys(boxes || {}), out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (overlaps(boxes[ids[i]], boxes[ids[j]])) out.push([ids[i], ids[j]]);
  return out;
}
const nameOf = (t) => String((t && (t.label || t.title || t.name || t.kind)) || 'thing').slice(0, 24);
/** "the clock and the note overlap" (several pairs: the first two and a count). Pure. */
export function sayPairs(pairs, things) {
  if (!pairs.length) return '';
  const one = ([a, b]) => 'the ' + nameOf(things[a]) + ' and the ' + nameOf(things[b]) + ' overlap';
  return one(pairs[0]) + (pairs.length > 1 ? ' (and ' + (pairs.length - 1) + ' more pair' + (pairs.length > 2 ? 's' : '') + ')' : '');
}

let lastStage = null;
export function decorate(st) { if (st && st.things) lastStage = st; }
function boxesOf(st) {
  const out = {};
  for (const t of Object.values(st.things())) {
    if (!t || t.kind === 'figure') continue; // figures walk in 3D and are not boxes here
    const el = st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(t.id) : t.id) + '"]');
    if (el) out[t.id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth || 1, h: el.offsetHeight || 1 };
  }
  return out;
}
/** outline every overlapping pair, clear the rest; returns the pairs. */
export function flag(st, say = true) {
  const boxes = boxesOf(st), pairs = pairsOf(boxes), hit = new Set(pairs.flat());
  for (const id of Object.keys(boxes)) {
    const el = st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!el) continue;
    if (hit.has(id)) { el.dataset.collision = '1'; el.style.outline = '2px dashed #ff6b6b'; } else if (el.dataset.collision) { delete el.dataset.collision; el.style.outline = ''; }
  }
  if (say && pairs.length && st.say) st.say(sayPairs(pairs, st.things()));
  return pairs;
}
function onDropped(e) { if (lastStage) flag(lastStage, true); }
if (typeof document !== 'undefined' && !globalThis.__voidCollide) { globalThis.__voidCollide = true; document.addEventListener('void:dropped', onDropped); document.addEventListener('void:moved', onDropped); }

async function run(text, api) {
  if (!collideOf(text)) return 'none';
  const pairs = flag(api.stage, false);
  api.say(pairs.length ? sayPairs(pairs, api.stage.things()) + ' · outlined in red' : 'nothing overlaps');
  return 'collide';
}

export default {
  name: 'collide',
  decorate,
  examples: ['any collisions', 'are things overlapping', 'check for collisions'],
  nearMisses: ['collision course', 'car collisions near me', 'what is a collision', 'check my code'],
  match(lower, text) { return collideOf(text || lower); },
  run,
  collideOf, overlaps, pairsOf, sayPairs,
};
