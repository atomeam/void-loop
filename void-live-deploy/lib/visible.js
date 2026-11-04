// Visible progress (Atom, 2026-11-03: "weve come so far and still feels like we are sitting still").
// Progress is what a visitor can see and use on a-to-mind.com. Internal laps, gates, incident logs and regenerated
// files are not progress. The will and the conductor add rankAdjust to a candidate's weight. The wants card shows
// shippedVisible: commits on main that touch a page or a skill, counted when the site is deployed.

export const VISIBLE_BOOST = 18;
export const INTERNAL_CUT = 12;

// a visitor meets it: a broken card, a wrong answer, a refusal on a card, a laggy render, a missing link
export const VISIBLE_RE = /\b(?:broken (?:cards?|pages?|buttons?)|wrong answers?|refusals? shown|shown on (?:a |the )?cards?|laggy|janky|slow (?:card|page|render)|missing links?|nothing appeared|link (?:goes|leads) nowhere|card (?:is |shows |draws )?(?:blank|empty|wrong))\b/i;
// the work a visitor never sees
export const INTERNAL_RE = /\b(?:verse[- ]?loops?|growth-suites|incident logs?|regenerat\w+|conductor|groom docs|self-heal|workflow yml|fast checks|git diff|failing checks|assertion failures|verify\.yml|checks?\.mjs)\b/i;

/** +VISIBLE_BOOST for a visitor-facing fix, -INTERNAL_CUT for internal work, the visible one when a line is both. Pure. */
export function rankAdjust(text) {
  const t = String(text || '');
  const vis = VISIBLE_RE.test(t), inn = INTERNAL_RE.test(t);
  if (vis) return VISIBLE_BOOST;
  if (inn) return -INTERNAL_CUT;
  return 0;
}

/** weights after the visible-progress rule, never below 1. Pure. */
export function adjustWeights(cands) {
  return (Array.isArray(cands) ? cands : []).map((c) => {
    const text = [c && c.title, c && c.why, c && c.kind, c && c.note, c && c.target].filter(Boolean).join(' ');
    return Math.max(1, Math.round((+c.weight || 0) + rankAdjust(text)));
  });
}

const GENERATED = /(?:^|\/)(?:skills\/(?:index|families|guide|deps)\.json|self\.json|void\.growth\.json|churn\.json|sitemap\.xml|llms\.txt)$/;

/** a path a visitor meets: a skill, or a page. Generated manifests, tools, docs and workflows are not. Pure. */
export function isFacingPath(p) {
  const s = String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!s || GENERATED.test(s) || s.startsWith('.github/') || s.startsWith('tools/') || s.startsWith('docs/') || s.startsWith('domains/') || s.startsWith('growth/')) return false;
  if (s === 'void.html' || s === 'index.html') return true;
  if (/^void-live-deploy\/skills\/.+\.js$/.test(s) && !/\/skills\/(?:index|families|guide|deps)\.json$/.test(s)) return true;
  if (/^void-live-deploy\/.+\.html$/.test(s)) return true;
  return false;
}

/** `git log --name-only --pretty=format:%cI` text -> [{ at, files }]. Pure. */
export function parseFacingLog(log) {
  const commits = []; let cur = null;
  for (const line of String(log || '').split('\n')) {
    if (!line.trim()) { cur = null; continue; }
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) { cur = { at: line.trim(), files: [] }; commits.push(cur); continue; }
    if (cur) cur.files.push(line.trim());
  }
  return commits;
}

/** { day, week }: commits whose files include a page or a skill, on the UTC day of `now` and across the 7 UTC days ending then. Pure. */
export function shippedVisible(commits, now = Date.now()) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const day0 = start.getTime(), week0 = day0 - 6 * 864e5;
  const seen = new Set(); let day = 0, week = 0;
  for (const c of commits || []) {
    const t = Date.parse(c && c.at); if (!Number.isFinite(t) || t > now) continue;
    const id = (c.sha || c.at) + '|' + (c.files || []).join(',');
    if (seen.has(id) || !(c.files || []).some(isFacingPath)) continue;
    seen.add(id);
    if (t >= week0) week++;
    if (t >= day0) day++;
  }
  return { day, week };
}

export const visibleLine = (v) => (v && Number.isFinite(+v.day) && Number.isFinite(+v.week)
  ? 'Visible changes shipped: ' + Math.max(0, Math.round(+v.day)) + ' today, ' + Math.max(0, Math.round(+v.week)) + ' this week (pages and skills on the live site).'
  : '');
