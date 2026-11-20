// A model judge for answers, next to the pattern checks (owner, 2026-11-20). Blind and pairwise: one call shows the question, then two answers in
// a random order (A and B, one is Verse's and one is the reference), and asks for right, useful and clear, 0-100, for each. The judge does not
// know which is which, and the order is shuffled so a model that likes the first answer cannot favour Verse. It tries Gemini first (a different
// model family from the one that answers), then the free Workers AI review model; no key or no readable answer is "unjudged", never a pass.
// Keys come from the environment of the house lane and are never printed or kept.
import { models } from '../void-live-deploy/lib/models.js';

/** why each judge did not answer in this process, for the log line: { gemini: 'HTTP 429', 'workers-ai': 'no key' }; empty when one did. Never holds a key. */
export const judgeWhy = {};
/** Gemini models tried in order (gemini-2.0-flash was shut down on 2026-06-01 and answers 404): the low-cost current one, then the 2.5 one still served to earlier users. */
export const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];
const cut = (s, n = 1200) => String(s || '').trim().slice(0, n);
/** the prompt: the rubric, the question and the two answers as A and B. Pure. */
export const judgePrompt = (ask, a, b) => 'You are a strict, fair grader of answers to a question a real person asked. Score each answer from 0 to 100 on three things:\n'
  + '- right: every fact is correct and nothing important is wrong or missing; an honest "I cannot see that live" is right when the question needs live data;\n'
  + '- useful: it gives what the person needs to act, in the shape they asked for (steps, a list, a draft, a number), and is not a dodge;\n'
  + '- clear: plain, short, no filler, no rambling, no raw data.\n'
  + 'Do not prefer an answer for being longer or for coming first. Reply with only JSON, like {"A":{"right":90,"useful":80,"clear":95},"B":{"right":70,"useful":60,"clear":90}}.\n\n'
  + 'Question: ' + cut(ask, 400) + '\n\nAnswer A:\n' + cut(a) + '\n\nAnswer B:\n' + cut(b);
/** the marks out of a model's reply, or null when it is not the JSON asked for. Pure. */
export function readJudge(reply) {
  const m = /\{[\s\S]*\}/.exec(String(reply || '')); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const out = {};
  for (const k of ['A', 'B']) { const o = j && j[k]; if (!o) return null; out[k] = {}; for (const d of ['right', 'useful', 'clear']) { const v = +o[d]; if (!Number.isFinite(v) || v < 0 || v > 100) return null; out[k][d] = Math.round(v); } }
  return out;
}
/** one blind call: { answer, reference, by } with the three marks each, or null (unjudged). `fetchFn` and `rnd` are injectable. */
export async function judge(ask, answer, reference, env = process.env, fetchFn = fetch, rnd = Math.random) {
  const flip = rnd() < 0.5, prompt = judgePrompt(ask, flip ? reference : answer, flip ? answer : reference), cf = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  for (const k of Object.keys(judgeWhy)) delete judgeWhy[k]; // the reason is the latest call's
  const done = (v, by) => v && { answer: flip ? v.B : v.A, reference: flip ? v.A : v.B, by };
  try {
    if (!env.GEMINI_API_KEY) judgeWhy.gemini = 'no key';
    if (env.GEMINI_API_KEY) {
      for (const m of GEMINI_MODELS) {
        const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }), signal: AbortSignal.timeout(40000) });
        const j = await r.json().catch(() => ({})), v = done(readJudge(j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text), 'gemini'); if (v) { judgeWhy.gemini = ''; return v; }
        judgeWhy.gemini = r.ok ? 'answer unreadable' : 'HTTP ' + r.status + ' (' + m + ')';
        if (r.ok) break; // a model that answers badly is not retried on the next one; a 404 or 403 is
      }
    }
    if (!(cf && env.CLOUDFLARE_ACCOUNT_ID)) judgeWhy['workers-ai'] = 'no key';
    if (cf && env.CLOUDFLARE_ACCOUNT_ID) {
      const r = await fetchFn('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + models('review'), { method: 'POST', headers: { authorization: 'Bearer ' + cf, 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0 }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({})), t = (j.result && (j.result.response || j.result)) || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      const v = done(readJudge(typeof t === 'string' ? t : JSON.stringify(t)), 'workers-ai'); if (v) { judgeWhy['workers-ai'] = ''; return v; }
      judgeWhy['workers-ai'] = r.ok ? 'answer unreadable' : 'HTTP ' + r.status;
    }
  } catch (e) { for (const k of ['gemini', 'workers-ai']) if (!judgeWhy[k] && ((k === 'gemini' && env.GEMINI_API_KEY) || (k !== 'gemini' && cf && env.CLOUDFLARE_ACCOUNT_ID))) judgeWhy[k] = String((e && e.name) || 'error').slice(0, 30); /* an unjudged answer is reported as unjudged, never passed */ }
  return null;
}
const mean = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0);
/** the judged means for Verse and for the reference, and whether Verse beats the reference: overall at least equal, no mark more than 5 behind. Pure. */
export function compare(judged) {
  const ok = judged.filter(Boolean); if (!ok.length) return null;
  const side = (k) => { const r = {}; for (const d of ['right', 'useful', 'clear']) r[d] = mean(ok.map((j) => j[k][d])); r.overall = mean([r.right, r.useful, r.clear]); return r; };
  const answer = side('answer'), reference = side('reference');
  return { judged: ok.length, answer, reference, by: [...new Set(ok.map((j) => j.by))], beats: answer.overall >= reference.overall && ['right', 'useful', 'clear'].every((d) => answer[d] >= reference[d] - 5) };
}
/** the reasons as a short phrase for the log line, or '' when nothing failed. Pure. */
export const whyLine = (why = judgeWhy) => Object.entries(why).filter(([, v]) => v).map(([k, v]) => k + ' ' + v).join(', ');
