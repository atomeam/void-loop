import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { refsIn, sliceOf, fileOf, planFor, healTarget, run, WAIT_DEPLOY_MS } from './guards/leaks.mjs';
import { studiedHosts } from '../void-live-deploy/lib/scrub-sites.js';
import { extraServed, scrubFile } from './public-sites.mjs';

const H = studiedHosts()[0], exists = (r) => ['void-live-deploy/skills/guide.json', 'void-live-deploy/echo-vault/index.html'].includes(r);

test('pages and scripts name the files they load', () => {
  assert.deepEqual(refsIn('<script src="/lib/a.js?v=1"></script> import x from "/skills/b.json"; fetch(`/c.txt`)'), ['/lib/a.js', '/skills/b.json', '/c.txt']);
});
test('a long list is read in slices that cover it', () => {
  const list = Array.from({ length: 300 }, (_, i) => i), t = 2 * 3600e3;
  const seen = new Set(); for (let k = 0; k < 3; k++) sliceOf(list, k * t).forEach((x) => seen.add(x));
  assert.equal(seen.size, 300);
  assert.equal(sliceOf([1, 2], 5).length, 2);
});
test('a path maps to the repo file it is served from, and code-built paths map to none', () => {
  assert.equal(fileOf('/skills/guide.json', exists), 'void-live-deploy/skills/guide.json');
  assert.equal(fileOf('/echo-vault/', exists), 'void-live-deploy/echo-vault/index.html');
  assert.equal(fileOf('/api/will', exists), '');
});
test('a static file goes to the deploy scrub; one already there waits for a deploy, then goes to the coder; code-built output goes to the coder', () => {
  const now = Date.UTC(2026, 10, 20, 6);
  assert.deepEqual(planFor('/skills/guide.json', [H], { exists, listed: [] }), { kind: 'scrub', file: 'skills/guide.json' });
  assert.equal(planFor('/skills/guide.json', [H], { exists, listed: ['skills/guide.json'], at: { 'skills/guide.json': new Date(now - 3600e3).toISOString() }, now }).kind, 'wait');
  assert.equal(planFor('/skills/guide.json', [H], { exists, listed: ['skills/guide.json'], at: { 'skills/guide.json': new Date(now - WAIT_DEPLOY_MS - 1).toISOString() }, now }).kind, 'heal');
  assert.equal(planFor('/api/will', [H], { exists, listed: [] }).kind, 'heal');
  assert.equal(planFor('/tower.size.json', [H], { exists, listed: [] }).kind, 'heal');
  assert.match(healTarget('/api/will'), /^heal:leak-api-will$/);
});
test('the deploy scrub takes the listed files too, JSON string by string and the rest as text', () => {
  assert.deepEqual(extraServed(() => JSON.stringify({ files: ['skills/guide.json', '../secret', 'a b'] })), ['skills/guide.json']);
  assert.deepEqual(extraServed(() => 'not json'), []);
  assert.equal(JSON.parse(scrubFile('x.json', JSON.stringify({ a: 'see ' + H }))).a, 'see another site');
  assert.equal(scrubFile('x/index.html', '<a href="https://' + H + '/">' + H + '</a>'), '<a href="another site">another site</a>');
  assert.deepEqual(JSON.parse(readFileSync(new URL('../void-live-deploy/lib/scrub-extra.json', import.meta.url), 'utf8')).files.filter((f) => /\.\./.test(f)), []);
});
test('a sweep that finds a name scrubs the file and logs it; a clean sweep says so', async () => {
  const saved = {}, jobs = [];
  const mk = (leakText) => ({ root: new URL('../', import.meta.url).pathname, now: Date.UTC(2026, 10, 20, 6), read: () => '', save: (f, t) => { saved[f] = t; }, queueJob: async (a, t) => { jobs.push(t); return { queued: true, why: '' }; },
    hit: async (p) => ({ status: p === '/skills/guide.json' ? 200 : 404, text: p === '/skills/guide.json' ? leakText : '', headers: new Headers() }) });
  const dirty = await run(mk('visit ' + H));
  assert.match(dirty.last, /Found a studied site named on 1 path: \/skills\/guide.json/);
  assert.match(dirty.last, /Put 1 file through the deploy scrub/);
  assert.deepEqual(JSON.parse(Object.values(saved)[0]).files, ['skills/guide.json']);
  const clean = await run(mk('nothing here'));
  assert.match(clean.last, /None names a site/);
  assert.equal(jobs.length, 0);
});

test('a script has its comments scrubbed and its code left: a link the page uses is not rewritten', async () => {
  const { scrubCode } = await import('../void-live-deploy/lib/scrub-sites.js');
  const src = '// like ' + H + ' does it\nconst url = "https://' + H + '/x"; // see ' + H + '\n/* ' + H + ' */\n';
  const out = scrubCode(src);
  assert.match(out, /^\/\/ like another site does it\n/);
  assert.ok(out.includes('"https://' + H + '/x"'), 'the code string stays');
  assert.match(out, /\/\/ see another site\n/);
  assert.match(out, /\/\* another site \*\//);
  assert.equal(scrubFile('lib/a.js', src), out);
});
test('a script is scrubbed when a comment names a site, and only counted when its code does', () => {
  const ex = (r) => r === 'void-live-deploy/lib/a.js' || r === 'void-live-deploy/lib/b.js';
  const withComment = '// ' + H + '\nconst x = 1;';
  const codeOnly = 'const u = "https://' + H + '/";';
  assert.equal(planFor('/lib/a.js', [H], { exists: ex, listed: [], text: withComment }).kind, 'scrub');
  assert.equal(planFor('/lib/b.js', [H], { exists: ex, listed: [], text: codeOnly }).kind, 'code');
  assert.equal(planFor('/lib/a.js', [H], { exists: ex, listed: ['lib/a.js'], text: withComment + '\nconst u = "' + H + '";' , at: {}, now: 0 }).kind, 'code');
});
