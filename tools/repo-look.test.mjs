// Seeing a repo (lib/repo-look.js, functions/api/repo.js, skills/repo.js) with a FAKE GitHub: the ask parser, the untrusted-text handling,
// the fixed hosts and no redirect elsewhere, the size cap, private/missing, the cache and the rate limit. Run: node --test tools/repo-look.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, repoAsk, readmeSummary, langMix, clean, lookRepo, repoText } from '../void-live-deploy/lib/repo-look.js';
import * as route from '../void-live-deploy/functions/api/repo.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };

const REPO = { full_name: 'acme/widget', description: 'A widget <img src=x onerror=alert(1)> maker', language: 'JavaScript', stargazers_count: 42, forks_count: 3, open_issues_count: 9, default_branch: 'main', pushed_at: '2026-10-01T10:00:00Z', license: { spdx_id: 'MIT' }, topics: ['tool'], private: false };
function github({ repo = REPO, readme = '# widget\n\n[![ci](x)](y)\n\nWidget makes widgets from plain words, fast and small.\n\nMore.', status = 200, bodyOf = null } = {}) {
  const seen = [];
  const f = async (url, init) => {
    seen.push({ url, init });
    const u = new URL(url), p = u.pathname.toLowerCase(), j = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: h });
    assert.equal(u.host, 'api.github.com'); assert.equal(init.redirect, 'manual'); assert.ok(!init.headers.authorization && !init.headers.Authorization, 'no token anywhere');
    if (bodyOf) return bodyOf(p);
    if (p === '/repos/acme/widget') return status === 200 ? j(repo) : j({ message: 'Not Found' }, status);
    if (p.endsWith('/languages')) return j({ JavaScript: 900, HTML: 100 });
    if (p.endsWith('/commits')) return j([{ sha: 'abcdef1234', commit: { message: 'fix: it\n\nbody', author: { name: 'Ann', date: '2026-10-01T00:00:00Z' } } }]);
    if (p.endsWith('/contents/')) return j([{ name: 'README.md', type: 'file' }, { name: 'src', type: 'dir' }]);
    if (p.endsWith('/readme')) return new Response(readme);
    if (p === '/search/issues') return j({ total_count: 4 });
    return j({}, 404);
  };
  f.seen = seen; return f;
}

test('parseRepo and repoAsk take repo names and github links, and leave the rest alone', () => {
  assert.equal(parseRepo('https://github.com/atomeam/void-loop/tree/main/x'), 'atomeam/void-loop');
  assert.equal(parseRepo('github.com/a1/b.c.git'), 'a1/b.c');
  assert.equal(parseRepo('a/b/c'), ''); assert.equal(parseRepo('../etc'), ''); assert.equal(parseRepo('x y/z'), ''); assert.equal(parseRepo('http://evil.com/a/b'), '');
  assert.equal(parseRepo('https://github.com.evil.com/a/b'), '');
  for (const t of ['look at atomeam/void-loop', 'What is in github.com/x/y?', 'https://github.com/x/y', 'show me the repo acme/widget', 'tell me about the repository acme/widget']) assert.ok(repoAsk(t), t);
  for (const t of ['look at the sky', 'look at and/or', 'what is in 24/7', 'look at report/final.pdf', 'add a link https://github.com/x/y', 'https://github.com/settings/profile?x', 'hello', '']) assert.equal(repoAsk(t), '', t);
});

test('untrusted text is cleaned: controls, key shapes, bidi marks, length; the README summary is its first plain paragraph', () => {
  assert.equal(clean('a‮b\u0000c  d'), 'a b c d');
  const fake = 'ghp_' + 'a'.repeat(36); // secret-scan: ok
  assert.ok(!clean('token ' + fake).includes(fake));
  assert.ok(clean('x'.repeat(500), 50).length <= 50);
  assert.equal(readmeSummary('# T\n\n![b](u)\n\n<p>html</p>\n\n```\ncode here that is long enough to count\n```\n\nIt does one real thing well, and says so.\n'), 'It does one real thing well, and says so.');
  assert.deepEqual(langMix({ A: 3, B: 1, C: 0 }), [{ name: 'A', pct: 75 }, { name: 'B', pct: 25 }]);
});

test('lookRepo shapes the facts, fixes hosts and paths, sends no token, and keeps text as data', async () => {
  const f = github(), out = await lookRepo('acme/widget', f);
  assert.ok(out.ok); const r = out.repo;
  assert.equal(r.name, 'acme/widget'); assert.equal(r.stars, 42); assert.equal(r.openPulls, 4); assert.equal(r.openIssues, 5);
  assert.deepEqual(r.langs.map((l) => l.name), ['JavaScript', 'HTML']); assert.equal(r.commits[0].msg, 'fix: it'); assert.equal(r.tree[0].name, 'src');
  assert.match(r.readme, /^Widget makes widgets/); assert.equal(r.description, 'A widget <img src=x onerror=alert(1)> maker', 'kept as text; the page escapes it');
  for (const s of f.seen) assert.match(s.url, /^https:\/\/api\.github\.com\/(repos\/acme\/widget|search\/issues\?)/);
  assert.match(repoText(r), /acme\/widget[\s\S]*Recent commits:[\s\S]*Top level: src\/, README\.md/);
});

test('private, missing, rate-limited and down repos say so plainly; a redirect to another host is not followed', async () => {
  const miss = await lookRepo('acme/widget', github({ status: 404 })); assert.equal(miss.kind, 'missing'); assert.match(miss.say, /only see public repos/);
  assert.equal((await lookRepo('acme/widget', github({ repo: { ...REPO, private: true } }))).kind, 'missing');
  const lim = await lookRepo('acme/widget', async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })); assert.equal(lim.kind, 'limited');
  const evil = await lookRepo('acme/widget', async () => new Response('', { status: 301, headers: { location: 'https://evil.example/x' } })); assert.equal(evil.ok, false);
  let calls = 0; const renamed = await lookRepo('acme/widget', async (u) => { calls++; return calls === 1 ? new Response('', { status: 301, headers: { location: 'https://api.github.com/repositories/123' } }) : new Response(JSON.stringify(REPO)); });
  assert.ok(renamed.ok || calls > 1);
  assert.equal((await lookRepo('../../etc/passwd', async () => assert.fail('no fetch'))).kind, 'missing');
});

test('a huge body is cut at the cap and a bad name never reaches GitHub', async () => {
  const big = 'x'.repeat(2_000_000);
  const out = await lookRepo('acme/widget', github({ readme: big }));
  assert.ok(out.ok); assert.ok(out.repo.readme.length <= 280);
});

const get = (env, r, ip = '1.1.1.1', fetchFn) => route.onRequestGet({ env, fetchFn, request: new Request('https://x/api/repo?r=' + encodeURIComponent(r), { headers: { 'cf-connecting-ip': ip } }) });
test('the route validates, caches a good answer, never caches a failure, and rate-limits fresh lookups', async () => {
  store.clear(); const env = { SALT: 's' }, f = github();
  assert.equal((await get(env, 'not a repo', '1.1.1.1', f)).status, 400);
  const a = await (await get(env, 'https://github.com/Acme/Widget', '1.1.1.1', f)).json(); assert.ok(a.ok);
  const n = f.seen.length; const b = await (await get(env, 'acme/widget', '2.2.2.2', f)).json(); assert.equal(b.cached, true); assert.equal(f.seen.length, n, 'the second look costs GitHub nothing');
  const nf = github({ status: 404 }); store.clear();
  const m = await get(env, 'acme/widget', '3.3.3.3', nf); assert.equal(m.status, 404); assert.equal(store.size === 0 || ![...store.keys()].some((k) => k.includes('__void-repo/acme')), true);
  store.clear(); let last; for (let i = 0; i < route.RL_MAX + 1; i++) last = await get(env, 'acme/widget' + (i % 2 ? '' : ''), '9.9.9.9', github({ status: 404 }));
  assert.equal(last.status, 429);
});

test('the repo card copies and saves as readable words: facts, languages and files apart, sections on their own lines', async () => {
  const { repoHtml } = await import('../void-live-deploy/skills/repo.js');
  const text = repoHtml((s) => String(s), { name: 'acme/widget', language: 'JavaScript', stars: 0, forks: 0, openIssues: 61, openPulls: 6, langs: [{ name: 'JavaScript', pct: 73.2 }, { name: 'HTML', pct: 24.7 }], commits: [{ sha: '890e85', msg: 'Site test' }, { sha: 'd7c97f', msg: 'Merge' }], tree: [{ name: 'docs', dir: true }, { name: 'AGENTS.md' }] }).replace(/<[^>]+>/g, '');
  for (const glued of ['JavaScript0', 'stars0', 'issues6', 'PRsJavaScript', '%HTML', 'commits890e85', '890e85Site', 'leveldocs', 'docs/AGENTS']) assert.ok(!text.includes(glued), glued + ' in: ' + text);
  assert.match(text, /JavaScript 0 stars 0 forks 61 open issues 6 open PRs/);
});
