// Incident autopsy (asked by Verse: "parse incidents.json and say which skill family is currently unhealthy"). Reads the site's own incidents.json
// (every red browser suite on main: time, commit, the names of the checks that failed; written by tools/incident-log.mjs) and places each failing
// check in a skill family by its name alone, with no guessing: the check's title (the words before its first colon) is matched against the skill
// names in skills/families.json, and failing that a double-quoted ask in the check is matched, word for word, against a skill's example asks
// (skills/guide.json). A check that matches nothing is listed as unmapped. Counts are counts of failing checks recorded in the file; nothing is
// estimated. Incident text is untrusted: it is shown only through esc. Pure: data in, data and markup out. No network, no model, no key.
import { familyMap } from './corrections.js';
import { WARNING_LOCK } from './art-rules.js';
import { incidentTargetOf, ERROR_REACTIONS } from './reactions.js';

export const RECENT = 8; // incidents listed
export const REACT_ON = 3; // the newest incidents that carry a spectator reaction bar (each bar is one read of /api/react)
/** the warning look on the error reactions of an incident's bar (asked by Verse: "errors trigger a specific 'confusion' or 'pity' reaction aesthetic"):
 *  { confused: css, pity: css } from the warning style lock's amber. Pure constant; nothing from a request. */
export const ERROR_TINT = Object.freeze(Object.fromEntries(ERROR_REACTIONS.map((id) => [id, 'background:rgba(255,176,0,.18);border-color:' + WARNING_LOCK.css.match(/#ffb000/)[0] + ';color:#ffd45e;box-shadow:0 0 0 1px rgba(255,176,0,.35) inset'])));
const norm = (t) => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** the incidents of a parsed incidents.json that are well formed: { at, sha, suite, checks[] }, in the file's order (newest first). Pure. */
export function parseIncidents(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.incidents) ? j.incidents : [];
  return list.filter((i) => i && /^[0-9a-f]{7,40}$/i.test(String(i.sha || '')) && Array.isArray(i.checks) && Number.isFinite(Date.parse(i.at)))
    .map((i) => ({ at: String(i.at), sha: String(i.sha).toLowerCase(), suite: String(i.suite || '').slice(0, 80), checks: i.checks.map((c) => String(c == null ? '' : c).slice(0, 400)).filter(Boolean),
      touched: (Array.isArray(i.touched) ? i.touched : []).map((x) => String(x == null ? '' : x)).filter((x) => /^[\w./@-]{1,120}$/.test(x)).slice(0, 15),
      ...(Number.isFinite(Date.parse(i.closedAt)) ? { closedAt: String(i.closedAt) } : {}) })); // closed: a later green run fixed it (tools/incident-log.mjs)
}

/** the skill a changed path is (void-live-deploy/skills/<name>.js, not a helper under skills/order or a test), or null. Pure. */
export function skillOfPath(path) {
  const m = /(?:^|\/)skills\/([a-z0-9][a-z0-9-]*)\.js$/.exec(String(path || ''));
  return m ? m[1] : null;
}

/** the changed skill files of a commit, each marked `likely` when its skill has a failing check in the same incident. Evidence, not blame. Pure. */
export function suspectsOf(touched, checks) {
  const failing = new Set((checks || []).map((c) => c.skill).filter(Boolean));
  return (touched || []).map((file) => ({ file, skill: skillOfPath(file) })).filter((x) => x.skill)
    .map((x) => ({ ...x, likely: failing.has(x.skill) })).sort((a, b) => b.likely - a.likely);
}

/** the title of a check: the words before its first colon, or its first four words when it has none. Pure. */
export function titleOf(check) {
  const s = String(check || '').trim(), i = s.indexOf(':');
  return norm(i > 0 && i <= 80 ? s.slice(0, i) : s.split(/\s+/).slice(0, 4).join(' '));
}

/**
 * The skill a failing check belongs to, or null (unmapped). 1) a skill whose name (dashes as spaces, at least 3 letters) is a whole-word part of the
 * check's title, the longest name first; 2) a double-quoted ask in the check equal, normalised, to an example ask of exactly one skill. Pure.
 */
export function skillOfCheck(check, names, pages) {
  const title = ' ' + titleOf(check) + ' ';
  for (const n of [...names].filter((x) => norm(x).length >= 3).sort((a, b) => b.length - a.length || a.localeCompare(b))) if (title.includes(' ' + norm(n) + ' ')) return n;
  const byExample = new Map();
  for (const p of Array.isArray(pages) ? pages : []) if (p && p.name && Array.isArray(p.examples)) for (const e of p.examples) { const k = norm(e); if (k) byExample.set(k, byExample.has(k) && byExample.get(k) !== p.name ? '' : p.name); }
  for (const m of String(check || '').matchAll(/"([^"]{3,80})"/g)) { const s = byExample.get(norm(m[1])); if (s) return s; }
  // 3) the page a check names in its own words, for checks titled by a batch ("void asks batch 4: ... on the self card"): the self card is
  // the growth skill's, the book is the guide's (owner's review, 2026-10-30: such a check stayed "unmapped" across four red runs)
  for (const [re, n] of PAGE_OWNERS) if (re.test(String(check || '')) && [...names].includes(n)) return n;
  return null;
}
const PAGE_OWNERS = [[/\bthe self card\b/i, 'growth'], [/\b(?:open the book|the book'?s|show the router rules)\b/i, 'guide']];

/**
 * Who owns a check that no skill name or example ask places: the part of Verse its title names, its family, and the files a builder opens
 * first, read from the browser suite's own check (tools/test_void.mjs: what it imports, loads or visits). A row names a skill only when the
 * check exercises that skill; otherwise it names the part ("the router") and its family. Matched on the check's title (titleOf), whole words.
 * Owner's review, 2026-10-30: the router's failing checks were all "unmapped", and "Open first" listed what the commit touched (drum kits,
 * rap tests) instead of the router's own files. Paths are under void-live-deploy/; tools/autopsy.test.mjs checks that each one exists.
 */
export const CHECK_OWNERS = Object.freeze([
  { re: /^router\b/, family: 'self', owner: 'the router', files: ['lib/router.js', 'functions/api/routes.js', 'lib/guard.js'] },
  { re: /^(?:identity|connected)\b/, skill: 'tower', files: ['lib/tower.js', 'identity/index.html'] },
  { re: /^money gpa near misses\b/, family: 'numbers', owner: 'the skill loader', files: ['void.html', 'skills/calc.js', 'skills/loan.js', 'skills/grades.js'] },
  { re: /^local tv radio\b/, skill: 'local-stations', files: ['local/app.js', 'local/index.html', 'skills/local-stations.js'] },
  { re: /^photo resizer\b/, skill: 'imgfit', files: ['resize-image/index.html', 'skills/imgfit.js'] },
  { re: /^confirm line\b/, skill: 'approve-card', files: ['lib/approval-core.js', 'lib/approval-gate.js', 'functions/api/answer.js'] },
  { re: /^paid\b/, skill: 'store', files: ['lib/paid-access.js', 'functions/api/answer.js'] },
  { re: /^webmcp\b/, family: 'self', owner: 'WebMCP', files: ['index.html', 'functions/api/miss.js'] },
  { re: /^refusal object\b/, family: 'self', owner: 'the refusal object', files: ['lib/refusal.js', 'lib/near-miss.js'] },
  { re: /^shared verse\b/, skill: 'share', files: ['lib/share-client.js', 'lib/share.js'] },
  { re: /^voice\b/, skill: 'growth', files: ['lib/voice.js', 'functions/api/reflect.js', 'lib/self-blocks.js'] },
  { re: /^field minds\b/, skill: 'agent-fluid-memory-orbs', files: ['lib/field-kit.js', 'lib/field-stage.js', 'skills/agent-fluid-memory-orbs.js'] },
  { re: /^defences\b/, family: 'self', owner: 'the defences', files: ['functions/api/_middleware.js', 'functions/api/miss.js'] },
  { re: /^look what i made\b/, skill: 'showcase', files: ['skills/showcase.js'] },
  { re: /^self grounding\b/, skill: 'know', files: ['functions/api/answer.js', 'lib/ground.js'] },
  { re: /^semantic validator\b/, family: 'self', owner: 'the semantic validator', files: ['lib/ground.js', 'skills/recipe.js'] },
  { re: /^what you told me\b/, skill: 'memory', files: ['skills/memory.js', 'functions/api/answer.js'] },
]);
/** the CHECK_OWNERS row of a check, or null. Pure. */
export const ownerOfCheck = (check) => { const t = titleOf(check); return CHECK_OWNERS.find((o) => o.re.test(t)) || null; };

/** the "Go against Verse" log (asked by Verse: "Connect the 'Go against Verse' logs to the 'incident-autopsy' skill for automated error analysis."): the failing checks
 *  of the Go games against Verse (the browser suite "go against v01d", tools/go-ai.test.mjs, lib/go-ai.js) are told apart from the rest of the incidents, counted, and
 *  offered back as the ask that replays one. Matched by words in the check's name; nothing is guessed. Pure. */
export const GO_LOG = { id: 'go-against-void', name: 'Go against Verse', replay: 'play go against void' };
export const isGoLog = (check) => /\bgo\s+(?:against|vs\.?|with)\s+(?:v01d|void|verse|you|the\s+computer)\b|\bgo[- ]ai\b/i.test(String(check || '').slice(0, 160));

/** the suite's own bookkeeping lines (a stalled check, the end-of-run flag): the runner failing, not a skill, so they are counted apart and never listed as unmapped (asked by Verse and the owner: the autopsy read 30 of its 74 "failures" as unmapped noise). */
/** how many red suites must share the stall (the "check timeout" signature) before it is escalated as a real incident (asked by Verse: "telemetry
 *  only escalates to an incident if the timeout signature repeats across N samples"): one stalled run is a busy machine; three is a pattern. */
export const STALL_REPEAT = 3;
export const isSuiteMeta = (check) => /^(?:check timeout|suite ran to the end)\b/i.test(String(check || '').trim());

/** an incident's failure signature (asked by Verse: "a 'failure-signature' into the incident-autopsy skill so it can distinguish ... a genuine
 *  system error"): whether its failing checks are new or already failed on earlier commits, from incidents.json alone. kind: 'new' (none of its
 *  checks failed before), 'recurring' (every one failed before: not this commit's doing), 'mixed' (some new), 'suite' (only the runner's own
 *  lines, a stalled machine). since: the oldest earlier incident sharing a check; fresh: the titles of the new ones. list is newest first. Pure. */
export function signatureOf(list, k) {
  const i = list[k]; if (!i) return null;
  const titles = [...new Set(i.checks.filter((c) => !isSuiteMeta(c)).map(titleOf).filter((t) => t.length >= 3))];
  if (!titles.length) return { kind: 'suite', since: '', seen: 0, fresh: [] };
  const older = list.slice(k + 1), seenAt = new Map();
  for (const o of older) for (const t of new Set(o.checks.map(titleOf))) if (titles.includes(t)) seenAt.set(t, o.at); // older is newest first, so the last write is the oldest
  const fresh = titles.filter((t) => !seenAt.has(t)), since = [...seenAt.values()].sort()[0] || '';
  return { kind: !seenAt.size ? 'new' : fresh.length ? 'mixed' : 'recurring', since, seen: older.filter((o) => o.checks.some((c) => titles.includes(titleOf(c)))).length, fresh };
}
/** the signature as one plain sentence. Pure. */
export function signatureLine(g) {
  if (!g) return '';
  const day = String(g.since || '').slice(0, 10);
  return g.kind === 'suite' ? 'Only the suite itself stalled: a busy machine, not a broken skill.'
    : g.kind === 'recurring' ? 'Recurring: every failing check also failed on ' + g.seen + ' earlier red suite' + (g.seen === 1 ? '' : 's') + ' (since ' + day + '), so not this commit\'s doing.'
    : g.kind === 'mixed' ? 'New here: ' + g.fresh.slice(0, 3).join(', ') + '; the rest failed before (since ' + day + ').'
    : 'New: none of these checks failed before, so this commit is the first suspect.';
}

/** the autopsy: { total, failing, recent: [{ sha, at, suite, checks: [{ text, skill, family }] }], families: [{ id, name, count }], unmapped: [{ text, count }],
 *  goLog: [{ sha, at, text }] (every failing Go-against-Verse check), focus }. `focus` (a family id; asked by Verse: a drill-down from the stability sparklines) keeps only
 *  that family's failing checks, and only the incidents that have one. Pure. */
export function autopsy(incidentsJson, fam, guide, focus = '') {
  const inc = parseIncidents(incidentsJson), map = familyMap(fam), names = [...map.keys()], pages = (guide && guide.pages) || [], want = String(focus || '');
  const counts = new Map(), un = new Map(), goLog = [], suite = { timeouts: 0, ended: 0, incidents: 0 };
  const byId = new Map(); for (const v of map.values()) if (!byId.has(v.id)) byId.set(v.id, v);
  let placed = inc.map((i, k) => ({ ...i, signature: signatureOf(inc, k), checks: i.checks.map((text) => {
    if (isSuiteMeta(text)) return { text, skill: null, family: null, name: null, meta: true };
    const skill = skillOfCheck(text, names, pages) || (isGoLog(text) && map.has('go') ? 'go' : null), f = skill && map.get(skill) || null; // a Go-against-Verse check belongs to the go skill (its name is too short to match by words)
    if (f) return { text, skill, family: f.id, name: f.name };
    // no skill name or example: the check's owner row (CHECK_OWNERS), a skill when the row names one in the families, else the part and its family
    const o = ownerOfCheck(text), of = o && (o.skill ? map.get(o.skill) : byId.get(o.family)) || null;
    return of ? { text, skill: o.skill || null, owner: o.skill ? null : o.owner, files: o.files, family: of.id, name: of.name } : { text, skill: null, family: null, name: null };
  }) }));
  if (want) placed = placed.map((i) => ({ ...i, checks: i.checks.filter((c) => c.family === want) })).filter((i) => i.checks.length);
  for (const i of placed) {
    const m = i.checks.filter((c) => c.meta); if (m.length) suite.incidents += 1;
    if (m.some((c) => /^check timeout/i.test(c.text))) suite.stalled = (suite.stalled || 0) + 1;
    for (const c of m) { if (/^check timeout/i.test(c.text)) suite.timeouts += 1; else suite.ended += 1; }
  }
  suite.stalled = suite.stalled || 0; suite.threshold = STALL_REPEAT; suite.escalated = suite.stalled >= STALL_REPEAT;
  for (const i of placed) for (const c of i.checks.filter((x) => !x.meta)) {
    if (isGoLog(c.text)) goLog.push({ sha: i.sha, at: i.at, text: c.text });
    if (c.family) counts.set(c.family, { id: c.family, name: c.name, count: (counts.get(c.family) || { count: 0 }).count + 1 }); else un.set(c.text, (un.get(c.text) || 0) + 1);
  }
  placed = placed.map((i) => { const checks = i.checks.map(({ text, skill, family, meta, owner, files }) => (meta ? { text, skill, family, meta: true } : { text, skill, family, ...(owner ? { owner } : {}), ...(files ? { files } : {}) })); return { ...i, checks, suspects: suspectsOf(i.touched, checks) }; });
  return {
    total: inc.length, failing: placed.reduce((n, i) => n + i.checks.filter((c) => !c.meta).length, 0), recent: placed.slice(0, RECENT), focus: want, goLog, suite,
    families: [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    unmapped: [...un].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
  };
}

/** a test case from each recent failure (asked by Verse: "Integrate the 'Site Test' suggestions with the 'incident-autopsy' skill to automatically
 *  generate a test case from a recent failure"): for every failing check of a recent incident that maps to a skill, newest first and one per skill,
 *  the ask to try: the check's own double-quoted ask when it has one (what failed, word for word), else the skill's last example from the book.
 *  [{ skill, family, ask, sha, check (its title) }]. Pure. */
export function incidentCases(a, guide, show = 5) {
  const pages = new Map((((guide && guide.pages) || [])).filter((p) => p && p.name && Array.isArray(p.examples)).map((p) => [p.name, p.examples]));
  const out = [], seen = new Set();
  for (const i of (a && a.recent) || []) for (const c of i.checks || []) {
    if (!c.skill || seen.has(c.skill)) continue;
    const quoted = (/"([^"]{3,80})"/.exec(c.text) || [])[1], ex = pages.get(c.skill) || [], ask = String(quoted || ex[ex.length - 1] || '').trim();
    if (!ask) continue;
    seen.add(c.skill); out.push({ skill: c.skill, family: c.family, ask, sha: i.sha.slice(0, 7), check: titleOf(c.text) });
  }
  return out.slice(0, show);
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** the card's body (below the title). An empty file says "no incidents recorded". Pure; every word from the file goes through esc. */
export function autopsyHtml(a, esc = escHtml) {
  // the warning style lock (lib/art-rules.js WARNING_LOCK; asked by Verse): error reports are amber on black with a hazard stripe, whatever they say
  const L = WARNING_LOCK, frame = (attr, inner) => '<div ' + attr + ' data-style-lock="' + L.id + '" style="' + L.css + '"><div style="' + L.stripe + '"></div><div style="padding:6px 12px 0">' + inner + '</div></div>';
  if (!a.total) return frame('data-autopsy-empty="1"', '<p>No incidents recorded.</p>');
  const top = a.families.length ? a.families.filter((f) => f.count === a.families[0].count) : [], fam = a.focus && a.families[0];
  return '<style>[data-style-lock=warning] .sub,[data-style-lock=warning] .src{color:' + L.sub + '}[data-style-lock=warning] a{color:#ffd45e}</style>' + frame('data-autopsy="1"',
    (a.focus ? '<p class="lead" data-autopsy-focus="' + esc(a.focus) + '">Only <b>' + esc(fam ? fam.name : a.focus) + '</b>: ' + esc(a.failing) + ' failing check' + (a.failing === 1 ? '' : 's') + ' in the logs. <a href="#" data-ask="incident autopsy">all families</a></p>'
      : '<p class="lead">' + (top.length ? 'Most failing checks recorded: <b>' + top.map((f) => esc(f.name)).join('</b>, <b>') + '</b> (' + esc(top[0].count) + ' of ' + esc(a.failing) + ').' : 'No failing check could be placed in a family.')
      + ' From the ' + esc(a.total) + ' red browser suites on main in <code>incidents.json</code>; a count is failing checks, not a rating.</p>')
    + (!a.focus && a.suite && (a.suite.timeouts || a.suite.ended) ? '<p class="sub" data-autopsy-suite="1"><b>The suite itself:</b> ' + esc(a.suite.timeouts) + ' stalled check' + (a.suite.timeouts === 1 ? '' : 's') + ' (no check finished within 300 s) and ' + esc(a.suite.ended) + ' end-of-run flag' + (a.suite.ended === 1 ? '' : 's') + ' in ' + esc(a.suite.incidents) + ' of the ' + esc(a.total) + ' red suites: the runner stalling, not a skill failing, so none of it is counted in a family.'
      + (a.suite.escalated ? ' <b data-stall-escalated="1">Escalated:</b> the stall repeats across ' + esc(a.suite.stalled) + ' suites (the bar is ' + esc(a.suite.threshold) + '), so it is treated as an incident to fix, not noise.'
        : a.suite.stalled ? ' <span data-stall-escalated="0">Not escalated: ' + esc(a.suite.stalled) + ' of the ' + esc(a.suite.threshold) + ' repeats it takes.</span>' : '') + '</p>' : '')
    + (a.families.length && !a.focus ? '<div class="vh">By family</div><ul data-autopsy-families="1">' + a.families.map((f) => '<li data-family="' + esc(f.id) + '"><a href="#" data-ask="' + esc('incident autopsy for ' + f.id) + '"><b>' + esc(f.name) + '</b></a> <span style="font-variant-numeric:tabular-nums">' + esc(f.count) + '</span></li>').join('') + '</ul>' : '')
    + (a.goLog && a.goLog.length ? '<div class="vh">' + esc(GO_LOG.name) + ' log</div><div class="sub" data-autopsy-golog="' + esc(a.goLog.length) + '">' + esc(a.goLog.length) + ' failing check' + (a.goLog.length === 1 ? '' : 's') + ' from the games against Verse, latest <code>' + esc(a.goLog[0].sha.slice(0, 8)) + '</code>: '
      + esc(a.goLog[0].text.slice(0, 140)) + ' <a href="#" data-ask="' + esc(GO_LOG.replay) + '">play it again</a></div>' : '')
    + '<div class="vh">Latest incidents</div><ul data-autopsy-recent="1">' + a.recent.map((i) => '<li data-sha="' + esc(i.sha) + '"' + (incidentTargetOf(i.at) ? ' data-incident="' + esc(incidentTargetOf(i.at)) + '"' : '') + '><code>' + esc(i.sha.slice(0, 8)) + '</code> <span class="sub">' + esc(i.at.slice(0, 16).replace('T', ' ')) + ' UTC · ' + esc(i.suite) + '</span><ul>'
      + i.checks.map((c) => '<li data-check="1">' + esc(c.text) + ' <span class="sub">' + (c.meta ? '(the suite itself)' : c.family ? '(' + esc(c.skill || c.owner) + ', ' + esc(c.family) + ')' : '(unmapped)') + '</span></li>').join('') + '</ul>' + (i.signature ? '<div class="sub" data-signature="' + esc(i.signature.kind) + '">' + esc(signatureLine(i.signature)) + '</div>' : '') + culpritHtml(i, esc) + remedyHtml(i, esc) + '</li>').join('') + '</ul>'
    + (a.unmapped.length ? '<div class="vh">Unmapped</div><div class="sub">No skill name or example ask matches these, so they are not placed in a family.</div><ul data-autopsy-unmapped="1">' + a.unmapped.slice(0, 12).map((u) => '<li>' + esc(u.text) + ' <span class="sub">×' + esc(u.count) + '</span></li>').join('') + '</ul>' : ''));
}
/** how many red suites incidents.json keeps (tools/incident-log.mjs KEEP): a week with that many may hold more that fell off the end */
export const INCIDENTS_KEPT = 30;
/** how many different checks failed across a list of incidents (the suite's own flags, a stall or the end-of-run flag, are not a check): one
 *  break seen again on every push until it is fixed adds red suites, not checks. Pure. */
export const failingChecksOf = (incidents) => new Set(incidents.flatMap((i) => i.checks.filter((c) => !isSuiteMeta(c)))).size;
/**
 * the stability gauge (Status card, asked by Verse): how often the browser suite went red on main in the last 7 days, from incidents.json.
 * score 100 with none, 12 less per red suite (never below 0); steady / wobbly / shaky. A red suite that a later green run fixed (closedAt,
 * written when the shards it failed passed on a later commit) no longer counts: `fixed` says how many of the week's those were. `checks`
 * says how many different checks failed in the ones that count, and `capped` says the file was full, so the week held at least `week`
 * red suites, not exactly that. Pure.
 */
export function stabilityOf(incidentsJson, now = Date.now()) {
  const week = 7 * 864e5, inc = parseIncidents(incidentsJson), inWeek = inc.filter((i) => { const t = Date.parse(i.at); return t <= now + 6e4 && now - t < week; });
  const recent = inWeek.filter((i) => !i.closedAt), fixed = inWeek.length - recent.length;
  const day = recent.filter((i) => now - Date.parse(i.at) < 864e5).length;
  // each red suite costs 12 and the cost halves every 12 hours, so a main that stays green climbs back in a day or two instead of sitting at
  // 0/100 for the whole week after a bad morning (owner, 2026-10-24: old incidents "lock the live health dial at 0/100 for a week")
  const cost = recent.reduce((a, i) => a + 12 * Math.pow(0.5, Math.max(0, now - Date.parse(i.at)) / (12 * 36e5)), 0);
  const score = Math.max(0, Math.round(100 - cost));
  const last = recent.length ? Math.max(0, Math.round((now - Math.max(...recent.map((i) => Date.parse(i.at)))) / 36e5)) : null; // hours since the newest red
  const capped = inc.length >= INCIDENTS_KEPT && inWeek.length === inc.length; // the oldest one kept is still inside the week
  return { score, label: score >= 95 ? 'steady' : score >= 60 ? 'wobbly' : 'shaky', week: recent.length, day, known: inc.length, last, checks: failingChecksOf(recent), capped, fixed };
}
/** the gauge as markup: a bar and one sentence. Pure. */
export function stabilityHtml(g, esc = escHtml) {
  if (!g || !g.known) return '<div class="status-stability sub" data-stability="none">No red suite recorded yet, so there is nothing to gauge.</div>';
  const col = g.label === 'steady' ? '#3fbf6a' : g.label === 'wobbly' ? '#d9a441' : '#e0584a';
  return '<div class="status-stability" data-stability="' + esc(g.label) + '" style="margin:6px 0"><b>Stability: ' + esc(g.label) + '</b> <span style="font-variant-numeric:tabular-nums">' + esc(g.score) + '/100</span>'
    + '<div style="height:6px;border-radius:3px;background:rgba(128,128,128,.25);margin:4px 0"><div style="height:6px;border-radius:3px;width:' + esc(g.score) + '%;background:' + col + '"></div></div>'
    + '<span class="sub">' + stabilityLine(g, esc) + '</span></div>';
}
/** the gauge's sentence in plain words: no file names, and "No failing checks" when the week has none that count. Pure. */
export function stabilityLine(g, esc = escHtml) {
  const fixed = g.fixed ? ' ' + esc(g.fixed) + ' earlier red run' + (g.fixed === 1 ? ' was' : 's were') + ' fixed by a later green run.' : '';
  if (!g.week) return 'No failing checks on main this week.' + fixed;
  // the log keeps only the newest INCIDENTS_KEPT red runs: a full week may hold more, so it says "at least"
  return (g.capped ? 'At least ' : '') + esc(g.week) + ' red run' + (g.week === 1 ? '' : 's') + ' of the browser checks on main this week (' + esc(g.day) + ' in the last 24 hours)'
    + (g.checks ? ', with ' + esc(g.checks) + ' different check' + (g.checks === 1 ? '' : 's') + ' failing' : '') + '.' + fixed;
}
/** the "changed in this commit" line of one incident: the skill files it changed, the likely ones first; says plainly when none was a skill file or the paths were never recorded. Pure. */

/**
 * the remediation draft of one incident (asked by Verse: "Add a 'remediation-draft' field to the incident-autopsy output that proposes a
 * code fix for the reported error"): a fix plan built from the record only, never a model's guess at code: the failing checks to re-run
 * alone (one run per check title), the files to open first (a changed skill file with a failing check, then the failing checks' own
 * files from their skill or CHECK_OWNERS row), how to undo the likely file if it fails again, and the commit to read. Code the page cannot check is not proposed. Pure.
 */
export function remediationOf(i) {
  const checks = (i && i.checks || []).filter((c) => c && !c.meta), sha = String(i && i.sha || ''), s8 = sha.slice(0, 8);
  const likely = (i && i.suspects || []).filter((x) => x.likely).map((x) => x.file);
  // the failing checks' own files: an owner row's files, else the skill's file. What the commit merely touched is not offered: a commit that
  // changed drum kits is no reason to open them for a router failure (owner's review, 2026-10-30); its skill files are on the culprit line.
  const own = checks.flatMap((c) => (Array.isArray(c.files) && c.files.length ? c.files : c.skill ? ['skills/' + c.skill + '.js'] : [])).map((f) => 'void-live-deploy/' + f);
  const open = [...new Set([...likely, ...own])].slice(0, 5);
  const titles = [...new Set(checks.map((c) => titleOf(c.text)).filter(Boolean))]; // one run per title: --only "router" runs every router check
  const steps = [];
  if (titles.length) steps.push('Re-run only what failed: ' + titles.slice(0, 3).map((t) => 'node tools/test_void.mjs --only "' + t + '"').join(' ; ') + (titles.length > 3 ? ' (and ' + (titles.length - 3) + ' more)' : ''));
  else if ((i && i.checks || []).some((c) => c && c.meta)) steps.push('Only the runner stalled here; re-run the suite on main before changing any skill.');
  if (open.length) steps.push('Open first: ' + open.map((f) => f.replace(/^void-live-deploy\//, '')).join(', ') + '.');
  if (likely.length && s8) steps.push('If it still fails, put ' + likely[0].replace(/^void-live-deploy\//, '') + ' back as it was before ' + s8 + ' (git checkout ' + s8 + '~1 -- ' + likely[0] + '), re-run, and open a PR with the fix.');
  if (sha) steps.push('Read the change: https://github.com/atomeam/void-loop/commit/' + sha);
  return steps;
}
/** the brief a builder agent gets from the root-cause button: the incident, its failing checks and the draft, one plain text. Pure. */
export function builderBrief(i) {
  const checks = (i && i.checks || []).map((c) => '- ' + c.text + (c.meta ? ' (the suite itself)' : c.skill || c.owner ? ' (' + (c.skill || c.owner) + ')' : ' (unmapped)'));
  return ['Incident ' + String(i && i.sha || '').slice(0, 8) + ' (' + String(i && i.at || '').slice(0, 16).replace('T', ' ') + ' UTC, ' + (i && i.suite || 'browser suite') + ')', 'Failing checks:', ...checks, 'Remediation draft:', ...remediationOf(i).map((x, k) => k + 1 + '. ' + x)].join('\n');
}
export function culpritHtml(i, esc) {
  if (!Array.isArray(i.touched) || !i.touched.length) return '';
  const sus = i.suspects || [], likely = sus.filter((x) => x.likely);
  if (!sus.length) return '<div class="sub" data-culprit="none">No skill file changed in this commit (' + esc(i.touched.length) + ' file' + (i.touched.length === 1 ? '' : 's') + ' did), so the cause is not a skill rewrite.</div>';
  return '<div class="sub" data-culprit="' + (likely.length ? 'likely' : 'changed') + '">' + (likely.length ? 'Likely cause: ' : 'Skill files changed in this commit: ')
    + sus.slice(0, 5).map((x) => '<code>' + esc(x.file.replace(/^void-live-deploy\//, '')) + '</code>' + (x.likely ? ' (has a failing check)' : '')).join(', ') + '</div>';
}
/** the remediation draft and the root-cause action under one incident: copy the brief for the builder agents, or open it as a
 *  prefilled issue the visitor files themselves (nothing is sent for them). Pure. */
export function remedyHtml(i, esc) {
  const steps = remediationOf(i); if (!steps.length) return '';
  const brief = builderBrief(i), issue = 'https://github.com/atomeam/void-loop/issues/new?labels=builder&title=' + encodeURIComponent('Incident ' + String(i.sha || '').slice(0, 8) + ': fix the failing checks') + '&body=' + encodeURIComponent(brief.slice(0, 6000));
  return '<div class="sub" data-remediation="' + esc(steps.length) + '"><b>Remediation draft:</b><ol style="margin:2px 0 4px 18px;padding:0">' + steps.map((x) => '<li style="white-space:normal;overflow-wrap:anywhere">' + esc(x) + '</li>').join('') + '</ol>'
    + '<span role="button" tabindex="0" data-builder-brief="' + esc(brief) + '" style="display:inline-block;cursor:pointer;border:1px solid #ffd45e;border-radius:12px;padding:3px 10px;margin:0 6px 4px 0">Send to builders: copy the brief</span>'
    + '<a href="' + esc(issue) + '" target="_blank" rel="noopener" data-builder-issue="1">or file it as an issue for the builder agents</a></div>';
}
/** the health pulse (self card): the latest incident, its commit and the families its checks map to; null when none is recorded. Pure. */
export function pulseOf(a) {
  const l = a && a.recent && a.recent[0]; if (!l) return null;
  const fams = [...new Map(l.checks.filter((c) => c.family).map((c) => [c.family, c.family])).keys()];
  return { sha: l.sha, at: l.at, suite: l.suite, families: fams, unmapped: l.checks.filter((c) => !c.family).length, checks: l.checks, signature: l.signature || null };
}
/**
 * The pulse's markup: read-only. Without an owner it has no button; with `owner` each mapped failing check of the latest incident gets a
 * "Suggest fix" (lib/correction-fix.js, the existing owner-only /api/propose-fix; a draft only, never run by itself). Pure; all text escaped.
 */
export function pulseHtml(a, esc = escHtml, { owner = false, names = {} } = {}) {
  const p = pulseOf(a), head = '<div class="vh">Health pulse</div>';
  if (!p) return head + '<div class="sub" data-pulse-empty="1">No incidents recorded.</div>';
  return head + '<div data-pulse="1"><div><code>' + esc(p.sha.slice(0, 8)) + '</code> <span class="sub">' + esc(p.at.slice(0, 16).replace('T', ' ')) + ' UTC · ' + esc(p.suite) + '</span></div>'
    + '<div class="sub">' + (p.families.length ? 'Families it maps to: ' + p.families.map((f) => esc(names[f] || f)).join(', ') : 'None of its failing checks map to a family') + (p.unmapped ? ' · ' + esc(p.unmapped) + ' unmapped' : '') + '.</div>'
    + (p.signature ? '<div class="sub" data-signature="' + esc(p.signature.kind) + '">' + esc(signatureLine(p.signature)) + '</div>' : '')
    + (owner ? '<ul data-pulse-checks="1">' + p.checks.map((c, i) => c.skill ? '<li>' + esc(c.text.split(':')[0]) + ' <button type="button" class="tr-copy" data-incident-fix="' + esc(i) + '">Suggest fix</button><span data-fix-out></span></li>' : '').join('') + '</ul>' : '')
    + '</div>';
}

/**
 * The failures as garden plants (asked by Verse and the owner: "the error garden grows from the incident autopsy"): one plant per distinct failing
 * check title in the newest incidents, its count the number of incidents it failed in (two or more is a weed), the most repeated first. Pure.
 */
export function failurePlants(incidentsJson, max = 12) {
  const by = new Map();
  for (const inc of parseIncidents(incidentsJson).slice(0, 30)) {
    for (const t of new Set(inc.checks.filter((c) => !isSuiteMeta(c)).map(titleOf).filter((x) => x.length >= 3))) {
      const e = by.get(t) || { text: t.slice(0, 120), count: 0, last: Date.parse(inc.at) };
      e.count += 1; by.set(t, e);
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, Math.max(1, Math.min(20, max | 0)));
}
