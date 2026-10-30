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
const NARRATION = /^(?:i|i'm|i've|i'll|i'd|we|we're|we've|my|our|let me|now|next|then|so|also|first|took|pushed|committed|merged|shipped|opened|made|fixed|added|wrote|it\s+(?:then|also|now)|[a-z]+ing)\b|^(?:criterion|reviewed|found|remainder)\s*:/i; // "my report quoted a timeout" and the closing check's own Found: line are the builder's, not the build's
// "red" is a failure only as a state ("is red", "went red", "red on main", "red since", "red:"), not as a name ("red checks grow in the garden"),
// and "failing" only as a state too ("still failing", "is failing", "3 failing", "failing:"), not as a word before a noun ("each failing check")
const FAILS = /\bFAIL(?:ED|S)?\b|\bfail(?:ed|s)\b|\b(?:still|is|are|was|were|keeps?|kept|started|went)\s+failing\b|\b\d+\s+failing\b|\bfailing\s*(?:[:,.]|on\b|since\b|in\s+ci\b)|\bbroke\b|\bstall(?:ed|s)?\b|\btimed? ?out\b|\bconflicts?\b|\bunconfirmed\b|\bnot fixed\b|\b(?:is|was|went|stays?|still|turned|came back|are|were)\s+red\b|\bred\s+(?:on|since|after|again|for|in)\b|(?<!\bthe\s)\bred\s*[:,.]/i; // "right about the red." names it, it is no state

// a failure the builder says went away on its own ("failed once under load and passed on its own", "passes alone", "passed on a re-run") is not still failing
// and a red the report bounds in time ("Main was red from about 05:44Z to 05:48Z", "was red for 4 minutes", "went red briefly") is over (2026-10-30 card)
const RESOLVED = /\b(?:passed|passes|green)\s+(?:on\s+its\s+own|alone|again|on\s+(?:a\s+)?re-?run|when\s+(?:run\s+)?alone)\b|\b(?:was|were|went|turned)\s+red\s+(?:(?:from|between)\b[^.]{0,30}\b(?:to|and|until)\b|for\s+(?:about\s+)?\d+\s*(?:s|sec|seconds?|m|min|minutes?|h|hours?)\b|briefly\b)/i;
// a failure the builder caused on purpose to prove a check bites ("with the mutation it fails, as expected", "without the refusal, the check fails",
// "with the line taken out, the new check fails") is the check working, not something failing (2026-10-18 card: two such lines read as failures)
const PLANNED = /\bas expected\b|\bmutat(?:ion|ed|ing)\b|\bon purpose\b|\bdeliberately\b|\bwithout\s+(?:the|its|this|that|it)(?:\s+[\w-]+){0,2}\s*,|\bwith\s+(?:the|its|this|that|it)\b[^,]{0,40}\b(?:taken out|removed|reverted|undone|commented out)\b/i;
// a failure that has not happened is not still failing: a condition ("If either PR goes red or hits a conflict, fix it first.") or a "would" ("A failing
// check would automatically revert the commit that broke it.") came back on a card as two of "3 things still failing" (2026-10-19)
// and a plan's designed outcome ("The laptop task then fails loudly instead of overwriting the card.", "Step 2 makes it fail harmlessly either way.") the same day
const HYPOTHETICAL = /^(?:if|when|whenever|should|unless|in case)\b|\b(?:would|will|then|makes?\s+(?:it|them|this|that))\s+(?:\w+\s+)?(?:revert|fails?|break|block|stop)\b|\bfails?\s+(?:loudly|harmlessly|safely|closed|gracefully|fast)\b|\bif\s+(?:either|any|the|a|one)\b[^.]{0,60}\b(?:red|fail|fails|conflicts?)\b|\b(?:a|an|any|each|every)\s+(?:[\w-]+\s+){0,2}that\s+fails?\b/i; // "reverts a commit that fails it" says what the suite does, not that something failed (2026-10-30)
/** the lines that name something failing, cleaned and clipped: the "FAIL ..." lines, "- **Name:** ... failed", stalls and conflicts; never a builder's
 *  own narration, and "red" only as a state. Pure. */
export function failuresOf(text) {
  const out = [], seen = new Set();
  for (const raw of String(text || '').split(/\n+|\s*⏎\s*|(?<=[.;!?])\s+(?=[A-Z-])/)) {
    const l = clean(raw);
    const body = l.replace(/^(?:[-+•\u2022\u25cf]|\d{1,2}[.)])\s+/, ''); // a list marker in front of the builder's own sentence hides it from the narration test
    if (l.length < 12 || !FAILS.test(l) || NARRATION.test(body) || RESOLVED.test(l) || PLANNED.test(l) || HYPOTHETICAL.test(body)) continue;
    if (/\b(?:no|nothing|zero|0)\s+(?:fail|red|conflict)|\bpassed\b.*\bnone\b/i.test(l)) continue;
    const k = l.toLowerCase().slice(0, 40); if (seen.has(k)) continue; seen.add(k);
    out.push(l.length > 110 ? l.slice(0, 107) + '...' : l);
    if (out.length >= MAX_FAILURES) break;
  }
  return out;
}

/** a pasted developer log, or null. Pure. */
// a link to one of this repo's own pull requests or commits is evidence enough on its own: a builder's short status update ("Two more bot notices on
// [atomeam/void-loop#1176](…/pull/1176), neither actionable …") carries one signal and fell through to the article lookup, which answered with an empty
// card (owner, 2026-10-19: "i pasted yor reply got nothing but line"). An instruction about the link ("review this PR …") is another skill's.
const OURS = /github\.com\/atomeam\/void-loop\/(?:pull|commit)\/[0-9a-f]+|\batomeam\/void-loop#\d+/i;
const ASKS_ABOUT_LINK = /^(?:please\s+)?(?:review|check|look(?:\s+at)?|summari[sz]e|explain|read|open|merge|close|approve|analy[sz]e|fix|show(?:\s+me)?|tell\s+me|what|why|how|can|could|is|does)\b/i;
export function telemetryOf(raw) {
  const text = String(raw || '').trim();
  const ours = OURS.test(text) && text.length >= 60 && !ASKS_ABOUT_LINK.test(text);
  if ((text.length < MIN_CHARS && !ours) || text.length > 20000) return null;
  const first = text.split('\n')[0].trim();
  if (/^(?:why|how|what|who|when|where|can|could|should|does|do|is|are|will|explain|fix|help)\b/i.test(first) && /\?\s*$/.test(first) && text.split('\n').length < 3) return null;
  const signals = signalsOf(text), read = statusReadOf(text);
  if (signals.length < MIN_SIGNALS && !ours && !read) return null;
  const shas = [...new Set((text.match(/\b[0-9a-f]{7,40}\b/g) || []).filter((s) => /\d/.test(s) && /[a-f]/.test(s)))].slice(0, 5);
  const prs = [...new Set([...text.matchAll(/(?:\bPR\s*#?|pull\/|void-loop#|#)(\d{2,6})\b/gi)].map((m) => m[1]))].slice(0, 5);
  const m = /(\d+)\s*(?:\/|of)\s*(\d+)\s*passed/i.exec(text);
  return { kind: read ? 'status' : signals.includes('run') || signals.includes('ci') ? 'ci' : 'status', signals, shas, prs, failures: failuresOf(text), passed: m ? { ok: +m[1], of: +m[2] } : null, read };
}

/** the card's lines for a reading, plain text (the page escapes them). Pure. */
export function summaryOf(t) {
  if (!t) return [];
  const out = [(t.kind === 'ci' ? 'A CI report' : 'A status update') + ' from the builders: read, not answered as a coding question.'];
  if (t.shas.length) out.push('Commits: ' + t.shas.join(', '));
  if (t.prs.length) out.push('Pull requests: ' + t.prs.map((p) => '#' + p).join(', '));
  if (t.passed) out.push('Passed ' + t.passed.ok + ' of ' + t.passed.of);
  if (t.read) {
    for (const c of t.read.changed) out.push('Changed: ' + c);
    for (const w of t.read.waits) out.push('Waiting: ' + w);
    if (t.read.next) out.push('Next step: ' + t.read.next);
  }
  // the report's word, not the state: the live lines above say what is true now (2026-10-30: the card said four were still failing over a green main)
  out.push(t.failures.length ? 'It names ' + t.failures.length + ' thing' + (t.failures.length === 1 ? '' : 's') + ' as failing' : 'Nothing in it names a failure');
  return out;
}

/** a builder's own report on work (first person, with pull requests or commits and the CI words around them): never a broken automation to fix, even when it quotes
 *  an error or a timeout it is describing. lib/automation-fix.js intentOf asks this first. Pure. */
export function isBuildersReport(text) {
  const t = telemetryOf(text);
  return !!t && (t.signals.includes('pr') || t.signals.includes('sha')) && (String(text).match(/\bI(?:'m|'ve|'ll|'d)?\b/g) || []).length >= 2;
}

// A pasted status report (owner, 2026-10-29): plain sentences on what shipped, what is held and what to do next, with no error quoted. Verse
// answered one with the broken-automation fix card ("That thread didn't start" read as trouble, "job loop" as the thing). It is a report to
// read back: what changed, what waits, and the one next step. A text that says something of its own is broken is never one.
const WAITS = /\b(?:did(?:n't| not)\s+(?:start|run|ship|land|go\s+out)|block(?:ed|s)\b|waiting|waits?\s+(?:on|for)|on hold|held\b|pending|not\s+(?:yet|started|shipped|merged|live|finished|done)|no result yet|set to (?:ship|run|start)|after\s+(?:the\s+)?[\w\s-]{0,40}\bresets?\b|queued|worth a look|needs?\s+(?:a look|your|you)\b|on\s+auto-?merge\b|will\s+check\b|after\s+it\s+(?:deploys|merges|ships|lands|goes\s+live)\b|(?:gave|handed)\s+(?:\w+\s+){0,3}back\b|no\s+spec(?:ification)?s?\b)/i;
const NEXT = /^(?:if you want(?: it)?|say so\b|next(?: step)?\s*:|reply\b|tell me\b|please\b|to (?:go on|continue|ship it)\b)/i;
const CHANGED = /\b(?:merged|is (?:now )?live|went live|shipped|deployed|released|landed|adds|added|fixed|finished|done|turned on|switched on|published)\b/i;
const BROKEN = /\b(?:stopped\s+(?:working|firing|running)|is(?:n't| not)\s+working|does(?:n't| not)\s+work|not working|keeps?\s+failing|won't\s+(?:run|start|fire|load)|broke\b|crash(?:es|ed)?)\b/i;
// a report's own closing checks ("[HYGIENE CHECK]", "Remainder: unverified", "Decision: keep") and a pasted time stamp ("Today 2:15 AM") are about the
// report, not about the work: the 2026-10-30 card read them back as "Changed:" lines, joined by the ⏎ a copied chat puts between lines
const CLOSING = /^\[?(?:HYGIENE|ASPIRATION)\s+CHECK\]?$|^(?:criterion|reviewed|found|remainder|request names|change reaches|outside|decision)\s*:/i;
const STAMP = /^(?:(?:today|yesterday|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\s+)?(?:at\s+)?\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?$/i;
const kindOf = (s) => (NEXT.test(s) ? 'next' : WAITS.test(s) ? 'waits' : CHANGED.test(s) ? 'changed' : null);
const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/^\s*(?:>|[-+]\s|\d+[.)]\s)\s*/, '').replace(/\s+/g, ' ').trim(); // keeps "#1470"
const tidy = (s) => s.replace(/^(?:also|and|then|plus|so)\s*,?\s+/i, '').replace(/[,;\s]+$/, '').replace(/[^.!]$/, '$&.').replace(/^./, (c) => c.toUpperCase());

/** a pasted status report read back as { changed, waits, next }, or null when the text is not one (a question, an instruction, a
 *  complaint that something is broken, or too short to be a report). Pure. */
export function statusReadOf(raw) {
  const lines = String(raw || '').split(/\n+|\s*⏎\s*/).map(plain).filter((l) => l && !CLOSING.test(l) && !STAMP.test(l)), text = lines.join(' ');
  if (text.length < MIN_CHARS || text.length > 20000 || BROKEN.test(text) || !lines.length) return null;
  if (/\?\s*$/.test(lines[0]) || /^(?:why|how|what|who|can|could|please|fix|help|explain)\b/i.test(lines[0])) return null;
  const sentences = lines.flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z"'(])/)).map((x) => x.trim()).filter((x) => x.length > 3);
  if (sentences.length < 3) return null;
  const read = { changed: [], waits: [], next: null }, open = [];
  for (const s of sentences) {
    // "the cleaner is live, and the fix is set to ship after the reset" is two items; split only when both halves read as one
    const halves = s.split(/,\s+and\s+/);
    const parts = halves.length === 2 && kindOf(halves[0]) && kindOf(halves[1]) ? halves : [s];
    const nums = s.match(/#\d+/g) || [];
    for (const p of parts) {
      const k = kindOf(p);
      if (k === 'next') read.next = read.next || tidy(p);
      else if (k === 'waits') { read.waits.push(tidy(p)); open.push({ text: tidy(p), nums }); }
      else if (k) {
        read.changed.push(tidy(p));
        // a later line that says the same #PR is done closes what an earlier line left open ("#1775 is on automerge" then "#1775, deployed")
        const done = p.match(/#\d+/g) || [];
        for (const o of open) if (o.nums.some((n) => done.includes(n))) read.waits = read.waits.filter((w) => w !== o.text);
      }
    }
  }
  // a wait that a later line closed still made it a report (owner, 2026-10-30: a report with two verified fixes, a fix "on automerge" and 2 jobs
  // "given back" was answered as a broken automation, because neither was read as open)
  return read.changed.length && open.length ? read : null;
}
/** true for a pasted status report (see statusReadOf). lib/automation-fix.js intentOf asks this, so a report is never a fix ask. Pure. */
export function isStatusReport(text) { return !!statusReadOf(text); }
