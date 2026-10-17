// The 3D frame budget (owner, 2026-10-15: "the 3D for the board games is still choppy and laggy on all devices"): opens the
// chess board in installed Chrome, desktop and a 3x phone, and fails if the work per frame regresses:
//  - an idle board draws nothing; an orbit frame is one pass (the key-light shadow is not redrawn while only the camera moves)
//  - the board never draws above MAX_DPR (1.5) pixels per CSS pixel, so a 3x phone does not draw 4x the pixels
//  - draw calls and triangles per frame stay under the budget below, and the quality governor is there
// Work is counted, not timed, so a slow shared runner can't flake it. tools/perf3d.mjs measures fps and p95 for people.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { routeOutside, voidApiReply } from './fixtures/outside.mjs';
import { acquire as acquireHeavy } from './heavy.mjs';
await acquireHeavy('3D frame budget (perf3d.test.mjs)'); // one heavy browser job at a time on this machine (tools/heavy.mjs); released when this process exits

export const BUDGET = { calls: 60, triangles: 120000, shadowPassesPerOrbitFrame: 0.1, maxDpr: 1.5 };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const exe = [process.env.VOID_TEST_BROWSER, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip 3D frame budget: no Chrome'); process.exit(0); }
const T = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0; const check = (name, ok, got) => { console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(got))); if (!ok) bad++; };
try {
  for (const phone of [false, true]) {
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1280, height: 860 } });
    await routeOutside(ctx);
    await ctx.route(/^http:\/\/127\.0\.0\.1:\d+\/api\//, (r) => r.fulfill(voidApiReply(r.request().url()) || { status: 404, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage(); await p.goto(base); await p.waitForTimeout(800);
    await p.fill('#input', 'play chess'); await p.keyboard.press('Enter');
    const up = await p.waitForFunction(() => { const l = window.__voidMini && window.__voidMini.list(); return l && l.some((x) => x.rendered && x.kind === 'chess'); }, null, { timeout: 120000 }).then(() => true, () => false);
    const tag = phone ? 'phone' : 'desktop';
    if (!up) { check('3D frame budget (' + tag + '): the chess board draws', false, 'no frame'); await ctx.close(); continue; }
    await p.waitForTimeout(2500);
    const m = await p.evaluate(async () => {
      const S = await import('/skills/scene3d.js'), E = await S.engine(), R = E.renderer;
      const me = () => S.liveMiniatures().find((x) => x.kind === 'chess');
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 40 && me().draws && (await (async () => { const d = me().draws; await wait(300); return me().draws !== d; })()); i++); // settle
      const d0 = me().draws; await wait(1500); const idle = me().draws - d0;
      const c = document.querySelector('.void-mini[data-kind="chess"] canvas'), r = c.getBoundingClientRect();
      const orig = R.render.bind(R); let mains = 0, shadows = 0, calls = 0, tris = 0;
      R.render = (sc, cam) => { const main = R.getRenderTarget() === null, sh = R.shadowMap.needsUpdate || R.shadowMap.autoUpdate; orig(sc, cam); if (main) { mains++; if (sh) shadows++; calls = Math.max(calls, R.info.render.calls); tris = Math.max(tris, R.info.render.triangles); } };
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2; ev('pointerdown', cx, cy);
      for (let k = 1; k <= 30; k++) { ev('pointermove', cx + k * 3, cy); await new Promise((res) => requestAnimationFrame(res)); }
      ev('pointerup', cx + 90, cy); await wait(600); R.render = orig;
      const q = await S.quality();
      return { idle, mains, shadows, calls, tris, dprUsed: c.width / r.width, maxDpr: S.MAX_DPR, steps: S.QUALITY_STEPS, q };
    });
    check('3D frame budget (' + tag + '): an idle chess board draws nothing', m.idle === 0, m);
    check('3D frame budget (' + tag + '): an orbit redraws the view without redrawing the shadow map', m.mains >= 3 && m.shadows / m.mains <= BUDGET.shadowPassesPerOrbitFrame, m);
    check('3D frame budget (' + tag + '): at most ' + BUDGET.maxDpr + 'x pixels per CSS pixel', m.maxDpr <= BUDGET.maxDpr && m.dprUsed <= BUDGET.maxDpr + 0.02, m);
    check('3D frame budget (' + tag + '): at most ' + BUDGET.calls + ' draw calls and ' + BUDGET.triangles + ' triangles a frame', m.calls > 0 && m.calls <= BUDGET.calls && m.tris <= BUDGET.triangles, m);
    check('3D frame budget (' + tag + '): the quality governor is running (steps down when frames run late)', Array.isArray(m.steps) && m.steps[0] === 1 && m.q && typeof m.q.quality === 'number', m);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
process.exit(bad ? 1 : 0);
