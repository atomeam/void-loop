import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missingIn, culprit, run, PAGES } from './guards/home.mjs';

const root = new URL('../', import.meta.url).pathname, page = readFileSync(root + 'void.html', 'utf8');
const rd = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

test('the page as it stands has the starfield as its default and the corner heart', () => {
  assert.deepEqual(missingIn(page), []);
  for (const f of PAGES) assert.deepEqual(missingIn(readFileSync(root + f, 'utf8')), [], f);
});
test('each way of losing one is named', () => {
  assert.match(missingIn(page.replace("fx: 'field'", "fx: 'off'")).join(), /not the default look/);
  assert.match(missingIn(page.replace(/<a id="void-anchor"/, '<a hidden id="void-anchor"')).join(), /heart is hidden/);
  assert.match(missingIn(page.replace(/<a id="void-anchor"[^>]*>/, '')).join(), /heart is gone/);
  assert.match(missingIn(page + '\n#void-anchor { display: none; }').join(), /hidden by a style/);
  assert.match(missingIn(page.split("import('/lib/void-cosmos.js')").join("import('/lib/x.js')")).join(), /engine is not loaded/);
  assert.ok(missingIn('').length >= 3);
});
test('the culprit is the newest change that took one away from a whole page', () => {
  const pages = { c4: page, c3: page, c2: page.replace(/<a id="void-anchor"[^>]*>/, ''), c1: page.replace(/<a id="void-anchor"[^>]*>/, ''), c0: page };
  assert.equal(culprit(['c1', 'c2', 'c3', 'c4'], (c) => pages[c]), 'c2');
  assert.equal(culprit(['c4', 'c3'], (c) => pages[c]), null);
  assert.equal(culprit(['c1', 'c2'], () => null), null);
});

const mkCtx = (over = {}) => {
  const jobs = [], reverts = [];
  return { jobs, reverts, ctx: { root, site: 'https://x.test', now: 1, dry: false, read: rd, chrome: '/none', loadPlaywright: async () => null, queueJob: async (a, t) => { jobs.push(t); return { queued: true, why: '' }; }, revertOnBranch: (sha, br, why, check) => { reverts.push([sha, br, why]); return { pushed: true, branch: br }; }, ...over } };
};
test('whole page and no browser: it says so and does nothing', async () => {
  const { ctx, jobs, reverts } = mkCtx();
  const r = await run(ctx);
  assert.match(r.last, /in all three copies/);
  assert.match(r.last, /Live look skipped/);
  assert.equal(jobs.length + reverts.length, 0);
});
test('a page that lost the heart with no culprit in reach goes to the coder, and nothing is removed', async () => {
  const { ctx, jobs, reverts } = mkCtx({ read: (p) => (p.endsWith('void-live-deploy/index.html') ? page.replace(/<a id="void-anchor"[^>]*>/, '') : rd(p)) });
  const r = await run(ctx);
  assert.match(r.last, /lost something it keeps: the corner heart is gone/);
  assert.deepEqual(jobs, ['heal:home-page']);
  assert.equal(reverts.length, 0);
});
