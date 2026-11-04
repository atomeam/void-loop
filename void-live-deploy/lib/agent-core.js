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

const STOP = new Set('a an the to for of and or in on me my it is be with this that what how can you please make write give do does did just'.split(' '));
// words that show up in a job line without being the job ("top three key words in a text" is about key words, not the number three).
// One of these shared with an open ask is how "three free things to do in Savannah" was handed to keyword-finder.
const FILLER = new Set('one two three four five six seven eight nine ten top first most last single every text line lines note notes your all per each thing things item items list lists show tell turn turns keep keeps from into using based about some'.split(' '));
const SHORT = new Set('km lb kg ft oz mi hr mb gb tb px'.split(' '));
const stem = (w) => {
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ers') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};
/** content stems of a line. Short unit tokens (km, lb) count; filler and glue do not. Pure. */
export function askTerms(s) {
  const out = [];
  for (const w of String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (/^\d+$/.test(w) || w.length < 2 || (!SHORT.has(w) && w.length < 3)) continue;
    const st = stem(w);
    if (STOP.has(w) || STOP.has(st) || FILLER.has(w) || FILLER.has(st)) continue;
    out.push(st);
  }
  return out;
}
// an open question wants new information (places, a plan, a way to do something), not a transform of the words it already used
const OPEN = /\b(things to do|ideas?|recommend|suggest|itinerary|what should|where can|where should|how do i|how can i|how should i|help me|pack for|weeknight|weekend|rainy[- ]day|apologi[sz]e|activities|places to|dinner)\b/i;
const NOT_OPEN = /\b(keywords?|key words|word count|count the words|percent|prime|binary|roman numeral|base64|status code|miles to|to km|to miles)\b/i;
/** true when the ask is an open question rather than a job a single bot was built to compute. Pure. */
export function openEnded(ask) {
  const t = String(ask || '').trim();
  if (NOT_OPEN.test(t)) return false;
  return OPEN.test(t) || /^(?:list|name|give me|what are|tell me)\b/i.test(t);
}
const purposeOf = (b) => new Set(askTerms([b.name || b.id || '', b.description || '', b.job || '', ...(b.examples || [])].join(' ')));
// the name's own words, unstemmed ("percent-bot" declares percent; "word-counter" does not declare "count")
const rawId = (b) => new Set(String(b.name || b.id || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
const slim = (b) => ({ name: String(b.name || b.id), description: String(b.description || b.job || 'the answer pipeline').slice(0, 160) });
const GENERAL = { name: 'verse', description: 'the answer pipeline' };

/** live bots whose declared purpose matches, best first, then Verse's answer pipeline. A shared filler word is not a match. Pure. */
export function botChoices(ask, bots) {
  const want = new Set(askTerms(ask));
  const open = openEnded(ask);
  const live = (bots || []).filter((b) => !b.status || b.status === 'live');
  const purposes = live.map(purposeOf);
  const owners = new Map();
  for (const b of live) for (const w of rawId(b)) owners.set(w, (owners.get(w) || 0) + 1);
  const ranked = [];
  live.forEach((b, i) => {
    const hit = [...purposes[i]].filter((w) => want.has(w));
    const named = rawId(b);
    let score = 0;
    // two purpose words, or the bot's own name when that name is not shared and the ask is not an open question
    if (hit.length >= 2) score = hit.length;
    else if (hit.length === 1 && !open && named.has(hit[0]) && owners.get(hit[0]) === 1) score = 1;
    if (score) ranked.push({ b, score, n: purposes[i].size });
  });
  ranked.sort((a, c) => c.score - a.score || a.n - c.n || slim(a.b).name.localeCompare(slim(c.b).name));
  const out = ranked.map((r) => slim(r.b));
  if (!out.some((b) => b.name === 'verse')) out.push(GENERAL);
  return out;
}
/** the bot that takes the ask: a real purpose match, or the answer pipeline when the ask is open. Pure. */
export function pickBot(ask, bots) {
  return botChoices(ask, bots)[0];
}
/** try order: each real match once, then the answer pipeline, then one stricter retry of it. Pure. */
export function attemptsFor(ask, bots) {
  const specs = botChoices(ask, bots).filter((b) => b.name !== 'verse');
  return [...specs.map((b) => ({ ...b, repair: false })), { ...GENERAL, repair: false }, { ...GENERAL, repair: true }];
}
/** the system line for one try. The answer pipeline answers the ask; a specialist does only its own job. Pure. */
export function answerBrief(bot) {
  const direct = 'You are Verse. Answer the task directly and concretely, from what you know. When it asks for several things, name that many specific ones, each with a concrete detail a person could use. Plain text, under 250 words. Do not reply with only words copied from the task. Never claim to have sent, paid, posted or deleted anything.';
  if (!bot || bot.name === 'verse' || bot.repair) return bot && bot.repair ? 'You are Verse. The last answer did not do the task. ' + direct.slice('You are Verse. '.length) : direct;
  return 'You are Verse, a helpful agent. You are acting as the bot "' + bot.name + '"' + (bot.description ? ' (' + bot.description + ')' : '') + '. Do only that bot\'s job, fully and concretely. Plain text, under 250 words. Never claim to have sent, paid, posted or deleted anything.';
}
/** an open ask needs a real answer: long enough, and mostly new words, not the ask's own words joined back together. A specialist's short exact answer is its own result. Pure. */
export function addressesAsk(ask, result) {
  const text = String(result || '').trim();
  if (text.length < 2) return false;
  if (!openEnded(ask)) return true;
  const want = new Set(askTerms(ask));
  const novel = new Set(askTerms(text).filter((w) => !want.has(w)));
  return novel.size >= 3 && text.length >= 40 && text.split(/\s+/).filter(Boolean).length >= 6;
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
