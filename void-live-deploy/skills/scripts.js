/**
 * scripts — Next #19: behavior scripts for figures (drives + idle actions true to the subject).
 * Pure JS, no three.js: fallbacks, trim of unknown names, and the idle-act picker are tested offline.
 * Workers AI writes a fresh script through /api/figurescript; when AI is off the fallback for the body runs.
 *
 * Script shape: { drives: string[], actions: string[], subject?: string }
 * Only names in KNOWN_DRIVES / KNOWN_ACTIONS are kept (unknown ones are trimmed so every script is safe to run).
 */
export const KNOWN_DRIVES = ['wander', 'notice', 'idle'];
export const KNOWN_ACTIONS = [
  'look', 'twirl', 'wave', 'stir', 'rumble', 'puff', 'pace', 'sit', 'hop', 'bow',
  'spin', 'sniff', 'glow', 'point', 'orbit', 'read', 'nod',
];

/** Map fancy script actions onto the visual acts the #17 brain already knows how to play. */
export const ACTION_TO_ACT = {
  look: 'look', twirl: 'twirl', wave: 'wave', stir: 'wave', rumble: 'twirl', puff: 'wave',
  pace: 'look', sit: 'look', hop: 'twirl', bow: 'wave', spin: 'twirl', sniff: 'look',
  glow: 'look', point: 'wave', orbit: 'twirl', read: 'look', nod: 'wave',
};

/** Built-in fallback per base body: every figure works without AI and without API keys. */
export const FALLBACKS = {
  person: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'wave', 'bow', 'pace', 'read'] },
  animal: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'sniff', 'hop', 'wave'] },
  object: { drives: ['wander', 'idle'], actions: ['look', 'glow', 'spin'] },
  place: { drives: ['idle', 'notice'], actions: ['look', 'glow', 'rumble'] },
  idea: { drives: ['wander', 'idle'], actions: ['look', 'glow', 'orbit', 'twirl'] },
  sprite: { drives: ['wander', 'notice', 'idle'], actions: ['look', 'twirl', 'wave'] },
};

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

/** Fallback script for a base body (or sprite). */
export function fallbackScript(body = 'sprite', subject = null) {
  const b = FALLBACKS[body] ? body : 'sprite';
  const base = FALLBACKS[b];
  return { drives: base.drives.slice(), actions: base.actions.slice(), subject: subject || null, source: 'fallback', body: b };
}

/**
 * Keep only known drives and actions. Empty / junk input collapses to the body fallback.
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
  return {
    drives: drives.length ? drives : fb.drives,
    actions: actions.length ? actions : fb.actions,
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

export default {
  KNOWN_DRIVES, KNOWN_ACTIONS, ACTION_TO_ACT, FALLBACKS,
  subjectKey, fallbackScript, trimScript, pickIdleAction, visualAct, allowsDrive,
};
