/**
 * code-hub-ui: the screen of /code/ and the pages of the code hosting lane (lib/code-sites.js). mountCode(root, { panels, tab, de }) builds what a page asks for:
 * open any public GitHub repository (or search for one) and read it: the file tree, a file coloured and numbered, the README drawn, commits, issues and pull
 * requests with their words and their diffs, "go to file"; paste a diff (or two texts) and see it, unified or side by side; and Verse's own code review on
 * any diff, run on this device. GitHub is read from the visitor's own browser (60 requests an hour for each visitor), every answer kept on this device with
 * its ETag so a second look is free and works offline; files come from GitHub's raw addresses. Read only: no token, no writing. English and German.
 * Pure logic: lib/code-hub.js. Tests: tools/code-hub.test.mjs, tools/video-code-page.mjs.
 */
import * as H from '/lib/code-hub.js';
import { DE } from '/lib/code-hub-de.js';
import { renderCode } from '/lib/gist.js';

const KEY = 'a2m.void.code.v1', GH = 'void-code-gh', SW_CACHE = 'void-shell-v2';
const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (x) => (isDe() && DE[x]) || x;
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, r = document) => r.querySelector(sel);
const mk = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } if (text != null) e.textContent = text; return e; };
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked */ } return m; }
const say = (id, msg) => { const n = document.getElementById(id); if (n) n.textContent = msg; };
const num = (n) => Number(n || 0).toLocaleString(isDe() ? 'de-DE' : 'en-US');
const ago = (iso) => H.ago(iso, Date.now(), isDe());
const ext = (u, label, cls = 'btn') => mk('a', { href: u, target: '_blank', rel: 'noopener noreferrer', class: cls }, label);

// ---------- GitHub, from this browser, every answer kept with its ETag ----------
let rate = null;
function showRate() { const r = rate, el = document.getElementById('c-rate'); if (!el || !r) return; el.textContent = t('GitHub requests left this hour for this browser:') + ' ' + r.left + ' / ' + r.limit + (r.left < 10 && r.reset ? ' · ' + t('more at') + ' ' + new Date(r.reset).toLocaleTimeString(isDe() ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '') + ' · ' + t('answers seen before are reused and cost nothing.'); }
async function cacheOpen() { try { return 'caches' in window ? await caches.open(GH) : null; } catch (_) { return null; } }
class GhError extends Error { constructor(status, limited) { super('github ' + status); this.status = status; this.limited = limited; } }
async function gh(path, raw = false) {
  const url = H.API + path, c = await cacheOpen(), hit = c ? await c.match(url).catch(() => null) : null, etag = hit && hit.headers.get('etag');
  const read = async (res) => (raw ? res.text() : res.json());
  if (hit && !navigator.onLine) return { data: await read(hit), cached: true };
  let r;
  try { r = await fetch(url, { headers: { accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', ...(etag ? { 'if-none-match': etag } : {}) } }); }
  catch (_) { if (hit) return { data: await read(hit), cached: true }; throw new GhError(0, false); }
  rate = H.rateOf((k) => r.headers.get(k)) || rate; showRate();
  if (r.status === 304 && hit) return { data: await read(hit), cached: true };
  if (r.ok) { const text = await r.text(); if (c) c.put(url, new Response(text, { headers: { etag: r.headers.get('etag') || '', 'content-type': raw ? 'text/plain' : 'application/json' } })).catch(() => {}); return { data: raw ? text : JSON.parse(text) }; }
  if (hit && (r.status === 403 || r.status === 429 || r.status >= 500)) return { data: await read(hit), cached: true, stale: true };
  throw new GhError(r.status, (rate && rate.left === 0) || r.status === 429);
}
const why = (e) => (e && e.limited ? t('GitHub’s hourly allowance for this browser is used up.') + (rate && rate.reset ? ' ' + t('It comes back at') + ' ' + new Date(rate.reset).toLocaleTimeString(isDe() ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) + '.' : '') + ' ' + t('Pages you opened before still show.')
  : e && e.status === 404 ? t('GitHub has nothing public there: a private repository, a wrong name or a deleted page.') : e && e.status === 0 ? t('GitHub could not be reached (offline?). Pages you opened before still show.') : t('GitHub did not answer just now') + (e && e.status ? ' (' + e.status + ')' : '') + '.');
async function rawFile(repo, ref, path) {
  const u = H.rawUrl(repo, ref, path); if (!u) throw new Error('bad'); const c = await cacheOpen(), hit = c ? await c.match(u).catch(() => null) : null;
  if (hit && !navigator.onLine) return await hit.text();
  try { const r = await fetch(u); if (r.status === 404) throw new GhError(404, false); if (!r.ok) throw new GhError(r.status, false); const len = +r.headers.get('content-length') || 0; if (len > 2e6) return { big: true };
    const buf = await r.arrayBuffer(); if (buf.byteLength > 2e6) return { big: true }; const text = new TextDecoder().decode(buf); if (/\u0000/.test(text.slice(0, 8000))) return { binary: true };
    if (c) c.put(u, new Response(text, { headers: { 'content-type': 'text/plain' } })).catch(() => {}); return text; }
  catch (e) { if (hit) return await hit.text(); throw e; }
}

// ---------- where we are: kept in the address, so every view is a link ----------
const S = { repo: '', view: 'code', ref: '', path: '', num: 0, sha: '', lines: null, state: 'open', page: 1, info: null, tree: null, treeRef: '', treeCut: false };
function link(o = {}) { const x = { ...S, ...o }, q = new URLSearchParams(); if (x.repo) q.set('r', x.repo); if (x.view && x.view !== 'code') q.set('v', x.view); if (x.ref && x.info && x.ref !== x.info.default_branch) q.set('ref', x.ref); else if (x.ref && !x.info && o.ref) q.set('ref', x.ref); if (x.path) q.set('p', x.path); if (x.num) q.set('n', String(x.num)); if (x.sha) q.set('sha', x.sha); if (x.lines) q.set('L', x.lines[0] + '-' + x.lines[1]); if (x.state && x.state !== 'open' && /issues|pulls/.test(x.view)) q.set('s', x.state); return location.pathname + (q.toString() ? '?' + q : ''); }
function go(o, push = true) { Object.assign(S, { num: 0, sha: '', lines: null, page: 1 }, o); try { history[push ? 'pushState' : 'replaceState'](null, '', link()); } catch (_) { /* no history */ } return draw(); }
const inLink = (label, o, cls) => { const a = mk('a', { href: link(o), ...(cls ? { class: cls } : {}) }, label); a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(o); }); return a; };
function readQuery() {
  const q = new URLSearchParams(location.search), r = q.get('r') || '', L = /^(\d+)-(\d+)$/.exec(q.get('L') || '');
  Object.assign(S, { repo: H.okRepo(r) ? r : '', view: q.get('v') || 'code', ref: q.get('ref') || '', path: q.get('p') || '', num: +q.get('n') || 0, sha: /^[0-9a-f]{7,40}$/i.test(q.get('sha') || '') ? q.get('sha') : '', lines: L ? [+L[1], +L[2]] : null, state: ['open', 'closed', 'all'].includes(q.get('s')) ? q.get('s') : 'open' });
}

// ---------- the repository ----------
async function openRepo(repo) {
  if (S.info && S.info.full_name && S.info.full_name.toLowerCase() === repo.toLowerCase()) return S.info;
  say('c-status', t('Opening') + ' ' + repo + '…'); S.info = null; S.tree = null;
  try { const { data, cached } = await gh(H.URLS.repo(repo)); if (!data || !data.full_name || data.private) throw new GhError(404, false); S.info = data; S.repo = data.full_name; say('c-status', cached ? t('Shown from this device: GitHub was not asked again.') : ''); }
  catch (e) {
    if (e.limited) { try { const r = await fetch('/api/repo?r=' + encodeURIComponent(repo)).then((x) => x.json()); if (r && r.ok && r.repo) { S.info = { full_name: r.repo.name, description: r.repo.description, stargazers_count: r.repo.stars, forks_count: r.repo.forks, language: r.repo.language, license: r.repo.license ? { spdx_id: r.repo.license } : null, default_branch: r.repo.branch, topics: r.repo.topics, open_issues_count: r.repo.openIssues, fromVerse: r.repo }; S.repo = r.repo.name; say('c-status', why(e) + ' ' + t('Showing Verse’s own recent look at this repository.')); } } catch (_) { /* nothing more to try */ } }
    if (!S.info) { say('c-status', why(e)); return null; }
  }
  const m = mem(); keep({ recent: [S.repo].concat((m.recent || []).filter((x) => x.toLowerCase() !== S.repo.toLowerCase())).slice(0, 12) }); drawRecent();
  return S.info;
}
async function loadTree(ref) {
  if (S.tree && S.treeRef === ref) return S.tree;
  const { data } = await gh(H.URLS.tree(S.repo, ref)); S.tree = H.treeOf(data); S.treeRef = ref; S.treeCut = !!(data && data.truncated); return S.tree;
}
function head() {
  const i = S.info, box = $('#c-head'); box.textContent = ''; if (!i) return;
  box.append(mk('h2', { id: 'c-name' }), mk('p', { class: 'desc' }, i.description || ''));
  $('#c-name', box).append(inLink(i.full_name, { view: 'code', path: '', ref: '' }));
  const st = mk('div', { class: 'stats' });
  const stat = (n, label) => { const s = mk('span'); s.append(mk('b', {}, num(n)), ' ' + t(label)); return s; };
  st.append(stat(i.stargazers_count, 'stars'), stat(i.forks_count, 'forks'), ...(i.subscribers_count != null ? [stat(i.subscribers_count, 'watching')] : []), stat(i.open_issues_count, 'open issues and pull requests'));
  if (i.language) st.append(mk('span', {}, i.language)); if (i.license && i.license.spdx_id && i.license.spdx_id !== 'NOASSERTION') st.append(mk('span', {}, t('Licence') + ': ' + i.license.spdx_id));
  if (i.pushed_at) st.append(mk('span', {}, t('Updated') + ' ' + ago(i.pushed_at))); if (i.archived) st.append(mk('span', { class: 'lbl' }, t('Archived'))); if (i.fork) st.append(mk('span', { class: 'lbl' }, t('Fork')));
  box.append(st);
  if (i.topics && i.topics.length) { const tp = mk('div', { class: 'row' }); for (const x of i.topics.slice(0, 12)) tp.append(ext('https://github.com/topics/' + encodeURIComponent(x), x, 'chip')); box.append(tp); }
  const acts = mk('div', { class: 'row' }), pinned = (mem().pins || []).includes(i.full_name);
  acts.append(ext(H.webUrl(S.repo, S), t('Open on GitHub'), 'btn go'), mk('button', { type: 'button', id: 'c-pin', onclick: () => { const p = mem().pins || []; keep({ pins: p.includes(i.full_name) ? p.filter((x) => x !== i.full_name) : [i.full_name].concat(p).slice(0, 30) }); head(); drawRecent(); } }, pinned ? t('Pinned ✓') : t('Pin on this device')),
    mk('button', { type: 'button', id: 'c-clone', onclick: () => copy('git clone https://github.com/' + i.full_name + '.git', t('Copied the clone command.')) }, t('Copy clone command')));
  if (i.homepage && /^https:\/\//.test(i.homepage)) acts.append(ext(i.homepage, t('Website')));
  box.append(acts);
  const tabs = mk('nav', { class: 'tabs', 'aria-label': t('Repository views') });
  for (const [v, label] of [['code', 'Code'], ['commits', 'Commits'], ['issues', 'Issues'], ['pulls', 'Pull requests'], ['actions', 'Actions'], ['find', 'Go to file']]) { const a = inLink(t(label), { view: v, path: v === 'code' ? S.path : '', num: 0 }); a.setAttribute('role', 'button'); a.className = 'btn'; a.setAttribute('aria-selected', String(S.view === v || (v === 'code' && S.view === 'file') || (v === 'issues' && S.view === 'issue') || (v === 'pulls' && S.view === 'pull') || (v === 'commits' && S.view === 'commit') || (v === 'actions' && S.view === 'run'))); tabs.append(a); }
  box.append(tabs);
}
// the screen says when it waits on GitHub (aria-busy): a screen reader hears it, and the tower gate reads the page once it is done
const draw = async () => { const app = document.getElementById('app'); if (app) app.setAttribute('aria-busy', 'true'); try { await drawNow(); } finally { if (app) app.setAttribute('aria-busy', 'false'); } };
async function drawNow() {
  const sec = $('#c-repo'); if (!sec) return; if (!S.repo) { sec.hidden = true; return; }
  sec.hidden = false; const view = $('#c-view'); view.textContent = ''; view.append(mk('p', { class: 'soft' }, t('Loading…')));
  const info = await openRepo(S.repo); if (!info) { view.textContent = ''; $('#c-head').textContent = ''; return; }
  if (!S.ref) S.ref = info.default_branch || 'main'; head(); view.textContent = '';
  try {
    if (S.view === 'commits') await drawCommits(view); else if (S.view === 'commit') await drawCommit(view);
    else if (S.view === 'issues' || S.view === 'pulls') await drawIssues(view, S.view === 'pulls'); else if (S.view === 'issue' || S.view === 'pull') await drawIssue(view, S.view === 'pull');
    else if (S.view === 'actions') await drawRuns(view); else if (S.view === 'run') await drawRun(view);
    else if (S.view === 'find') await drawFind(view); else await drawCode(view);
  } catch (e) { view.append(mk('p', { class: 'bad' }, why(e))); }
  document.title = (S.repo ? S.repo + ' · ' : '') + (isDe() && cfgDe.h1 ? cfgDe.h1 : document.querySelector('h1').textContent) + ' · Verse';
  document.documentElement.dataset.codeView = S.view;
}
function crumbs(box) {
  const c = mk('nav', { class: 'crumbs', 'aria-label': t('Path') }); c.append(inLink(S.repo.split('/')[1], { view: 'code', path: '' }));
  const parts = S.path ? S.path.split('/') : []; parts.forEach((p, i) => { c.append(mk('span', { class: 'soft' }, '/')); c.append(i === parts.length - 1 ? mk('b', {}, p) : inLink(p, { view: 'code', path: parts.slice(0, i + 1).join('/') })); });
  const br = mk('select', { 'aria-label': t('Branch'), id: 'c-ref' }); br.append(mk('option', { value: S.ref }, S.ref));
  br.addEventListener('focus', async () => { if (br.dataset.done) return; br.dataset.done = '1'; try { const { data } = await gh(H.URLS.branches(S.repo)); for (const b of data || []) if (b.name !== S.ref) br.append(mk('option', { value: b.name }, b.name)); } catch (_) { /* only the one */ } }, { once: true });
  br.addEventListener('change', () => go({ ref: br.value, view: S.view === 'file' ? 'file' : 'code' }));
  const w = mk('div', { class: 'row' }); w.append(br, c); box.append(w);
}
async function drawCode(box) {
  crumbs(box); const tree = await loadTree(S.ref), here = tree.find((e) => e.path === S.path);
  if (S.path && here && !here.dir) return drawFile(box, here);
  if (S.path && !here) { box.append(mk('p', { class: 'bad' }, t('There is no such file or folder on this branch.'))); return; }
  const list = H.listDir(tree, S.path), ul = mk('ul', { class: 'tree', id: 'c-tree' });
  if (S.path) { const li = mk('li'); li.append(inLink('📁 ..', { view: 'code', path: S.path.split('/').slice(0, -1).join('/') })); ul.append(li); }
  for (const e of list) { const li = mk('li'), a = inLink((e.dir ? '📁 ' : e.sub ? '🔗 ' : '📄 ') + e.name, { view: 'code', path: e.path }); if (e.size != null) a.append(mk('span', { class: 'sz' }, H.sizeOf(e.size))); li.append(a); ul.append(li); }
  box.append(ul); if (S.treeCut) box.append(mk('p', { class: 'soft' }, t('This repository is very large: GitHub sent part of its tree. Open folders on GitHub for the rest.')));
  box.append(mk('p', { class: 'soft' }, list.filter((e) => e.dir).length + ' ' + t('folders') + ', ' + list.filter((e) => !e.dir).length + ' ' + t('files') + ' · ' + tree.filter((e) => !e.dir).length + ' ' + t('files in the repository')));
  const rd = list.find((e) => !e.dir && /^readme(?:\.(?:md|markdown|txt|rst))?$/i.test(e.name));
  if (rd) { const sec = mk('section', { class: 'panel', id: 'c-readme' }); sec.append(mk('h3', {}, rd.name)); const body = mk('div', { class: 'md' }, t('Loading…')); sec.append(body); box.append(sec);
    try { const txt = await rawFile(S.repo, S.ref, rd.path); body.innerHTML = /\.(?:md|markdown)$/i.test(rd.name) ? H.mdHtml(txt, mdCtx(S.path)) : '<pre>' + esc(txt) + '</pre>'; } catch (e) { body.textContent = why(e); } }
}
const mdCtx = (dir) => ({ repo: S.repo, ref: S.ref, dir, link: (p) => link({ view: 'code', path: p }) });
async function drawFile(box, e) {
  const bar = mk('div', { class: 'row' }), name = e.path.split('/').pop(), raw = H.rawUrl(S.repo, S.ref, e.path);
  bar.append(ext(H.webUrl(S.repo, { view: 'file', ref: S.ref, path: e.path, lines: S.lines }), t('Open on GitHub')), ext(raw, t('Raw')), inLink(t('History'), { view: 'commits', path: e.path }, 'btn'), ext('/g/?gh=' + encodeURIComponent(S.repo + '/' + S.ref + '/' + e.path), t('Open as a gist'), 'btn'));
  box.append(bar, mk('p', { class: 'soft' }, H.sizeOf(e.size)));
  const out = mk('div', { id: 'c-file' }); box.append(out); out.textContent = t('Loading…');
  let text; try { text = await rawFile(S.repo, S.ref, e.path); } catch (er) { out.textContent = why(er); return; }
  if (text && text.big) { out.textContent = t('This file is over 2 MB: open it raw or on GitHub.'); return; }
  if (text && text.binary) { if (/\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i.test(name)) { out.textContent = ''; out.append(mk('img', { src: raw, alt: name, style: 'max-width:100%;height:auto', referrerpolicy: 'no-referrer' })); } else out.textContent = t('This is not a text file: download it raw.'); return; }
  const tools = mk('div', { class: 'row' }), lines = mk('input', { type: 'text', id: 'c-lines', 'aria-label': t('Highlight lines'), placeholder: t('Lines, like 10-20'), value: S.lines ? S.lines[0] + '-' + S.lines[1] : '', size: '10' });
  const md = /\.(?:md|markdown)$/i.test(name); let asSource = !md;
  const paint = () => { out.textContent = ''; if (!asSource) { const d = mk('div', { class: 'md' }); d.innerHTML = H.mdHtml(text, mdCtx(e.path.split('/').slice(0, -1).join('/'))); out.append(d); return; } const pre = renderCode(out, name, text, S.lines); const lit = pre.querySelector('.lit'); if (lit) setTimeout(() => lit.scrollIntoView({ block: 'center' }), 50); };
  tools.append(mk('button', { type: 'button', id: 'c-copy', onclick: () => copy(text, t('Copied the file.')) }, t('Copy')), mk('button', { type: 'button', onclick: () => { const a = mk('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name }); document.body.append(a); a.click(); a.remove(); } }, t('Download')));
  if (md) tools.append(mk('button', { type: 'button', id: 'c-src', onclick: (ev) => { asSource = !asSource; ev.target.textContent = asSource ? t('Show rendered') : t('Show source'); paint(); } }, t('Show source')));
  const lf = mk('form', { class: 'row' }); lf.append(lines, mk('button', { type: 'submit' }, t('Highlight')), mk('button', { type: 'button', onclick: () => copy(location.origin + link({ lines: S.lines }), t('Copied the link to these lines.')) }, t('Copy line link')));
  lf.addEventListener('submit', (ev) => { ev.preventDefault(); const m = /^\s*(\d+)\s*(?:[-–:]\s*(\d+))?\s*$/.exec(lines.value); S.lines = m ? [Math.min(+m[1], +(m[2] || m[1])), Math.max(+m[1], +(m[2] || m[1]))] : null; try { history.replaceState(null, '', link()); } catch (_) { /* fine */ } asSource = true; paint(); });
  box.insertBefore(tools, out); box.insertBefore(lf, out); box.insertBefore(mk('p', { class: 'soft' }, text.split('\n').length + ' ' + t('lines')), out); paint();
}
async function drawCommits(box) {
  if (S.path) box.append(mk('p', { class: 'soft' }, t('Commits that changed') + ' ' + S.path));
  const { data } = await gh(H.URLS.commits(S.repo, { ref: S.ref, path: S.path, page: S.page })), ul = mk('ul', { class: 'items', id: 'c-commits' });
  for (const c of data || []) { const li = mk('li'), msg = String((c.commit && c.commit.message) || '').split('\n')[0].slice(0, 200); li.append(inLink(msg || c.sha.slice(0, 7), { view: 'commit', sha: c.sha }, 'it'), mk('span', { class: 'soft' }, [(c.commit && c.commit.author && c.commit.author.name) || '', c.commit && c.commit.author && ago(c.commit.author.date), c.sha.slice(0, 7)].filter(Boolean).join(' · '))); ul.append(li); }
  box.append(ul); if (!(data || []).length) box.append(mk('p', { class: 'soft' }, t('No commits here.')));
  const nav = mk('div', { class: 'row' }); if (S.page > 1) nav.append(mk('button', { type: 'button', onclick: () => go({ view: 'commits', path: S.path, page: S.page - 1 }, false).then(() => {}) }, t('Newer'))); if ((data || []).length === 30) nav.append(mk('button', { type: 'button', id: 'c-older', onclick: () => { S.page++; draw(); } }, t('Older'))); box.append(nav);
}
async function drawCommit(box) {
  const { data: c } = await gh(H.URLS.commit(S.repo, S.sha)); const msg = String((c.commit && c.commit.message) || '');
  box.append(mk('h3', {}, msg.split('\n')[0]), mk('pre', { class: 'desc' }, msg.split('\n').slice(1).join('\n').trim()), mk('p', { class: 'soft' }, [(c.commit && c.commit.author && c.commit.author.name), c.commit && c.commit.author && ago(c.commit.author.date), c.sha].filter(Boolean).join(' · ')));
  const st = c.stats || {}; box.append(mk('p', { class: 'stats' }, (c.files || []).length + ' ' + t('files changed') + ' · +' + num(st.additions) + ' −' + num(st.deletions)));
  const row = mk('div', { class: 'row' }); row.append(ext(H.webUrl(S.repo, { view: 'commit', sha: c.sha }), t('Open on GitHub'))); box.append(row);
  diffBlock(box, H.parseDiff(H.filesToDiff(c.files)), (c.files || []).filter((f) => !f.patch).map((f) => f.filename));
}
async function drawIssues(box, pulls) {
  const bar = mk('div', { class: 'row' }); for (const s of ['open', 'closed', 'all']) { const a = inLink(t({ open: 'Open', closed: 'Closed', all: 'All' }[s]), { view: S.view, state: s }, 'chip'); if (S.state === s) a.setAttribute('aria-current', 'true'), a.classList.add('on'); bar.append(a); }
  bar.append(ext(H.webUrl(S.repo, { view: pulls ? 'pulls' : 'issues' }), t('Open on GitHub'), 'chip')); box.append(bar);
  const { data } = await gh(pulls ? H.URLS.pulls(S.repo, { state: S.state, page: S.page }) : H.URLS.issues(S.repo, { state: S.state, page: S.page }));
  const items = (data || []).filter((x) => pulls || !x.pull_request), ul = mk('ul', { class: 'items', id: 'c-list' });
  for (const x of items) {
    const li = mk('li'), state = pulls ? (x.merged_at ? 'merged' : x.state) : x.state; li.append(mk('span', { class: 'st ' + (state === 'open' ? '' : state === 'merged' || x.state_reason === 'completed' ? 'closed' : 'shut') }, t(state === 'open' ? 'Open' : state === 'merged' ? 'Merged' : 'Closed')), ' ', inLink('#' + x.number + ' ' + String(x.title || '').slice(0, 200), { view: pulls ? 'pull' : 'issue', num: x.number }, 'it'));
    for (const l of (x.labels || []).slice(0, 5)) li.append(mk('span', { class: 'lbl' }, l.name));
    li.append(mk('span', { class: 'soft' }, [x.user && x.user.login, ago(x.created_at), x.comments ? x.comments + ' ' + t('comments') : '', x.draft ? t('draft') : ''].filter(Boolean).join(' · '))); ul.append(li);
  }
  box.append(ul); if (!items.length) box.append(mk('p', { class: 'soft' }, pulls ? t('No pull requests here.') : t('No issues here.')));
  const nav = mk('div', { class: 'row' }); if ((data || []).length === 30) nav.append(mk('button', { type: 'button', onclick: () => { S.page++; draw(); } }, t('More'))); box.append(nav);
}
function comment(who, when, body) { const d = mk('div', { class: 'comment' }), w = mk('div', { class: 'who' }, who + ' · ' + ago(when)), m = mk('div', { class: 'md' }); m.innerHTML = body ? H.mdHtml(body, mdCtx('')) : '<p class="soft">' + esc(t('No description.')) + '</p>'; d.append(w, m); return d; }
async function drawIssue(box, pull) {
  const [{ data: x }, cm] = await Promise.all([gh(pull ? H.URLS.pull(S.repo, S.num) : H.URLS.issue(S.repo, S.num)), gh(H.URLS.comments(S.repo, S.num)).catch(() => ({ data: [] }))]);
  const state = pull ? (x.merged_at ? 'merged' : x.state) : x.state;
  box.append(mk('h3', {}, String(x.title || '') + ' #' + x.number)); const meta = mk('p', { class: 'soft' }); meta.append(mk('span', { class: 'st ' + (state === 'open' ? '' : state === 'merged' ? 'closed' : 'shut') }, t(state === 'open' ? 'Open' : state === 'merged' ? 'Merged' : 'Closed')), ' ' + [x.user && x.user.login, ago(x.created_at)].join(' · ')); box.append(meta);
  if (pull) box.append(mk('p', { class: 'stats' }, (x.base && x.base.ref) + ' ← ' + (x.head && x.head.label) + ' · ' + num(x.commits) + ' ' + t('commits') + ' · ' + num(x.changed_files) + ' ' + t('files changed') + ' · +' + num(x.additions) + ' −' + num(x.deletions) + (x.draft ? ' · ' + t('draft') : '')));
  const lb = mk('div', { class: 'row' }); for (const l of (x.labels || []).slice(0, 10)) lb.append(mk('span', { class: 'lbl' }, l.name)); lb.append(ext(H.webUrl(S.repo, { view: pull ? 'pull' : 'issue', num: x.number }), t('Open on GitHub'))); box.append(lb);
  let files = null;
  if (pull) { const tabs = mk('div', { class: 'tabs' }), conv = mk('div'), fl = mk('div', { hidden: true });
    const b1 = mk('button', { type: 'button', 'aria-selected': 'true' }, t('Conversation')), b2 = mk('button', { type: 'button', 'aria-selected': 'false', id: 'c-files' }, t('Files changed') + ' (' + num(x.changed_files) + ')');
    b1.onclick = () => { conv.hidden = false; fl.hidden = true; b1.setAttribute('aria-selected', 'true'); b2.setAttribute('aria-selected', 'false'); };
    b2.onclick = async () => { conv.hidden = true; fl.hidden = false; b2.setAttribute('aria-selected', 'true'); b1.setAttribute('aria-selected', 'false'); if (!files) { fl.textContent = t('Loading…'); try { files = (await gh(H.URLS.pullFiles(S.repo, S.num))).data; fl.textContent = ''; diffBlock(fl, H.parseDiff(H.filesToDiff(files)), (files || []).filter((f) => !f.patch).map((f) => f.filename)); } catch (e) { fl.textContent = why(e); } } };
    tabs.append(b1, b2); box.append(tabs, conv, fl); box = conv; }
  box.append(comment(x.user ? x.user.login : '', x.created_at, x.body));
  for (const c of cm.data || []) box.append(comment(c.user ? c.user.login : '', c.created_at, c.body));
  if (x.comments > (cm.data || []).length) box.append(ext(H.webUrl(S.repo, { view: pull ? 'pull' : 'issue', num: x.number }), t('More comments on GitHub')));
}
async function drawRuns(box) {
  const [{ data }, wf] = await Promise.all([gh(H.URLS.runs(S.repo, S.page)), gh(H.URLS.workflows(S.repo)).catch(() => ({ data: {} }))]);
  const flows = (wf.data && wf.data.workflows) || [], runs = (data && data.workflow_runs) || [];
  box.append(mk('p', { class: 'soft' }, flows.length + ' ' + t('workflows') + ' · ' + num(data && data.total_count) + ' ' + t('runs') + ' · ' + t('what this repository runs by itself on each push, pull request or schedule.')));
  const ul = mk('ul', { class: 'items', id: 'c-runs' });
  for (const r of runs) { const st = H.runState(r), li = mk('li'); li.append(mk('span', { class: 'st ' + st.cls }, t(st.word)), ' ', inLink((r.display_title || r.name || '').slice(0, 160), { view: 'run', num: r.id }, 'it'), mk('span', { class: 'soft' }, [r.name, r.head_branch, r.event, ago(r.created_at), H.runTime(r.run_started_at || r.created_at, r.updated_at)].filter(Boolean).join(' · '))); ul.append(li); }
  box.append(ul); if (!runs.length) box.append(mk('p', { class: 'soft' }, t('No workflow runs here.')));
  const nav = mk('div', { class: 'row' }); if (runs.length === 20) nav.append(mk('button', { type: 'button', onclick: () => { S.page++; draw(); } }, t('Older'))); nav.append(ext(H.webUrl(S.repo, { view: 'actions' }), t('Open on GitHub'), 'btn'), ext('/code-review/', t('Verse’s review as a GitHub Action'), 'btn')); box.append(nav);
}
async function drawRun(box) {
  const { data } = await gh(H.URLS.jobs(S.repo, S.num)), jobs = (data && data.jobs) || [];
  box.append(mk('h3', {}, t('Workflow run') + ' ' + S.num), ext('https://github.com/' + S.repo + '/actions/runs/' + S.num, t('Open on GitHub')));
  for (const j of jobs) { const st = H.runState(j), d = mk('details', { class: 'pl', ...(st.cls === 'bad' ? { open: true } : {}) }), sm = mk('summary'); sm.append(mk('span', { class: 'st ' + st.cls }, t(st.word)), ' ' + j.name + ' · ' + H.runTime(j.started_at, j.completed_at)); d.append(sm);
    const ol = mk('ol', { class: 'items' }); for (const s of j.steps || []) { const ss = H.runState(s); ol.append(mk('li', {}, (ss.cls === 'bad' ? '✗ ' : ss.word === 'Passed' ? '✓ ' : '· ') + s.name + (s.started_at ? ' · ' + H.runTime(s.started_at, s.completed_at) : ''))); } d.append(ol); box.append(d); }
  if (!jobs.length) box.append(mk('p', { class: 'soft' }, t('No jobs in this run.')));
}
async function drawFind(box) {
  const tree = await loadTree(S.ref), f = mk('form', { class: 'row', role: 'search' }), inp = mk('input', { type: 'search', id: 'c-find', 'aria-label': t('Go to file'), placeholder: t('Type part of a file name or path'), autocomplete: 'off' }); f.append(inp); box.append(f);
  const ul = mk('ul', { class: 'tree', id: 'c-found' }), note = mk('p', { class: 'soft' }, tree.filter((e) => !e.dir).length + ' ' + t('files, searched on this device as you type.')); box.append(note, ul);
  const run = () => { ul.textContent = ''; for (const e of H.findFiles(tree, inp.value)) { const li = mk('li'); li.append(inLink('📄 ' + e.path, { view: 'code', path: e.path })); ul.append(li); } };
  inp.addEventListener('input', run); f.addEventListener('submit', (e) => { e.preventDefault(); const a = ul.querySelector('a'); if (a) a.click(); });
  const out = mk('div', { class: 'row' }); out.append(mk('span', { class: 'soft' }, t('Search inside the code (GitHub asks you to sign in for that):')), ext('https://github.com/search?type=code&q=' + encodeURIComponent('repo:' + S.repo + ' '), t('Search code on GitHub'), 'chip')); box.append(out); inp.focus();
}

// ---------- diffs and Verse's review ----------
const LANGS = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift', php: 'php', c: 'c', h: 'c', cpp: 'c++', cs: 'c#', sh: 'bash', bash: 'bash', yml: 'yaml', yaml: 'yaml', tf: 'terraform', lua: 'lua', ps1: 'powershell', sql: 'sql', html: 'html', css: 'css' };
let reviewLib = null;
async function review(files, box, btn) {
  btn.disabled = true; btn.textContent = t('Reviewing on this device…');
  try {
    reviewLib = reviewLib || await import('/lib/code-review.js'); let total = 0;
    box.querySelectorAll('tr.find').forEach((r) => r.remove());
    for (const [i, f] of files.entries()) {
      const { code, lines } = H.addedOf(f); if (!code.trim()) continue; const e = (/\.([a-z0-9]+)$/i.exec(f.to || '') || [])[1], name = /dockerfile$/i.test(f.to || '') ? 'dockerfile' : LANGS[String(e || '').toLowerCase()];
      const res = reviewLib.ruleReview(code, { lang: name ? reviewLib.langNamed(name) || undefined : undefined, max: 200 });
      const table = box.querySelector('table[data-f="' + i + '"]'); if (!table) continue;
      for (const fd of res.findings) { const n = lines[fd.line - 1]; const row = table.querySelector('tr[data-n="' + n + '"]'); const tr = mk('tr', { class: 'find' }), td = mk('td', { colspan: '3' }, '⚑ ' + (t(fd.kind) || fd.kind) + ' · ' + t('line') + ' ' + n + ': ' + fd.message); tr.append(td); if (row) row.after(tr); else table.append(tr); total++; }
    }
    say('c-revmsg', total ? total + ' ' + t('findings from Verse’s review, marked under their lines.') : t('Verse’s review found nothing wrong in the added lines.'));
  } catch (_) { say('c-revmsg', t('Verse’s review could not run here.')); }
  btn.disabled = false; btn.textContent = t('Review the changes with Verse');
}
function diffBlock(box, files, skipped = [], split = false) {
  const top = mk('div', { class: 'row' }), sp = mk('button', { type: 'button', id: 'c-split', 'aria-pressed': String(split) }, split ? t('Unified view') : t('Side by side')), rv = mk('button', { type: 'button', class: 'go', id: 'c-review' }, t('Review the changes with Verse'));
  const adds = files.reduce((a, f) => a + f.adds, 0), dels = files.reduce((a, f) => a + f.dels, 0); top.append(mk('span', { class: 'stats' }, files.length + ' ' + t('files') + ' · +' + num(adds) + ' −' + num(dels)), sp, rv);
  const wrap = mk('div'), msg = mk('p', { class: 'live', id: 'c-revmsg', role: 'status' }); box.append(top, msg, wrap);
  const paint = () => { wrap.textContent = ''; files.forEach((f, i) => wrap.append(fileDiff(f, i, split))); for (const s of skipped) wrap.append(mk('p', { class: 'soft' }, s + ': ' + t('no text diff (a binary file or a very large change).'))); };
  sp.onclick = () => { split = !split; sp.textContent = split ? t('Unified view') : t('Side by side'); sp.setAttribute('aria-pressed', String(split)); paint(); };
  rv.onclick = () => review(files, wrap, rv); paint();
}
function fileDiff(f, i, split) {
  const d = mk('div', { class: 'diff' }), name = f.from && f.to && f.from !== f.to ? f.from + ' → ' + f.to : f.to || f.from; d.append(mk('div', { class: 'fh' }, name + '  +' + f.adds + ' −' + f.dels));
  const tb = mk('table', { 'data-f': String(i) }), row = (cls, cells, n) => { const tr = mk('tr', { class: cls, ...(n != null ? { 'data-n': String(n) } : {}) }); for (const [c, x] of cells) tr.append(mk('td', c ? { class: c } : {}, x)); tb.append(tr); };
  for (const h of f.hunks) {
    row('hunk', split ? [['n', ''], ['', h.head], ['n', ''], ['', '']] : [['n', ''], ['n', ''], ['', h.head]]);
    if (!split) { for (const r of h.rows) row(r.t, [['n', r.o != null ? r.o : ''], ['n', r.n != null ? r.n : ''], ['', (r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' ') + r.text]], r.n); continue; }
    for (let k = 0; k < h.rows.length;) {
      if (h.rows[k].t === 'ctx') { const r = h.rows[k++]; row('ctx', [['n', r.o], ['', r.text], ['n', r.n], ['', r.text]], r.n); continue; }
      const del = [], add = []; while (k < h.rows.length && h.rows[k].t === 'del') del.push(h.rows[k++]); while (k < h.rows.length && h.rows[k].t === 'add') add.push(h.rows[k++]);
      for (let j = 0; j < Math.max(del.length, add.length); j++) { const a = del[j], b = add[j]; const tr = mk('tr', { ...(b ? { 'data-n': String(b.n) } : {}) }); tr.append(mk('td', { class: 'n' }, a ? a.o : ''), mk('td', { class: a ? 'dl' : '' , style: a ? 'background:color-mix(in srgb,#cf222e 16%,transparent)' : '' }, a ? a.text : ''), mk('td', { class: 'n' }, b ? b.n : ''), mk('td', { style: b ? 'background:color-mix(in srgb,#2da44e 18%,transparent)' : '' }, b ? b.text : '')); tb.append(tr); }
    }
  }
  d.append(tb); return d;
}
async function copy(text, done) { try { await navigator.clipboard.writeText(text); say('c-sharemsg', done || t('Copied.')); } catch (_) { say('c-sharemsg', t('Copy did not work here: select the text and copy it.')); } }
function drawRecent() {
  const box = $('#c-recent'); if (!box) return; box.textContent = ''; const m = mem(), pins = m.pins || [], rec = (m.recent || []).filter((x) => !pins.includes(x));
  const chip = (r, pin) => inLinkRepo((pin ? '★ ' : '') + r, r);
  if (pins.length) { box.append(mk('span', { class: 'soft' }, t('Pinned') + ':')); for (const r of pins) box.append(chip(r, true)); }
  if (rec.length) { box.append(mk('span', { class: 'soft' }, t('Recent') + ':')); for (const r of rec.slice(0, 8)) box.append(chip(r)); }
  if (!pins.length && !rec.length) { box.append(mk('span', { class: 'soft' }, t('Try') + ':')); for (const r of ['atomeam/void-loop', 'torvalds/linux', 'microsoft/vscode', 'python/cpython']) box.append(chip(r)); }
}
const inLinkRepo = (label, repo) => { const a = mk('a', { href: location.pathname + '?r=' + repo, class: 'chip' }, label); a.addEventListener('click', (e) => { e.preventDefault(); S.info = null; go({ repo, view: 'code', path: '', ref: '' }); }); return a; };

// ---------- panels ----------
const PANELS = {};
let cfgDe = {};
PANELS.open = () => {
  const s = mk('section', { class: 'panel', id: 'c-open', 'aria-labelledby': 'c-open-h' });
  s.innerHTML = '<h2 id="c-open-h">' + esc(t('Open a repository')) + '</h2><form id="c-form" class="row"><input type="text" id="c-in" autocomplete="off" spellcheck="false" aria-label="' + esc(t('A repository, a GitHub link, a file, an issue or a pull request')) + '" placeholder="' + esc(t('owner/name or any github.com link')) + '"><button type="submit" class="go">' + esc(t('Open')) + '</button></form>'
    + '<div class="row" id="c-recent"></div><form id="c-sf" class="row" role="search"><input type="search" id="c-sq" aria-label="' + esc(t('Search GitHub repositories')) + '" placeholder="' + esc(t('Search repositories: markdown editor, game engine…')) + '"><button type="submit">' + esc(t('Search')) + '</button></form><ul class="items" id="c-sres"></ul><p class="live" id="c-status" role="status"></p><p class="rate" id="c-rate"></p>';
  $('#c-form', s).addEventListener('submit', (e) => { e.preventDefault(); const v = $('#c-in').value, x = H.ghTarget(v); if (!x) { say('c-status', t('That is not a GitHub repository or link. Type owner/name, like atomeam/void-loop.')); return; } if (x.gist) { const g = $('#c-gin'); if (g) { g.value = x.gist; $('#c-gf').requestSubmit(); g.scrollIntoView({ block: 'center' }); } else location.href = '/code/?id=' + x.gist; return; } S.info = null; go({ repo: x.repo, view: x.view, ref: x.ref || '', path: x.path || '', num: x.num || 0, sha: x.sha || '', lines: x.lines || null }).then(() => { if (x.lines) S.lines = x.lines; }); });
  $('#c-sf', s).addEventListener('submit', async (e) => { e.preventDefault(); const q = $('#c-sq').value.trim(); if (!q) return; const ul = $('#c-sres'); ul.textContent = ''; say('c-status', t('Searching…'));
    try { const { data } = await gh(H.URLS.searchRepos(q)); say('c-status', num(data.total_count) + ' ' + t('repositories; the best matches first.')); for (const r of (data.items || []).slice(0, 20)) { const li = mk('li'); li.append(inLinkRepo(r.full_name, r.full_name), mk('span', { class: 'soft' }, [r.description ? String(r.description).slice(0, 160) : '', '★ ' + num(r.stargazers_count), r.language, r.pushed_at ? t('Updated') + ' ' + ago(r.pushed_at) : ''].filter(Boolean).join(' · '))); li.querySelector('a').className = 'it'; ul.append(li); } }
    catch (er) { say('c-status', why(er)); } });
  return s;
};
PANELS.repo = () => { const s = mk('section', { class: 'panel', id: 'c-repo', hidden: true }); s.append(mk('div', { id: 'c-head' }), mk('div', { id: 'c-view' })); return s; };
PANELS.diff = (c) => {
  const s = mk('section', { class: 'panel', id: 'c-diff', 'aria-labelledby': 'c-diff-h' });
  s.innerHTML = '<h2 id="c-diff-h">' + esc(t(c.diffTitle || 'Read and review a diff')) + '</h2><div class="tabs" role="tablist"><button type="button" role="tab" id="c-dt1" aria-selected="true">' + esc(t('Paste a diff')) + '</button><button type="button" role="tab" id="c-dt2" aria-selected="false">' + esc(t('Compare two texts')) + '</button></div>'
    + '<div id="c-dp1"><textarea id="c-dtext" aria-label="' + esc(t('A unified diff')) + '" placeholder="' + esc(t('Paste the output of git diff, a .patch file or a pull request’s diff')) + '" spellcheck="false"></textarea><div class="row"><button type="button" id="c-dshow" class="go">' + esc(t('Show the diff')) + '</button><label class="btn" for="c-dfile">' + esc(t('Open a .diff or .patch file')) + '</label><input type="file" id="c-dfile" class="pick" accept=".diff,.patch,text/plain"></div></div>'
    + '<div id="c-dp2" hidden><div class="row"><textarea id="c-da" aria-label="' + esc(t('The old text')) + '" placeholder="' + esc(t('The old text')) + '" spellcheck="false"></textarea><textarea id="c-db" aria-label="' + esc(t('The new text')) + '" placeholder="' + esc(t('The new text')) + '" spellcheck="false"></textarea></div><div class="row"><input type="text" id="c-dname" aria-label="' + esc(t('File name (for colours and the review)')) + '" placeholder="' + esc(t('File name, like app.js')) + '" value=""><button type="button" id="c-dcmp" class="go">' + esc(t('Compare')) + '</button></div></div><div id="c-dout"></div>';
  const tab = (n) => { $('#c-dp1', s).hidden = n !== 1; $('#c-dp2', s).hidden = n !== 2; $('#c-dt1', s).setAttribute('aria-selected', String(n === 1)); $('#c-dt2', s).setAttribute('aria-selected', String(n === 2)); };
  $('#c-dt1', s).onclick = () => tab(1); $('#c-dt2', s).onclick = () => tab(2);
  const showDiff = (text) => { const out = $('#c-dout', s); out.textContent = ''; const files = H.parseDiff(text); if (!files.length) { out.append(mk('p', { class: 'bad' }, t('That is not a unified diff: it needs lines starting with @@, + and -.'))); return; } diffBlock(out, files); };
  $('#c-dshow', s).onclick = () => showDiff($('#c-dtext', s).value);
  $('#c-dfile', s).onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const txt = (await f.text()).slice(0, 2e6); $('#c-dtext', s).value = txt; showDiff(txt); };
  $('#c-dcmp', s).onclick = () => { const d = H.textDiff($('#c-da', s).value, $('#c-db', s).value, ($('#c-dname', s).value || 'text').replace(/[^\w.-]/g, '').slice(0, 60) || 'text'); const out = $('#c-dout', s); if (!d) { out.textContent = ''; out.append(mk('p', { class: 'soft' }, t('The two texts are the same.'))); return; } showDiff(d); };
  if (c.tab === 'compare') tab(2);
  return s;
};
PANELS.gist = () => {
  const s = mk('section', { class: 'panel', id: 'c-gist', 'aria-labelledby': 'c-gist-h' });
  s.innerHTML = '<h2 id="c-gist-h">' + esc(t('Read a GitHub gist')) + '</h2><form class="row" id="c-gf"><input type="text" id="c-gin" aria-label="' + esc(t('A gist link or id')) + '" placeholder="https://gist.github.com/…"><button type="submit">' + esc(t('Open')) + '</button><a class="btn" href="/g/">' + esc(t('Make a gist on Verse (no account)')) + '</a></form><div id="c-gout"></div>';
  const open = async (id) => { const out = $('#c-gout', s); out.textContent = t('Loading…'); try { const { data: g } = await gh(H.URLS.gist(id)); out.textContent = ''; out.append(mk('p', { class: 'soft' }, [(g.description || ''), g.owner && g.owner.login, ago(g.updated_at)].filter(Boolean).join(' · ')), ext(g.html_url && /^https:\/\/gist\.github\.com\//.test(g.html_url) ? g.html_url : 'https://gist.github.com/' + id, t('Open on GitHub')));
    for (const f of Object.values(g.files || {})) { out.append(mk('h3', {}, f.filename)); const box = mk('div'); out.append(box); renderCode(box, f.filename, String(f.content || '').slice(0, 400000), null); } } catch (e) { out.textContent = why(e); } };
  $('#c-gf', s).onsubmit = (e) => { e.preventDefault(); const x = H.ghTarget($('#c-gin', s).value) || {}; const id = x.gist || (/^[0-9a-f]{5,40}$/i.test($('#c-gin', s).value.trim()) ? $('#c-gin', s).value.trim() : ''); if (!id) { $('#c-gout', s).textContent = t('That is not a gist link.'); return; } try { history.replaceState(null, '', location.pathname + '?id=' + id); } catch (_) { /* fine */ } open(id); };
  const q = new URLSearchParams(location.search).get('id'); if (q && /^[0-9a-f]{5,40}$/i.test(q)) { $('#c-gin', s).value = q; setTimeout(() => open(q), 0); }
  return s;
};
function keepForOffline() { try { if (!('caches' in window)) return; caches.open(SW_CACHE).then((c) => Promise.all([location.pathname, location.pathname + 'app.js', '/lib/code-hub-ui.js', '/lib/code-hub.js', '/lib/code-hub-de.js', '/lib/gist.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/code-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {}); } catch (_) { /* no cache */ } }
/** mounts the panels a page asks for: { panels: ['open', 'repo', 'diff', 'gist'], tab, de: { h1, intro } }. */
export async function mountCode(root, c = {}) {
  root.textContent = ''; cfgDe = c.de || {};
  for (const p of c.panels || ['open', 'repo', 'diff']) if (PANELS[p]) root.append(PANELS[p](c));
  const foot = mk('div', { class: 'row' }); foot.innerHTML = '<button type="button" id="c-share">' + esc(t('Share link')) + '</button> <span class="live" id="c-sharemsg" role="status"></span>'; root.append(foot);
  $('#c-share').addEventListener('click', async () => { const url = location.href; try { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { await navigator.share({ title: document.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } copy(url, t('Copied the link to this view.')); });
  if (isDe()) { document.documentElement.lang = 'de'; const h = document.querySelector('h1'), p = document.querySelector('.intro'); if (h && cfgDe.h1) h.textContent = cfgDe.h1; if (p && cfgDe.intro) p.textContent = cfgDe.intro; if (cfgDe.h1) document.title = cfgDe.h1 + ' · Verse'; }
  readQuery(); drawRecent(); addEventListener('popstate', () => { readQuery(); draw(); });
  if (S.repo && document.getElementById('c-repo')) await draw();
  document.documentElement.dataset.codeReady = '1'; keepForOffline();
}
