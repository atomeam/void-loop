// Stage pack I (owner, 2026-10-18): the pure logic behind partial-answer, draft-triad, stale-work, certainty-budget and
// interrupt-priority, so it can be tested without a browser. No network, no model call, no secrets, nothing about money.
// State that is not "kept" lives in memory only (module level) and ends with the page.

const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '');

// ---- 1. partial answer ----------------------------------------------------------------------------------------------
/** what a kind of question usually needs and the person has not said (a small local table; first matching row wins) */
export const MISSING_TABLE = [
  { re: /\b(trip|travel|flight|holiday|vacation|visit)\b/i, missing: ['the dates', 'the budget', 'where you leave from'] },
  { re: /\b(buy|purchase|choose|pick|compare|which)\b/i, missing: ['what it is for', 'the budget', 'what you already own'] },
  { re: /\b(move|moving|relocate|relocation)\b/i, missing: ['when', 'who is coming', 'the budget'] },
  { re: /\b(hire|hiring|recruit)\b/i, missing: ['the role', 'the start date', 'the budget'] },
  { re: /\b(learn|study|course|exam)\b/i, missing: ['the goal', 'hours per week', 'what you already know'] },
  { re: /\b(cook|recipe|dinner|meal)\b/i, missing: ['how many people', 'allergies', 'what is in the kitchen'] },
  { re: /\b(bug|error|crash|fail|failing|broken|debug)\b/i, missing: ['the exact error', 'what changed last', 'how to reproduce it'] },
  { re: /\b(meeting|schedule|plan|launch|deadline)\b/i, missing: ['the date', 'who decides', 'what done looks like'] },
];
export const DEFAULT_MISSING = ['the goal', 'the deadline', 'what you already tried'];

const TRIG = /^(?:please\s+)?(?:partial\s+answer\s+(?:on|to|for|about)|tell\s+me\s+only\s+what\s+you\s+know\s+about)\s+(.+)$/i;
const splitItems = (s) => String(s || '').split(/\s*;\s*/).map((x) => tidy(x)).filter(Boolean).slice(0, 12);

/** the answer schema {known, missing, next_question}; with nothing supplied, the local table fills the missing list. Pure. */
export function answerOf(subject, known, missing) {
  let miss = (missing || []).slice();
  if (!miss.length && !(known || []).length) { const row = MISSING_TABLE.find((r) => r.re.test(subject)); miss = (row ? row.missing : DEFAULT_MISSING).slice(); }
  return { known: (known || []).slice(), missing: miss, next_question: miss.length ? 'Can you tell me ' + miss[0] + '?' : '' };
}

/** { subject, known, missing, next_question, supplied } for a partial-answer ask, or null. "known: a; b / missing: c" is the person's own facts. Pure. */
export function partialOf(text) {
  const m = TRIG.exec(tidy(text));
  if (!m) return null;
  const rest = m[1];
  const ki = rest.search(/\bknown\s*:/i), mi = rest.search(/\bmissing\s*:/i);
  const cut = [ki, mi].filter((i) => i >= 0);
  const subject = tidy((cut.length ? rest.slice(0, Math.min(...cut)) : rest).replace(/[\s/,:-]+$/, '')).slice(0, 160);
  if (!subject) return null;
  const grab = (re) => { const x = re.exec(rest); return x ? splitItems(x[1].replace(/\s*\/\s*$/, '')) : []; };
  const known = grab(/\bknown\s*:\s*(.*?)(?=\s*\/?\s*\bmissing\s*:|$)/i);
  const missing = grab(/\bmissing\s*:\s*(.*?)(?=\s*\/?\s*\bknown\s*:|$)/i);
  return { ...answerOf(subject, known, missing), subject, supplied: known.length + missing.length > 0 };
}

/** "fill the hole: <text>" -> the text, or '' */
export function holeOf(text) { const m = /^(?:please\s+)?fill\s+(?:in\s+)?the\s+hole\s*:\s*(.+)$/i.exec(tidy(text)); return m ? m[1].trim().slice(0, 200) : ''; }

/** fill exactly one hole (the first missing item) with the person's text and re-ask; never invents. Pure. */
export function fillHole(ans, text) {
  if (!ans.missing.length || !tidy(text)) return ans;
  const [hole, ...rest] = ans.missing;
  return { known: [...ans.known, hole.replace(/^the\s+/, '') + ': ' + tidy(text)], missing: rest, next_question: rest.length ? 'Can you tell me ' + rest[0] + '?' : '' };
}

// ---- 2. draft triad -------------------------------------------------------------------------------------------------
export const DRAFT_LABELS = ['aggressive', 'conservative', 'weird'];
export function triadOf(text) { const m = /^(?:please\s+)?(?:three|3)\s+drafts?\s+of\s+(.+)$/i.exec(tidy(text)); return m ? m[1].trim().slice(0, 240) : ''; }
/** three drafts, fixed labels, built by template (no model). Pure. */
export function triad(src) {
  const s = tidy(src), first = s.charAt(0).toUpperCase() + s.slice(1);
  return [
    { label: 'aggressive', text: first + '. Now. No more waiting, no hedging: this is the decision, act on it today.' },
    { label: 'conservative', text: 'For your consideration: ' + s + '. This is offered with room to adjust, subject to review and agreement from the people it affects.' },
    { label: 'weird', text: 'A lighthouse keeper, who has strong opinions, leans over the rail and mutters: "' + s + '". The gulls take notes.' },
  ];
}

// ---- 3. stale work ---------------------------------------------------------------------------------------------------
export const STALE_EDITS = 5;
export const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(d));
/** the bump ask: { kind: 'edited'|'decided', thing } or null. Bare "I edited X" only counts when `known(thing)` (it is already tracked); "note that I edited X" always. Pure. */
export function bumpOf(text, known) {
  const t = tidy(text);
  const kindOf = (w) => (/^edit/i.test(w) ? 'edited' : 'decided');
  let m = /^(?:note|log|bump)\s*(?:that|:)?\s*(?:i\s+)?(edited|decided(?:\s+on)?)\s+(?:the\s+|my\s+)?(.+)$/i.exec(t);
  if (m) return { kind: kindOf(m[1]), thing: m[2].toLowerCase().slice(0, 60) };
  m = /^i\s+(edited|decided(?:\s+on)?)\s+(?:the\s+|my\s+)?(.+)$/i.exec(t);
  if (m && known && known(m[2].toLowerCase().slice(0, 60))) return { kind: kindOf(m[1]), thing: m[2].toLowerCase().slice(0, 60) };
  return null;
}
export function bump(counters, kind, thing) {
  const c = { ...(counters || {}) }, o = { edits: 0, decisions: 0, ...(c[thing] || {}) };
  if (kind === 'edited') o.edits += 1; else o.decisions += 1;
  c[thing] = o; return c;
}
/** the pure rule: edits >= 5 and decisions == 0 (and not killed, not deferred past today) */
export function isStale(o, today) { return !!o && !o.killed && o.edits >= STALE_EDITS && o.decisions === 0 && !(o.defer && o.defer > today); }
export const staleList = (counters, today) => Object.entries(counters || {}).filter(([, o]) => isStale(o, today)).map(([thing]) => thing);
export function decide(counters, thing) { return bump(counters, 'decided', thing); }
/** defer writes a date (YYYY-MM-DD); anything else changes nothing */
export function defer(counters, thing, date) { if (!isDay(date) || !counters[thing]) return counters; return { ...counters, [thing]: { ...counters[thing], defer: date } }; }
export function kill(counters, thing) { if (!counters[thing]) return counters; return { ...counters, [thing]: { ...counters[thing], killed: true } }; }
export const staleIntent = (text) => /^(?:(?:show|list|open)\s+(?:my\s+|the\s+)?)?stale\s+work$/i.test(tidy(text));

// ---- 4. certainty budget ---------------------------------------------------------------------------------------------
export const DEFAULT_BUDGET = 5;
const HEDGE = /\b(maybe|might|may|perhaps|probably|possibly|could|seems?|appears?|likely|roughly|about|around|i think|i guess|i suppose|not sure|unsure|sometimes|often)\b/i;
const HARD = /\b(definitely|certainly|always|never|must|guaranteed?|obviously|clearly|undoubtedly|proven|without a doubt|for sure|absolutely|everyone|nobody|no one|all of them|none of them|will)\b/i;
const OPTION = /\b(?:option|options|either|alternatively)\b|\bor\b/i;
/** 'question' | 'option' | 'soft' | 'hard'. Hedges win over absolutes ("probably always"), questions cost nothing. Pure heuristic. */
export function classifyClaim(text) {
  const t = tidy(text);
  if (!t) return 'soft';
  if (/\?\s*$/.test(String(text).trim()) || /^(?:who|what|when|where|why|how|which|is|are|do|does|did|can|should|would)\b/i.test(t)) return 'question';
  if (HEDGE.test(t)) return 'soft';
  if (HARD.test(t) || /100\s*%/.test(t)) return 'hard';
  if (OPTION.test(t)) return 'option';
  return 'soft';
}
export const newBudget = (n) => { const max = Math.min(20, Math.max(1, Math.floor(+n) || DEFAULT_BUDGET)); return { max, left: max }; };
/** try a line against the budget: a hard claim spends one; at zero only questions and options are accepted. Pure. */
export function spend(b, text) {
  const kind = classifyClaim(text);
  if (kind === 'hard') return b.left > 0 ? { ok: true, kind, state: { ...b, left: b.left - 1 } } : { ok: false, kind, state: b, why: 'Out of certainty: ask a question or offer options, or refill by confirming a fact.' };
  if (b.left <= 0 && kind === 'soft') return { ok: false, kind, state: b, why: 'Out of certainty: only questions and options now.' };
  return { ok: true, kind, state: b };
}
/** refill only when the person states a fact to confirm (non-empty, not a question) */
export function refill(b, fact) { const t = tidy(fact); if (!t || classifyClaim(fact) === 'question') return { ok: false, state: b }; return { ok: true, state: { ...b, left: b.max } }; }
export function budgetIntent(text) {
  const t = tidy(text).toLowerCase();
  let m = /^(?:(?:show|open|start|set|give me)\s+)?(?:a\s+|my\s+|the\s+)?certainty\s+budget(?:\s+(?:of|to)?\s*(\d{1,2}))?$/.exec(t);
  if (m) return { act: 'show', n: m[1] ? +m[1] : 0 };
  m = /^refill\s+certainty(?:\s*:\s*(.*))?$/.exec(t);
  if (m) return { act: 'refill', fact: (m[1] || '').trim() };
  return null;
}

// ---- 5. interrupt priority ------------------------------------------------------------------------------------------
export const LEVELS = ['deep', 'normal', 'interruptible'];
export const priorityOf = (text) => { const m = /^(?:please\s+)?set\s+(?:my\s+)?priority(?:\s+to)?\s+(deep|normal|interruptible)$/i.exec(tidy(text)); return m ? m[1].toLowerCase() : ''; };
export const deferredIntent = (text) => /^(?:show|list)\s+(?:the\s+|my\s+)?deferred(?:\s+(?:nags|queue|suggestions|nudges))?$/i.test(tidy(text));
const mem = { level: 'normal', queue: [] };
export const getPriority = () => mem.level;
export function setPriority(level) { if (!LEVELS.includes(level)) return mem.level; mem.level = level; return level; }
export const deferred = () => mem.queue.slice();
export function clearDeferred() { mem.queue.length = 0; }
/** Pure rule: may a suggestion of this weight ('soft' | 'important') interrupt at this level? deep: never; normal: important only; interruptible: all. */
export function allows(level, weight) { return level === 'interruptible' || (level === 'normal' && weight === 'important'); }
/** The one hook the stage's soft suggestions call: true when `msg` may be shown now; otherwise it is queued (20 newest kept) and false is returned. */
export function maySuggest(msg, weight = 'soft') {
  if (allows(mem.level, weight)) return true;
  mem.queue.push(String(msg || '').slice(0, 160)); if (mem.queue.length > 20) mem.queue.shift();
  return false;
}
