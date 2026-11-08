// The stage beside the show on /local/ (owner, 2026-11-06: "when bluprints from local tv are opened on stage it would be nice if the show went
// into a card alongside the blueprint so it doesnt stop playing"; local/stage-dock.js). In installed Chrome, on a desktop and a 390 px phone:
// a TV station plays on /local/ (a canvas stream stands in for the station, so no outside stream is needed), Verse's learned idea note shows
// its "blueprint on stage" link, and a plain click must
//  - open the real stage (/?q=blueprint this: ...) in the layer over the page, never leave /local/
//  - keep the SAME <video> element playing, its time still moving on from where it was (no reload, no restart)
//  - put the player beside the stage on a desktop and under it on a phone, with no overlap and nothing sideways
//  - fold away on Back to the stations and on the browser's Back, the show still playing
// and with nothing playing, the link opens the stage the ordinary way.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { routeOutside } from './fixtures/outside.mjs';
import { acquire as acquireHeavy } from './heavy.mjs';
await acquireHeavy('the stage beside the show on /local/ (local-stage-dock.test.mjs)');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip the stage beside the show: no Chrome'); process.exit(0); }
const T = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
let bad = 0; const check = (name, ok, got) => { console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(got))); if (!ok) bad++; };
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const IDEA = { kind: 'idea', topic: 'art provenance tracker', note: 'A small app that tracks where a piece of art has been and who owned it.' };

async function page(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await routeOutside(ctx);
  await ctx.route(/\/api\//, (route) => { const u = route.request().url();
    if (u.includes('/api/watchalong')) return route.fulfill(json({ notes: [IDEA] }));
    if (u.includes('/api/local')) return route.fulfill(json({ ok: false, say: 'Type a town or city to find its stations.' }));
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); });
  const p = await ctx.newPage();
  await p.goto(base + '/local/', { waitUntil: 'load' });
  return { ctx, p };
}
// a TV station "playing": a canvas stream in the page's own player, and the page told so the way local/app.js tells it
const play = (p, state = 'playing') => p.evaluate(async (state) => {
  const v = document.getElementById('video');
  if (!v.srcObject) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); let n = 0;
    setInterval(() => { g.fillStyle = 'hsl(' + (n++ % 360) + ',60%,40%)'; g.fillRect(0, 0, 320, 180); }, 40);
    v.muted = true; v.srcObject = c.captureStream(25); v._mark = 'the-one';
    document.getElementById('screen').hidden = false; document.getElementById('bar').hidden = false;
    await v.play();
  }
  document.dispatchEvent(new CustomEvent('local:now', { detail: { station: { kind: 'tv', cc: 'US', id: 'test.us', name: 'Test TV' }, state, media: v, name: 'Test TV' } }));
}, state);
const videoNow = (p) => p.evaluate(() => { const v = document.getElementById('video'); return { mark: v._mark, paused: v.paused, t: v.currentTime, connected: v.isConnected }; });
const rect = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);

for (const [label, viewport, mobile] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const { ctx, p } = await page(viewport, mobile);
  await play(p);
  await p.waitForSelector('a.w-blueprint', { timeout: 10000 });
  await p.waitForTimeout(800);
  const before = await videoNow(p);
  check(label + ': the show plays before the blueprint opens', !before.paused && before.t > 0.3, before);
  await p.click('a.w-blueprint');
  await p.waitForSelector('#dock-frame', { timeout: 5000 });
  const on = await p.evaluate(() => ({ on: document.documentElement.classList.contains('on-stage'), tv: document.documentElement.classList.contains('stage-tv'), path: location.pathname, src: document.getElementById('dock-frame').getAttribute('src'), name: document.getElementById('show-name').textContent }));
  check(label + ': the stage opens over /local/ with the blueprint ask', on.on && on.tv && on.path === '/local/' && /^\/\?q=blueprint(%20|\+)this/.test(new URL(on.src, base).pathname + new URL(on.src, base).search), on);
  check(label + ': the show card names the station', on.name === 'Test TV', on.name);
  await p.waitForTimeout(1500);
  const during = await videoNow(p);
  check(label + ': the same video keeps playing, its time moving on (no restart)', during.mark === 'the-one' && during.connected && !during.paused && during.t > before.t + 0.8, { before, during });
  const show = await rect(p, '#screen'), stage = await rect(p, '#dock-frame');
  if (label === 'desktop') check(label + ': the show is a card beside the stage, not over it', show && stage && show.l >= stage.r - 1 && show.r <= viewport.width && show.w >= 240, { show, stage });
  else check(label + ': the show is a card under the stage, not over it', show && stage && show.t >= stage.b - 1 && show.b <= viewport.height && show.l >= 0 && show.r <= viewport.width, { show, stage });
  const side = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(label + ': nothing sideways', side <= 0, side);
  await p.click('#dock-back');
  await p.waitForTimeout(600);
  const after = await videoNow(p);
  const off = await p.evaluate(() => ({ on: document.documentElement.classList.contains('on-stage'), frame: !!document.getElementById('dock-frame'), path: location.pathname }));
  check(label + ': Back to the stations folds the stage away, the show still playing', !off.on && !off.frame && off.path === '/local/' && after.mark === 'the-one' && !after.paused && after.t > during.t, { off, after });
  // the browser's Back closes it too, and stays on /local/
  await p.click('a.w-blueprint'); await p.waitForSelector('#dock-frame', { timeout: 5000 });
  await p.evaluate(() => history.back()); await p.waitForTimeout(800);
  const back = await p.evaluate(() => ({ on: document.documentElement.classList.contains('on-stage'), path: location.pathname, paused: document.getElementById('video').paused }));
  check(label + ': the browser\'s Back closes the stage and keeps the show', !back.on && back.path === '/local/' && !back.paused, back);
  await ctx.close();
}

// nothing playing (the stream failed): the link is the ordinary link to the stage
{
  const { ctx, p } = await page({ width: 1280, height: 800 }, false);
  await play(p);
  await p.waitForSelector('a.w-blueprint', { timeout: 10000 });
  await play(p, 'failed'); await p.evaluate(() => { document.getElementById('watch').hidden = false; }); // the panel folds on a failed stream; the old link is what is clicked
  await Promise.all([p.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {}), p.click('a.w-blueprint')]);
  check('nothing playing: the link opens the stage itself', new URL(p.url()).pathname === '/', p.url());
  await ctx.close();
}

await browser.close(); server.close();
console.log(bad ? bad + ' failed' : 'the stage beside the show: all passed');
process.exit(bad ? 1 : 0);
