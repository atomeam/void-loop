// The site's signposts say only what is true today: /.well-known/security.txt (RFC 9116), /humans.txt, the api-catalog,
// and the 404 page that Cloudflare Pages serves for a path with no file. Each one parses, and every address on a-to-mind.com
// it points at is a file in void-live-deploy or a Pages Function, so a sign never leads to a missing page.
//   node --test tools/well-known.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dep = resolve(root, 'void-live-deploy');
const read = (p) => readFileSync(resolve(dep, p), 'utf8');
const SITE = 'https://a-to-mind.com';

/** the Pages Function routes, from functions/ (functions/api/hook/[id].js -> /api/hook/[id]). */
function functionRoutes() {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  // a _middleware.js wraps the routes beside it and is no route itself (Cloudflare Pages Functions)
  return walk(join(dep, 'functions')).filter((f) => f.endsWith('.js') && !f.endsWith('_middleware.js')).map((f) => '/' + f.slice(join(dep, 'functions').length + 1).replace(/\\/g, '/').replace(/\.js$/, '').replace(/\/index$/, ''));
}
const FN = functionRoutes();
// only the paths _routes.json sends to Functions reach one (functions/[handle].js would match any one-segment path otherwise)
const ROUTED = JSON.parse(read('_routes.json')).include.map((g) => new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));

/** does this site path resolve to something real: a static file as Pages serves it, or a function route? Pure but for the disk. */
export function exists(path) {
  const p = decodeURIComponent(String(path).split(/[?#]/)[0]);
  if (p === '/') return true;
  const f = join(dep, p);
  if (!f.startsWith(dep)) return false;
  if (existsSync(f) && statSync(f).isFile()) return true;
  if (existsSync(join(f, 'index.html'))) return true;
  if (existsSync(f + '.html')) return true;
  return ROUTED.some((re) => re.test(p)) && FN.some((r) => r === p || (r.includes('[') && new RegExp('^' + r.replace(/\[\[[^\]]+\]\]/g, '.*').replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(p)));
}

/** RFC 9116 fields of a security.txt: { field: [values] }; comments and blank lines skipped. Pure. */
export function parseSecurityTxt(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const m = /^([A-Za-z-]+):\s*(.+)$/.exec(l);
    if (!m) throw new Error('not a field line: ' + l);
    (out[m[1].toLowerCase()] ||= []).push(m[2].trim());
  }
  return out;
}

const siteLinks = (text) => [...text.matchAll(/https:\/\/a-to-mind\.com(\/[^\s"'<>)]*)?/g)].map((m) => m[1] || '/');

test('exists() knows files, folders with index.html and function routes, and refuses what is not there', () => {
  assert.ok(exists('/api/mcp/server-card'), 'the MCP Server Card route');
  assert.ok(exists('/') && exists('/privacy/') && exists('/llms.txt') && exists('/api/mcp') && exists('/tools.json') && exists('/@someone'));
  assert.ok(!exists('/no-such-page-anywhere') && !exists('/api/no-such-route'));
});

test('security.txt follows RFC 9116 and its contacts are ones the site already publishes', () => {
  const text = read('.well-known/security.txt');
  const f = parseSecurityTxt(text);
  assert.ok(f.contact && f.contact.length >= 1, 'Contact is required');
  for (const c of f.contact) assert.match(c, /^(mailto:|https:\/\/|tel:)/, 'Contact is a URI: ' + c);
  assert.equal((f.expires || []).length, 1, 'exactly one Expires');
  const exp = Date.parse(f.expires[0]);
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(f.expires[0]) && Number.isFinite(exp), 'Expires is an RFC 3339 date-time');
  // a stale file is worse than none: refresh Expires (one year out at most) before it gets within a month of passing
  assert.ok(exp - Date.now() > 30 * 864e5, 'Expires is less than 30 days away (or past): move it one year out');
  assert.ok(exp - Date.now() <= 366 * 864e5, 'Expires is more than a year out (RFC 9116 recommends a year at most)');
  assert.deepEqual(f.canonical, [SITE + '/.well-known/security.txt'], 'Canonical is the file\'s own https address');
  const mails = f.contact.filter((c) => c.startsWith('mailto:')).map((c) => c.slice(7));
  const published = read('privacy/index.html') + read('index.html');
  for (const m of mails) assert.ok(published.includes(m), m + ' is not an address the site already publishes');
  const repo = JSON.parse(readFileSync(resolve(root, 'server.json'), 'utf8')).repository.url;
  for (const c of f.contact.filter((x) => x.startsWith('https://github.com/'))) assert.ok(c.startsWith(repo + '/'), c + ' is not this repository');
  for (const k of ['encryption', 'acknowledgments', 'hiring', 'policy']) assert.ok(!f[k], k + ' points at something that does not exist yet');
  for (const p of siteLinks(text)) assert.ok(exists(p), 'security.txt points at a missing ' + p);
});

test('humans.txt names only what is real: its links exist and the components it names are vendored', () => {
  const text = read('humans.txt');
  assert.match(text, /\/\* TEAM \*\//);
  assert.match(text, /\/\* SITE \*\//);
  for (const p of siteLinks(text)) assert.ok(exists(p), 'humans.txt points at a missing ' + p);
  const vendor = readdirSync(join(dep, 'vendor'));
  if (/three\.js/.test(text)) assert.ok(vendor.some((d) => d.startsWith('three-')), 'three.js is named but not vendored');
  if (/PDF\.js/.test(text)) assert.ok(vendor.some((d) => d.startsWith('pdfjs-')), 'PDF.js is named but not vendored');
  const wrangler = read('wrangler.toml');
  for (const [word, bind] of [['D1', 'd1_databases'], ['KV', 'kv_namespaces'], ['R2', 'r2_buckets'], ['Workers AI', '[ai]']]) {
    if (text.includes(word)) assert.ok(wrangler.includes(bind), word + ' is named but has no binding in wrangler.toml');
  }
});

test('every JSON file in .well-known parses, and the api-catalog points only at things that exist', () => {
  for (const n of readdirSync(join(dep, '.well-known'))) {
    if (n.endsWith('.txt')) continue;
    const j = JSON.parse(read('.well-known/' + n));
    for (const p of siteLinks(JSON.stringify(j))) assert.ok(exists(p), n + ' points at a missing ' + p);
  }
  // gpc.json is a promise to honour Global Privacy Control: if one is ever added it must be the spec's shape
  if (existsSync(join(dep, '.well-known/gpc.json'))) {
    const g = JSON.parse(read('.well-known/gpc.json'));
    assert.equal(typeof g.gpc, 'boolean');
    assert.match(String(g.lastUpdate), /^\d{4}-\d{2}-\d{2}/);
    // the promise is kept only while nothing is sold or shared: the privacy page says both, and links the file
    const priv = read('privacy/index.html');
    assert.match(priv, /do not sell your data and we do not share it for advertising/);
    assert.match(priv, /Global Privacy Control/);
    assert.ok(priv.includes('href="/.well-known/gpc.json"'));
  }
});

test('the 404 page: noindex, no redirect, an ask box that goes to /?q=, and links only to pages that exist', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!/http-equiv=["']?refresh/i.test(html) && !/location\.(href|replace|assign)\s*[=(]/.test(html), 'no redirect away from the missing path');
  assert.match(html, /<form action="\/" method="get"[^>]*>/);
  assert.match(html, /<input[^>]*\bname="q"/);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith('/'));
  assert.ok(hrefs.length >= 4, 'a few real destinations');
  for (const h of hrefs) assert.ok(exists(h), '404.html links to a missing ' + h);
  assert.ok(!/fetch\(|sendBeacon|XMLHttpRequest/.test(html), 'the missing path is shown, never sent anywhere');
});

// every page a function serves outside /api reaches it (2026-10-24: functions/is-it/[what].js was never routed, so /is-it/christmas, its
// feed and its JSON answered with the home page on the live site): a function route with no _routes.json include is dead code
test('every function route outside /api is in _routes.json', () => {
  const dead = FN.filter((r) => !r.startsWith('/api/') && r !== '/[handle]').filter((r) => !ROUTED.some((re) => re.test(r.replace(/\[\[[^\]]+\]\]/g, 'x').replace(/\[[^\]]+\]/g, 'x'))));
  assert.deepEqual(dead, []);
});
