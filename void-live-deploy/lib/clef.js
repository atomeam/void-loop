// Clef beside the embedding router (frontier #9, first piece). Clef-flash (@cf/cloudflare/clef-flash, Workers AI 2026-10-01) is a
// decision model: it reads a state and typed questions and returns a probability for every allowed answer. Here the state is the
// ask and the one question is a `choice` over the router's skills (lib/router.js SKILLS) plus "none" (an ask to answer in words).
// Nothing here is wired into /api/answer yet: /api/bench (owner only) runs both routers on the bench's asks and
// tools/route-bench.mjs scores them; the router switches only where Clef wins.
import { SKILLS } from './router.js';
import { CLEF_MODEL } from './models.js';

export { CLEF_MODEL };
export const NONE = 'none';
export const CLEF_TIMEOUT_MS = 3000;

const ABOUT = {
  self: 'About Void itself: what it can do, its menu, its board, what it wants',
  act: 'Doing something for the person in the world: sending a message or email, booking, buying, paying, scheduling',
};
// the one question: which skill should take this ask, or none of them
export function skillQuestion(skills = SKILLS) {
  const criteria = {};
  for (const [k, s] of Object.entries(skills)) criteria[k] = ABOUT[k] || 'Puts or does this on the screen, e.g. ' + (s.examples || []).slice(0, 3).map((e) => '"' + e + '"').join(', ');
  criteria[NONE] = 'A question to answer in words (facts, explanations, advice, history), or anything none of the others does';
  return { skill: { type: 'choice', instructions: 'Verse is a blank screen that answers asks. Which of its skills should handle this ask? Pick none when the person wants an answer in words rather than a thing made or done.', criteria } };
}

// the chosen option and its probability, from whatever shape the answer carries (choice + a probability per option + confidence)
export function clefPick(r) {
  const a = r && (r.answers || (r.result && r.result.answers)) && (r.answers || r.result.answers).skill;
  if (!a || typeof a !== 'object') return null;
  const probs = [a.probabilities, a.options, a.probs, a.distribution].find((x) => x && typeof x === 'object' && !Array.isArray(x)) || null;
  let skill = typeof a.choice === 'string' ? a.choice : null;
  if (!skill && probs) skill = Object.entries(probs).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
  if (!skill) return null;
  const p = probs && Number.isFinite(Number(probs[skill])) ? Number(probs[skill]) : Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : null;
  return { skill, p: p == null ? null : Math.round(p * 1000) / 1000, confidence: Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : null };
}

// one ask through Clef-flash. Never throws: a failure is { kind: 'fallback', why }.
export async function clefRoute(env, ask, { question = skillQuestion() } = {}) {
  const t0 = Date.now();
  if (!env || !env.AI) return { kind: 'fallback', why: 'no model', ms: 0 };
  let t;
  try {
    const r = await Promise.race([
      env.AI.run(CLEF_MODEL, { model: 'clef-flash', state: String(ask).slice(0, 300), questions: question }),
      new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), CLEF_TIMEOUT_MS); }),
    ]);
    const pick = clefPick(r);
    if (!pick || !(pick.skill in question.skill.criteria)) return { kind: 'fallback', why: 'no answer', ms: Date.now() - t0 };
    return { kind: pick.skill === NONE ? NONE : 'skill', skill: pick.skill === NONE ? null : pick.skill, p: pick.p, ms: Date.now() - t0 };
  } catch (e) {
    return { kind: 'fallback', why: /timeout/.test(String(e && e.message)) ? 'timeout' : 'model error', ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

// Yes/no calls (frontier #10): the same model on one choice between yes and no about a short text, e.g. whether a goal is a
// daily practice (lib/plan.js PRACTICE_ASK). { yes: true | false, p } or, on any failure, { yes: null, why }: never a guess.
export function yesNoQuestion(instructions) {
  return { skill: { type: 'choice', instructions, criteria: { yes: 'Yes, it is', no: 'No, it is not' } } };
}
export async function clefYesNo(env, text, instructions) {
  const r = await clefRoute(env, text, { question: yesNoQuestion(instructions) });
  return r.kind === 'skill' ? { yes: r.skill === 'yes', p: r.p, ms: r.ms } : { yes: null, why: r.why, ms: r.ms };
}

// Where Clef routes (frontier #9, Route bench run 38428528839, 2026-10-13): Clef-flash 290/306 right against the embedding
// router's 201/306; it won by 2+ on these skills and sent 3 of 69 answer-in-words asks to a skill. Every other skill keeps the
// embedding guess. Below CONFIDENT Clef is not followed; its pick is kept as `unsure`, for asking instead of guessing.
export const CLEF_SKILLS = ['calc', 'place', 'timer', 'translate', 'weather', 'worldtime'];
export const CONFIDENT = 0.7;
export function clefOn(env) { return !(env && /^(off|0|false|no)$/i.test(String(env.VOID_CLEF || ''))); }

// the embedding router's result, with Clef's pick taking over where Clef won the bench
export function mergeRoute(embed, clef) {
  const e = embed || { kind: 'fallback', why: 'no route' };
  if (!clef || clef.kind === 'fallback') return e;
  const sure = clef.p != null && clef.p >= CONFIDENT;
  const mine = (k) => CLEF_SKILLS.includes(k);
  if (!sure) return (clef.skill && mine(clef.skill)) ? { ...e, unsure: clef.skill, clefP: clef.p } : e;
  if (clef.kind === 'skill' && mine(clef.skill)) return { ...e, kind: 'skill', skill: clef.skill, score: clef.p, by: 'clef' };
  if (clef.kind === NONE && e.kind === 'skill' && mine(e.skill)) return { ...e, kind: 'simple', skill: undefined, score: clef.p, by: 'clef' };
  return e;
}
