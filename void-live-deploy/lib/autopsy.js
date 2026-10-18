// Incident autopsy (asked by Void: "parse incidents.json and say which skill family is currently unhealthy"). Reads the site's own incidents.json
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
/** the warning look on the error reactions of an incident's bar (asked by Void: "errors trigger a specific 'confusion' or 'pity' reaction aesthetic"):
 *  { confused: css, pity: css } from the warning style lock's amber. Pure constant; nothing from a request. */
export const ERROR_TINT = Object.freeze(Object.fromEntries(ERROR_REACTIONS.map((id) => [id, 'background:rgba(255,176,0,.18);border-color:' + WARNING_LOCK.css.match(/#ffb000/)[0] + ';color:#ffd45e;box-shadow:0 0 0 1px rgba(255,176,0,.35) inset'])));
const norm = (t) => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** the incidents of a parsed incidents.json that are well formed: { at, sha, suite, checks[] }, in the file's order (newest first). Pure. */
export function parseIncidents(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.incidents) ? j.incidents : [];
  return list.filter((i) => i && /^[0-9a-f]{7,40}$/i.test(String(i.sha || '')) && Array.isArray(i.checks) && Number.isFinite(Date.parse(i.at)))
    .map((i) => ({ at: String(i.at), sha: String(i.sha).toLowerCase(), suite: String(i.suite || '').slice(0, 80), checks: i.checks.map((c) => String(c == null ? '' : c).slice(0, 400)).filter(Boolean),
      touched: (Array.isArray(i.touched) ? i.touched : []).map((x) => String(x == null ? '' : x)).filter((x) => /^[\w./@-]{1,120}$/.test(x)).slice(0, 15) }));
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
  return null;
}

/** the "Go against V01D" log (asked by Void: "Connect the 'Go against V01D' logs to the 'incident-autopsy' skill for automated error analysis."): the failing checks
 *  of the Go games against V01D (the browser suite "go against v01d", tools/go-ai.test.mjs, lib/go-ai.js) are told apart from the rest of the incidents, counted, and
 *  offered back as the ask that replays one. Matched by words in the check's name; nothing is guessed. Pure. */
export const GO_LOG = { id: 'go-against-void', name: 'Go against V01D', replay: 'play go against void' };
export const isGoLog = (check) => /\bgo\s+(?:against|vs\.?|with)\s+(?:v01d|void|you|the\s+computer)\b|\bgo[- ]ai\b/i.test(String(check || '').slice(0, 160));

/** the autopsy: { total, failing, recent: [{ sha, at, suite, checks: [{ text, skill, family }] }], families: [{ id, name, count }], unmapped: [{ text, count }],
 *  goLog: [{ sha, at, text }] (every failing Go-against-V01D check), focus }. `focus` (a family id; asked by Void: a drill-down from the stability sparklines) keeps only
 *  that family's failing checks, and only the incidents that have one. Pure. */
export function autopsy(incidentsJson, fam, guide, focus = '') {
  const inc = parseIncidents(incidentsJson), map = familyMap(fam), names = [...map.keys()], pages = (guide && guide.pages) || [], want = String(focus || '');
  const counts = new Map(), un = new Map(), goLog = [];
  let placed = inc.map((i) => ({ ...i, checks: i.checks.map((text) => {
    const skill = skillOfCheck(text, names, pages) || (isGoLog(text) && map.has('go') ? 'go' : null), f = skill && map.get(skill) || null; // a Go-against-V01D check belongs to the go skill (its name is too short to match by words)
    return { text, skill: f ? skill : null, family: f ? f.id : null, name: f ? f.name : null };
  }) }));
  if (want) placed = placed.map((i) => ({ ...i, checks: i.checks.filter((c) => c.family === want) })).filter((i) => i.checks.length);
  for (const i of placed) for (const c of i.checks) {
    if (isGoLog(c.text)) goLog.push({ sha: i.sha, at: i.at, text: c.text });
    if (c.family) counts.set(c.family, { id: c.family, name: c.name, count: (counts.get(c.family) || { count: 0 }).count + 1 }); else un.set(c.text, (un.get(c.text) || 0) + 1);
  }
  placed = placed.map((i) => { const checks = i.checks.map(({ text, skill, family }) => ({ text, skill, family })); return { ...i, checks, suspects: suspectsOf(i.touched, checks) }; });
  return {
    total: inc.length, failing: placed.reduce((n, i) => n + i.checks.length, 0), recent: placed.slice(0, RECENT), focus: want, goLog,
    families: [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    unmapped: [...un].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
  };
}

/** a test case from each recent failure (asked by Void: "Integrate the 'Site Test' suggestions with the 'incident-autopsy' skill to automatically
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
  // the warning style lock (lib/art-rules.js WARNING_LOCK; asked by Void): error reports are amber on black with a hazard stripe, whatever they say
  const L = WARNING_LOCK, frame = (attr, inner) => '<div ' + attr + ' data-style-lock="' + L.id + '" style="' + L.css + '"><div style="' + L.stripe + '"></div><div style="padding:6px 12px 0">' + inner + '</div></div>';
  if (!a.total) return frame('data-autopsy-empty="1"', '<p>No incidents recorded.</p>');
  const top = a.families.length ? a.families.filter((f) => f.count === a.families[0].count) : [], fam = a.focus && a.families[0];
  return '<style>[data-style-lock=warning] .sub,[data-style-lock=warning] .src{color:' + L.sub + '}[data-style-lock=warning] a{color:#ffd45e}</style>' + frame('data-autopsy="1"',
    (a.focus ? '<p class="lead" data-autopsy-focus="' + esc(a.focus) + '">Only <b>' + esc(fam ? fam.name : a.focus) + '</b>: ' + esc(a.failing) + ' failing check' + (a.failing === 1 ? '' : 's') + ' in the logs. <a href="#" data-ask="incident autopsy">all families</a></p>'
      : '<p class="lead">' + (top.length ? 'Most failing checks recorded: <b>' + top.map((f) => esc(f.name)).join('</b>, <b>') + '</b> (' + esc(top[0].count) + ' of ' + esc(a.failing) + ').' : 'No failing check could be placed in a family.')
      + ' From the ' + esc(a.total) + ' red browser suites on main in <code>incidents.json</code>; a count is failing checks, not a rating.</p>')
    + (a.families.length && !a.focus ? '<div class="vh">By family</div><ul data-autopsy-families="1">' + a.families.map((f) => '<li data-family="' + esc(f.id) + '"><a href="#" data-ask="' + esc('incident autopsy for ' + f.id) + '"><b>' + esc(f.name) + '</b></a> <span style="font-variant-numeric:tabular-nums">' + esc(f.count) + '</span></li>').join('') + '</ul>' : '')
    + (a.goLog && a.goLog.length ? '<div class="vh">' + esc(GO_LOG.name) + ' log</div><div class="sub" data-autopsy-golog="' + esc(a.goLog.length) + '">' + esc(a.goLog.length) + ' failing check' + (a.goLog.length === 1 ? '' : 's') + ' from the games against V01D, latest <code>' + esc(a.goLog[0].sha.slice(0, 8)) + '</code>: '
      + esc(a.goLog[0].text.slice(0, 140)) + ' <a href="#" data-ask="' + esc(GO_LOG.replay) + '">play it again</a></div>' : '')
    + '<div class="vh">Latest incidents</div><ul data-autopsy-recent="1">' + a.recent.map((i) => '<li data-sha="' + esc(i.sha) + '"' + (incidentTargetOf(i.at) ? ' data-incident="' + esc(incidentTargetOf(i.at)) + '"' : '') + '><code>' + esc(i.sha.slice(0, 8)) + '</code> <span class="sub">' + esc(i.at.slice(0, 16).replace('T', ' ')) + ' UTC · ' + esc(i.suite) + '</span><ul>'
      + i.checks.map((c) => '<li data-check="1">' + esc(c.text) + ' <span class="sub">' + (c.family ? '(' + esc(c.skill) + ', ' + esc(c.family) + ')' : '(unmapped)') + '</span></li>').join('') + '</ul>' + culpritHtml(i, esc) + '</li>').join('') + '</ul>'
    + (a.unmapped.length ? '<div class="vh">Unmapped</div><div class="sub">No skill name or example ask matches these, so they are not placed in a family.</div><ul data-autopsy-unmapped="1">' + a.unmapped.slice(0, 12).map((u) => '<li>' + esc(u.text) + ' <span class="sub">×' + esc(u.count) + '</span></li>').join('') + '</ul>' : ''));
}
/** the "changed in this commit" line of one incident: the skill files it changed, the likely ones first; says plainly when none was a skill file or the paths were never recorded. Pure. */
export function culpritHtml(i, esc) {
  if (!Array.isArray(i.touched) || !i.touched.length) return '';
  const sus = i.suspects || [], likely = sus.filter((x) => x.likely);
  if (!sus.length) return '<div class="sub" data-culprit="none">No skill file changed in this commit (' + esc(i.touched.length) + ' file' + (i.touched.length === 1 ? '' : 's') + ' did), so the cause is not a skill rewrite.</div>';
  return '<div class="sub" data-culprit="' + (likely.length ? 'likely' : 'changed') + '">' + (likely.length ? 'Likely cause: ' : 'Skill files changed in this commit: ')
    + sus.slice(0, 5).map((x) => '<code>' + esc(x.file.replace(/^void-live-deploy\//, '')) + '</code>' + (x.likely ? ' (has a failing check)' : '')).join(', ') + '</div>';
}
/** the health pulse (self card): the latest incident, its commit and the families its checks map to; null when none is recorded. Pure. */
export function pulseOf(a) {
  const l = a && a.recent && a.recent[0]; if (!l) return null;
  const fams = [...new Map(l.checks.filter((c) => c.family).map((c) => [c.family, c.family])).keys()];
  return { sha: l.sha, at: l.at, suite: l.suite, families: fams, unmapped: l.checks.filter((c) => !c.family).length, checks: l.checks };
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
    + (owner ? '<ul data-pulse-checks="1">' + p.checks.map((c, i) => c.skill ? '<li>' + esc(c.text.split(':')[0]) + ' <button type="button" class="tr-copy" data-incident-fix="' + esc(i) + '">Suggest fix</button><span data-fix-out></span></li>' : '').join('') + '</ul>' : '')
    + '</div>';
}

/**
 * The failures as garden plants (asked by Void and the owner: "the error garden grows from the incident autopsy"): one plant per distinct failing
 * check title in the newest incidents, its count the number of incidents it failed in (two or more is a weed), the most repeated first. Pure.
 */
export function failurePlants(incidentsJson, max = 12) {
  const by = new Map();
  for (const inc of parseIncidents(incidentsJson).slice(0, 30)) {
    for (const t of new Set(inc.checks.map(titleOf).filter((x) => x.length >= 3))) {
      const e = by.get(t) || { text: t.slice(0, 120), count: 0, last: Date.parse(inc.at) };
      e.count += 1; by.set(t, e);
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, Math.max(1, Math.min(20, max | 0)));
}
