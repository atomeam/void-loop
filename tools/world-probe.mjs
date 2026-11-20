// Opens a /world/ scene in a real browser and checks what it must do: draws with no errors, every part is there and tappable, every behaviour and every
// beyond-reality feature works, and how fast it runs. Takes a screenshot and a short video. node tools/world-probe.mjs [thing] [--tier=full|light] [--out=dir]
// Needs Chrome (CHROME or /usr/bin/google-chrome) and playwright-core. On a computer with no graphics card the speed is a software figure, and the result says so.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../void-live-deploy'), TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const arg = (k, d) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '=' + d).split('=')[1], thing = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'snail';
const tier = arg('tier', 'full'), out = arg('out', '/tmp/world-probe');
const serve = () => new Promise((ok) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }).listen(0, () => ok(s)); });
const { chromium } = await import('playwright-core'), srv = await serve(); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 600 }, recordVideo: { dir: out, size: { width: 960, height: 600 } } }), p = await ctx.newPage(), logs = [];
p.setDefaultTimeout(150000); p.on('pageerror', (e) => logs.push(String(e.message).slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 160)); });
await p.goto('http://localhost:' + srv.address().port + '/world/?thing=' + thing + '&tier=' + tier); await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
const W = (fn, a) => p.evaluate(fn, a), wait = (ms) => p.waitForTimeout(ms), st = () => W(() => window.__world.handle().stats());
await wait(3000); await p.screenshot({ path: path.join(out, thing + '.png') }); const man = await W(() => window.__world.manifest), res = { thing, tier, backend: await W(() => window.__world.backend), parts: {}, behaviors: {}, plus: {} };
res.parts.missing = await W(() => { const h = window.__world.handle(), have = h.parts(); return window.__world.manifest.parts.map((x) => x.id).filter((id) => !have.includes(id) || !window.__world.pickPart(id)); });
const s0 = await st(); await wait(2500); const s1 = await st(); res.behaviors['crawl-waves'] = s1.pos.x !== s0.pos.x || s1.pos.z !== s0.pos.z; res.behaviors['mucus-trail'] = s1.trail > 0;
await p.mouse.click(820, 270); await p.waitForFunction(() => window.__world.handle().stats().food > 0, null, { timeout: 8000 }).catch(() => {}); res.behaviors['steer-and-seek-food'] = (await st()).food > 0; res.plus['tap-to-feed'] = res.behaviors['steer-and-seek-food'];
await W(() => window.__world.setTime(0)); await wait(500); const t0 = await st(); await wait(1500); res.plus['slow-time'] = (await st()).time - t0.time < 0.2; await W(() => window.__world.setTime(3));
await W(() => window.__world.setToggle('xray', true)); await wait(800); res.plus['see-inside'] = (await st()).xray === true; await p.screenshot({ path: path.join(out, thing + '-inside.png') }); await W(() => window.__world.setToggle('xray', false));
await W(() => window.__world.setToggle('glass', true)); await wait(800); res.plus['look-up-through-glass'] = (await st()).glass === true; await W(() => window.__world.setToggle('glass', false));
await W(() => window.__world.setVar('temp', 0)); await p.waitForFunction(() => window.__world.handle().stats().retreat > 0.8, null, { timeout: 45000 }).catch(() => {}); res.behaviors['retreat-and-seal'] = (await st()).retreat > 0.8; res.plus['change-weather'] = res.behaviors['retreat-and-seal']; await p.screenshot({ path: path.join(out, thing + '-sealed.png') }); await W(() => window.__world.setVar('temp', 16)); await wait(500);
res.plus['facts-with-sources'] = (await W(() => window.__world.manifest.facts.length)) >= 10;
await wait(1500);
res.fps = Math.round(await W(() => window.__world.fps)); res.errors = [...(await W(() => window.__world.errors)), ...logs]; res.note = 'speed is as measured on this computer; with no graphics card it is a software figure';
const flat = (o) => Object.values(o).flatMap((v) => (typeof v === 'boolean' ? [v] : [])); res.ok = res.parts.missing.length === 0 && res.errors.length === 0 && [...flat(res.behaviors), ...flat(res.plus)].every(Boolean);
const vid = p.video(); await ctx.close(); await b.close(); srv.close(); if (vid) { const f = await vid.path(); fs.renameSync(f, path.join(out, thing + '.webm')); }
console.log(JSON.stringify(res)); process.exit(res.ok ? 0 : 1);
