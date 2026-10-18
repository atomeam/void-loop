// Verse's fixes, previewed for the owner (owner, 2026-10-16: "confidence > 0.8 might auto-merge, < 0.8 diff-preview for Adam").
// The pull requests Verse's own model opened (label "made by Verse", .github/workflows/propose-fix.yml) carry its confidence and
// the lines they change in their body; one under 0.8 is labelled "waits for owner" instead of automerge. The card
// (skills/v01d-fixes.js) shows each open one with its confidence, where it changes, and the diff; Approve
// (functions/api/v01d-fixes.js, owner only) swaps "waits for owner" for automerge, so it merges once Void's review is clean. Pure.
export const REPO = 'atomeam/void-loop';
// LABEL is the GitHub label's name, an identifier the workflows make (people see Verse)
export const LABEL = 'made by Verse', WAITS = 'waits for owner', MERGES = 'automerge';
export const MAX_LINES = 40;

/** one open pull request, as the card shows it: number, title, link, Verse's confidence and where, and whether it waits. */
export function fixOf(pr) {
  if (!pr || typeof pr.number !== 'number') return null;
  const labels = (pr.labels || []).map((l) => (l && l.name) || '').filter(Boolean);
  if (!labels.includes(LABEL)) return null;
  const body = String(pr.body || '');
  const c = /(?:V01D|Verse)'s confidence: ([0-9.]+|none given)\./.exec(body), w = /Where: ([^\n]*?)\.(?:\s|$)/.exec(body), why = /Why, in (?:V01D|Verse)'s words: ([^\n]*?)\. (?:(?:V01D|Verse)'s confidence|Labelled)/.exec(body);
  const rk = /Risk: (low|medium|high)\b(?: \(([^)]*)\))?/.exec(body); // asked by Void: how much the fix changes, worked out by tools/propose-fix.mjs
  const conf = c && c[1] !== 'none given' && Number.isFinite(parseFloat(c[1])) ? Math.round(parseFloat(c[1]) * 100) / 100 : null;
  return {
    number: pr.number, title: String(pr.title || '').slice(0, 200), url: /^https:\/\/github\.com\//.test(String(pr.html_url || '')) ? pr.html_url : 'https://github.com/' + REPO + '/pull/' + pr.number,
    confidence: conf, where: w ? w[1].slice(0, 160) : '', why: why ? why[1].slice(0, 400) : '', risk: rk ? rk[1] : null, riskWhy: rk && rk[2] ? rk[2].slice(0, 160) : '', draft: pr.draft === true, waits: labels.includes(WAITS), merges: labels.includes(MERGES),
  };
}

/** the open fixes, the waiting ones first, then by confidence (lowest first: the ones to look at hardest). Pure. */
export function fixesOf(prs) {
  return (Array.isArray(prs) ? prs : []).map(fixOf).filter(Boolean)
    .sort((a, b) => (b.waits - a.waits) || ((a.confidence ?? -1) - (b.confidence ?? -1)) || a.number - b.number);
}

/** the changed lines of a pull request's files (GitHub's patch text), + and − only, at most MAX_LINES, for a <pre>. Pure. */
export function diffLines(files) {
  const out = [];
  for (const f of Array.isArray(files) ? files : []) {
    if (!f || typeof f.patch !== 'string') continue;
    out.push('# ' + String(f.filename || '').slice(0, 120));
    for (const line of f.patch.split('\n')) if (/^[+-]/.test(line) && !/^(?:\+\+\+|---)/.test(line)) out.push(line.slice(0, 220));
    if (out.length >= MAX_LINES) break;
  }
  return out.length > MAX_LINES ? out.slice(0, MAX_LINES).concat('… (more on GitHub)') : out;
}
