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
  + 'if the goal needs it, make the first step "Talk to a professional".';

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
