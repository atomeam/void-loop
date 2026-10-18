// Telemetry route (asked by the owner, 2026-10-18): a pasted CI report, build log or status update is the builders' own diagnostics, not a
// coding question, so the page reads it instead of lecturing about async JavaScript. Pure and device-local: no network, no model.
//   telemetryOf(text)  null for anything that is not a pasted developer log; else { kind, signals, shas, prs, failures, passed }
// A question or an instruction is never taken ("why is my ci red", "fix this test"): a log needs length and at least three kinds of evidence.
export const MIN_CHARS = 160, MIN_SIGNALS = 3, MAX_FAILURES = 6;

const SIGNALS = [
  ['ci', /\b(?:CI|browser suite|unit tests?|fast checks|workflow|verify run|incidents?\.json|deploy(?:ed|ment)?)\b/i],
  ['sha', /(?:\b(?:sha|commit|head)\s+`?[0-9a-f]{7,40}\b|`[0-9a-f]{7,40}`|\b[0-9a-f]{7,8}\b(?=\s+(?:failed|passed|merged|broke)))/i],
  ['pr', /\bPR\s*#?\d+|\bpull[ /]\d+|\[?(?:draft )?PR\b/i],
  ['status', /\b(?:FAIL(?:ED|S)?|passed|passes|red|green|merged|pushed|committed|conflict|timed? ?out|stalled?)\b/],
  ['counts', /\b\d+\s*(?:\/|of)\s*\d+(?:\s*(?:passed|checks?|tests?))?\b|\b\d+\s+(?:checks?|tests?|sections?|files?)\b/i],
  ['run', /actions\/runs\/\d+|\brun\s+\d{6,}/i],
];

const clean = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();

/** the kinds of evidence a text carries, by name. Pure. */
export function signalsOf(text) { return SIGNALS.filter(([, re]) => re.test(text)).map(([n]) => n); }

// a builder telling what they did ("I'm making it opt-in so red checks…", "Committing the fix…", "Pushing the changes…") is not a failure, however
// many failure words it carries (2026-10-18: a pasted run report came back as "6 things still failing", all six the builder's own sentences)
const NARRATION = /^(?:i|i'm|i've|i'll|i'd|we|we're|we've|let me|now|next|then|so|also|first|took|pushed|committed|merged|shipped|opened|made|fixed|added|wrote|[a-z]+ing)\b/i;
// "red" is a failure only as a state ("is red", "went red", "red on main", "red since", "red:"), not as a name ("red checks grow in the garden"),
// and "failing" only as a state too ("still failing", "is failing", "3 failing", "failing:"), not as a word before a noun ("each failing check")
const FAILS = /\bFAIL(?:ED|S)?\b|\bfail(?:ed|s)\b|\b(?:still|is|are|was|were|keeps?|kept|started|went)\s+failing\b|\b\d+\s+failing\b|\bfailing\s*(?:[:,.]|on\b|since\b|in\s+ci\b)|\bbroke\b|\bstall(?:ed|s)?\b|\btimed? ?out\b|\bconflicts?\b|\bunconfirmed\b|\bnot fixed\b|\b(?:is|was|went|stays?|still|turned|came back|are|were)\s+red\b|\bred\s+(?:on|since|after|again|for|in)\b|\bred\s*[:,.]/i;

// a failure the builder says went away on its own ("failed once under load and passed on its own", "passes alone", "passed on a re-run") is not still failing
const RESOLVED = /\b(?:passed|passes|green)\s+(?:on\s+its\s+own|alone|again|on\s+(?:a\s+)?re-?run|when\s+(?:run\s+)?alone)\b/i;
// a failure the builder caused on purpose to prove a check bites ("with the mutation it fails, as expected", "without the refusal, the check fails",
// "with the line taken out, the new check fails") is the check working, not something failing (2026-10-18 card: two such lines read as failures)
const PLANNED = /\bas expected\b|\bmutat(?:ion|ed|ing)\b|\bon purpose\b|\bdeliberately\b|\bwithout\s+(?:the|its|this|that)\s+[\w-]+(?:\s+[\w-]+)?\s*,|\bwith\s+(?:the|its|this|that|it)\b[^,]{0,40}\b(?:taken out|removed|reverted|undone|commented out)\b/i;
/** the lines that name something failing, cleaned and clipped: the "FAIL ..." lines, "- **Name:** ... failed", stalls and conflicts; never a builder's
 *  own narration, and "red" only as a state. Pure. */
export function failuresOf(text) {
  const out = [], seen = new Set();
  for (const raw of String(text || '').split(/\n+|\s*⏎\s*|(?<=[.;!?])\s+(?=[A-Z-])/)) {
    const l = clean(raw);
    const body = l.replace(/^(?:[-+•\u2022\u25cf]|\d{1,2}[.)])\s+/, ''); // a list marker in front of the builder's own sentence hides it from the narration test
    if (l.length < 12 || !FAILS.test(l) || NARRATION.test(body) || RESOLVED.test(l) || PLANNED.test(l)) continue;
    if (/\b(?:no|nothing|zero|0)\s+(?:fail|red|conflict)|\bpassed\b.*\bnone\b/i.test(l)) continue;
    const k = l.toLowerCase().slice(0, 40); if (seen.has(k)) continue; seen.add(k);
    out.push(l.length > 110 ? l.slice(0, 107) + '...' : l);
    if (out.length >= MAX_FAILURES) break;
  }
  return out;
}

/** a pasted developer log, or null. Pure. */
export function telemetryOf(raw) {
  const text = String(raw || '').trim();
  if (text.length < MIN_CHARS || text.length > 20000) return null;
  const first = text.split('\n')[0].trim();
  if (/^(?:why|how|what|who|when|where|can|could|should|does|do|is|are|will|explain|fix|help)\b/i.test(first) && /\?\s*$/.test(first) && text.split('\n').length < 3) return null;
  const signals = signalsOf(text);
  if (signals.length < MIN_SIGNALS) return null;
  const shas = [...new Set((text.match(/\b[0-9a-f]{7,40}\b/g) || []).filter((s) => /\d/.test(s) && /[a-f]/.test(s)))].slice(0, 5);
  const prs = [...new Set([...text.matchAll(/(?:\bPR\s*#?|pull\/|#)(\d{2,6})\b/gi)].map((m) => m[1]))].slice(0, 5);
  const m = /(\d+)\s*(?:\/|of)\s*(\d+)\s*passed/i.exec(text);
  return { kind: signals.includes('run') || signals.includes('ci') ? 'ci' : 'status', signals, shas, prs, failures: failuresOf(text), passed: m ? { ok: +m[1], of: +m[2] } : null };
}

/** the card's lines for a reading, plain text (the page escapes them). Pure. */
export function summaryOf(t) {
  if (!t) return [];
  const out = [(t.kind === 'ci' ? 'A CI report' : 'A status update') + ' from the builders: read, not answered as a coding question.'];
  if (t.shas.length) out.push('Commits: ' + t.shas.join(', '));
  if (t.prs.length) out.push('Pull requests: ' + t.prs.map((p) => '#' + p).join(', '));
  if (t.passed) out.push('Passed ' + t.passed.ok + ' of ' + t.passed.of);
  out.push(t.failures.length ? t.failures.length + ' thing' + (t.failures.length === 1 ? '' : 's') + ' still failing or unconfirmed' : 'Nothing in it names a failure');
  return out;
}
