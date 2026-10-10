// Runs only the accessibility flows (tools/a11y-flows.mjs) against void-live-deploy served locally, with outside services answered by stand-ins,
// and prints the report in about half a minute. tools/test_void.mjs runs the same flows inside the full suite.
//   node tools/a11y-run.mjs          prints every step: ok or SHORT with how it falls short
//   node tools/a11y-run.mjs --json   the report as JSON
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { runFlows, formatReport } from './a11y-flows.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  let f = path.join(root, p);
  if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const json = (b) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });

async function fresh() {
  const ctx = await browser.newContext();
  await ctx.route(/\/skills\/scene3d\.js(?:\?|$)/, (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/, (r) => {
    const u = r.request().url();
    if (u.includes('/w/api.php')) return r.fulfill(json({ query: { search: [{ title: 'Black hole' }] } }));
    if (u.includes('/page/summary/')) return r.fulfill(json({ title: 'Black hole', extract: 'A region of spacetime where gravity is so strong that nothing can escape.', timestamp: '2026-09-20T10:00:00Z' }));
    return r.fulfill(json({}));
  });
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base); await p.waitForTimeout(700);
  return { ctx, p, errors };
}
let report, code = 0;
try { report = await runFlows(fresh); } catch (e) { console.error('the flows could not run:', e); code = 1; }
if (report) console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 1) : 'a11y flows (' + report.filter((x) => x.ok).length + ' of ' + report.length + ' hold):\n' + formatReport(report).split('\n').map((l) => '  ' + l).join('\n'));
await browser.close(); server.close(); process.exit(code);
