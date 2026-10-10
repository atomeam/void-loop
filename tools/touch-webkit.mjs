// Ringer by touch in WebKit (the engine under iOS Safari): the same checks tools/test_3d.mjs runs in Chromium with real
// touch events (ringerTouch). WebKit has no touch emulation, so here a finger is touch-type pointer events dispatched where
// the finger is, which is what the ring's code listens for; the camera drag after a cancelled touch is a real mouse drag.
// CI runs it when Ringer changes (.github/workflows/touch-webkit.yml). Run: node tools/touch-webkit.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from 'playwright-core';
import { ringerTouch } from './test_3d.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  let f = path.join(root, p);
  if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await webkit.launch({ headless: true });

// a fresh page with the network stubbed: nothing leaves the machine, and the ring needs none of it
async function fresh() {
  const ctx = await browser.newContext({ hasTouch: true });
  await ctx.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/, (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base); await p.waitForTimeout(700);
  const ask = async (t, w = 450) => { await p.fill('#input', t); await p.keyboard.press('Enter'); await p.waitForTimeout(w); };
  return { ctx, p, ask, errors };
}

// a finger as touch-type pointer events: down where it lands, moves and the lift to the element it went down on (a touch
// is captured by where it started), a cancel to the same
async function webkitTouch(F) {
  await F.p.evaluate(() => {
    // a dispatched pointer is not one the browser knows, so capturing it throws (OrbitControls captures every pointer it
    // takes); capture calls for these test pointers (ids from 20) do nothing, real pointers are untouched
    for (const fn of ['setPointerCapture', 'releasePointerCapture']) { const real = Element.prototype[fn]; Element.prototype[fn] = function (id) { if (id >= 20) return; return real.call(this, id); }; }
    const has = Element.prototype.hasPointerCapture; Element.prototype.hasPointerCapture = function (id) { return id >= 20 ? false : has.call(this, id); };
    const live = new Map();
    const fire = (type, el, pt) => el.dispatchEvent(new PointerEvent(type, { pointerId: 20 + (pt.id || 0), pointerType: 'touch', isPrimary: !pt.id, clientX: pt.x, clientY: pt.y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, width: 12, height: 12, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true, composed: true }));
    window.__finger = {
      start(pts) { for (const pt of pts) if (!live.has(pt.id || 0)) { const el = document.elementFromPoint(pt.x, pt.y) || document.body; live.set(pt.id || 0, { el, pt }); fire('pointerdown', el, pt); } },
      move(pts) { for (const pt of pts) { const t = live.get(pt.id || 0); if (t) { t.pt = pt; fire('pointermove', t.el, pt); } } },
      end(type) { for (const [, t] of live) fire(type, t.el, t.pt); live.clear(); },
    };
  });
  const call = (fn, arg) => F.p.evaluate(([f, a]) => window.__finger[f](a), [fn, arg]);
  return {
    start: (pts) => call('start', pts), move: (pts) => call('move', pts), end: () => call('end', 'pointerup'), cancel: () => call('end', 'pointercancel'),
    orbit: async (a, b) => { await F.p.mouse.move(a.x, a.y); await F.p.mouse.down(); for (let i = 1; i <= 6; i++) await F.p.mouse.move(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6); await F.p.mouse.up(); },
  };
}

let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n  ' + String(got).slice(0, 2000))); if (!ok) bad++; };
await ringerTouch({ check, fresh, touchInput: webkitTouch, label: ' (WebKit)' });
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
