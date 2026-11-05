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

// Anything that leaves the site or can't be undone stops for an approval card first. What counts is the verb given as an order (the ask's
// first word, or after "please", "can you", "then", "I need to"...) followed by who or what it acts on, not the same word as a noun:
// "text my mom" and "book a table" wait for a yes; "encode the text hello world in base64", "book recommendations" and "sort in order" do not
// (2026-11-04: the base64 ask sat waiting for a yes because "text" was anywhere in it). Delete, remove and cancel wait only when what goes is
// outside the page (an account, a subscription, files), so "remove duplicates from this list" is just done.
const LEAD = String.raw`(?:^|[.!?;:]\s+|\b(?:please|then|and|also|now|just|can you|could you|would you|will you|go ahead and|help me|(?:i|we)(?: really)? (?:need|want|have|would like|'d like) (?:you )?to|i want you to)\s+)`;
const SENDS = String.raw`(?:send|e-?mail|text|dm|message|post|tweet|publish|pay|buy|purchase|order|book|reserve|transfer|wire|venmo|submit|subscribe|unsubscribe|reply|sign(?= up| me| the| this| my| it| in))`;
const ONTO = String.raw`(?:me|us|him|her|them|it|this|that|these|those|a|an|the|my|our|your|his|their|some|all|everyone|up|out|in|to|for|on|back|\$|\d)\b`;
const ORDERED = new RegExp(LEAD + SENDS + String.raw`\s+(?:` + ONTO + String.raw`|\S+@\S+|@\w|\+?\d)`, 'i');
const NEXT = new RegExp(LEAD + SENDS + String.raw`\s+(\S+)`, 'gi'); // "email Bob": the word after the verb is a name, as typed
const GONE = new RegExp(LEAD + String.raw`(?:delete|remove|cancel|close|erase|wipe|terminate|deactivate)\s+(?:\S+\s+){0,3}?(?:account|subscriptions?|orders?|bookings?|reservations?|appointments?|memberships?|e-?mails?|messages?|posts?|tweets?|files?|folders?|repos?|repository|photos?|data|payments?|plan|card|profile|page|channel|server|database|branch|domain|website|site)\b`, 'i');
export const needsYes = (ask) => {
  const s = String(ask || '').trim();
  return ORDERED.test(s) || GONE.test(s) || [...s.matchAll(NEXT)].some((m) => /^[A-Z][a-z]/.test(m[1]));
};

const STOP = new Set('a an the to for of and or in on me my it is be with this that what how can you please make write give some any list top best one two three four five six seven ten things thing stuff'.split(' '));
const stem = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)).map(stem) || [];
/** the bot (from /tools.json, or bots/registry.json once the factory ships it) whose words best match the ask. A bot takes the task only when
 * the match is real: two of the ask's words, or half of them for a short ask. One shared word (the "three" in "list three free things to do
 * in Savannah" against keyword-finder's "top three key words") is a coincidence, and Verse answers itself. */
export function pickBot(ask, bots) {
  const want = new Set(words(ask));
  let best = null, score = 0;
  for (const b of bots || []) {
    if (b.status && b.status !== 'live') continue;
    const s = new Set(words((b.name || b.id || '') + ' ' + (b.cat || '') + ' ' + (b.description || b.job || '') + ' ' + (b.examples || []).join(' ')).filter((w) => want.has(w))).size;
    if (s > score) { best = b; score = s; }
  }
  const real = best && (score >= 2 || score / Math.max(1, want.size) >= 0.5);
  return real ? { name: String(best.name || best.id), description: String(best.description || best.job || '').slice(0, 160) } : { name: 'verse', description: 'Verse itself' };
}

const FACING = new Set(['needs_yes', 'done', 'failed']);
const FACING_LINE = {
  needs_yes: { title: 'Verse needs your yes', lead: 'Waiting on you: ' },
  done: { title: 'Verse finished a task', lead: 'On your Made shelf: ' },
  failed: { title: 'Verse got stuck', lead: 'Try again: ' },
};
/** tasks a member should hear about even if the tab was closed: finished, stuck, or waiting on a yes, and not yet marked seen.
 * A decline is their own answer, so it is not a follow-up. Newest first, twenty at most. */
export function inboxOf(tasks) {
  return (tasks || []).filter((t) => FACING.has(t.status) && !Number(t.seen)).map((t) => {
    const n = FACING_LINE[t.status];
    return { id: t.id, status: t.status, ask: String(t.ask || '').slice(0, 160), title: n.title, body: n.lead + String(t.ask || '').slice(0, 120), at: Number(t.done || t.created) || 0 };
  }).sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id))).slice(0, 20);
}

/** what a yes or a no does to a task that is waiting. A yes resumes: the draft stays and lands on the Made shelf, and nothing is
 * sent, paid or deleted (this route has no outside executor). A no stops. Anything else, or a task that is not waiting, does nothing. */
export function decisionOf(decision, task) {
  if (!task || task.status !== 'needs_yes') return { ok: false, say: 'nothing waiting' };
  if (decision === 'no') return { ok: true, status: 'declined', seen: 1, line: 'You said no. Stopped. Nothing was sent, paid or deleted.' };
  if (decision === 'yes') return { ok: true, status: 'done', seen: 0, line: 'You said yes. Resumed. Nothing was sent or paid: the approved draft is on your Made shelf.' };
  return { ok: false, say: 'yes or no' };
}

/** apply a decision or a seen list to a copy of the thread, the same words and statuses as the route. Pure. */
export function applyAgent(tasks, body) {
  const out = (tasks || []).map((t) => ({ ...t, steps: (t.steps || []).map((s) => ({ ...s })) }));
  const b = body || {};
  if (b.decision === 'yes' || b.decision === 'no') {
    const t = out.find((x) => x.id === b.id);
    const d = decisionOf(b.decision, t);
    if (d.ok && t) { t.status = d.status; t.seen = d.seen; t.done = Date.now(); t.steps.push({ at: Date.now(), line: d.line }); }
  }
  if (Array.isArray(b.seen)) { const ids = new Set(b.seen); for (const t of out) if (ids.has(t.id)) t.seen = 1; }
  return out;
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
