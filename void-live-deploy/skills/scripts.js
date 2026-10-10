/**
 * scripts — Next #19/#20: behavior scripts for figures (drives, idle actions, reactions to other figures).
 * Pure JS, no three.js: fallbacks, trim of unknown names, idle-act and reaction pickers are tested offline.
 * Workers AI writes a fresh script through /api/figurescript; when AI is off the fallback for the body runs.
 *
 * Script shape: { drives, actions, tags?, reactsTo?, subject?, body?, source? }
 * Only names in KNOWN_* lists are kept (unknown ones are trimmed so every script is safe to run).
 */
export const KNOWN_DRIVES = ['wander', 'notice', 'idle'];
export const KNOWN_ACTIONS = [
  'look', 'twirl', 'wave', 'stir', 'rumble', 'puff', 'pace', 'sit', 'hop', 'bow',
  'spin', 'sniff', 'glow', 'point', 'orbit', 'read', 'nod',
];
/** How one figure responds when another tagged figure is nearby (Next #20). */
export const KNOWN_REACTS = ['greet', 'follow', 'chase', 'flee', 'argue', 'team', 'eat'];
/** Role tags a script may claim; others match against these in reactsTo. */
export const KNOWN_TAGS = [
  'police', 'troublemaker', 'animal', 'person', 'place', 'object', 'idea', 'sprite', 'chef', 'friend',
  'zombie', 'brain', 'cat', 'mouse', 'dog', 'bone', 'fish', 'cheese', 'rabbit', 'carrot', 'monkey', 'banana', 'shark', 'bee', 'flower', 'food',
  'cloud', 'sun', 'fire', 'ice', 'water',
];

/** Map fancy script actions onto the visual acts the #17 brain already knows how to play. */
export const ACTION_TO_ACT = {
  look: 'look', twirl: 'twirl', wave: 'wave', stir: 'wave', rumble: 'twirl', puff: 'wave',
  pace: 'look', sit: 'look', hop: 'twirl', bow: 'wave', spin: 'twirl', sniff: 'look',
  glow: 'look', point: 'wave', orbit: 'twirl', read: 'look', nod: 'wave',
};

/** Built-in fallback per base body: every figure works without AI and without API keys. */
export const FALLBACKS = {
  person: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'wave', 'bow', 'pace', 'read'], tags: ['person'], reactsTo: { person: 'greet', animal: 'greet', troublemaker: 'flee' } },
  animal: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'sniff', 'hop', 'wave'], tags: ['animal'], reactsTo: { animal: 'team', person: 'follow', troublemaker: 'flee' } },
  object: { drives: ['wander', 'idle'], actions: ['look', 'glow', 'spin'], tags: ['object'], reactsTo: { person: 'greet' } },
  place: { drives: ['idle', 'notice'], actions: ['look', 'glow', 'rumble'], tags: ['place'], reactsTo: {} },
  idea: { drives: ['wander', 'idle'], actions: ['look', 'glow', 'orbit', 'twirl'], tags: ['idea'], reactsTo: { idea: 'team' } },
  sprite: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'twirl', 'wave'], tags: ['sprite', 'friend'], reactsTo: { sprite: 'greet', friend: 'greet', person: 'greet' } },
};

const SUBJECT_TAGS = [
  [/\b(police|officer|cop|sheriff|detective|guard)\b/i, 'police'],
  [/\b(criminal|thief|robber|bandit|troublemaker|villain|outlaw|gg allin)\b/i, 'troublemaker'],
  [/\b(chef|cook|baker)\b/i, 'chef'],
];

// Natures: what a thing is to the others, so things on the stage act like themselves with no AI and no setup.
// A zombie finds a brain and eats it; a cat chases a mouse and flees a dog; a mouse eats cheese and flees a cat.
// Each row: the subject pattern, the tags it carries, and how it reacts to others' tags ('eat' consumes what it catches).
export const NATURES = [
  [/\b(zombies?|ghouls?|undead|walkers?)\b/i, ['zombie'], { brain: 'eat', person: 'chase' }],
  [/\bbrains?\b/i, ['brain', 'food'], {}],
  [/\b(cats?|kittens?|kitty)\b/i, ['cat'], { mouse: 'chase', fish: 'eat', dog: 'flee' }],
  [/\b(mouse|mice|rats?)\b/i, ['mouse'], { cheese: 'eat', cat: 'flee' }],
  [/\b(dogs?|puppy|puppies|pup)\b/i, ['dog'], { cat: 'chase', bone: 'eat' }],
  [/\bbones?\b/i, ['bone', 'food'], {}],
  [/\b(fish|goldfish|salmon|tuna)\b/i, ['fish', 'food'], { shark: 'flee' }],
  [/\bcheese\b/i, ['cheese', 'food'], {}],
  [/\b(rabbits?|bunny|bunnies|hares?)\b/i, ['rabbit'], { carrot: 'eat', dog: 'flee' }],
  [/\bcarrots?\b/i, ['carrot', 'food'], {}],
  [/\b(monkeys?|apes?|chimps?)\b/i, ['monkey'], { banana: 'eat' }],
  [/\bbananas?\b/i, ['banana', 'food'], {}],
  [/\bsharks?\b/i, ['shark'], { fish: 'eat' }],
  [/\b(bees?|bumblebees?)\b/i, ['bee'], { flower: 'follow' }],
  [/\b(flowers?|roses?|daisy|daisies|tulips?)\b/i, ['flower'], {}],
  [/\b(clouds?|storm\s?clouds?|rain\s?clouds?|cumulus|thunderheads?)\b/i, ['cloud'], {}],
  [/\bsun\b/i, ['sun'], {}],
  [/\b(fires?|campfires?|bonfires?|flames?)\b/i, ['fire'], {}],
  [/\b(ice|ice\s?cubes?|icebergs?|ice\s?blocks?)\b/i, ['ice'], {}],
  [/\b(sea|ocean|lake|pond|puddle)\b/i, ['water'], {}],
];

// Conditions: some things act only when the conditions are right. A cloud gathers water from the air (faster over a
// sea or lake), and once it is heavy and the air is humid enough it rains, or snows if the air is freezing, then
// lightens and stops; a hot sun or a fire dries it out instead. Ice melts above freezing (fast beside a fire) and is
// gone when it has melted. A flower under rain grows. Everything here is pure: the stage feeds it where things are.
// climateAt: the air around one thing, from the things near it (distance in stage px).
export function climateAt(self, others, base = { temp: 14, humidity: 0.55 }) {
  let temp = base.temp, humidity = base.humidity, rainedOn = false, sun = 0;
  for (const o of others || []) {
    if (!o || o === self || o.id === self.id || !o.kind) continue;
    const dx = (o.x || 0) - (self.x || 0), dy = (o.y || 0) - (self.y || 0), d = Math.hypot(dx, dy);
    const near = (r) => Math.max(0, 1 - d / r);
    if (o.kind === 'sun') { const k = near(420); temp += 16 * k; humidity -= 0.3 * k; sun = Math.max(sun, k); }
    else if (o.kind === 'fire') { const k = near(200); temp += 24 * k; humidity -= 0.15 * k; }
    else if (o.kind === 'ice') temp -= 16 * near(200);
    else if (o.kind === 'water') humidity += 0.45 * near(320);
    // falling rain lands on what is under the cloud (stage y grows downward)
    if (o.kind === 'cloud' && o.state && o.state.falling === 'rain' && Math.abs(dx) < 70 && dy < 0 && dy > -260) rainedOn = true;
  }
  return { temp: Math.round(temp * 10) / 10, humidity: Math.max(0, Math.min(1, humidity)), rainedOn, sun };
}
export function precipFor(temp) { return temp <= 0 ? 'snow' : temp <= 3 ? 'sleet' : 'rain'; }
export const CONDITIONS = {
  cloud: {
    start: () => ({ water: 0.35, falling: null, storm: false }),
    step(st, env, dt) {
      let water = st.water + dt * 0.06 * Math.max(0, env.humidity - 0.3) - (env.temp > 28 ? dt * 0.04 : 0);
      let falling = st.falling;
      if (!falling && water >= 0.75 && env.humidity >= 0.45) falling = precipFor(env.temp);
      if (falling) { falling = precipFor(env.temp); water -= dt * 0.07; if (water <= 0.3) falling = null; }
      water = Math.max(0, Math.min(1, water));
      return { water, falling, storm: falling === 'rain' && water > 0.85 && env.temp >= 20 };
    },
  },
  ice: {
    start: () => ({ melt: 0 }),
    step(st, env, dt) { const melt = Math.max(0, Math.min(1, st.melt + dt * (env.temp > 0 ? env.temp * 0.0012 : env.temp * 0.002))); return { melt, gone: melt >= 1 }; },
  },
  flower: {
    start: () => ({ grow: 0 }),
    step(st, env, dt) { return { grow: Math.min(1, st.grow + (env.rainedOn ? dt * 0.12 : 0)) }; },
  },
};
// advance: the world lives on while you are away. Two things happen to what you left on the stage, with no clock and no
// Math.random, so the same things and the same ms end the same on every device:
//  1. conditions: a cloud, ice and a flower are stepped with the same CONDITIONS and climateAt the stage runs live;
//  2. reactions: the NATURES that are reactions play out between the things that are there: a zombie walks to a brain and
//     eats it, a dog goes for a bone, a cat catches a mouse (the mouse flees, a cat flees a dog), a bee finds a flower.
// Fixed steps of AWAY_STEP_S seconds; each seed gives a thing a steady pace of its own (0.9x to 1.1x) and that is all a
// seed changes. things: [{ id, kindOf|kind, x, y, at?: { x, y }, seed?, nature?, title? }]: `at` is where the figure last
// was (its own place, which beats the card's x, y). opts.bounds { w, h } is the stage (default 1200 x 700). Returns
// { things: the same things moved on (an eaten one carries gone: true), changes: [{ id, kind, what, with? }], note }.
export const AWAY_MIN_MS = 60e3; // under a minute away there is nothing to tell
export const AWAY_MAX_MS = 24 * 36e5; // a day is as far as the world is replayed
export const AWAY_STEP_S = 5; // seconds per simulated step
export const WALK_PX_S = { zombie: 14, cat: 60, dog: 70, mouse: 55, rabbit: 50, monkey: 45, shark: 40, fish: 30, bee: 80 }; // how fast each walks
const NEAR_PX = 24, FLEE_SEES_PX = 300;
const paceOf = (seed) => { let h = (Number(seed) || 0) >>> 0; h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return 0.9 + 0.2 * (((h ^ (h >>> 16)) >>> 0) / 4294967296); };
const kindOfThing = (t) => String((t && (t.kindOf || t.kind)) || '');
const placeOf = (t) => (t.at && Number.isFinite(t.at.x) && Number.isFinite(t.at.y) ? { x: t.at.x, y: t.at.y } : { x: Number(t.x) || 0, y: Number(t.y) || 0 });
export function awayText(ms) {
  const m = Math.round(ms / 6e4);
  if (m < 60) return m + ' min';
  const h = Math.round(m / 60);
  return h < 48 ? (h === 1 ? '1 hour' : h + ' hours') : Math.round(h / 24) + ' days';
}
const REACTION_WORDS = { eat: 'found', follow: 'found', chase: 'caught' };
export function advance(things, ms, opts = {}) {
  const list = Array.isArray(things) ? things.filter((t) => t && t.id != null) : [];
  const away = Math.max(0, Math.min(AWAY_MAX_MS, Math.floor(Number(ms) || 0)));
  const W = Math.max(100, Number(opts.bounds && opts.bounds.w) || 1200), H = Math.max(100, Number(opts.bounds && opts.bounds.h) || 700);
  const nat = new Map(list.map((t) => [t.id, natureOf(kindOfThing(t))]));
  const conds = list.filter((t) => CONDITIONS[kindOfThing(t)]);
  const actors = list.filter((t) => Object.keys(nat.get(t.id).reactsTo).length);
  if (!away || (!conds.length && !actors.length)) return { things: list.map((t) => ({ ...t })), changes: [], note: '' };
  const cur = new Map(conds.map((t) => [t.id, t.nature ? { ...t.nature } : CONDITIONS[kindOfThing(t)].start()]));
  const first = new Map([...cur].map(([id, st]) => [id, { ...st }]));
  const fell = new Map();
  const pos = new Map(list.map((t) => [t.id, placeOf(t)]));
  const moved = new Set(), gone = new Set(), done = new Set(), reacted = [];
  const tagsOf = (id) => nat.get(id).tags;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const walk = (id, from, to, step, away_) => { // one step toward (or away from) a point, kept on the stage
    const d = dist(from, to); if (d < 1e-9) return from;
    const k = (away_ ? -1 : 1) * Math.min(step, away_ ? step : d) / d;
    moved.add(id);
    return { x: Math.max(0, Math.min(W, from.x + (to.x - from.x) * k)), y: Math.max(0, Math.min(H, from.y + (to.y - from.y) * k)) };
  };
  let left = away / 1000;
  while (left > 1e-9) {
    const dt = Math.min(AWAY_STEP_S, left); left -= dt;
    // 1. conditions
    const others = conds.map((t) => ({ id: t.id, x: pos.get(t.id).x, y: pos.get(t.id).y, kind: kindOfThing(t), state: cur.get(t.id) }));
    const next = new Map();
    for (const t of conds) {
      const p = pos.get(t.id);
      const env = climateAt({ id: t.id, x: p.x, y: p.y }, others);
      const st = CONDITIONS[kindOfThing(t)].step(cur.get(t.id), env, dt * paceOf(t.seed));
      next.set(t.id, st);
      if (st.falling) fell.set(t.id, st.falling);
    }
    for (const [id, st] of next) cur.set(id, st);
    // 2. reactions, in the order the things were left
    for (const a of actors) {
      if (gone.has(a.id)) continue;
      const step = (WALK_PX_S[kindOfThing(a)] || 40) * paceOf(a.seed) * dt, me = pos.get(a.id), rx = nat.get(a.id).reactsTo;
      // afraid first: a chaser close by (not one that has already caught this one) and it runs
      let chaser = null, cd = FLEE_SEES_PX;
      for (const o of actors) {
        if (o === a || gone.has(o.id) || done.has(o.id + '>' + a.id)) continue;
        const ro = nat.get(o.id).reactsTo;
        if (!tagsOf(a.id).some((tg) => ro[tg] === 'chase')) continue;
        if (!Object.entries(rx).some(([tg, r]) => r === 'flee' && tagsOf(o.id).includes(tg))) continue;
        const d = dist(me, pos.get(o.id)); if (d < cd) { cd = d; chaser = o; }
      }
      if (chaser) { pos.set(a.id, walk(a.id, me, pos.get(chaser.id), step, true)); continue; }
      // otherwise go for the nearest thing it reacts to
      let goal = null, how = null, gd = Infinity;
      for (const o of list) {
        if (o === a || gone.has(o.id) || done.has(a.id + '>' + o.id)) continue;
        const r = Object.entries(rx).find(([tg, v]) => v !== 'flee' && tagsOf(o.id).includes(tg));
        if (!r) continue;
        const d = dist(me, pos.get(o.id)); if (d < gd) { gd = d; goal = o; how = r[1]; }
      }
      if (!goal) continue;
      const near = Math.max(NEAR_PX, step);
      if (gd <= near) {
        pos.set(a.id, { ...pos.get(goal.id) }); moved.add(a.id); // it ends beside what it caught or found
        done.add(a.id + '>' + goal.id);
        reacted.push({ id: a.id, kind: kindOfThing(a), what: REACTION_WORDS[how] || 'found', with: kindOfThing(goal) });
        if (how === 'eat') gone.add(goal.id);
      } else pos.set(a.id, walk(a.id, me, pos.get(goal.id), step, false));
    }
  }
  const changes = [];
  for (const t of conds) {
    const k = kindOfThing(t), a = first.get(t.id), b = cur.get(t.id);
    if (k === 'cloud' && fell.has(t.id)) changes.push({ id: t.id, kind: k, what: fell.get(t.id) === 'snow' ? 'snowed' : 'rained' });
    else if (k === 'ice' && b.melt - a.melt >= 0.05) changes.push({ id: t.id, kind: k, what: b.gone ? 'melted away' : 'melted' });
    else if (k === 'flower' && b.grow - a.grow >= 0.05) changes.push({ id: t.id, kind: k, what: 'grew' });
  }
  changes.push(...reacted);
  const groups = new Map();
  for (const c of changes) { const key = c.kind + '|' + c.what + '|' + (c.with || ''); const g = groups.get(key) || { ...c, n: 0 }; g.n += 1; groups.set(key, g); }
  const parts = [...groups.values()].map((g) => (g.n > 1 ? g.n + ' ' + g.kind + 's ' : 'the ' + g.kind + ' ') + g.what + (g.with ? ' the ' + g.with : ''));
  const note = parts.length ? 'While you were away (' + awayText(away) + '): ' + parts.join(', ') + '.' : '';
  return {
    things: list.map((t) => {
      const out = { ...t };
      if (cur.has(t.id)) out.nature = cur.get(t.id);
      if (moved.has(t.id)) { const p = pos.get(t.id); out.at = { x: Math.round(p.x), y: Math.round(p.y) }; }
      if (gone.has(t.id)) out.gone = true;
      return out;
    }),
    changes, note,
  };
}
export function natureOf(subject) {
  const tags = [], reactsTo = {};
  for (const [re, t, r] of NATURES) if (re.test(String(subject || ''))) { tags.push(...t); Object.assign(reactsTo, r); }
  return { tags, reactsTo };
}

function uniq(list) {
  const out = []; const seen = new Set();
  for (const x of list || []) {
    const s = String(x || '').toLowerCase().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s); out.push(s);
  }
  return out;
}

/** Stable cache key for a subject (title first, else body). */
export function subjectKey(card = {}, body = 'sprite') {
  const t = String(card.title || card.subject || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (t || String(body || 'sprite').toLowerCase()).slice(0, 80);
}

/** Role tags inferred from a subject title (police, troublemaker, …) plus the body tag.
 * Subject roles come first so pickReaction prefers chase/flee over a generic body greet. */
export function tagsFor(body = 'sprite', subject = null) {
  const out = [];
  const hay = String(subject || '');
  for (const [re, tag] of SUBJECT_TAGS) if (re.test(hay)) out.push(tag);
  out.push(...natureOf(hay).tags);
  const b = FALLBACKS[body] ? body : 'sprite';
  out.push(b);
  return uniq(out).filter((t) => KNOWN_TAGS.includes(t));
}

/** Fallback script for a base body (or sprite), with default reactsTo / tags (Next #20). */
export function fallbackScript(body = 'sprite', subject = null) {
  const b = FALLBACKS[body] ? body : 'sprite';
  const base = FALLBACKS[b];
  const tags = tagsFor(b, subject);
  // Police chase troublemakers; troublemakers flee police — the #20 done-when pair.
  let reactsTo = { ...(base.reactsTo || {}) };
  if (tags.includes('police')) reactsTo = { ...reactsTo, troublemaker: 'chase' };
  if (tags.includes('troublemaker')) reactsTo = { ...reactsTo, police: 'flee' };
  if (tags.includes('chef')) reactsTo = { ...reactsTo, person: 'greet' };
  reactsTo = { ...reactsTo, ...natureOf(subject).reactsTo }; // its nature wins over the body's polite default
  return {
    drives: base.drives.slice(),
    actions: base.actions.slice(),
    tags,
    reactsTo: { ...reactsTo },
    subject: subject || null,
    source: 'fallback',
    body: b,
  };
}

function trimReactsTo(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const tag = String(k || '').toLowerCase().trim();
    const react = String(v || '').toLowerCase().trim();
    if (KNOWN_TAGS.includes(tag) && KNOWN_REACTS.includes(react)) out[tag] = react;
  }
  return out;
}

/**
 * Keep only known drives, actions, tags and reactsTo. Empty / junk input collapses to the body fallback.
 * Unknown names are dropped so a model can never invent an unsafe verb.
 */
export function trimScript(raw, body = 'sprite', subject = null) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch (_) { obj = null; }
  }
  if (!obj || typeof obj !== 'object') return fallbackScript(body, subject);
  const drives = uniq(obj.drives).filter((d) => KNOWN_DRIVES.includes(d));
  const actions = uniq(obj.actions).filter((a) => KNOWN_ACTIONS.includes(a));
  const fb = fallbackScript(body, subject);
  const tags = uniq([...(obj.tags || []), ...tagsFor(body, subject)]).filter((t) => KNOWN_TAGS.includes(t));
  const reactsTo = { ...fb.reactsTo, ...trimReactsTo(obj.reactsTo) };
  return {
    drives: drives.length ? drives : fb.drives,
    actions: actions.length ? actions : fb.actions,
    tags: tags.length ? tags : fb.tags,
    reactsTo,
    subject: subject || (obj.subject ? String(obj.subject).slice(0, 80) : null),
    source: obj.source === 'ai' || obj.source === 'cache' ? obj.source : (obj.source || 'trimmed'),
    body: FALLBACKS[body] ? body : 'sprite',
  };
}

/** Pick one idle action name from a script (falls back to look). */
export function pickIdleAction(script, rng = Math.random) {
  const acts = (script && script.actions && script.actions.length) ? script.actions : FALLBACKS.sprite.actions;
  return acts[Math.floor(rng() * acts.length)] || 'look';
}

/** Map a script action onto the visual act the brain plays (look / twirl / wave). */
export function visualAct(action) {
  return ACTION_TO_ACT[action] || 'look';
}

/** True when the script allows a drive (missing drives = all allowed, so old figures keep working). */
export function allowsDrive(script, drive) {
  if (!script || !script.drives || !script.drives.length) return true;
  return script.drives.includes(drive);
}

/**
 * Next #20: pick how `self` reacts to `other` from self.reactsTo × other.tags.
 * First matching tag wins (stable order of other.tags). null = no reaction.
 */
export function pickReaction(selfScript, otherScript) {
  if (!selfScript || !otherScript) return null;
  const reacts = selfScript.reactsTo || {};
  const tags = otherScript.tags || [];
  for (const tag of tags) {
    if (reacts[tag] && KNOWN_REACTS.includes(reacts[tag])) return reacts[tag];
  }
  return null;
}

// two things of the same nature (both zombies, both cats): their nature tags overlap, 'food' aside
const NATURE_TAGS = new Set(NATURES.flatMap(([, t]) => t).filter((t) => t !== 'food'));
function sameKind(a, b) { const ta = (a && a.tags) || [], tb = new Set((b && b.tags) || []); return ta.some((t) => NATURE_TAGS.has(t) && tb.has(t)); }
/**
 * Among nearby others, pick the best (nearest) reaction target.
 * Returns { other, react } or null. Distance is screen px.
 */
export function pickNearbyReaction(self, others, maxDist = 220) {
  if (!self || !others || !others.length) return null;
  let best = null;
  for (const o of others) {
    if (!o || o === self || o.id === self.id) continue;
    if (o.leaving || o.chasedOff || o.eaten) continue;
    const d = Math.hypot((o.x || 0) - (self.x || 0), (o.y || 0) - (self.y || 0));
    const react = pickReaction(self.script, o.script);
    if (!react) continue;
    if ((react === 'chase' || react === 'eat') && sameKind(self.script, o.script)) continue; // a zombie does not hunt a zombie
    if (d > (react === 'eat' ? maxDist * 5 : maxDist)) continue; // food is smelled from across the stage: a hunter finds it
    const rank = react === 'eat' ? 0 : 1; // hunger first: food in reach beats a nearer chase
    if (!best || rank < best.rank || (rank === best.rank && d < best.d)) best = { other: o, react, d, rank };
  }
  return best ? { other: best.other, react: best.react } : null;
}

export default {
  KNOWN_DRIVES, KNOWN_ACTIONS, KNOWN_REACTS, KNOWN_TAGS, ACTION_TO_ACT, FALLBACKS,
  subjectKey, tagsFor, fallbackScript, trimScript, pickIdleAction, visualAct, allowsDrive, natureOf, NATURES, climateAt, precipFor, CONDITIONS, advance, awayText,
  pickReaction, pickNearbyReaction,
};
