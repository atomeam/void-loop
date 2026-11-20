// The assistant exam rides the house lanes (tools/assistant-exam.mjs, docs/map.d/tower-assistant.md): once a day it puts the 20 fixed questions
// to the live agent, logs the score on /progress/ and in tower.assistant.json, records the three marks on the Tower target, queues every
// question with a gap on the build list, and hands the coder the weakest gaps while Verse is not above the bar. No workflow of its own.
import { join } from 'node:path';
import { load, serialize, examine, applyRun, askLive, refusedCount, GAP_BELOW } from '../assistant-exam.mjs';
import { load as loadUniverse, serialize as serializeUniverse, markOf } from '../universe.mjs';

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

export async function run(ctx, { ask = askLive, check = (a) => refusedCount(a) } = {}) {
  const file = load(join(ctx.root, 'void-live-deploy/tower.assistant.json')), base = ctx.site;
  const answers = await examine(base, file.set, ask);
  const refused = check(answers);
  if (refused > 4) return { last: refused + ' of ' + file.set.length + ' questions were not answered (the daily free tasks or the agent were off), so there is no score to log. It tries again at the next run.', ok: false, note: 'Live questions to the agent; no paid model.' };
  const universe = loadUniverse(join(ctx.root, 'void-live-deploy/tower.universe.json'));
  const out = applyRun({ file, universe, answers, base, at: new Date(ctx.now).toISOString(), mark: markOf });
  ctx.save(join(ctx.root, 'void-live-deploy/tower.assistant.json'), serialize(out.file));
  ctx.save(join(ctx.root, 'void-live-deploy/tower.universe.json'), serializeUniverse(out.universe));
  const above = out.sum.right > BAR && out.sum.useful > BAR && out.sum.clear > BAR;
  let queued = '';
  if (!above && out.jobs.length) { const q = await ctx.queueJob(askOf(file.set, out.rows, out.sum), 'heal:assistant-exam'); queued = ' Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').'; }
  return { last: lineOf(out.sum, out.gaps.length, out.jobs.length) + queued, ok: true, note: 'Twenty live questions to the agent on the free tier; no paid model.' };
}
