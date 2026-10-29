// The tower gate's Verse-side measures run against this checkout, before a push (owner, 2026-10-23: test the result the way it will be used): a
// local server for void-live-deploy (with /api/chat, /api/boards and /api/social on a FAKE D1, tools/social-seed.mjs), then for each floor named the
// gate's own measure() (speed, mobile, accessibility, offline, sharing, local language, design polish) and its own answer() for the probe's question,
// askParts, pageParts and facts (tools/tower-probes.mjs). Nothing is written: tower.evidence.json is the gate's on main, after the deploy.
//   node tools/gate-local.mjs chat email social
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
process.env.TOWER_PRIVATE = process.env.TOWER_PRIVATE || fs.mkdtempSync(path.join(os.tmpdir(), 'gate-local-'));
const { chromium } = await import('playwright-core');
const { measure, answer, defects } = await import('./tower-gate.mjs');
const { probeFor, score } = await import('./tower-probes.mjs');
const { FLOORS, aspectsOf } = await import('../void-live-deploy/lib/tower.js');
const chat = await import('../void-live-deploy/functions/api/chat.js'), boards = await import('../void-live-deploy/functions/api/boards/[[path]].js'), social = await import('../void-live-deploy/functions/api/social.js');
const { seeded } = await import('./social-seed.mjs');
const env = await seeded(Date.now());
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
let base = '';
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), route = { '/api/chat': chat, '/api/boards': boards, '/api/social': social }[u.pathname];
  if (route) { const chunks = []; for await (const c of req) chunks.push(c); const r = new Request(base + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '127.0.0.1' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const o = await (req.method === 'POST' ? route.onRequestPost : route.onRequestGet)({ request: r, env, params: {} }); res.writeHead(o.status, { 'content-type': o.headers.get('content-type') || 'application/json' }); return res.end(await o.text()); }
  if (u.pathname.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{}'); }
  let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r)); base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
let fail = 0;
for (const id of process.argv.slice(2)) {
  const f = FLOORS.find((x) => x.id === id), p = probeFor(id); if (!f) { console.log('no floor ' + id); fail = 1; continue; }
  const page = (p && p.verse) || f.page, v = await measure(b, base + page, id.replace(/\W+/g, '-') + '-verse', null, p);
  const line = (k, val, good) => { console.log((good ? 'ok   ' : 'FAIL ') + (id + ' ' + k).padEnd(28) + val); if (!good) fail = 1; };
  console.log('== ' + id + ' at ' + page + ' (aspects: ' + aspectsOf(f).join(', ') + ')');
  line('speed', v.speed + ' ms to the load event (bar 200)', v.speed <= 200); line('reliability', v.reliability + ' of 3', v.reliability === 3); line('mobile', v.mobile + ' px overflow', v.mobile === 0); line('accessibility', v.a11y + ' unnamed', v.a11y === 0);
  line('offline', String(v.offline), v.offline === 1); line('sharing', v.sharing + ' of 4 ' + JSON.stringify(v.shared), v.sharing === 4); line('local language', String(v.german), v.german === 1);
  line('design polish', v.design ? defects(v.design) + ' defects ' + JSON.stringify(v.design) : 'not read', v.design && defects(v.design) === 0);
  if (p && p.ask) { const t = await answer(b, base + p.ask.verse, null); const tr = p.truth ? score(t, p.truth) : null; if (tr) line('accuracy', tr.n + ' of ' + tr.of + (tr.missing.length ? ' missing ' + tr.missing.join('; ') : ''), tr.n === tr.of);
    for (const [a, items] of Object.entries(p.askParts || {})) { const s = score(t, items); line(a, s.n + ' of ' + s.of + (s.missing.length ? ' missing ' + s.missing.join('; ') : ''), s.n === s.of); } }
  for (const [a, pp] of Object.entries((p && p.pageParts) || {})) { const t = await answer(b, base + pp.verse, null); const s = score(t, pp.items); line(a, s.n + ' of ' + s.of + (s.missing.length ? ' missing ' + s.missing.join('; ') : ''), s.n === s.of); }
  if (p && p.facts && p.facts.length) { const s = score(v.text, p.facts); line('completeness', s.n + ' of ' + s.of + (s.missing.length ? ' missing ' + s.missing.join('; ') : ''), s.n === s.of); }
  const unmeasured = aspectsOf(f).filter((a) => !['speed', 'reliability', 'mobile', 'accessibility', 'offline', 'sharing', 'local language', 'design polish', 'big answer', 'accuracy', 'completeness'].includes(a) && !(p && ((p.askParts || {})[a] || (p.pageParts || {})[a] || (p.parts || {})[a])));
  if (unmeasured.length) console.log('     ' + id + ' unverified (no check): ' + unmeasured.join(', '));
}
await b.close(); srv.close(); process.exit(fail);
