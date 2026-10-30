// brain-dream: Verse Brain dreams up ideas, jobs and fixes from its real memory (owner, 2026-10-30: "Verse can use its brain to come up
// with ideas and jobs and fixes ... it can dream and think coherently"; 2026-10-29: "dont fake it").
// A dream is made only from something the brain read or holds, and it names that thing as its source:
//   fix   a break its watch saw (lib/brain-watch.js): a red run on main, Verse's will stuck, a pull request open too long, an open issue;
//         or an organ of this brain that has run long and gained nothing (its own counts, lib/brain.js selfOf)
//   job   what Verse's will decided to do next (/api/will, lib/brain-watch.js decisionOf), not yet built
//   idea  a frontier draft the brain left out because it is its own product, not a part of a mind (lib/brain-drafts.json)
// Each dream has a full brief an agent can work from: what to do, why (the memory it came from, with its link), when it is done, and the
// rules of the work. Its key is the same each time the same memory makes it, so a dream is posted once (functions/api/team.js 'dream').
// Pure: no fetch, no DOM, no storage. /brain/ shows the dreams of the brain in the visitor's browser (nothing sent); tools/brain-dream.mjs
// makes them from what the server side can read and posts at most one a run to /team/ #work, where it is a job on the build queue.

export const KINDS = ['fix', 'job', 'idea'];
export const MAX = 12, ORGAN_GENS = 500;
const s = (x, n = 160) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
const clip = (x, n = 90) => { const t = s(x, 800); if (t.length <= n) return t; const c = t.slice(0, n - 3), at = c.lastIndexOf(' '); return (at > n / 2 ? c.slice(0, at) : c).replace(/[\s,;:.]+$/, '') + '...'; };
const gh = (u) => (/^https:\/\/github\.com\/atomeam\/void-loop\/(pull|issues|actions\/runs)\/\d+/.test(u || '') ? s(u, 200) : '');
/** a short stable key from text (FNV-1a, base 36): the same memory gives the same key. */
export const hash = (t) => { let h = 0x811c9dc5; for (const c of String(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
export const KEY = /^[a-z0-9][a-z0-9-]{2,60}$/;
export const TAG = 'Dream key: ';
/** the line a posted dream ends with, so it is posted once. */
export const tagOf = (key) => TAG + key;
/** the keys of dreams already posted, read from message bodies. */
export const keysIn = (bodies) => new Set((bodies || []).flatMap((b) => [...String(b || '').matchAll(/Dream key: ([a-z0-9][a-z0-9-]{2,60})/g)].map((m) => m[1])));

const RULES = 'Rules: open the pull request ready with auto-merge, keep main green, change only what this asks, and verify the result live on a-to-mind.com before you call it done. No faked data or counts.';
// only what the repository's own people and bots opened: anyone can open an issue on a public repository, and a dream's brief is a job
export const trusted = (x) => !!x && (['OWNER', 'MEMBER', 'COLLABORATOR'].includes(x.author_association) || (x.user && x.user.type === 'Bot' && /^github-actions\[bot\]$|^claude\[bot\]$/.test(x.user.login || '')));
const PRODUCT = /its own product|a different job|a 3D tool rather than a mind part/;

function dream(kind, key, title, why, done, sources, rank) {
  return { kind, key, title: clip(title, 110), why: clip(why, 300), done: clip(done, 240), sources: sources.filter((x) => x && x.what).map((x) => ({ what: s(x.what, 160), url: x.url || '' })), rank };
}

/** the dreams in what the brain remembers, most urgent first. memory: { breaks, prs, issues, decision, drafts, self, at }:
 *  breaks   lib/brain-watch.js breaksOf (those marked seen are left out)
 *  prs      open pull requests [{ number, title, created_at, html_url, author_association, user }] (the GitHub API's own list)
 *  issues   open issues [{ number, title, html_url, pull_request, author_association, user }] (pull requests in that list are left out)
 *           (both only when opened by the repository's people or its bots: trusted)
 *  decision lib/brain-watch.js decisionOf(will)
 *  drafts   lib/brain-drafts.json drafts
 *  self     lib/brain.js selfOf(brain), for its organs' own counts (only on the page that runs the brain)
 *  Nothing in memory, no dream. Pure. */
export function dreamsOf(memory = {}) {
  const at = Number.isFinite(memory.at) ? memory.at : Date.now(), out = [];
  const breaks = (Array.isArray(memory.breaks) ? memory.breaks : []).filter((b) => b && !b.marked && !b.ok);
  for (const b of breaks) {
    if (b.kind === 'ci') out.push(dream('fix', 'fix-' + s(b.key, 40).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + hash(b.what), 'Make main green again: ' + b.what,
      'The brain\'s watch saw ' + b.what + ' (' + b.why + '). A red run on main stops what comes after it.', 'The next run of that workflow on main passes, and the live site still works.', [{ what: 'watch: ' + b.what, url: gh(b.url) }], 0));
    if (b.kind === 'will') out.push(dream('fix', 'fix-will-' + hash(b.what), 'Unstick Verse\'s will: ' + b.what.replace(/^Verse's will is stuck on /, ''),
      'The brain\'s watch saw ' + b.what + ' (' + b.why + ').', 'The will ships that want, or sets it aside with a reason, and its next run starts something new.', [{ what: 'watch: ' + b.what, url: gh(b.url) }], 1));
  }
  const old = (Array.isArray(memory.prs) ? memory.prs : []).filter((p) => trusted(p) && Number.isFinite(Date.parse(p.created_at)) && at - Date.parse(p.created_at) > 3 * 3600e3);
  for (const p of old.slice(0, 3)) {
    const h = Math.floor((at - Date.parse(p.created_at)) / 3600e3);
    out.push(dream('fix', 'fix-pr-' + Math.round(+p.number), 'Get pull request #' + Math.round(+p.number) + ' merged or closed: ' + clip(p.title, 70),
      'It has been open ' + h + ' hours; the goal is 0 open pull requests and main green.', 'The pull request is merged with its checks green, or closed with the reason written on it.', [{ what: 'open pull request #' + Math.round(+p.number), url: gh(p.html_url) }], 2));
  }
  const issues = (Array.isArray(memory.issues) ? memory.issues : []).filter((i) => trusted(i) && !i.pull_request && Number.isFinite(+i.number));
  for (const i of issues.slice(0, 3)) out.push(dream('fix', 'fix-issue-' + Math.round(+i.number), 'Close issue #' + Math.round(+i.number) + ': ' + clip(i.title, 70),
    'It is open; the goal is 0 open issues.', 'A merged pull request fixes what the issue says, it is verified live, and the issue is closed.', [{ what: 'open issue #' + Math.round(+i.number), url: gh(i.html_url) }], 3));
  const d = memory.decision;
  if (d && d.want) out.push(dream('job', 'job-want-' + hash(d.want), 'Build what Verse decided next: ' + d.want,
    'Verse\'s will put it first' + (d.because ? ', because ' + d.because : '') + '.', 'It is merged and live, and the will moves on to its next want.', [{ what: 'Verse\'s will (/api/will): ' + d.want, url: '' }], 4));
  const self = memory.self;
  for (const [id, name] of [['painter', 'Painter'], ['grower', 'Grower'], ['formula', 'Formula']]) {
    const o = self && self[id]; if (!o || !Number.isFinite(+o.gen) || +o.gen < ORGAN_GENS) continue;
    const best = id === 'formula' ? o.skill : o.best != null ? o.best : o.score;
    if (best == null || +best > 0) continue;
    out.push(dream('fix', 'fix-organ-' + id, name + ' has run ' + Math.round(+o.gen) + ' generations and never scored above 0',
      'This brain\'s own count: ' + name + ' is at generation ' + Math.round(+o.gen) + ' and its best is ' + best + '. A search that never scores is measuring the wrong thing or searching nowhere.',
      'Its test shows a score above 0 within ' + ORGAN_GENS + ' generations on the test seeds, and /brain/ shows it live.', [{ what: 'Verse Brain\'s gains: ' + name + ' best ' + best + ' at generation ' + Math.round(+o.gen), url: '' }], 5));
  }
  for (const x of (Array.isArray(memory.drafts) ? memory.drafts : []).filter((x) => x && !x.organ && PRODUCT.test(x.left || ''))) {
    const n = String(x.folder || '').match(/^F(\d+)-([a-z0-9-]+)$/); if (!n) continue;
    const t = (x.techniques || []).slice(0, 4).join(', ');
    out.push(dream('idea', 'idea-draft-f' + n[1], 'Make draft F' + n[1] + ' (' + n[2] + ') a Verse tool of its own',
      'The brain left it out: ' + x.left + '.' + (t ? ' It uses ' + t + ', which the brain already runs.' : ''),
      'A page of its own, in the sitemap and the tools list, wired into the shared hand-off and telling the brain what it is used for (window.verseBrain.tell).', [{ what: 'frontier draft F' + n[1] + ' in lib/brain-drafts.json, left out', url: '' }], 6));
  }
  const seen = new Set();
  return out.filter((x) => x.sources.length && !seen.has(x.key) && seen.add(x.key)).sort((a, b) => a.rank - b.rank).slice(0, MAX);
}

/** the dream's brief, as a #work post: what, why, the memory it came from, when it is done, the rules, and its key. Pure. */
export function briefOf(d) {
  const src = d.sources.map((x) => '- ' + x.what + (x.url ? ' (' + x.url + ')' : '')).join('\n');
  return [(d.kind === 'fix' ? 'Fix' : d.kind === 'job' ? 'Job' : 'Idea') + ': ' + d.title, '', 'Why: ' + d.why, '', 'From what the brain remembers:', src, '',
    'Done when: ' + d.done, '', RULES, '', 'Dreamed by Verse Brain.', tagOf(d.key)].join('\n');
}

/** the first dream not posted yet, or null. posted: a Set of keys (keysIn). */
export const nextDream = (dreams, posted) => (dreams || []).find((d) => KEY.test(d.key) && !(posted && posted.has(d.key))) || null;
