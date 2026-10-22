/**
 * Fix audit (asked by Verse, 2026-10-21, three asks in one card: "Audit the fixed skills to ensure their 'evidence' rating in
 * skills/families.json was updated correctly based on the fix", "Automate a 'post-fix' audit that checks if a shipped fix accidentally
 * broke a skill in a different family", and "Verify if the newly shipped /fix/ pages are actually reducing the 'friction' metric").
 * From Verse's own files only: the growth ledger's fix lines (void.growth.json), the evidence ratings (skills/families.json) and the
 * red browser suites on main (incidents.json, placed in families by lib/autopsy.js). Pure.
 */
import { autopsy } from './autopsy.js';
const norm = (s) => String(s || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const WINDOW_H = 48; // a red suite this soon after a fix counts as the fix's to answer for
/** skill name -> { family, familyName, tier, last } from families.json. Pure. */
export function table(fam) {
  const t = new Map();
  for (const f of (fam && fam.families) || []) for (const s of (f && f.skills) || []) if (s && s.name && !t.has(s.name)) t.set(s.name, { family: f.id, familyName: f.name || f.id, tier: s.tier || 'experiment', last: s.last_tested || '' });
  return t;
}
/** the skills a ledger line names: a name with a dash or 7+ letters as whole words (an everyday word like "place" is not a skill). Pure. */
export function named(what, t) {
  const text = ' ' + norm(what) + ' ', hit = [];
  for (const n of [...t.keys()].sort((a, b) => b.length - a.length)) { const w = norm(n); if ((/-/.test(n) || w.length >= 7) && text.includes(' ' + w + ' ') && !hit.some((h) => norm(h).includes(w))) hit.push(n); }
  return hit;
}
/** the audit: { fixes: [{ at, by, what, skills: [{ name, family, tier, last, current }], broke: [{ sha, at, family, check }] }], stale, crossed, total }. */
export function auditOf(ledger, fam, incidents, { days = 30, now = Date.now() } = {}) {
  const t = table(fam), list = Array.isArray(ledger) ? ledger : (ledger && ledger.entries) || [];
  const inc = (incidents && incidents.incidents) || [];
  const placed = inc.map((i) => { const one = autopsy({ incidents: [i] }, fam, null).recent[0]; return { sha: String(i.sha || ''), at: String(i.at || ''), checks: (one && one.checks) || [] }; });
  const fixes = list.filter((e) => e && e.kind === 'fix' && e.at && now - Date.parse(e.at) < days * 864e5).map((e) => {
    const skills = named(e.what, t).map((n) => { const s = t.get(n); return { name: n, family: s.family, familyName: s.familyName, tier: s.tier, last: s.last, current: !!s.last && s.last >= String(e.at).slice(0, 10) }; });
    const fams = new Set(skills.map((s) => s.family)), t0 = Date.parse(e.at);
    const broke = skills.length ? placed.filter((i) => { const ti = Date.parse(i.at); return ti > t0 && ti - t0 < WINDOW_H * 36e5; })
      .flatMap((i) => i.checks.filter((c) => c.family && !fams.has(c.family)).map((c) => ({ sha: i.sha, at: i.at, family: c.family, skill: c.skill, check: String(c.text).slice(0, 200) }))) : [];
    return { at: e.at, by: e.by, what: String(e.what), skills, broke };
  }).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const withSkills = fixes.filter((f) => f.skills.length);
  return { fixes: withSkills, unnamed: fixes.length - withSkills.length, total: fixes.length, stale: withSkills.reduce((n, f) => n + f.skills.filter((s) => !s.current).length, 0), crossed: withSkills.filter((f) => f.broke.length).length, days };
}
/** the card. esc escapes every value. Pure. */
export function auditHtml(r, esc, { fixPages = null } = {}) {
  const shown = r.fixes.slice(0, 25);
  return '<h2>Fix audit</h2><p class="lead">' + esc(r.total) + ' fix' + (r.total === 1 ? '' : 'es') + ' in my growth ledger in the last ' + esc(r.days) + ' days; ' + esc(r.fixes.length) + ' name a skill of mine. '
    + esc(r.stale) + ' fixed skill rating' + (r.stale === 1 ? ' predates' : 's predate') + ' its fix, and ' + esc(r.crossed) + ' fix' + (r.crossed === 1 ? ' was' : 'es were') + ' followed within ' + WINDOW_H + ' hours by a failing check in a different family (followed, not proven caused: read the commit).</p>'
    + '<ul data-fix-audit="' + esc(r.fixes.length) + '" style="padding-left:18px">' + shown.map((f) => '<li style="margin:0 0 8px;white-space:normal" data-crossed="' + (f.broke.length ? 1 : 0) + '"><span class="sub">' + esc(f.at.slice(0, 10)) + ' · ' + esc(f.by) + '</span> ' + esc(f.what)
      + '<div class="sub">Evidence: ' + f.skills.map((s) => esc(s.name) + ' is <b>' + esc(s.tier) + '</b>' + (s.current ? ' (rated ' + esc(s.last) + ', after the fix)' : s.last ? ' (<b data-stale="1">rated ' + esc(s.last) + ', before the fix</b>)' : ' (<b data-stale="1">no rating date</b>)')).join('; ') + '</div>'
      + (f.broke.length ? '<div class="sub" data-broke="' + esc(f.broke.length) + '"><b>Then broke elsewhere:</b> ' + f.broke.slice(0, 3).map((b) => esc(b.skill) + ' (' + esc(b.family) + ') in ' + esc(b.sha.slice(0, 8))).join(', ') + '</div>' : '<div class="sub">No failing check in another family within ' + WINDOW_H + ' hours.</div>') + '</li>').join('') + '</ul>'
    + '<div class="vh">The /fix/ pages and friction</div><p class="sub" data-fix-pages="' + esc(fixPages == null ? '' : fixPages) + '">' + (fixPages != null ? esc(fixPages) + ' /fix/ pages' : 'My /fix/ pages') + ' explain errors in outside tools (GitHub Actions, n8n, Make). My friction line counts my own skills that fail or are least checked (skills/families.json), and no /fix/ page is one of those skills, so the friction line cannot show whether they help; it moves only when a skill is fixed and re-rated. What would show it: visits to a page and fewer asks about that error, which I do not count.</p>'
    + '<div class="src">Source: fix lines in my growth ledger (void.growth.json), ratings in skills/families.json, red suites on main in incidents.json. A rating counts as updated when its last_tested date is the fix day or later. My own records, no model.</div>';
}
