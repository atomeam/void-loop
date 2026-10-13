/**
 * An open plan (frontier #10, next step): an explicit plan ask of a kind skills/intent.js has no steps for ("plan my garden",
 * "make a plan to learn Spanish") goes to the answer engine, /api/answer mode 'plan'. This is the pure half: the goal as one
 * clean line, the fixed rules the model gets, and the reply turned into 3 to 7 short steps. The model only fills in steps;
 * the page builds the one ask that runs from them ("make a list with …"), so a reply can never call anything else.
 * Nothing is stored. Tests: tools/plan.test.mjs.
 */
export const GOAL_MAX = 80, STEP_MAX = 60, PLAN_MIN = 3, PLAN_MAX = 7;
export const PLAN_SYSTEM = 'You turn one personal goal into a short checklist. Answer with only a JSON array of 3 to 7 steps in the order to do them, '
  + 'each a plain instruction of at most 8 words, with no numbering, no dates and no commas. Do not give medical, legal or financial advice; '
  + 'if the goal needs it, make the first step "Talk to a professional". When the goal is a skill practised a little each day, '
  + 'you may answer {"steps": [...], "timer": N} instead, N the whole minutes of one practice session (5 to 60). You may also add '
  + '"note": one short encouraging line to keep in mind (at most 12 words).';
// the yes/no call Clef makes beside the plan (lib/clef.js clefYesNo): a timer fits a daily practice, not a project done once
export const PRACTICE_ASK = 'Is this goal a skill the person practises a little each day (a language, an instrument, drawing, a sport, fitness), rather than a project done once (a garden, a move, a trip)?';
/** the engine's timer, unless Clef said the goal is not a daily practice; Clef failing or off leaves it as the engine said */
export const keepTimer = (timer, daily) => (daily && daily.yes === false ? null : timer);
// the second call: a skill to learn (an instrument, a language, a craft), rather than a project, opens with finding a teacher
export const LEARN_ASK = 'Is this goal a new skill the person wants to learn (a language, an instrument, a craft, a sport), rather than a project or a task to finish?';
export const LEARN_STEP = 'Find a teacher or a course';
const TAUGHT = /\b(?:teachers?|tutors?|courses?|class(?:es)?|lessons?|coach(?:es)?|instructors?|school)\b/i;
/** the steps, opened with LEARN_STEP when Clef said it is a skill to learn and no step already finds teaching; a full plan stays */
export const withLearnStep = (steps, learn) => (learn && learn.yes === true && steps.length < PLAN_MAX && !steps.some((s) => TAUGHT.test(s)) ? [LEARN_STEP, ...steps] : steps);
export const NOTE_MAX = 80;
export const TIMER_MIN = 5, TIMER_MAX = 60;

const ctl = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ');
/** the goal as one line, at most GOAL_MAX characters */
export const cleanGoal = (s) => ctl(s).replace(/\s+/g, ' ').trim().slice(0, GOAL_MAX).trim();
export const planPrompt = (goal) => 'Goal: ' + goal;

// the list ask (skills/list.js) splits on commas, "and", "&" and new lines: a step keeps them out so it stays one item
const cleanStep = (s) => ctl(s).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'`]+|["'`.]+$/g, '').replace(/[,;]+/g, ' ')
  .replace(/\s*&\s*|\s+and\s+/gi, ' + ').replace(/\s+/g, ' ').trim().slice(0, STEP_MAX).trim();

/** the model's reply -> 3 to 7 steps (a JSON array, or a numbered or bulleted list), else null */
export function parsePlan(text) {
  const t = String(text || '');
  let raw = null;
  const a = t.match(/\[[\s\S]*\]/);
  if (a) { try { const j = JSON.parse(a[0]); if (Array.isArray(j)) raw = j.filter((x) => typeof x === 'string'); } catch (_) {} }
  if (!raw) raw = t.split('\n').filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l));
  const seen = new Set(), steps = [];
  for (const r of raw) {
    const s = cleanStep(r), k = s.toLowerCase();
    if (s.length < 3 || seen.has(k)) continue;
    seen.add(k); steps.push(s);
    if (steps.length === PLAN_MAX) break;
  }
  return steps.length >= PLAN_MIN ? steps : null;
}

/** the one practice timer a reply may suggest ({"steps": [...], "timer": 20}): whole minutes from TIMER_MIN to TIMER_MAX, else null */
export function parseTimer(text) {
  const o = String(text || '').match(/\{[\s\S]*\}/);
  if (!o) return null;
  let j = null; try { j = JSON.parse(o[0]); } catch (_) { return null; }
  const v = j && (typeof j.timer === 'number' || (typeof j.timer === 'string' && /^\d+$/.test(j.timer.trim()))) ? Number(j.timer) : NaN;
  return Number.isInteger(v) && v >= TIMER_MIN && v <= TIMER_MAX ? v : null;
}

/** a note to self as one plain line: no markup, no control characters, cut at a word under NOTE_MAX; '' when nothing is left */
export function cleanNote(s) {
  let t = ctl(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > NOTE_MAX) { const cut = t.slice(0, NOTE_MAX + 1); const sp = cut.lastIndexOf(' '); t = (sp > 20 ? cut.slice(0, sp) : t.slice(0, NOTE_MAX)).trim(); }
  return t;
}
/** the one note to self a reply may carry ({"steps": [...], "note": "..."}), cleaned; null when there is none */
export function parseNote(text) {
  const o = String(text || '').match(/\{[\s\S]*\}/);
  if (!o) return null;
  let j = null; try { j = JSON.parse(o[0]); } catch (_) { return null; }
  const n = j && typeof j.note === 'string' ? cleanNote(j.note) : '';
  return n.length >= 3 ? n : null;
}
