// The calendar embed (void-live-deploy/calendar/embed/): the one page other sites may frame. Run: node --test tools/embed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../void-live-deploy/', import.meta.url).pathname, read = (f) => readFileSync(root + f, 'utf8');
/** the Content-Security-Policy headers a path gets from _headers, as Cloudflare applies them: every matching block in order, a line "! Content-Security-Policy" dropping what came before. */
function cspFor(urlPath) {
  let on = false, out = [];
  for (const l of read('_headers').split('\n')) {
    if (/^\s*#/.test(l) || !l.trim()) continue;
    if (/^\S/.test(l)) { const p = l.trim(); on = p === urlPath || (p.endsWith('*') && urlPath.startsWith(p.slice(0, -1))); continue; }
    if (!on) continue; const t = l.trim();
    if (t === '! Content-Security-Policy') out = []; else if (/^Content-Security-Policy:/.test(t)) out.push(t.slice('Content-Security-Policy:'.length).trim());
  }
  return out;
}
test('the embed page is framable by any site, and nothing else on the site is', () => {
  const e = cspFor('/calendar/embed/'); assert.equal(e.length, 1, 'one policy, the site-wide one dropped'); assert.match(e[0], /frame-ancestors \*/);
  assert.match(e[0], /default-src 'none'/); assert.match(e[0], /script-src 'self'(?:;|$)/); assert.doesNotMatch(e[0], /script-src[^;]*unsafe-inline/); assert.match(e[0], /connect-src 'self'/); assert.match(e[0], /form-action 'none'/); assert.match(e[0], /base-uri 'none'/);
  for (const p of ['/', '/calendar/', '/recipes/', '/api/calshare', '/calendar/embed.js']) for (const c of cspFor(p)) assert.match(c, /frame-ancestors 'self' chrome-extension:/, p + ' stays unframable');
  const blocks = read('_headers').split('\n').filter((l) => /^\S/.test(l) && !l.startsWith('#')).length; assert.ok(blocks < 80, 'the rule budget');
  assert.equal([...read('_headers').matchAll(/frame-ancestors \*/g)].length, 1, 'only the embed loosens it');
});
test('the embed page and its script: no inline script, no form, no picture, no HTML built from text, nothing but the calendar\'s own library', () => {
  const html = read('calendar/embed/index.html'), js = read('calendar/embed/embed.js');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'no inline script'); assert.ok(!/<(?:form|img|iframe|object|embed|link)\b/i.test(html)); assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|localStorage|sessionStorage|method:\s*['"](?:POST|PUT|DELETE)/.test(js), 'it only reads, and draws text');
  assert.deepEqual([...js.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['/lib/calendar.js', '/lib/calshare.js']);
});
