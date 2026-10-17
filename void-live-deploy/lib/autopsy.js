// Incident autopsy (asked by Void: "parse incidents.json and say which skill family is currently unhealthy"). Reads the site's own incidents.json
// (every red browser suite on main: time, commit, the names of the checks that failed; written by tools/incident-log.mjs) and places each failing
// check in a skill family by its name alone, with no guessing: the check's title (the words before its first colon) is matched against the skill
// names in skills/families.json, and failing that a double-quoted ask in the check is matched, word for word, against a skill's example asks
// (skills/guide.json). A check that matches nothing is listed as unmapped. Counts are counts of failing checks recorded in the file; nothing is
// estimated. Incident text is untrusted: it is shown only through esc. Pure: data in, data and markup out. No network, no model, no key.
import { familyMap } from './corrections.js';

export const RECENT = 8; // incidents listed
const norm = (t) => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** the incidents of a parsed incidents.json that are well formed: { at, sha, suite, checks[] }, in the file's order (newest first). Pure. */
export function parseIncidents(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.incidents) ? j.incidents : [];
  return list.filter((i) => i && /^[0-9a-f]{7,40}$/i.test(String(i.sha || '')) && Array.isArray(i.checks) && Number.isFinite(Date.parse(i.at)))
    .map((i) => ({ at: String(i.at), sha: String(i.sha).toLowerCase(), suite: String(i.suite || '').slice(0, 80), checks: i.checks.map((c) => String(c == null ? '' : c).slice(0, 400)).filter(Boolean) }));
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

/** the autopsy: { total, failing, recent: [{ sha, at, suite, checks: [{ text, skill, family }] }], families: [{ id, name, count }], unmapped: [{ text, count }] }. Pure. */
export function autopsy(incidentsJson, fam, guide) {
  const inc = parseIncidents(incidentsJson), map = familyMap(fam), names = [...map.keys()], pages = (guide && guide.pages) || [];
  const counts = new Map(), un = new Map();
  const placed = inc.map((i) => ({ ...i, checks: i.checks.map((text) => {
    const skill = skillOfCheck(text, names, pages), f = skill && map.get(skill) || null;
    if (f) counts.set(f.id, { id: f.id, name: f.name, count: (counts.get(f.id) || { count: 0 }).count + 1 }); else un.set(text, (un.get(text) || 0) + 1);
    return { text, skill: f ? skill : null, family: f ? f.id : null };
  }) }));
  return {
    total: inc.length, failing: placed.reduce((n, i) => n + i.checks.length, 0), recent: placed.slice(0, RECENT),
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
  if (!a.total) return '<p data-autopsy-empty="1">No incidents recorded.</p>';
  const top = a.families.length ? a.families.filter((f) => f.count === a.families[0].count) : [];
  return '<div data-autopsy="1"><p class="lead">' + (top.length ? 'Most failing checks recorded: <b>' + top.map((f) => esc(f.name)).join('</b>, <b>') + '</b> (' + esc(top[0].count) + ' of ' + esc(a.failing) + ').' : 'No failing check could be placed in a family.')
    + ' From the ' + esc(a.total) + ' red browser suites on main in <code>incidents.json</code>; a count is failing checks, not a rating.</p>'
    + (a.families.length ? '<div class="vh">By family</div><ul data-autopsy-families="1">' + a.families.map((f) => '<li data-family="' + esc(f.id) + '"><b>' + esc(f.name) + '</b> <span style="font-variant-numeric:tabular-nums">' + esc(f.count) + '</span></li>').join('') + '</ul>' : '')
    + '<div class="vh">Latest incidents</div><ul data-autopsy-recent="1">' + a.recent.map((i) => '<li data-sha="' + esc(i.sha) + '"><code>' + esc(i.sha.slice(0, 8)) + '</code> <span class="sub">' + esc(i.at.slice(0, 16).replace('T', ' ')) + ' UTC · ' + esc(i.suite) + '</span><ul>'
      + i.checks.map((c) => '<li data-check="1">' + esc(c.text) + ' <span class="sub">' + (c.family ? '(' + esc(c.skill) + ', ' + esc(c.family) + ')' : '(unmapped)') + '</span></li>').join('') + '</ul></li>').join('') + '</ul>'
    + (a.unmapped.length ? '<div class="vh">Unmapped</div><div class="sub">No skill name or example ask matches these, so they are not placed in a family.</div><ul data-autopsy-unmapped="1">' + a.unmapped.slice(0, 12).map((u) => '<li>' + esc(u.text) + ' <span class="sub">×' + esc(u.count) + '</span></li>').join('') + '</ul>' : '')
    + '</div>';
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
