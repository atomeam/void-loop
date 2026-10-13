/**
 * intent skill: summon by outcome, not by name (frontier #10, first piece).
 * "I need to ship the product page by Friday" becomes a build order of asks Void already answers, run in order:
 * a countdown to the day, a checklist with dates worked back from it, the day on the calendar, and (when a person
 * is named: "and tell Sam") a draft note to them. What those asks put on the stage becomes one group, so
 * dragging one piece moves the plan (skills/group.js).
 * Nothing is sent or published: the draft is a sticky on your own stage. No model call; the planner is a fixed
 * list of existing asks and their shapes, so the same sentence always brings the same pieces.
 * Empty surface stays empty: only an outcome with a deadline, or one asked for as a plan ("plan my move"), triggers this.
 */

import { cleanNote } from '../lib/plan.js';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const DAY_RE = String.raw`(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?`;
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
const DATE_RE = String.raw`(?:today|tonight|tomorrow|(?:this\s+|next\s+)?` + DAY_RE + String.raw`|next\s+week|(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(?:week|month)|in\s+(?:\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+(?:days?|weeks?)|` + MON_RE + String.raw`\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?` + MON_RE + String.raw`|the\s+\d{1,2}(?:st|nd|rd|th))`;
const LEAD = String.raw`(?:(?:i|we)\s+(?:really\s+)?(?:need|have|want|must|got)\s+to|i\s+(?:gotta|must)|(?:i|we)(?:'ve|\s+have)\s+got\s+to|(?:i'm|i\s+am|we're|we\s+are)\s+(?:going|supposed|trying|planning)\s+to|help\s+me|plan(?:\s+for)?(?:\s+me)?(?:\s+to)?|(?:my|our|the)\s+goal\s+is\s+to)`;
const TELL = String.raw`(?:(?:,\s*|\s+)(?:and\s+|then\s+)?(?:tell|let|update|email|text|message|ping|send\s+(?:it\s+|this\s+|that\s+)?to|show\s+(?:it\s+)?to)\s+([a-z][a-z'-]{1,20})(?:\s+know)?)?`;
const ASK_RE = new RegExp('^' + LEAD + String.raw`\s+(.{3,80}?)\s+(?:(?:by|before|on|until|till|for)\s+|(?=in\s))(` + DATE_RE + ')' + TELL + '$');

// a goal said as a noun: "the product page launch on Friday", "my essay is due October 20", "our offsite is next week". Only
// a noun that names an outcome counts (a launch, a piece of work handed in, a talk, an exam, an event), so "the weather on
// Friday" or "my birthday on Friday" stay with their skills; the verb goes in front so the steps and the list read as a goal
const NOUN_RE = new RegExp(String.raw`^((?:the|my|our)\s+.{2,60}?)\s+(?:(?:is|'s)\s+)?(?:(?:due|happening|coming\s+up|set\s+for)\s+)?(?:(?:on|by|for)\s+)?(` + DATE_RE + ')' + TELL + '$');
const NOUN_KINDS = [
  [/^(.+?)\s+(launch|release|go-live)$/, (m) => (m[2] === 'go-live' ? 'go live with' : m[2]) + ' ' + m[1]],
  [/\b(?:essay|report|paper|thesis|dissertation|article|proposal|application|chapter|homework|assignment|coursework)\b/, (m) => 'hand in ' + m.input],
  [/\b(?:presentation|talk|pitch|speech|demo|keynote|lecture)\b/, (m) => 'give ' + m.input],
  [/\b(?:exam|test|midterm|final|finals|interview|audition)\b/, (m) => 'be ready for ' + m.input],
  [/\b(?:party|wedding|event|trip|dinner|offsite|conference|launch party|recital|fundraiser)\b/, (m) => m.input],
];
function nounGoal(phrase) {
  if (/\b(?:was|were|is|are|will|would|did|does|do|has|had|got|went|isn't|wasn't)\b/.test(phrase)) return null; // "the exam was on Friday" is not a plan
  for (const [re, verb] of NOUN_KINDS) { const m = re.exec(phrase); if (m) return verb(m); }
  return null;
}

const NOT_A_PERSON = /^(?:me|us|them|everyone|everybody|people|the|my|our|it|you|him|her|team|boss)$/;

/** "I need to ship the product page by Friday and tell Sam" -> { goal, when, who } or null. Pure. */
export function intentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase().replace(/[’]/g, "'")
    .replace(/^(?:(?:can you |please )?(?:help me )?(?:make|give|build|draw up|write|put together) (?:me |us )?(?:a )?plan (to|for))\b/, 'plan $1'); // "make a plan to X by Friday" is "plan to X by Friday"
  const m = ASK_RE.exec(t);
  if (!m) {
    const n = NOUN_RE.exec(t), goal = n && nounGoal(n[1]);
    if (!goal) return null;
    return { goal, when: n[2], who: n[3] && !NOT_A_PERSON.test(n[3]) ? n[3] : null };
  }
  const goal = m[1].replace(/^(?:to\s+)/, '').trim();
  if (!/^[a-z]/.test(goal) || /\b(?:remind|timer|alarm|wake|sleep|period|ovulat)\w*/.test(goal)) return null; // other skills own these
  const who = m[3] && !NOT_A_PERSON.test(m[3]) ? m[3] : null;
  return { goal, when: m[2], who };
}

const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A date phrase ("friday", "in 2 weeks", "october 16", "the 20th") to a day on or after today, or null. Pure. */
export function deadlineOf(when, now = new Date()) {
  const w = String(when || '').toLowerCase().trim();
  const today = day0(now);
  if (w === 'today' || w === 'tonight') return today;
  if (w === 'tomorrow') return addDays(today, 1);
  if (w === 'next week') return addDays(today, 7);
  if (/end\s+of\s+(?:the\s+|this\s+)?week$/.test(w)) return addDays(today, (5 - today.getDay() + 7) % 7); // the working week ends Friday
  if (/end\s+of\s+(?:the\s+|this\s+)?month$/.test(w)) return new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let m = /^in\s+(\S+)\s+(days?|weeks?)$/.exec(w);
  if (m) { const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]]; return n ? addDays(today, n * (/^week/.test(m[2]) ? 7 : 1)) : null; }
  m = new RegExp('^(this\\s+|next\\s+)?(' + DAY_RE + ')$').exec(w);
  if (m) {
    const idx = WEEKDAYS.findIndex((d) => d.startsWith(m[2].slice(0, 3)));
    if (idx < 0) return null;
    // the soonest one still ahead ("next friday" too); said on that weekday it means next week's, as the calendar skill reads it
    return addDays(today, (idx - today.getDay() + 7) % 7 || 7);
  }
  let mon = null, dom = null;
  if ((m = new RegExp('^(' + MON_RE + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?$').exec(w))) { mon = m[1]; dom = Number(m[2]); }
  else if ((m = new RegExp('^(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(' + MON_RE + ')$').exec(w))) { mon = m[2]; dom = Number(m[1]); }
  if (mon) {
    const mi = MONTHS.findIndex((x) => x.startsWith(mon.slice(0, 3)));
    let d = new Date(today.getFullYear(), mi, dom);
    if (d.getMonth() !== mi) return null; // february 31
    if (d < today) d = new Date(today.getFullYear() + 1, mi, dom);
    return d;
  }
  if ((m = /^the\s+(\d{1,2})(?:st|nd|rd|th)$/.exec(w))) {
    const n = Number(m[1]);
    for (let k = 0; k < 3; k++) { const d = new Date(today.getFullYear(), today.getMonth() + k, n); if (d.getDate() === n && d >= today) return d; }
  }
  return null;
}

// The steps before the goal itself, by what kind of outcome it is. The goal is always the last line, on the day. No step says
// "and": the list ask splits on it ("sort and give away" came out as two items).
const STEPS = [
  [/^(?:ship|launch|release|publish|deploy|go live|roll out|put out|push out)\b/, ['outline it', 'build the first version', 'review it', 'fix what the review found']],
  [/^(?:write|finish|submit|hand in|turn in|file)\b|\b(?:essay|report|paper|thesis|article|proposal|application|chapter|post|blog)\b/, ['outline', 'first draft', 'revise', 'final read']],
  [/\b(?:presentation|talk|pitch|speech|demo|slides|deck|keynote|lecture)\b/, ['outline the story', 'make the slides', 'rehearse', 'last run-through']],
  [/\b(?:exam|test|quiz|midterm|final|finals|interview)\b|^(?:study|revise|prepare|prep)\b/, ['list the topics', 'study the hard parts', 'practise', 'light review']],
  [/^(?:move|pack|clear out|empty)\b/, ['sort out what to give away', 'get boxes', 'pack', 'last checks']],
  [/^(?:plan|organi[sz]e|host|throw|run)\b|\b(?:party|wedding|event|trip|dinner)\b/, ['set the plan', 'book the place', 'invite people', 'get what you need']],
];

/** Steps worked back from the deadline: [{ text, date }], the goal last on the day itself. Pure. */
export function stepsFor(goal, deadline, now = new Date(), own = null) {
  const today = day0(now);
  const span = Math.max(0, Math.round((day0(deadline) - today) / 86400000));
  const hit = STEPS.find(([re]) => re.test(goal));
  const before = (own && own.length ? own : hit ? hit[1] : ['work out the steps', 'do the main part', 'check it']).slice(); // own: the answer engine's steps
  // spread the steps over the days before the deadline; with fewer days than steps several share a day
  const out = before.map((text, i) => ({ text, date: addDays(today, span ? Math.floor((i * span) / before.length) : 0) }));
  out.push({ text: goal, date: day0(deadline) });
  return out;
}

const SHORT_DAY = (d) => WEEKDAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate();
const MONTH_DAY = (d) => MONTHS[d.getMonth()] + ' ' + d.getDate();
const LONG_DAY = (d) => WEEKDAYS[d.getDay()][0].toUpperCase() + WEEKDAYS[d.getDay()].slice(1, 3) + ' ' + MONTHS[d.getMonth()][0].toUpperCase() + MONTHS[d.getMonth()].slice(1, 3) + ' ' + d.getDate();
const listSafe = (s) => s.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim(); // the list ask splits on commas
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// A plan asked for without a day (frontier #10's next step): "make a plan to ship the product page", "plan my move", "plan our
// wedding". Only an explicit ask for a plan counts, and only an outcome the steps know: "I need to finish my essay" (no plan
// asked, no day) still leaves the void empty, and "plan my day" or "a plan to lose weight" are not outcomes with steps here.
const PLAN_VERB_RE = new RegExp(String.raw`^(?:(?:can\s+you\s+|please\s+)?(?:help\s+me\s+)?(?:make|give|build|draw\s+up|write|put\s+together)\s+(?:me\s+|us\s+)?(?:a\s+)?plan\s+(?:to|for\s+how\s+to)\s+)(.{3,80}?)` + TELL + '$');
const PLAN_NOUN_RE = new RegExp(String.raw`^(?:(?:can\s+you\s+|please\s+)?(?:help\s+me\s+)?(?:(?:make|give|build|draw\s+up|put\s+together)\s+(?:me\s+|us\s+)?(?:a\s+)?plan\s+for\s+|plan\s+(?:out\s+)?))((?:the|my|our)\s+.{2,60}?)` + TELL + '$');
export function undatedOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase().replace(/[’]/g, "'");
  if (new RegExp('\\b(?:by|before|until|till|on|in)\\s+' + DATE_RE + '\\b').test(t)) return null; // a day: the dated plan
  let goal = null, who = null, m = PLAN_VERB_RE.exec(t);
  if (m) {
    goal = m[1].trim();
    if (!STEPS.some(([re]) => re.test(goal)) || (/^write\b/.test(goal) && !/\b(?:essay|report|paper|thesis|article|proposal|application|chapter|post|blog)\b/.test(goal))) return null;
  } else if ((m = PLAN_NOUN_RE.exec(t))) {
    const phrase = m[1].trim();
    goal = nounGoal(phrase) || (/^(?:my|our|the)\s+(?:house\s+)?move$/.test(phrase) ? 'move' : null);
    if (!goal || !STEPS.some(([re]) => re.test(goal))) return null;
  } else return null;
  who = m[2] && !NOT_A_PERSON.test(m[2]) ? m[2] : null;
  return { goal: listSafe(goal), who };
}

// An open plan (frontier #10, next step): an explicit plan ask of a kind with no steps here ("plan my garden", "make a plan to
// learn Spanish") goes to the answer engine for the steps (lib/plan.js, /api/answer mode 'plan'). Not a day's or a week's plan,
// and not health, diet or money: those stay with their own skills, or with no one.
const OPEN_NOT = /\b(?:day|days|week|weekend|morning|evening|night|today|tomorrow|weight|diet|meal|meals|eat|eating|calories|workout|exercise|fitness|sleep|health|medical|medicine|medication|pain|therapy|money|budget|debt|loan|invest|investing|investment|savings|retirement|tax|taxes|stocks?|crypto)\b/;
export function openPlanOf(text) {
  if (planOf(text)) return null; // a kind with its own steps, dated or not
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase().replace(/[’]/g, "'");
  if (new RegExp('\\b(?:by|before|until|till|on|in)\\s+' + DATE_RE + '\\b').test(t)) return null;
  const m = PLAN_VERB_RE.exec(t) || PLAN_NOUN_RE.exec(t);
  if (!m) return null;
  const goal = listSafe(m[1].trim());
  if (goal.length < 3 || OPEN_NOT.test(goal)) return null;
  return { goal, who: m[2] && !NOT_A_PERSON.test(m[2]) ? m[2] : null };
}

/** The build order: asks Void already answers, in the order they run. Pure. */
export function planOf(text, now = new Date()) {
  const hit = intentOf(text);
  if (!hit) {
    const u = undatedOf(text);
    if (!u) return null;
    const hit2 = STEPS.find(([re]) => re.test(u.goal));
    const steps = hit2[1].map((t) => ({ text: t, date: null })).concat([{ text: u.goal, date: null }]);
    const asks = [{ piece: 'checklist', ask: 'make a list with ' + steps.map((st) => st.text).join(', ') }];
    if (u.who) asks.push({ piece: 'draft', ask: 'add a sticky that says draft to ' + cap(u.who) + ' (not sent): heads up, ' + (/^(?:give\s+)?us\b|\bour\b/.test(String(text).toLowerCase()) ? "we're" : "I'm") + ' working on: ' + u.goal });
    return { goal: u.goal, who: u.who, deadline: null, steps, asks };
  }
  const deadline = deadlineOf(hit.when, now);
  if (!deadline) return null;
  const goal = listSafe(hit.goal);
  const steps = stepsFor(goal, deadline, now);
  // the countdown's label takes letters and spaces only, up to 40 (countdownOf in skills/countdown.js)
  const label = goal.replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').reduce((acc, w) => (acc.length + w.length + 1 <= 40 ? (acc ? acc + ' ' + w : w) : acc), '') || 'the day';
  const asks = [
    { piece: 'countdown', ask: 'days until ' + label + ' on ' + MONTH_DAY(deadline) },
    { piece: 'checklist', ask: 'make a list with ' + steps.map((s) => s.text + ' (' + SHORT_DAY(s.date) + ')').join(', ') },
    { piece: 'calendar', ask: 'add ' + goal + ' to my calendar on ' + MONTH_DAY(deadline) },
  ];
  if (hit.who) asks.push({ piece: 'draft', ask: 'add a sticky that says draft to ' + cap(hit.who) + ' (not sent): heads up, ' + (/^we\b/.test(String(text).trim().toLowerCase()) ? "we're" : "I'm") + ' aiming to ' + goal + ' by ' + LONG_DAY(deadline) });
  return { goal, who: hit.who, deadline, steps, asks, generic: !STEPS.some(([re]) => re.test(goal)) };
}

/** A dated plan with the answer engine's steps in place of the generic ones, dated back from the day; the other asks as they were. Pure. */
export function withSteps(plan, own, now = new Date()) {
  const steps = stepsFor(plan.goal, plan.deadline, now, own);
  const asks = plan.asks.map((a) => (a.piece === 'checklist' ? { ...a, ask: 'make a list with ' + steps.map((st) => st.text + ' (' + SHORT_DAY(st.date) + ')').join(', ') } : a));
  return { ...plan, steps, asks, generic: false, engine: true };
}

// Lay the new pieces out in a row (wrapping), so the group lands as one tidy block near the top left.
function layOut(st, ids, live) {
  const root = st.stage;
  const W = (root && root.clientWidth) || 1200;
  let x = 24, y = 56, rowH = 0;
  for (const id of ids) {
    const t = live[id];
    const el = root && root.querySelector ? root.querySelector('[data-id="' + String(id).replace(/"/g, '') + '"]') : null;
    const w = (el && el.offsetWidth) || 240, h = (el && el.offsetHeight) || 140;
    if (x > 24 && x + w > W - 16) { x = 24; y += rowH + 16; rowH = 0; }
    t.x = x; t.y = y;
    x += w + 16; rowH = Math.max(rowH, h);
  }
}

let seq = 0;
// the plan's steps from the answer engine, and the one practice timer it may suggest (whole minutes, 5 to 60, checked here
// too); null when it has no steps (no model, busy, or no reply)
async function engineSteps(goal) {
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'plan', goal }) });
    const j = await r.json();
    const steps = Array.isArray(j.steps) && j.steps.length ? j.steps.map((x) => listSafe(String(x)).replace(/\s*&\s*|\s+and\s+/gi, ' + ').slice(0, 60)).filter(Boolean).slice(0, 7) : null;
    const timer = Number.isInteger(j.timer) && j.timer >= 5 && j.timer <= 60 ? j.timer : null;
    const note = typeof j.note === 'string' && cleanNote(j.note).length >= 3 ? cleanNote(j.note) : null;
    return steps ? { steps, timer, practice: !!timer && j.practice === true, learn: j.learn === true, note } : null;
  } catch (_) { return null; }
}
// the fixed shapes besides the checklist that an engine reply may add: a practice timer, run as the timer's own ask
// (practice: Clef called the goal a daily practice, and the card says so)
const timerAsk = (min, practice) => ({ piece: 'timer', ask: 'set a timer for ' + min + ' minutes', minutes: min, practice });
// and a note to self, run as the sticky's own ask
const noteAsk = (note) => ({ piece: 'note', ask: 'add a sticky that says ' + note });
const extras = (got) => [...(got.timer ? [timerAsk(got.timer, got.practice)] : []), ...(got.note ? [noteAsk(got.note)] : [])];
async function run(text, api) {
  let plan = planOf(text);
  if (!plan) {
    const open = openPlanOf(text);
    if (!open) return 'none';
    const got = await engineSteps(open.goal), steps = got && got.steps;
    if (!steps) { if (api.say) api.say('could not plan "' + open.goal + '" right now: the answer engine gave no steps. Try again in a minute'); return 'intent'; }
    const asks = [{ piece: 'checklist', ask: 'make a list with ' + steps.join(', ') }];
    if (open.who) asks.push({ piece: 'draft', ask: 'add a sticky that says draft to ' + cap(open.who) + ' (not sent): heads up, ' + (/^(?:give\s+)?us\b|\bour\b/.test(String(text).toLowerCase()) ? "we're" : "I'm") + ' working on: ' + open.goal });
    asks.push(...extras(got));
    plan = { goal: open.goal, who: open.who, deadline: null, steps: steps.map((t) => ({ text: t, date: null })), asks, open: true, learn: got.learn };
  } else if (plan.generic && !OPEN_NOT.test(plan.goal)) { // a dated plan with only the generic steps: the engine's, when it has them
    const got = await engineSteps(plan.goal);
    if (got) { plan = withSteps(plan, got.steps); plan.asks.push(...extras(got)); plan.learn = got.learn; }
  }
  const st = api.stage || {};
  if (!st.ask || !st.things) return 'none';
  const before = new Set(Object.keys(st.things()));
  for (const a of plan.asks) await st.ask(a.ask); // in order: each is an ask Void already answers, as if typed
  const live = st.things();
  const ids = Object.keys(live).filter((id) => !before.has(id));
  if (ids.length > 1) {
    const g = 'g' + Date.now().toString(36) + 'p' + (seq++).toString(36);
    for (const id of ids) live[id].group = g;
    if (st.render) st.render(); // measure what was just drawn, then place it
    layOut(st, ids, live);
    if (st.save) st.save();
    if (st.render) st.render();
  }
  // Clef called it a skill to learn (lib/plan.js withLearnStep), so the engine's steps open with finding a teacher
  const taught = plan.learn ? ' · a skill to learn, so it starts with finding a teacher or a course' : '';
  const pieces = plan.asks.map((a) => a.piece === 'draft' ? 'a draft to ' + cap(plan.who) : a.piece === 'timer' ? (a.practice ? 'a daily practice, so a ' + a.minutes + ' minute timer' : 'a ' + a.minutes + ' minute practice timer') : a.piece === 'note' ? 'a note to self' : a.piece).join(', ');
  if (api.say && plan.open) { api.say('planned "' + plan.goal + '" · ' + pieces + (ids.length > 1 ? ' · one group' : '') + (plan.who ? ' · nothing sent' : '') + ' · steps from the answer engine, check them' + taught); return 'intent'; }
  if (api.say && !plan.deadline) { api.say('planned "' + plan.goal + '" · ' + pieces + (ids.length > 1 ? ' · one group' : '') + (plan.who ? ' · nothing sent' : '') + ' · no day yet: add one ("' + plan.goal + ' by Friday") for dates, a countdown and the calendar'); return 'intent'; }
  if (api.say) api.say('planned "' + plan.goal + '" for ' + LONG_DAY(plan.deadline) + ' · ' + pieces + (ids.length > 1 ? ' · one group, drag one to move them all' : '') + (plan.who ? ' · nothing sent' : '') + (plan.engine ? ' · steps from the answer engine, check them' + taught : ''));
  return 'intent';
}

export default {
  name: 'intent',
  examples: ['I need to ship the product page by Friday', 'I have to finish my essay by October 20', 'I need to prepare a talk by next week and tell Sam',
    'help me launch the newsletter by the end of the month', 'we need to move house in 2 weeks',
    'the product page launch on Friday', 'my essay is due October 20', 'make a plan to ship the product page', 'plan my move', 'plan my garden', 'make a plan to learn Spanish'],
  nearMisses: ['I need to wake up at 6 am, what time should I go to bed?', 'remind me at 5 to call home', 'days until friday', 'what do i need to get a 90',
    'I need to ship', 'call Sam next Tuesday at 4', 'i need a timer for 5 minutes', 'I need to finish my essay', 'how do I ship a product by friday',
    'my birthday on Friday', 'the exam was on Friday', 'plan my day', 'make a plan to lose weight', 'meal plan for the week'],
  intentOf,
  deadlineOf,
  withSteps,
  stepsFor,
  planOf,
  openPlanOf,
  match(lower, text) { return !!planOf(text) || !!openPlanOf(text); },
  run,
};
