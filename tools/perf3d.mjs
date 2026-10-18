// node tools/perf3d.mjs [--base URL] [--phone] [--out dir] [--only regex]
// Profiles Verse's 3D boards in installed Chrome: opens each game, waits for its first frame, then measures
// idle (frames drawn while nothing moves) and an orbit drag (fps, frame-time p95, long tasks), plus the renderer's
// draw calls, triangles, textures and geometries. With --trace it also saves a Chrome DevTools performance trace.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const phone = process.argv.includes('--phone'), trace = process.argv.includes('--trace');
const out = arg('--out', '/workspace/void-audit/perf3d'); fs.mkdirSync(out, { recursive: true });
const only = arg('--only') ? new RegExp(arg('--only')) : null;
export const GAMES = [
  { name: 'voidquest', ask: 'play monopoly' }, { name: 'chess', ask: 'play chess' }, { name: 'checkers', ask: 'play checkers' },
  { name: 'aggravation', ask: 'play aggravation' }, { name: 'clock', ask: 'show me a 3d clock' }, { name: 'heart', ask: 'show me a 3d heart' },
];
let base = arg('--base'), server = null;
if (!base) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
  const T = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2' };
  server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise((r) => server.once('listening', r)); base = 'http://127.0.0.1:' + server.address().port + '/';
}
const browser = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const results = [];
for (const g of GAMES) {
  if (only && !only.test(g.name)) continue;
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1440, height: 900 } });
  if (!/127\.0\.0\.1/.test(base)) await ctx.route(/\/api\//, (r) => r.continue());
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(base); await p.waitForTimeout(1500);
  await p.fill('#input', g.ask); await p.keyboard.press('Enter');
  const ok = await p.waitForFunction(() => { const l = window.__voidMini && window.__voidMini.list(); return l && l.some((x) => x.rendered); }, null, { timeout: 90000 }).then(() => true, () => false);
  if (!ok) { results.push({ game: g.name, error: 'no 3D frame' }); console.log(JSON.stringify({ game: g.name, error: 'no 3D frame' })); await ctx.close(); continue; }
  await p.waitForTimeout(4000); // textures upload, intro animation settles
  if (trace) await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame,gpu,blink', transferMode: 'ReturnAsStream' });
  const m = await p.evaluate(async () => {
    const S = await import('/skills/scene3d.js'); const E = await S.engine(); const info = E.renderer.info;
    const mini = () => S.liveMiniatures().find((x) => x.rendered && x.visible);
    const lt = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(e.duration); }); try { po.observe({ type: 'longtask', buffered: false }); } catch (_) {}
    const frames = async (ms) => { const ts = []; const end = performance.now() + ms; await new Promise((res) => { const f = (t) => { ts.push(t); if (t < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return ts.slice(1).map((t, i) => t - ts[i]); };
    // idle: how many times the board redraws while nobody touches it
    const d0 = mini().draws; await frames(2000); const idleDraws = mini().draws - d0;
    info.autoReset = true;
    // drag-orbit the board for 3 s (synthetic pointer events on its canvas), counting real redraws
    const key = mini().key, c = document.querySelector('.void-mini[data-key="' + CSS.escape(key) + '"] canvas'), r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    // every main pass the renderer draws is timed: frame gaps are the gaps between them
    const R = E.renderer, orig = R.render.bind(R), stamps = []; let shadowPasses = 0, mainCalls = 0;
    R.render = (sc, cam) => { const main = R.getRenderTarget() === null; const sh = R.shadowMap.needsUpdate || R.shadowMap.autoUpdate; const c0 = R.info.render.calls; orig(sc, cam); if (main) { stamps.push(performance.now()); mainCalls += R.info.render.calls; if (sh) shadowPasses++; } };
    ev('pointerdown', cx, cy); const a0 = mini().draws; const t0 = performance.now(); let k = 0;
    await new Promise((res) => { const f = () => { k++; ev('pointermove', cx + Math.sin(k / 12) * r.width * 0.3, cy + Math.cos(k / 17) * r.height * 0.1); if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    ev('pointerup', cx, cy); R.render = orig; const secs = (performance.now() - t0) / 1000; const draws = mini().draws - a0; const ft = stamps.slice(1).map((x, i) => x - stamps[i]);
    const ms = mini().ms; po.disconnect();
    const cnt = E.canvas; return { idleDraws, drag: { secs, drawFps: draws / secs, p95: 0, frames: ft.slice(1), shadowPassesPerDraw: Math.round(shadowPasses / Math.max(1, stamps.length) * 100) / 100, callsPerDraw: Math.round(mainCalls / Math.max(1, stamps.length)) }, lastDrawMs: ms, longTasks: lt.length, longTaskMs: Math.round(lt.reduce((a, b) => a + b, 0)),
      triangles: info.render.triangles, textures: info.memory.textures, geometries: info.memory.geometries, programs: (info.programs || []).length,
      mini: { w: mini().w, h: mini().h, canvasPx: c.width + 'x' + c.height }, engineCanvas: cnt.width + 'x' + cnt.height, dpr: devicePixelRatio, gpu: (() => { try { const gl = E.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(d.UNMASKED_RENDERER_WEBGL); } catch (_) { return '?'; } })() };
  });
  if (trace) { const done = new Promise((res) => cdp.once('Tracing.tracingComplete', res)); await cdp.send('Tracing.end'); const { stream } = await done; let data = ''; for (;;) { const c = await cdp.send('IO.read', { handle: stream }); data += c.data; if (c.eof) break; } fs.writeFileSync(path.join(out, g.name + (phone ? '-phone' : '') + '.trace.json'), data); }
  m.drag.p95 = Math.round(pct(m.drag.frames, 0.95) * 10) / 10; m.drag.avgMs = Math.round(m.drag.frames.reduce((a, b) => a + b, 0) / Math.max(1, m.drag.frames.length) * 10) / 10; delete m.drag.frames;
  m.drag.secs = Math.round(m.drag.secs * 10) / 10; m.drag.drawFps = Math.round(m.drag.drawFps);
  await p.screenshot({ path: path.join(out, g.name + (phone ? '-phone' : '-desktop') + '-' + (arg('--tag') || 'run') + '.png') });
  results.push({ game: g.name, ...m }); console.log(JSON.stringify({ game: g.name, ...m }));
  await ctx.close();
}
await browser.close(); if (server) server.close();
fs.writeFileSync(path.join(out, (arg('--tag') || 'run') + (phone ? '-phone' : '-desktop') + '.json'), JSON.stringify(results, null, 1));
