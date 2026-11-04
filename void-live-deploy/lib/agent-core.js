// Verse's agent (owner, 2026-11-04: "i want Verse to be a big dog in the agentic game ... we can scale with income").
// Pure parts, tested in tools/agent-core.test.mjs: the model tiers the treasury can buy, which asks stop for a yes,
// which of Verse's own bots takes a task, and the daily brief.
import { models, PAID_MODEL } from './models.js';

// The tiers. 'free' runs on the site's own Workers AI binding. A stronger tier turns on only when the treasury's
// infrastructure pot (realized Gumroad earnings only, treasury/policy.json) holds a month of it, never on credit.
export const TIERS = Object.freeze([
  Object.freeze({ name: 'free', model: models('agent'), month_cents: 0, why: 'Workers AI free daily allowance' }),
  Object.freeze({ name: 'strong', model: PAID_MODEL, month_cents: 500, why: 'paid Workers AI neurons, bought from the infrastructure pot' }),
]);
/** the best tier a realized infrastructure pot pays a month of. */
export function tierFor(infraCents) {
  const c = Number(infraCents) || 0;
  let best = TIERS[0];
  for (const t of TIERS) if (c >= t.month_cents && t.month_cents >= best.month_cents) best = t;
  return best;
}

// Anything that leaves the site or can't be undone stops for an approval card first.
const GATED = /\b(send|email|text|dm|message|post|tweet|publish|pay|buy|purchase|order|book|transfer|delete|remove|cancel|sign|submit)\b/i;
export const needsYes = (ask) => GATED.test(String(ask || ''));

const STOP = new Set('a an the to for of and or in on me my it is be with this that what how can you please make write give'.split(' '));
const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) || [];
/** the bot (from /tools.json, or bots/registry.json once the factory ships it) whose words best match the ask. */
export function pickBot(ask, bots) {
  const want = new Set(words(ask));
  let best = null, score = 0;
  for (const b of bots || []) {
    if (b.status && b.status !== 'live') continue;
    const s = words((b.name || b.id || '') + ' ' + (b.cat || '') + ' ' + (b.description || b.job || '') + ' ' + (b.examples || []).join(' ')).filter((w) => want.has(w)).length;
    if (s > score) { best = b; score = s; }
  }
  return best ? { name: String(best.name || best.id), description: String(best.description || best.job || '').slice(0, 160) } : { name: 'verse', description: 'Verse itself' };
}

/** the daily brief for one thread: what got made, what waits on a yes, what is still running. */
export function brief(tasks, now = Date.now()) {
  const day = (tasks || []).filter((t) => now - Number(t.created) < 864e5);
  const n = (s) => day.filter((t) => t.status === s).length;
  const made = n('done'), wait = n('needs_yes'), run = n('queued') + n('running');
  const lines = [];
  lines.push(made ? 'Made ' + made + ' thing' + (made > 1 ? 's' : '') + ' in the last day.' : 'Nothing made yet today. Send me a task.');
  if (wait) lines.push(wait + ' waiting on your yes.');
  if (run) lines.push(run + ' still working.');
  return { day: new Date(now).toISOString().slice(0, 10), made, waiting: wait, running: run, text: lines.join(' ') };
}
