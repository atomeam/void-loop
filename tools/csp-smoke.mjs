// Loads the site's pages with the real _headers CSP applied (served from void-live-deploy/ on a local port) and fails on
// any CSP violation: the home page with its 3D, /films/, /store/ and a Gumroad-style embed frame. Needs Chrome
// (playwright-core). Outside requests are answered empty, so it runs offline.
//   node tools/csp-smoke.mjs                         local copy, outside requests answered empty
//   CSP_BASE=https://a-to-mind.com node tools/csp-smoke.mjs   the live site, real third parties, its own headers
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../void-live-deploy');
export function headerFor(file = path.join(root, '_headers')) {
  const lines = fs.readFileSync(file, 'utf8').split('\n'); const out = {}; let inAll = false;
  for (const l of lines) { if (/^\S/.test(l)) inAll = l.trim() === '/*'; else if (inAll && l.includes(':')) { const i = l.indexOf(':'); out[l.slice(0, i).trim()] = l.slice(i + 1).trim(); } }
  return out;
}
/** the headers a path gets: every block whose path is the path itself or a matching splat; a CSP from several blocks is sent twice (both enforced, as Cloudflare does),
 *  and a `! Name` line in a later block drops the Name an earlier block set (Cloudflare's detach), so that block's own value is the only one sent */
export function headersFor(urlPath, file = path.join(root, '_headers')) {
  const out = {}; let on = false;
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s*#/.test(l) || !l.trim()) continue;
    if (/^\S/.test(l)) { const p = l.trim(); on = p === urlPath || (p.endsWith('*') && urlPath.startsWith(p.slice(0, -1))); continue; }
    if (!on) continue;
    const d = l.match(/^\s*!\s*(\S+)\s*$/); if (d) { delete out[d[1]]; continue; }
    const i = l.indexOf(':'), k = l.slice(0, i).trim(), v = l.slice(i + 1).trim();
    out[k] = out[k] ? [].concat(out[k], v) : v;
  }
  return out;
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
if (import.meta.url === 'file://' + process.argv[1]) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json', ...headersFor('/api/') }); return res.end('{}'); }
    let f = path.join(root, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', ...headersFor(p) }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const port = srv.address().port, BASE = process.env.CSP_BASE || `http://127.0.0.1:${port}`;
  const { chromium } = await import('playwright-core');
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((x) => fs.existsSync(x));
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const bad = [];
  for (const page of ['/', '/films/', '/store/']) {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    if (!process.env.CSP_BASE) await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 200, body: '' }));
    pg.on('pageerror', (e) => { if (/Content Security Policy/i.test(String(e))) bad.push(page + ': ' + String(e).slice(0, 200)); });
    pg.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) bad.push(page + ': ' + m.text().slice(0, 200)); });
    await pg.goto(`${BASE}${page}`, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
    if (page === '/') await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://gumroad.com/l/x'; document.body.append(f); const v = document.createElement('iframe'); v.src = 'https://www.youtube-nocookie.com/embed/x'; document.body.append(v); });
    await pg.waitForTimeout(800); await ctx.close();
  }
  await browser.close(); srv.close();
  if (bad.length) { console.log([...new Set(bad)].join('\n')); process.exit(1); }
  console.log('csp-smoke: /, /films/, /store/ and embeds load with no CSP violation');
}
