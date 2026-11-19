// The rival list and the side-by-side live inside the owner-only Versus (/versus/?view=rival, /versus/?view=compare). The old addresses redirect there,
// the rival feature files answer only the owner, and the sitemap no longer lists the old pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRedirects, redirectTo } from '../void-live-deploy/lib/page-pass.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';

const D = new URL('../void-live-deploy/', import.meta.url);
const read = (p) => readFileSync(new URL(p, D), 'utf8');

test('/rival/ and /compare/ are no longer pages; they redirect into /versus/ and keep the question asked', () => {
  assert.ok(!existsSync(new URL('rival/index.html', D)) && !existsSync(new URL('compare/index.html', D)));
  const t = parseRedirects(read('_redirects'));
  assert.deepEqual(redirectTo(t, '/rival/', '').to, '/versus/?view=rival');
  assert.deepEqual(redirectTo(t, '/rival/', '?site=abc.com'), { to: '/versus/?view=rival&site=abc.com', status: 301 });
  assert.deepEqual(redirectTo(t, '/compare/', '?floor=x'), { to: '/versus/?view=compare&floor=x', status: 301 });
  assert.equal(redirectTo(t, '/compare', '').status, 301);
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
