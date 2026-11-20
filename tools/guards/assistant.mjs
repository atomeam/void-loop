// The assistant exam (the 20 fixed questions once a day, and a fresh held-out sample of 20 from the pool at every ride, tools/heldout-exam.mjs) rides the house lanes (tools/assistant-exam.mjs, docs/map.d/tower-assistant.md): once a day it puts the 20 fixed questions
// to the live agent, logs the score on /progress/ and in tower.assistant.json, records the three marks on the Tower target, queues every
// question with a gap on the build list, and hands the coder the weakest gaps while Verse is not above the bar. No workflow of its own.
import { join } from 'node:path';
import { load, serialize, examine, applyRun, askLive, refusedCount, GAP_BELOW } from '../assistant-exam.mjs';
import { load as loadUniverse, serialize as serializeUniverse, markOf } from '../universe.mjs';
import * as held from '../heldout-exam.mjs';
import { whyLine } from '../answer-judge.mjs';

export const BAR = 94;
/** the line for /progress/: the score in plain words and what is next. Changes with every score, so every run is logged. Pure. */
export const lineOf = (sum, gaps, jobs) => 'Scored ' + sum.overall + ' of 100 on ' + sum.questions + ' fixed questions (right ' + sum.right + ', useful ' + sum.useful + ', clear ' + sum.clear + '). '
  + (sum.right > BAR && sum.useful > BAR && sum.clear > BAR ? 'Above ' + BAR + ' on all three.' : jobs + ' question' + (jobs === 1 ? '' : 's') + ' with a gap are on the build list (' + gaps + ' gaps).');
/** the coder's ask: the three weakest questions and what each lacks. Pure. */
export const askOf = (set, rows, sum) => {
  const by = new Map(set.map((q) => [q.id, q.ask]));
  const worst = rows.map((r) => ({ r, s: Math.min(r.right, r.useful, r.clear) })).filter((x) => x.s < GAP_BELOW).sort((a, b) => a.s - b.s).slice(0, 3);
  return 'The assistant exam scored ' + sum.overall + ' (right ' + sum.right + ', useful ' + sum.useful + ', clear ' + sum.clear + '; the bar is ' + BAR + ' on each). Weakest: '
    + worst.map(({ r }) => '"' + String(by.get(r.id)).slice(0, 70) + '" (right ' + r.right + ', useful ' + r.useful + ', clear ' + r.clear + '; ' + ['right', 'useful', 'clear'].flatMap((d) => r.gaps[d].slice(0, 2)).join('; ') + ')').join(' | ')
    + '. Improve how the agent answers such questions in general (lib/agent-answer.js, functions/api/agent.js), never for these words.';
};

async function runFixed(ctx, { ask, check }) {
  const file = load(join(ctx.root, 'void-live-deploy/tower.assistant.json')), base = ctx.site;
  const answers = await examine(base, file.set, ask);
  const refused = check(answers);
  if (refused > 4) return { ok: false, last: refused + ' of ' + file.set.length + ' questions were not answered (the daily free tasks or the agent were off), so there is no score to log. It tries again at the next run.' };
  const universe = loadUniverse(join(ctx.root, 'void-live-deploy/tower.universe.json'));
  const out = applyRun({ file, universe, answers, base, at: new Date(ctx.now).toISOString(), mark: markOf });
  ctx.save(join(ctx.root, 'void-live-deploy/tower.assistant.json'), serialize(out.file));
  const above = out.sum.right > BAR && out.sum.useful > BAR && out.sum.clear > BAR;
  let queued = '';
  if (!above && out.jobs.length) { const q = await ctx.queueJob(askOf(file.set, out.rows, out.sum), 'heal:assistant-exam'); queued = ' Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').'; }
  return { last: lineOf(out.sum, out.gaps.length, out.jobs.length) + queued, ok: true, universe: out.universe };
}

/** the line for the held-out sample: pattern marks, the blind judge's verdict against the reference, and the streak toward the bar. Pure. */
export const heldLineOf = (out) => 'Held-out sample of ' + out.sum.questions + ' unseen questions: right ' + out.sum.right + ', useful ' + out.sum.useful + ', clear ' + out.sum.clear + '. '
  + (out.verdict ? 'Judge (' + out.verdict.by.join(' and ') + ', ' + out.verdict.judged + ' judged blind): Verse ' + out.verdict.verse + ' against the reference ' + out.verdict.reference + '. ' : 'No judge answered' + (whyLine() ? ' (' + whyLine() + ')' : '') + ', so this run is not counted. ')
  + (out.beat === true ? 'Beat the reference. ' : out.beat === false ? 'Did not beat the reference. ' : '') + 'In a row: ' + out.streak + ' of ' + held.STREAK + '.';

async function runHeld(ctx, { ask, judgeFn, check }, universe) {
  const f = join(ctx.root, 'void-live-deploy/tower.heldout.json'), file = held.load(f), picked = held.sample(file.set, file.seen);
  const answers = await examine(ctx.site, picked, ask);
  if (check(answers) > 4) return { line: 'Held-out: ' + check(answers) + ' of ' + picked.length + ' questions were not answered, so there is no score. ', ok: false };
  const judged = await held.judgeAll(picked, answers, ctx.env || {}, judgeFn), out = held.applyRun({ file, picked, answers, judged, base: ctx.site, at: new Date(ctx.now).toISOString() });
  ctx.save(f, held.serialize(out.file));
  const today = new Date(ctx.now).toISOString().slice(0, 10);
  let u = markOf(universe, held.TARGET_ID, 'heldout', held.markOf(out.sum, out.streak), { judge: 'held-out exam', at: today });
  const jobs = held.jobsOf(picked, out.rows, today, held.TARGET_ID), bg = (u.background || []).filter((b) => !(b.id === held.TARGET_ID && String(b.aspect).startsWith('heldout:'))).concat(jobs);
  u = { ...u, background: bg.slice(-600) };
  let queued = '';
  if (out.beat !== true && jobs.length) { const q = await ctx.queueJob('The held-out exam (unseen questions, never tuned on) scored right ' + out.sum.right + ', useful ' + out.sum.useful + ', clear ' + out.sum.clear + (out.verdict ? ', and the blind judge rated Verse ' + out.verdict.verse + ' against the reference ' + out.verdict.reference : '') + '. Weak areas: ' + jobs.map((j) => j.job.replace(/^build: Verse answers in /, '').slice(0, 150)).join(' | ') + ' Improve how the agent answers these kinds of question in general (lib/agent-answer.js, functions/api/agent.js); do not look for or add the exam\'s questions.', 'heal:heldout-exam'); queued = ' Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').'; }
  return { line: heldLineOf(out) + queued, ok: true, universe: u };
}

export async function run(ctx, { ask = askLive, check = (a) => refusedCount(a), judgeFn, heldout = true, fixed = new Date(ctx.now).getUTCHours() === 13 } = {}) {
  const parts = []; let universe = loadUniverse(join(ctx.root, 'void-live-deploy/tower.universe.json'));
  if (fixed) { const r = await runFixed(ctx, { ask, check }); parts.push(r); if (r.universe) universe = r.universe; }
  if (heldout) { const r = await runHeld(ctx, { ask, judgeFn, check }, universe).catch((e) => ({ line: 'Held-out exam could not run (' + String((e && e.message) || e).slice(0, 80) + ').', ok: false })); parts.push(r); if (r.universe) universe = r.universe; }
  if (parts.some((x) => x.universe)) ctx.save(join(ctx.root, 'void-live-deploy/tower.universe.json'), serializeUniverse(universe));
  return { last: parts.map((x) => x.last || x.line).join(' '), ok: parts.some((x) => x.ok), note: 'Live questions to the agent on the free tier, judged by a free model; no paid model.' };
}
