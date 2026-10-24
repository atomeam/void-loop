// See a repository (owner, 2026-10-17: "make v01d able to see repos"). "look at atomeam/void-loop", "what is in github.com/x/y", a pasted repo URL:
// Verse answers from what is really there. Public repos only, through GitHub's unauthenticated REST API and raw README text, NO token anywhere.
// Pure helpers here (parse, shape, summarise) plus lookRepo(), which takes the fetch to use. Everything read from a repo (description, README,
// commit messages, file names) is UNTRUSTED text: it is length-capped, stripped of control characters and secret shapes, shown with esc() on the
// page, and never given to a model. The README "summary" is its first plain paragraph, cut by code, not written by a model.
import { redact } from './automation-fix.js';

export const NAME_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
export const API = 'https://api.github.com';
export const MAX_BODY = 200000, MAX_FILES = 60, MAX_COMMITS = 5, TIMEOUT_MS = 8000;

/** "atomeam/void-loop", "https://github.com/x/y/tree/main/src", "github.com/x/y.git" -> "x/y", or '' when it is not a repo name. Pure. */
export function parseRepo(text) {
  let t = String(text == null ? '' : text).trim().slice(0, 300);
  const u = /(?:^|[\s(<"'])(?:https?:\/\/)?(?:www\.)?github\.com\/([^\s/?#]+)\/([^\s/?#)>"']+)/i.exec(t);
  if (u) t = u[1] + '/' + u[2]; else if (/\s/.test(t)) return '';
  t = t.replace(/\.git$/i, '');
  if (!NAME_RE.test(t)) return '';
  const [o, n] = t.split('/');
  if (/^\.+$/.test(o) || /^\.+$/.test(n)) return '';
  return o + '/' + n;
}

const WORDS = '(?:look(?:s)? (?:at|into|in)|what(?:\'?s| is) (?:in|inside|on)|show me|have a look at|take a look at|check (?:out)?|tell me about|summari[sz]e|open|see|read|explore|inspect|review)';
const SKIP = new Set(['and', 'or', 'w', 'n', 'a', 'b', 'i', 's', 'y', 'x', 'km', 'hr', 'day', 'night', 'on', 'off', 'in', 'out', 'me', 'you', 'us', 'them', 'his', 'her', 'he', 'she', 'it', 'yes', 'no']);
/** a person's ask -> "owner/name" when it asks to see a GitHub repo, else ''. A github.com link is enough; a bare owner/name needs a look-at word or "repo". Pure. */
export function repoAsk(text) {
  const raw = String(text == null ? '' : text).replace(/[’]/g, "'").trim().replace(/[?!.,]+$/, '').slice(0, 400);
  if (!raw) return '';
  if (/github\.com\//i.test(raw)) {
    if (/\b(?:link|bookmark)\b/i.test(raw)) return '';
    if (/github\.com\/[^\s/]+\/[^\s/]+\/blob\//i.test(raw)) return ''; // one file is skills/gh-file.js, not the whole repo
    if (/github\.com\/(?:orgs|settings|marketplace|features|sponsors|topics|search|login|notifications)\b/i.test(raw)) return '';
    return parseRepo(raw);
  }
  const m = new RegExp('^(?:(?:please|hey|v01d|void|verse|can you|could you|will you)\\s+)*' + WORDS + '\\s+(?:(?:the|this|my|our)\\s+)?(?:(?:github\\s+)?repo(?:sitory)?\\s+)?(?:called\\s+|named\\s+|at\\s+|of\\s+)?([A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+)$', 'i').exec(raw);
  const m2 = /^(?:what is in|what's in|look at|show me)\s+(?:the\s+)?(?:github\s+)?repo(?:sitory)?\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/i.exec(raw);
  const c = (m || m2) && (m || m2)[1];
  if (!c) return '';
  const [o, n] = c.split('/');
  if (SKIP.has(o.toLowerCase()) || SKIP.has(n.toLowerCase()) || !/[a-z]/i.test(o) || !/[a-z]/i.test(n) || /\.(?:png|jpe?g|gif|pdf|txt|csv|js|mjs|ts|py|html?|css|md|json|docx?|xlsx?|mp[34]|zip)$/i.test(n)) return '';
  return parseRepo(c);
}

/** untrusted one-line text -> safe short text: control characters out, key shapes redacted, cut to max. Pure. */
export function clean(v, max = 200) {
  const s = redact(String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim());
  return s.length > max ? s.slice(0, max - 1) + '…' : s; // ellipsis-ok: drawn picture or short label, the full text is on the card
}

/** the README's first plain paragraph (headings, badges, images, html and code skipped), cut to max. Pure. */
export function readmeSummary(md, max = 280) {
  const lines = String(md == null ? '' : md).slice(0, 20000).replace(/<!--[\s\S]*?-->/g, ' ').replace(/```[\s\S]*?(?:```|$)/g, ' ').split(/\r?\n/);
  const paras = []; let cur = [];
  for (const l of lines) { if (!l.trim()) { if (cur.length) paras.push(cur.join(' ')); cur = []; } else cur.push(l.trim()); }
  if (cur.length) paras.push(cur.join(' '));
  for (const p of paras) {
    if (/^(#|\||[-*_=]{3,}|!\[|\[!\[|<|>|\[[^\]]*\]:)/.test(p)) continue;
    const t = p.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
    if (t.length >= 25 && /[a-z]{3}/i.test(t)) return clean(t, max);
  }
  return '';
}

/** language byte counts -> [{ name, pct }] largest first, at most 6, the rest folded into "other". Pure. */
export function langMix(bytes) {
  const e = Object.entries(bytes && typeof bytes === 'object' ? bytes : {}).map(([k, v]) => [clean(k, 30), Number(v)]).filter(([k, v]) => k && v > 0).sort((a, b) => b[1] - a[1]);
  const total = e.reduce((s, x) => s + x[1], 0); if (!total) return [];
  const out = e.slice(0, 6).map(([name, v]) => ({ name, pct: Math.round((v / total) * 1000) / 10 }));
  const rest = e.slice(6).reduce((s, x) => s + x[1], 0);
  if (rest) out.push({ name: 'other', pct: Math.round((rest / total) * 1000) / 10 });
  return out;
}

/** the pieces GitHub returned -> the card's facts, every string cleaned. Pure. */
export function shape({ repo, languages, commits, tree, readme, pulls }) {
  const r = repo || {}, num = (x) => (Number.isFinite(+x) && +x >= 0 ? Math.floor(+x) : null);
  return {
    name: clean(r.full_name, 201), description: clean(r.description, 300), url: 'https://github.com/' + clean(r.full_name, 201),
    language: clean(r.language, 30), stars: num(r.stargazers_count), forks: num(r.forks_count), license: clean(r.license && r.license.spdx_id, 30),
    branch: clean(r.default_branch, 60), pushed: clean(r.pushed_at, 10), archived: !!r.archived, topics: (Array.isArray(r.topics) ? r.topics : []).slice(0, 8).map((t) => clean(t, 30)).filter(Boolean),
    openIssues: pulls == null ? num(r.open_issues_count) : Math.max(0, num(r.open_issues_count) - pulls), openPulls: pulls == null ? null : pulls,
    langs: langMix(languages),
    commits: (Array.isArray(commits) ? commits : []).slice(0, MAX_COMMITS).map((c) => ({ sha: clean(c && c.sha, 7), msg: clean(String((c && c.commit && c.commit.message) || '').split('\n')[0], 100), who: clean(c && c.commit && c.commit.author && c.commit.author.name, 40), date: clean(c && c.commit && c.commit.author && c.commit.author.date, 10) })).filter((c) => c.sha),
    tree: (Array.isArray(tree) ? tree : []).slice(0, MAX_FILES).map((f) => ({ name: clean(f && f.name, 100), dir: !!(f && f.type === 'dir') })).filter((f) => f.name),
    treeTotal: Array.isArray(tree) ? tree.length : 0, readme: readmeSummary(readme),
  };
}

async function readCapped(res, cap = MAX_BODY) {
  if (!res.body || !res.body.getReader) return (await res.text()).slice(0, cap);
  const rd = res.body.getReader(), dec = new TextDecoder(); let out = '', n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; out += dec.decode(value, { stream: true }); if (n >= cap) { try { await rd.cancel(); } catch (_) {} break; } }
  return out.slice(0, cap);
}

/** one GET on api.github.com with a fixed path: no redirect to any other host (a renamed repo's one redirect is followed only when it stays on api.github.com), a time limit and a size cap. { status, json | text }. */
export async function get(fetchFn, path, accept = 'application/vnd.github+json', hops = 1) {
  const url = API + path, ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : 0;
  try {
    const res = await fetchFn(url, { redirect: 'manual', signal: ctl ? ctl.signal : undefined, headers: { accept, 'user-agent': 'a-to-mind-Verse', 'x-github-api-version': '2022-11-28' } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || '';
      const m = hops > 0 && /^https:\/\/api\.github\.com(\/repositories\/\d+(?:\/[a-z/]*)?)(?:\?.*)?$/.exec(loc);
      return m ? get(fetchFn, m[1] + (path.includes('?') ? '?' + path.split('?')[1] : ''), accept, hops - 1) : { status: 502 };
    }
    if (!res.ok) return { status: res.status, limited: res.headers.get('x-ratelimit-remaining') === '0' };
    const text = await readCapped(res);
    if (accept.includes('json')) { try { return { status: 200, json: JSON.parse(text) }; } catch (_) { return { status: 502 }; } }
    return { status: 200, text };
  } catch (_) { return { status: 504 }; } finally { clearTimeout(timer); }
}

/** look at a public repo: { ok, repo: facts } or { ok:false, kind:'missing'|'limited'|'down', say }. fetchFn is injected so tests need no network. */
export async function lookRepo(full, fetchFn) {
  if (!NAME_RE.test(String(full))) return { ok: false, kind: 'missing', say: 'That does not look like a GitHub repository name. Give me owner/name, like atomeam/void-loop.' };
  const base = '/repos/' + full;
  const main = await get(fetchFn, base);
  if (main.status === 404 || main.status === 403 && !main.limited) return { ok: false, kind: 'missing', say: 'I can only see public repos, and I could not find ' + full + ' on GitHub. It may be private, renamed or misspelled.' };
  if (main.status === 451) return { ok: false, kind: 'missing', say: full + ' is blocked for legal reasons, so I cannot show it.' };
  if (main.limited || main.status === 429) return { ok: false, kind: 'limited', say: 'GitHub is limiting how fast I can look right now. Try again in a few minutes.' };
  if (main.status !== 200 || !main.json || !main.json.full_name || main.json.private) return { ok: false, kind: main.json && main.json.private ? 'missing' : 'down', say: main.json && main.json.private ? 'I can only see public repos.' : 'I could not reach GitHub just now. Try again in a minute.' };
  const name = main.json.full_name, b = '/repos/' + name;
  if (!NAME_RE.test(name)) return { ok: false, kind: 'down', say: 'GitHub sent a name I would not trust, so I stopped.' };
  const [lang, com, tree, rd, pr] = await Promise.all([
    get(fetchFn, b + '/languages'), get(fetchFn, b + '/commits?per_page=' + MAX_COMMITS), get(fetchFn, b + '/contents/'),
    get(fetchFn, b + '/readme', 'application/vnd.github.raw'), get(fetchFn, '/search/issues?per_page=1&q=' + encodeURIComponent('repo:' + name + ' is:pr is:open')),
  ]);
  const files = Array.isArray(tree.json) ? tree.json.slice().sort((a, c) => (a.type === c.type ? 0 : a.type === 'dir' ? -1 : 1)) : [];
  return { ok: true, repo: shape({ repo: main.json, languages: lang.json, commits: com.json, tree: files, readme: rd.text, pulls: pr.json && Number.isFinite(+pr.json.total_count) ? +pr.json.total_count : null }) };
}

/** the card's plain-text version, for Copy and Save. Pure. */
export function repoText(r) {
  const L = [r.name + (r.archived ? ' (archived)' : ''), r.description, r.url, ''];
  L.push([r.language && 'language ' + r.language, r.stars != null && r.stars + ' stars', r.forks != null && r.forks + ' forks', r.license && 'license ' + r.license, r.openIssues != null && r.openIssues + ' open issues', r.openPulls != null && r.openPulls + ' open PRs'].filter(Boolean).join(' · '));
  if (r.langs.length) L.push('Languages: ' + r.langs.map((l) => l.name + ' ' + l.pct + '%').join(', '));
  if (r.readme) L.push('', 'README: ' + r.readme);
  if (r.commits.length) L.push('', 'Recent commits:', ...r.commits.map((c) => '- ' + c.sha + ' ' + c.msg + (c.who ? ' (' + c.who + (c.date ? ', ' + c.date : '') + ')' : '')));
  if (r.tree.length) L.push('', 'Top level: ' + r.tree.map((f) => f.name + (f.dir ? '/' : '')).join(', ') + (r.treeTotal > r.tree.length ? ' …' : ''));
  return L.filter((x, i) => x !== undefined && x !== false && !(x === '' && i === 3)).join('\n');
}
