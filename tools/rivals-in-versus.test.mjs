// The rival list and the side-by-side live inside the owner-only Versus (/versus/?view=rival, /versus/?view=compare). The old addresses redirect there,
// the rival feature files answer only the owner, and the sitemap no longer lists the old pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { movedTo, MOVED_PATHS } from '../void-live-deploy/lib/versus-moved.js';
import { onRequest } from '../void-live-deploy/functions/_middleware.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';

const D = new URL('../void-live-deploy/', import.meta.url);
const read = (p) => readFileSync(new URL(p, D), 'utf8');

test('/rival/ and /compare/ are no longer pages; they redirect into /versus/ and keep the query, so an old bookmark lands on the same view', async () => {
  assert.ok(!existsSync(new URL('rival/index.html', D)) && !existsSync(new URL('compare/index.html', D)));
  assert.deepEqual(movedTo('/rival/', ''), { to: '/versus/?view=rival', status: 301 });
  assert.deepEqual(movedTo('/rival/', '?site=abc.com'), { to: '/versus/?view=rival&site=abc.com', status: 301 });
  assert.deepEqual(movedTo('/compare', '?floor=x'), { to: '/versus/?view=compare&floor=x', status: 301 });
  assert.deepEqual(movedTo('/assimilated/', '?q=abc'), { to: '/versus/?view=assimilated&q=abc', status: 301 });
  assert.equal(movedTo('/versus/', ''), null);
  assert.deepEqual(movedTo('/tower/', ''), { to: '/versus/?view=growth', status: 301 });
  // _redirects runs before any function on Cloudflare and drops the query, so these paths are not in it; they reach the middleware through _routes.json
  assert.doesNotMatch(read('_redirects'), /^\/(rival|compare)\/? /m);
  const include = JSON.parse(read('_routes.json')).include;
  for (const p of MOVED_PATHS) assert.ok(include.includes(p), p + ' goes to the middleware');
  const res = await onRequest({ request: new Request('https://a-to-mind.com/rival/?site=abc.com'), env: {}, next: () => new Response('static') });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://a-to-mind.com/versus/?view=rival&site=abc.com');
});

test('the sitemap builder lists neither old page', async () => {
  const { pages } = await import('./sitemap.mjs');
  const locs = pages().map((p) => p.loc);
  assert.ok(locs.length > 10 && !locs.includes('/rival/') && !locs.includes('/compare/'));
});

test('/versus/ opens the rival and side-by-side views only after the owner gate has answered', () => {
  const html = read('versus/index.html');
  assert.match(html, /const model = await ownerModel\(\);[\s\S]*model && view === 'rival'[\s\S]*model && view === 'compare'/);
  assert.ok(existsSync(new URL('versus/rivals.js', D)) && existsSync(new URL('versus/compare.js', D)));
  assert.match(read('_routes.json'), /"\/versus\/rivals\.js"/);
});

test('the rival feature files are owner-only files (lib/owner-gate.js, tools/owner-gate.test.mjs)', () => {
  assert.ok(ownerOnlyPath('/rivals/index.json') && ownerOnlyPath('/rivals/abc.com.json'));
});

test('what /versus/ sends a visitor has no static import of the file that lists the sites; it loads after the owner gate says yes', () => {
  for (const f of ['versus/index.html', 'versus/open.js']) assert.doesNotMatch(read(f), /^\s*import[^\n]*versus-floor\.js|modulepreload" href="\/lib\/versus-floor\.js/m, f);
  assert.match(read('versus/open.js'), /await import\('\.\.\/lib\/versus-floor\.js'\)/);
  assert.match(read('versus/index.html'), /await import\('\/lib\/versus-floor\.js'\)/);
});

test('the assimilated list is an owner-only Versus view; its phone layout cannot push the page sideways', () => {
  assert.ok(!existsSync(new URL('assimilated/index.html', D)), '/assimilated/ is no longer a page');
  assert.match(read('versus/index.html'), /model && view === 'assimilated'[\s\S]*import\('\/versus\/assimilated\.js'\)/);
  assert.ok(ownerOnlyPath('/versus/assimilated.js') && ownerOnlyPath('/assimilated.json'));
  assert.match(read('_routes.json'), /"\/versus\/assimilated\.js"/);
  // the phone check found a status text that cannot wrap ("measured ahead, still being checked") stretching the table past a 390 px window
  const css = read('versus/assimilated.js').match(/@media \(max-width: 640px\) \{([^`]*?)\}\s*<\/style>/)[1];
  assert.match(css, /\.as table, \.as tbody \{ display: block; \}/);
  assert.match(css, /\.as \.st \{ white-space: normal; \}/);
});

test('obituaries and lineage is an owner-only Versus view, with the files it reads', () => {
  assert.ok(!existsSync(new URL('obituaries/index.html', D)), '/obituaries/ is no longer a page');
  assert.match(read('versus/index.html'), /model && view === 'obituaries'[\s\S]*import\('\/versus\/obituaries\.js'\)/);
  for (const f of ['/versus/obituaries.js', '/parity.json', '/tower.evidence.json', '/history/abc.com.json', '/lib/tower.js']) assert.ok(ownerOnlyPath(f), f);
  for (const f of ['/versus/obituaries.js', '/parity.json']) assert.ok(JSON.parse(read('_routes.json')).include.includes(f), f + ' goes through the middleware');
  assert.match(read('versus/obituaries.js'), /await import\('\/lib\/tower\.js'\)/, 'the Tower code loads only inside the owner view');
  assert.deepEqual(movedTo('/obituaries/', '?q=abc'), { to: '/versus/?view=obituaries&q=abc', status: 301 });
});
