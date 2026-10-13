// Clef beside the embedding router (frontier #9, first piece). Clef-flash (@cf/cloudflare/clef-flash, Workers AI 2026-10-01) is a
// decision model: it reads a state and typed questions and returns a probability for every allowed answer. Here the state is the
// ask and the one question is a `choice` over the router's skills (lib/router.js SKILLS) plus "none" (an ask to answer in words).
// Nothing here is wired into /api/answer yet: /api/bench (owner only) runs both routers on the bench's asks and
// tools/route-bench.mjs scores them; the router switches only where Clef wins.
import { SKILLS } from './router.js';

export const CLEF_MODEL = '@cf/cloudflare/clef-flash';
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
  return { skill: { type: 'choice', instructions: 'Void is a blank screen that answers asks. Which of its skills should handle this ask? Pick none when the person wants an answer in words rather than a thing made or done.', criteria } };
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
