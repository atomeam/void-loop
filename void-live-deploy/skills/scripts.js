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
export const KNOWN_REACTS = ['greet', 'follow', 'chase', 'flee', 'argue', 'team'];
/** Role tags a script may claim; others match against these in reactsTo. */
export const KNOWN_TAGS = [
  'police', 'troublemaker', 'animal', 'person', 'place', 'object', 'idea', 'sprite', 'chef', 'friend',
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

/**
 * Among nearby others, pick the best (nearest) reaction target.
 * Returns { other, react } or null. Distance is screen px.
 */
export function pickNearbyReaction(self, others, maxDist = 220) {
  if (!self || !others || !others.length) return null;
  let best = null;
  for (const o of others) {
    if (!o || o === self || o.id === self.id) continue;
    if (o.leaving || o.chasedOff) continue;
    const d = Math.hypot((o.x || 0) - (self.x || 0), (o.y || 0) - (self.y || 0));
    if (d > maxDist) continue;
    const react = pickReaction(self.script, o.script);
    if (!react) continue;
    if (!best || d < best.d) best = { other: o, react, d };
  }
  return best ? { other: best.other, react: best.react } : null;
}

export default {
  KNOWN_DRIVES, KNOWN_ACTIONS, KNOWN_REACTS, KNOWN_TAGS, ACTION_TO_ACT, FALLBACKS,
  subjectKey, tagsFor, fallbackScript, trimScript, pickIdleAction, visualAct, allowsDrive,
  pickReaction, pickNearbyReaction,
};
