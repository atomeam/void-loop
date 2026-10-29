/**
 * code-hub: the pure part of /code/ (owner, 2026-10-26: the code hosting floor, GitHub, gets a Verse page). Any public GitHub repository is read through
 * GitHub's public REST API (unauthenticated: 60 requests an hour for each visitor's address; the page asks from the visitor's own browser and keeps every
 * answer with its ETag, and an answer GitHub says is unchanged does not count against that hour) and files through GitHub's public raw addresses. This file
 * builds the API addresses from checked names (a visitor never picks a host), reads a pasted GitHub link into what to show, lists a directory from the tree,
 * finds files by name, turns a README into safe HTML and a unified diff into rows. Everything read from a repo is untrusted text: the HTML made here holds
 * only escaped text and a short list of tags rebuilt with checked attributes. No network, no DOM. Tests: tools/code-hub.test.mjs.
 */
import { tokens, langOf } from './gist.js';

export const API = 'https://api.github.com', RAW = 'https://raw.githubusercontent.com', WEB = 'https://github.com';
const PART = /^[A-Za-z0-9_.-]{1,100}$/;
export const okRepo = (r) => { const [o, n, x] = String(r || '').split('/'); return !x && PART.test(o || '') && PART.test(n || '') && !/^\.+$/.test(o) && !/^\.+$/.test(n); };
const okRef = (r) => /^[A-Za-z0-9._\/-]{1,200}$/.test(String(r || '')) && !/(?:^|\/)\.\.?(?:\/|$)/.test(r) && !/\/\//.test(r);
const okPath = (p) => p === '' || (/^[^\u0000-\u001f?#\\]{1,500}$/.test(String(p)) && !/(?:^|\/)\.\.?(?:\/|$)/.test(p) && !/^\/|\/$|\/\//.test(p));
const encPath = (p) => String(p).split('/').map(encodeURIComponent).join('/');

/** what a pasted text points at: { repo, view, ref, path, num, sha, lines, gist }, or null. Accepts owner/name, github.com links of every kind, raw links and gist links. Pure. */
export function ghTarget(text) {
  const t = String(text == null ? '' : text).trim().slice(0, 600);
  let m = /^(?:https?:\/\/)?gist\.github\.com\/(?:([A-Za-z0-9-]{1,39})\/)?([0-9a-f]{5,40})\b/i.exec(t); if (m) return { gist: m[2].toLowerCase() };
  m = /^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/([^?#\s]+)/i.exec(t);
  if (m) { const repo = m[1] + '/' + m[2], path = decodeURIComponent(m[4]); return okRepo(repo) && okRef(m[3]) && okPath(path) ? { repo, view: 'file', ref: m[3], path } : null; }
  m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)(?:\/([^?#\s]*))?(?:\?[^#\s]*)?(?:#L(\d+)(?:-L(\d+))?)?\s*$/i.exec(t);
  if (!m) { const r = t.replace(/\.git$/i, ''); return okRepo(r) ? { repo: r, view: 'code' } : null; }
  const repo = m[1] + '/' + m[2].replace(/\.git$/i, ''); if (!okRepo(repo)) return null;
  const rest = (m[3] || '').replace(/\/+$/, '').split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (_) { return x; } }), [kind, a, ...more] = rest;
  const lines = m[4] ? [Math.min(+m[4], +(m[5] || m[4])), Math.max(+m[4], +(m[5] || m[4]))] : null;
  if (!kind) return { repo, view: 'code' };
  if ((kind === 'blob' || kind === 'tree') && a && okRef(a)) { const path = more.join('/'); if (!okPath(path)) return null; return { repo, view: kind === 'blob' ? 'file' : 'code', ref: a, path, ...(lines ? { lines } : {}) }; }
  if (kind === 'issues') return /^\d{1,9}$/.test(a || '') ? { repo, view: 'issue', num: +a } : { repo, view: 'issues' };
  if (kind === 'pull' && /^\d{1,9}$/.test(a || '')) return { repo, view: 'pull', num: +a };
  if (kind === 'pulls') return { repo, view: 'pulls' };
  if (kind === 'actions') return /^runs$/.test(a || '') && /^\d{1,12}$/.test(more[0] || '') ? { repo, view: 'run', num: +more[0] } : { repo, view: 'actions' };
  if (kind === 'commits') return { repo, view: 'commits', ...(a && okRef(a) ? { ref: a } : {}) };
  if (kind === 'commit' && /^[0-9a-f]{7,40}$/i.test(a || '')) return { repo, view: 'commit', sha: a.toLowerCase() };
  return { repo, view: 'code' };
}

// ---------- the API addresses, every one built here from checked parts ----------
const R = (repo) => { if (!okRepo(repo)) throw new Error('bad repo'); return '/repos/' + repo; };
const q = (o) => { const s = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v != null && v !== '') s.set(k, String(v)); const x = s.toString(); return x ? '?' + x : ''; };
export const URLS = {
  repo: (repo) => R(repo),
  branches: (repo) => R(repo) + '/branches?per_page=100',
  tree: (repo, ref) => { if (!okRef(ref)) throw new Error('bad ref'); return R(repo) + '/git/trees/' + encPath(ref) + '?recursive=1'; },
  readme: (repo, ref) => R(repo) + '/readme' + q({ ref }),
  commits: (repo, { ref, path, page = 1 } = {}) => R(repo) + '/commits' + q({ sha: ref && okRef(ref) ? ref : '', path: path && okPath(path) ? path : '', per_page: 30, page }),
  commit: (repo, sha) => { if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error('bad sha'); return R(repo) + '/commits/' + sha; },
  issues: (repo, { state = 'open', page = 1 } = {}) => R(repo) + '/issues' + q({ state: ['open', 'closed', 'all'].includes(state) ? state : 'open', per_page: 30, page }),
  issue: (repo, n) => R(repo) + '/issues/' + (+n | 0),
  comments: (repo, n) => R(repo) + '/issues/' + (+n | 0) + '/comments?per_page=50',
  pulls: (repo, { state = 'open', page = 1 } = {}) => R(repo) + '/pulls' + q({ state: ['open', 'closed', 'all'].includes(state) ? state : 'open', per_page: 30, page }),
  pull: (repo, n) => R(repo) + '/pulls/' + (+n | 0),
  pullFiles: (repo, n) => R(repo) + '/pulls/' + (+n | 0) + '/files?per_page=100',
  reviews: (repo, n) => R(repo) + '/pulls/' + (+n | 0) + '/reviews?per_page=50',
  searchRepos: (words, page = 1) => '/search/repositories' + q({ q: String(words || '').slice(0, 200), per_page: 20, page }),
  runs: (repo, page = 1) => R(repo) + '/actions/runs?per_page=20&page=' + (Math.max(1, +page | 0)),
  jobs: (repo, id) => R(repo) + '/actions/runs/' + (Math.max(0, +id) || 0) + '/jobs?per_page=50',
  workflows: (repo) => R(repo) + '/actions/workflows?per_page=50',
  gist: (id) => { if (!/^[0-9a-f]{5,40}$/i.test(id)) throw new Error('bad gist'); return '/gists/' + id; },
};
/** the raw address of a file at a ref. Pure. */
export const rawUrl = (repo, ref, path) => (okRepo(repo) && okRef(ref) && okPath(path) ? RAW + '/' + repo + '/' + encPath(ref) + '/' + encPath(path) : '');
/** the github.com address for what is on screen (the "Open on GitHub" link). Pure. */
export function webUrl(repo, { view = 'code', ref = '', path = '', num = 0, sha = '', lines = null } = {}) {
  if (!okRepo(repo)) return WEB; const b = WEB + '/' + repo;
  if (view === 'file' && ref && path) return b + '/blob/' + encPath(ref) + '/' + encPath(path) + (lines ? '#L' + lines[0] + (lines[1] !== lines[0] ? '-L' + lines[1] : '') : '');
  if (view === 'code' && ref && path) return b + '/tree/' + encPath(ref) + '/' + encPath(path);
  if (view === 'issues') return b + '/issues'; if (view === 'issue' && num) return b + '/issues/' + num;
  if (view === 'pulls') return b + '/pulls'; if (view === 'pull' && num) return b + '/pull/' + num;
  if (view === 'actions') return b + '/actions';
  if (view === 'commits') return b + '/commits' + (ref ? '/' + encPath(ref) : ''); if (view === 'commit' && sha) return b + '/commit/' + sha;
  return b;
}

// ---------- the tree ----------
/** a git tree answer -> [{ path, dir, size }]. Pure. */
export const treeOf = (j) => ((j && j.tree) || []).filter((e) => e && typeof e.path === 'string' && okPath(e.path) && (e.type === 'tree' || e.type === 'blob' || e.type === 'commit')).map((e) => ({ path: e.path, dir: e.type === 'tree', sub: e.type === 'commit', size: e.type === 'blob' ? +e.size || 0 : null }));
/** the entries directly in a directory, directories first, then by name. Pure. */
export function listDir(entries, dir = '') {
  const pre = dir ? dir + '/' : '';
  return (entries || []).filter((e) => e.path.startsWith(pre) && e.path.length > pre.length && !e.path.slice(pre.length).includes('/'))
    .map((e) => ({ ...e, name: e.path.slice(pre.length) })).sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) : a.dir ? -1 : 1));
}
/** "Go to file": files whose path holds the typed letters in order, the tightest and shortest first. Pure. */
export function findFiles(entries, typed, n = 40) {
  const want = String(typed || '').toLowerCase().replace(/\s+/g, ''); if (!want) return [];
  const out = [];
  for (const e of entries || []) {
    if (e.dir) continue; const p = e.path.toLowerCase(); let i = 0, start = -1, gaps = 0, last = -1;
    for (let k = 0; k < p.length && i < want.length; k++) if (p[k] === want[i]) { if (start < 0) start = k; if (last >= 0) gaps += k - last - 1; last = k; i++; }
    if (i < want.length) continue; const name = p.slice(p.lastIndexOf('/') + 1), inName = name.includes(want) ? 0 : 1;
    out.push({ e, score: inName * 1000 + gaps * 3 + p.length * 0.1 + (p.includes(want) ? 0 : 50) });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, n).map((x) => x.e);
}
export const sizeOf = (n) => (n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
/** "3 days ago" for a time. Pure. */
export function ago(iso, now = Date.now(), de = false) {
  const d = (now - Date.parse(iso)) / 1000; if (!Number.isFinite(d)) return '';
  const u = [[31536000, de ? ['Jahr', 'Jahren'] : ['year', 'years']], [2592000, de ? ['Monat', 'Monaten'] : ['month', 'months']], [86400, de ? ['Tag', 'Tagen'] : ['day', 'days']], [3600, de ? ['Stunde', 'Stunden'] : ['hour', 'hours']], [60, de ? ['Minute', 'Minuten'] : ['minute', 'minutes']]];
  for (const [s, [one, many]] of u) if (d >= s) { const n = Math.floor(d / s); return de ? 'vor ' + n + ' ' + (n === 1 ? one : many) : n + ' ' + (n === 1 ? one : many) + ' ago'; }
  return de ? 'gerade eben' : 'just now';
}
/** a workflow run's state in words and a colour class: { word, cls }. Pure. */
export function runState(r) { const c = r && r.conclusion, st = r && r.status; if (st && st !== 'completed') return { word: st === 'queued' || st === 'waiting' || st === 'pending' ? 'Queued' : 'Running', cls: '' }; return c === 'success' ? { word: 'Passed', cls: '' } : c === 'failure' || c === 'timed_out' || c === 'startup_failure' ? { word: 'Failed', cls: 'bad' } : c === 'cancelled' ? { word: 'Cancelled', cls: 'shut' } : c === 'skipped' || c === 'neutral' ? { word: 'Skipped', cls: 'shut' } : { word: c ? String(c) : 'Done', cls: 'shut' }; }
/** a run's length from its start and end. Pure. */
export const runTime = (a, b) => { const s = (Date.parse(b) - Date.parse(a)) / 1000; if (!Number.isFinite(s) || s < 0) return ''; return s < 60 ? Math.round(s) + ' s' : s < 3600 ? Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s' : Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min'; };
/** GitHub's hourly allowance from an answer's headers: { left, limit, reset (ms) } or null. Pure. */
export function rateOf(get) { const left = +get('x-ratelimit-remaining'), limit = +get('x-ratelimit-limit'), reset = +get('x-ratelimit-reset'); return Number.isFinite(left) && get('x-ratelimit-remaining') != null ? { left, limit: limit || 60, reset: reset ? reset * 1000 : 0 } : null; }

// ---------- a README (or an issue's words) as safe HTML ----------
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ALLOWED = new Set(['a', 'img', 'br', 'p', 'div', 'b', 'strong', 'i', 'em', 'code', 'kbd', 'sub', 'sup', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'hr', 'picture', 'span', 'del', 's', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre']);
/** a link or picture address made safe: https and http stay; a relative one points into the repo (pictures to the raw file, links to this page); anything else is dropped. Pure. */
export function safeUrl(u, ctx = {}, img = false) {
  const s = String(u || '').trim().replace(/[\u0000-\u001f\s]/g, ''); if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.replace(/^http:/i, 'https:');
  if (/^#[\w-]{1,80}$/.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//')) return /^mailto:[^<>"']{3,200}$/i.test(s) && !img ? s : '';
  if (!ctx.repo || !ctx.ref) return '';
  const base = (ctx.dir || '').split('/').filter(Boolean), parts = s.replace(/[?#].*$/, '').split('/');
  const out = s.startsWith('/') ? [] : base.slice();
  for (const p of parts) { if (!p || p === '.') continue; if (p === '..') out.pop(); else out.push(p); }
  const path = out.join('/'); if (!okPath(path)) return '';
  let dec = path; try { dec = decodeURIComponent(path); } catch (_) { /* as typed */ }
  return img ? rawUrl(ctx.repo, ctx.ref, dec) : (ctx.link ? ctx.link(dec) : webUrl(ctx.repo, { view: 'file', ref: ctx.ref, path: dec }));
}
function tagOf(raw, ctx) {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>$/.exec(raw); if (!m) return null; const name = m[2].toLowerCase(); if (!ALLOWED.has(name)) return null;
  if (m[1]) return '</' + name + '>';
  const attrs = {}; m[3].replace(/([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g, (_, k, __, a, b, c) => { attrs[k.toLowerCase()] = a != null ? a : b != null ? b : c; return ''; });
  let out = '<' + name;
  if (name === 'a') { const h = safeUrl(attrs.href, ctx); if (h) out += ' href="' + escH(h) + '"' + (/^https?:/.test(h) ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''); }
  if (name === 'img') { const src = safeUrl(attrs.src, ctx, true); if (!src) return ''; out += ' src="' + escH(src) + '" alt="' + escH(attrs.alt || '') + '" loading="lazy" referrerpolicy="no-referrer"'; for (const k of ['width', 'height']) if (/^\d{1,4}%?$/.test(attrs[k] || '')) out += ' ' + k + '="' + attrs[k] + '"'; }
  if (attrs.open !== undefined && name === 'details') out += ' open';
  return out + (/\/\s*$/.test(m[3]) && name !== 'img' && name !== 'br' && name !== 'hr' ? '></' + name + '>' : '>');
}
let SEQ = 0;
function inline(text, ctx) {
  const id = (SEQ++ % 1e6).toString(36), keep = [], stash = (h) => '\u0001' + id + '.' + (keep.push(h) - 1) + '\u0002';
  let s = String(text).replace(/`([^`\n]+)`/g, (_, c) => stash('<code>' + escH(c) + '</code>'));
  s = s.replace(/<\/?[a-zA-Z][^<>]{0,400}>/g, (tg) => { const h = tagOf(tg, ctx); return h == null ? tg : stash(h); });
  s = s.replace(/!\[([^\]]{0,300})\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, alt0, u) => { const alt = alt0.replace(/\u0001[^\u0002]*\u0002/g, ''), src = safeUrl(u, ctx, true); return src ? stash('<img src="' + escH(src) + '" alt="' + escH(alt) + '" loading="lazy" referrerpolicy="no-referrer">') : escH(alt); });
  s = s.replace(/\[([^\]]{1,400})\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, label, u) => { const h = safeUrl(u, ctx); const inner = inline(label, ctx); return h ? stash('<a href="' + escH(h) + '"' + (/^https?:/.test(h) ? ' rel="noopener noreferrer nofollow" target="_blank"' : '') + '>' + inner + '</a>') : stash(inner); });
  s = s.replace(/(^|[\s(])(https:\/\/[^\s<>()"']{3,300}[^\s<>()"'.,;:!?])/g, (_, pre, u) => pre + stash('<a href="' + escH(u) + '" rel="noopener noreferrer nofollow" target="_blank">' + escH(u) + '</a>'));
  s = escH(s).replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<strong>$1</strong>').replace(/__(?=\S)([^_\n]*?\S)__/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?![_\w])/g, '$1<em>$2</em>').replace(/~~(?=\S)([^~\n]*?\S)~~/g, '<del>$1</del>');
  const re = new RegExp('\u0001' + id + '\\.(\\d+)\u0002', 'g'); for (let k = 0; k < 4 && re.test(s); k++) { re.lastIndex = 0; s = s.replace(re, (_, i) => keep[+i]); }
  return s;
}
/** code coloured as safe HTML spans (the same colouring as /g/). Pure. */
export function codeHtml(text, name) { const lang = langOf(name || ''); return String(text).split('\n').map((l) => tokens(l, lang).map(([k, x]) => (k ? '<span class="' + k + '">' + escH(x) + '</span>' : escH(x))).join('')).join('\n'); }
const FENCE_LANG = { javascript: 'x.js', js: 'x.js', ts: 'x.ts', typescript: 'x.ts', jsx: 'x.js', tsx: 'x.ts', json: 'x.json', python: 'x.py', py: 'x.py', bash: 'x.sh', sh: 'x.sh', shell: 'x.sh', console: 'x.sh', zsh: 'x.sh', html: 'x.html', xml: 'x.xml', css: 'x.css', scss: 'x.css', go: 'x.go', rust: 'x.rs', rs: 'x.rs', c: 'x.c', cpp: 'x.cpp', java: 'x.java', ruby: 'x.rb', rb: 'x.rb', yaml: 'x.yml', yml: 'x.yml', toml: 'x.toml', php: 'x.php', swift: 'x.swift', kotlin: 'x.kt' };
/** GitHub-flavoured markdown (headings, lists, task boxes, quotes, fences, tables, rules, links, pictures and a short list of HTML tags) -> safe HTML. ctx: { repo, ref, dir, link }. Pure. */
export function mdHtml(md, ctx = {}) {
  const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').slice(0, 400000).split('\n'); let out = '', para = [], list = null, i = 0;
  const flush = () => { if (para.length) { out += '<p>' + para.map((l) => inline(l, ctx)).join('<br>') + '</p>'; para = []; } };
  const close = () => { if (list) { out += '</' + list + '>'; list = null; } };
  while (i < lines.length) {
    const raw = lines[i], l = raw.trim();
    const fence = /^(```+|~~~+)\s*([\w+-]*)/.exec(l);
    if (fence) { flush(); close(); const body = []; i++; while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]); i++; out += '<pre><code>' + codeHtml(body.join('\n'), FENCE_LANG[fence[2].toLowerCase()] || '') + '</code></pre>'; continue; }
    if (!l) { flush(); close(); i++; continue; }
    let m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(l);
    if (m) { flush(); close(); const n = m[1].length, id = m[2].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80); out += '<h' + n + (id ? ' id="' + escH(id) + '"' : '') + '>' + inline(m[2], ctx) + '</h' + n + '>'; i++; continue; }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(l)) { flush(); close(); out += '<hr>'; i++; continue; }
    if (l.startsWith('>')) { flush(); close(); const q = []; while (i < lines.length && lines[i].trim().startsWith('>')) q.push(lines[i++].trim().replace(/^>\s?/, '')); out += '<blockquote>' + mdHtml(q.join('\n'), ctx) + '</blockquote>'; continue; }
    if (/^\|.*\|$/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(lines[i + 1].trim())) {
      flush(); close(); const cells = (x) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim(), ctx));
      out += '<table><thead><tr>' + cells(l).map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>'; i += 2;
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) out += '<tr>' + cells(lines[i++]).map((c) => '<td>' + c + '</td>').join('') + '</tr>';
      out += '</tbody></table>'; continue;
    }
    m = /^(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/.exec(l);
    if (m) { flush(); const kind = m[1] ? 'ul' : 'ol'; if (list !== kind) { close(); out += '<' + kind + '>'; list = kind; } const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]); out += '<li>' + (task ? (task[1] === ' ' ? '☐ ' : '☑ ') + inline(task[2], ctx) : inline(m[3], ctx)) + '</li>'; i++; continue; }
    if (/^<\/?[a-zA-Z][^>]*>$/.test(l)) { flush(); close(); out += inline(l, ctx); i++; continue; }
    para.push(l); i++;
  }
  flush(); close(); return out;
}

// ---------- diffs: a unified diff into rows, and GitHub's file patches into one diff ----------
/** unified diff text -> [{ from, to, adds, dels, hunks: [{ head, rows: [{ t: 'add'|'del'|'ctx', o, n, text }] }] }]. Pure. */
export function parseDiff(text) {
  const files = []; let f = null, h = null, o = 0, n = 0;
  const start = (from, to) => { f = { from, to, adds: 0, dels: 0, hunks: [] }; files.push(f); h = null; };
  for (const line of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    let m = /^diff --git a\/(.*?) b\/(.*)$/.exec(line); if (m) { start(m[1], m[2]); continue; }
    if (/^(?:index |new file mode|deleted file mode|similarity index|rename (?:from|to)|old mode|new mode|Binary files)/.test(line)) { if (!f) start('', ''); continue; }
    m = /^--- (?:a\/)?(.*)$/.exec(line); if (m && (!h || !f)) { if (!f || f.hunks.length) start(m[1], ''); else f.from = m[1] === '/dev/null' ? f.from : m[1]; continue; }
    m = /^\+\+\+ (?:b\/)?(.*)$/.exec(line); if (m && f && !h) { if (m[1] !== '/dev/null') f.to = m[1]; continue; }
    m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line); if (m) { if (!f) start('', ''); o = +m[1]; n = +m[2]; h = { head: line, rows: [] }; f.hunks.push(h); continue; }
    if (!h) continue;
    if (line.startsWith('+')) { h.rows.push({ t: 'add', o: null, n: n++, text: line.slice(1) }); f.adds++; }
    else if (line.startsWith('-')) { h.rows.push({ t: 'del', o: o++, n: null, text: line.slice(1) }); f.dels++; }
    else if (line.startsWith(' ') || line === '') { if (line === '' && h.rows.length && h === f.hunks[f.hunks.length - 1]) { /* a trailing blank line */ } h.rows.push({ t: 'ctx', o: o++, n: n++, text: line.slice(1) }); }
    else if (line.startsWith('\\')) continue;
  }
  for (const x of files) { if (!x.to) x.to = x.from; if (!x.from) x.from = x.to; for (const hk of x.hunks) while (hk.rows.length && hk.rows[hk.rows.length - 1].t === 'ctx' && hk.rows[hk.rows.length - 1].text === '') hk.rows.pop(); }
  return files.filter((x) => x.hunks.length || x.to);
}
/** GitHub's list of changed files (each with its patch) -> one unified diff. Pure. */
export const filesToDiff = (files) => (files || []).filter((f) => f && typeof f.filename === 'string' && typeof f.patch === 'string').map((f) => 'diff --git a/' + (f.previous_filename || f.filename) + ' b/' + f.filename + '\n--- a/' + (f.previous_filename || f.filename) + '\n+++ b/' + f.filename + '\n' + f.patch + '\n').join('');
/** two texts -> a unified diff of their lines (the "compare two texts" box), with three lines of context. Pure. */
export function textDiff(a, b, name = 'text') {
  const A = String(a == null ? '' : a).replace(/\r\n?/g, '\n').split('\n'), B = String(b == null ? '' : b).replace(/\r\n?/g, '\n').split('\n');
  if (A.length * B.length > 4e6) return '';
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n || j < m) { if (i < n && j < m && A[i] === B[j]) { ops.push([' ', A[i], i, j]); i++; j++; } else if (i < n && (j >= m || L[i + 1][j] >= L[i][j + 1])) { ops.push(['-', A[i], i, j]); i++; } else { ops.push(['+', B[j], i, j]); j++; } }
  const out = ['--- a/' + name, '+++ b/' + name]; let k = 0;
  while (k < ops.length) {
    while (k < ops.length && ops[k][0] === ' ') k++; if (k >= ops.length) break;
    let s = Math.max(0, k - 3), e = k; for (;;) { while (e < ops.length && ops[e][0] !== ' ') e++; let run = 0; while (e + run < ops.length && ops[e + run][0] === ' ') run++; if (e + run >= ops.length || run > 6) { e = Math.min(ops.length, e + Math.min(run, 3)); break; } e += run; }
    const seg = ops.slice(s, e), os = seg.filter((x) => x[0] !== '+').length, ns = seg.filter((x) => x[0] !== '-').length;
    out.push('@@ -' + (seg[0][2] + 1) + ',' + os + ' +' + (seg[0][3] + 1) + ',' + ns + ' @@'); for (const x of seg) out.push(x[0] + x[1]); k = e;
  }
  return out.length > 2 ? out.join('\n') + '\n' : '';
}
/** one file's diff -> the added lines as code, with each one's line in the new file (what Verse's review reads, as /api/review does). Pure. */
export function addedOf(file) {
  const code = [], lines = [];
  for (const h of (file && file.hunks) || []) for (const r of h.rows) if (r.t === 'add') { code.push(r.text); lines.push(r.n); }
  return { code: code.join('\n'), lines };
}
