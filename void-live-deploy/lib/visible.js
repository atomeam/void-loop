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

// Fun first (owner, 2026-11-20: "Verse is kinda boring still, i cant really find anything i like doing on it"; "none of the games are good or
// fun"). The build lanes were making business-tool skills nobody plays with (runbook, ops digest, client-* and delivery packs). New work now
// goes mostly to what a visitor plays with: games and their updates, daily challenges, cards and creative tools. Business tools keep a
// small share (BUSINESS_SHARE of the top wants), never none, so a real client ask can still be built.
export const FUN_BOOST = 20;
export const BUSINESS_CUT = 25;
export const BUSINESS_SHARE = 0.2;
export const FUN_RE = /\b(?:games?|game updates?|play(?:able|ing)?|puzzles?|daily (?:challenges?|puzzles?|games?)|challenges?|quiz(?:zes)?|trivia|riddles?|arcade|levels?|high scores?|leaderboards?|chess|checkers|cards?|card art|draw(?:ing)?|paint(?:ing)?|doodles?|colou?ring|pixel art|art forge|music|songs?|beats?|stor(?:y|ies)|fanfic|emoji|stickers?|memes?|avatars?|creative|jokes?|word games?)\b/i;
export const BUSINESS_RE = /\b(?:clients?|client-\w+|runbooks?|sops?|ops[- ]digest|ops|hand-?offs?|intake|kick-?off|onboarding|deliver(?:y|ables?)|ownership|reliability|status (?:reports?|packs?|handoff)|invoices?|proposals?|b2b|stakeholders?|escalations?|sla|compliance|exceptions[- ]pack|lift[- ](?:summary|plan)|monitor[- ]receipt|connections[- ]watch|automation[- ](?:status|handoff|proposal)|systems[- ]connect|scope[- ]pack|[\w]+-pack)\b/i;
/** 'business' for a business-tool want, 'fun' for something a visitor plays with, '' for the rest. Business wins when a line is both. Pure. */
export function laneOf(text) {
  const t = String(text || '');
  if (BUSINESS_RE.test(t)) return 'business';
  if (FUN_RE.test(t)) return 'fun';
  return '';
}

/** +VISIBLE_BOOST for a visitor-facing fix, -INTERNAL_CUT for internal work, the visible one when a line is both; then +FUN_BOOST for
 *  something a visitor plays with, -BUSINESS_CUT for a business tool (a visible fix keeps its own boost alone). Pure. */
export function rankAdjust(text) {
  const t = String(text || '');
  const vis = VISIBLE_RE.test(t), inn = INTERNAL_RE.test(t), lane = laneOf(t);
  if (vis) return VISIBLE_BOOST; // a broken thing a visitor meets is fixed first, whatever it is
  return (inn ? -INTERNAL_CUT : 0) + (lane === 'fun' ? FUN_BOOST : lane === 'business' ? -BUSINESS_CUT : 0);
}

const textOf = (c) => [c && c.title, c && c.why, c && c.kind, c && c.note, c && c.target].filter(Boolean).join(' ');
/** weights after the visible-progress and fun-first rules, never below 1; then business tools hold at most BUSINESS_SHARE of the top
 *  `top` (the first one always keeps its place): the rest sit just under the top. Pure. */
export function adjustWeights(cands, top = 10) {
  const list = Array.isArray(cands) ? cands : [];
  const w = list.map((c) => Math.max(1, Math.round((+c.weight || 0) + rankAdjust(textOf(c)))));
  const order = w.map((x, i) => i).sort((a, b) => w[b] - w[a]);
  const allowed = Math.max(1, Math.floor(BUSINESS_SHARE * top)), held = [], picks = [];
  let seen = 0;
  for (const i of order) {
    if (laneOf(textOf(list[i])) === 'business' && ++seen > allowed) held.push(i);
    else if (picks.length < top) picks.push(i);
  }
  if (picks.length >= top) { const floor = Math.min(...picks.map((i) => w[i])); for (const i of held) if (w[i] >= floor) w[i] = Math.max(1, floor - 1); }
  return w;
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
