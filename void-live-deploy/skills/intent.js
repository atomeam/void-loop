/**
 * intent skill: summon by outcome, not by name (frontier #10, first piece).
 * "I need to ship the product page by Friday" becomes a build order of asks Void already answers, run in order:
 * a countdown to the day, a checklist with dates worked back from it, the day on the calendar, and (when a person
 * is named: "and tell Sam") a draft note to them. What those asks put on the stage becomes one group, so
 * dragging one piece moves the plan (skills/group.js).
 * Nothing is sent or published: the draft is a sticky on your own stage. No model call; the planner is a fixed
 * list of existing asks and their shapes, so the same sentence always brings the same pieces.
 * Empty surface stays empty: only an outcome with a deadline triggers this.
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const DAY_RE = String.raw`(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?`;
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
const DATE_RE = String.raw`(?:today|tonight|tomorrow|(?:this\s+|next\s+)?` + DAY_RE + String.raw`|next\s+week|(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(?:week|month)|in\s+(?:\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+(?:days?|weeks?)|` + MON_RE + String.raw`\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?` + MON_RE + String.raw`|the\s+\d{1,2}(?:st|nd|rd|th))`;
const LEAD = String.raw`(?:(?:i|we)\s+(?:really\s+)?(?:need|have|want|must|got)\s+to|i\s+(?:gotta|must)|(?:i|we)(?:'ve|\s+have)\s+got\s+to|(?:i'm|i\s+am|we're|we\s+are)\s+(?:going|supposed|trying|planning)\s+to|help\s+me|plan(?:\s+for)?(?:\s+me)?(?:\s+to)?|(?:my|our|the)\s+goal\s+is\s+to)`;
const TELL = String.raw`(?:(?:,\s*|\s+)(?:and\s+|then\s+)?(?:tell|let|update|email|text|message|ping|send\s+(?:it\s+|this\s+|that\s+)?to|show\s+(?:it\s+)?to)\s+([a-z][a-z'-]{1,20})(?:\s+know)?)?`;
const ASK_RE = new RegExp('^' + LEAD + String.raw`\s+(.{3,80}?)\s+(?:(?:by|before|on|until|till|for)\s+|(?=in\s))(` + DATE_RE + ')' + TELL + '$');

const NOT_A_PERSON = /^(?:me|us|them|everyone|everybody|people|the|my|our|it|you|him|her|team|boss)$/;

/** "I need to ship the product page by Friday and tell Sam" -> { goal, when, who } or null. Pure. */
export function intentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase().replace(/[’]/g, "'");
  const m = ASK_RE.exec(t);
  if (!m) return null;
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

// The steps before the goal itself, by what kind of outcome it is. The goal is always the last line, on the day.
const STEPS = [
  [/^(?:ship|launch|release|publish|deploy|go live|roll out|put out|push out)\b/, ['outline it', 'build the first version', 'review it', 'fix what the review found']],
  [/^(?:write|finish|submit|hand in|turn in|file)\b|\b(?:essay|report|paper|thesis|article|proposal|application|chapter|post|blog)\b/, ['outline', 'first draft', 'revise', 'final read']],
  [/\b(?:presentation|talk|pitch|speech|demo|slides|deck|keynote|lecture)\b/, ['outline the story', 'make the slides', 'rehearse', 'last run-through']],
  [/\b(?:exam|test|quiz|midterm|final|finals|interview)\b|^(?:study|revise|prepare|prep)\b/, ['list the topics', 'study the hard parts', 'practise', 'light review']],
  [/^(?:move|pack|clear out|empty)\b/, ['sort and give away', 'get boxes', 'pack', 'last checks']],
  [/^(?:plan|organi[sz]e|host|throw|run)\b|\b(?:party|wedding|event|trip|dinner)\b/, ['set the plan', 'book and invite', 'get what you need', 'confirm everyone']],
];

/** Steps worked back from the deadline: [{ text, date }], the goal last on the day itself. Pure. */
export function stepsFor(goal, deadline, now = new Date()) {
  const today = day0(now);
  const span = Math.max(0, Math.round((day0(deadline) - today) / 86400000));
  const hit = STEPS.find(([re]) => re.test(goal));
  const before = (hit ? hit[1] : ['work out the steps', 'do the main part', 'check it']).slice();
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

/** The build order: asks Void already answers, in the order they run. Pure. */
export function planOf(text, now = new Date()) {
  const hit = intentOf(text);
  if (!hit) return null;
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
  return { goal, who: hit.who, deadline, steps, asks };
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
async function run(text, api) {
  const plan = planOf(text);
  if (!plan) return 'none';
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
  const pieces = plan.asks.map((a) => a.piece === 'draft' ? 'a draft to ' + cap(plan.who) : a.piece).join(', ');
  if (api.say) api.say('planned "' + plan.goal + '" for ' + LONG_DAY(plan.deadline) + ' · ' + pieces + (ids.length > 1 ? ' · one group, drag one to move them all' : '') + (plan.who ? ' · nothing sent' : ''));
  return 'intent';
}

export default {
  name: 'intent',
  examples: ['I need to ship the product page by Friday', 'I have to finish my essay by October 20', 'I need to prepare a talk by next week and tell Sam',
    'help me launch the newsletter by the end of the month', 'we need to move house in 2 weeks'],
  nearMisses: ['I need to wake up at 6 am, what time should I go to bed?', 'remind me at 5 to call home', 'days until friday', 'what do i need to get a 90',
    'I need to ship', 'call Sam next Tuesday at 4', 'i need a timer for 5 minutes', 'I need to finish my essay', 'how do I ship a product by friday'],
  intentOf,
  deadlineOf,
  stepsFor,
  planOf,
  match(lower, text) { return !!planOf(text); },
  run,
};
