// game-fun: the fun probe. It PLAYS a full-screen game on a phone screen and measures what makes a game fun instead of "it loads":
// it is ready at once, the first tap starts play, keys and touch move you, the score climbs while you play, there is no long dead
// stretch, the game gets harder, doing nothing loses, a lost game restarts in one tap, there is sound, and it holds its frame rate.
// A game must expose window.__game() (its state) and, under ?probe=1, window.__gameCheat.bot() (where a decent player would aim).
// A game without them cannot be measured, so it fails. tools/game-audit.mjs refuses to list a game whose current update has no pass.
//   node tools/game-fun.mjs <id> [--write] [--ms=30000]   plays /games/<id>/; --write keeps the result in data/game-fun.json
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..'), site = path.join(repo, 'void-live-deploy');
export const RECORD = 'data/game-fun.json';
export const BAR = { readyMs: 1500, startMs: 500, rises: 5, deadMs: 8000, failMs: 60000, sounds: 10, fps: 50 };
/** what failed, in plain words; [] is a pass. Pure. */
export function funChecks(r, bar = BAR) {
  const f = [];
  if (!r || !r.hook) return ['the game has no window.__game() state, so nothing can measure it'];
  if (!(r.readyMs <= bar.readyMs)) f.push('not ready within ' + bar.readyMs + ' ms (' + r.readyMs + ')');
  if (!(r.startMs <= bar.startMs)) f.push('the first tap did not start play within ' + bar.startMs + ' ms');
  if (!r.keys) f.push('the arrow keys do not move the player');
  if (!r.touch) f.push('a finger does not move the player');
  if (!(r.rises >= bar.rises)) f.push('the score rose ' + (r.rises || 0) + ' times in play (need ' + bar.rises + ')');
  if (!(r.deadMs <= bar.deadMs)) f.push('a dead stretch of ' + r.deadMs + ' ms with nothing scored');
  if (!(r.speedEnd > r.speedStart || r.levelEnd > r.levelStart)) f.push('it did not get harder while playing');
  if (!(r.failMs <= bar.failMs)) f.push('doing nothing did not lose within ' + bar.failMs / 1000 + ' s');
  if (!r.again) f.push('a lost game did not restart in one tap');
  if (!r.audio || !(r.sounds >= bar.sounds)) f.push('fewer than ' + bar.sounds + ' sounds in play');
  if (!(r.fps >= bar.fps)) f.push('frame rate ' + r.fps + ' (need ' + bar.fps + ')');
  if (r.errors) f.push(r.errors + ' page error(s): ' + String(r.errorText || '').slice(0, 120));
  return f;
}
/** the record with one probe result. Pure. */
export function withResult(rec, id, update, r, fails, at) {
  const games = { ...((rec && rec.games) || {}) };
  games[id] = { update, pass: fails.length === 0, at, fails, metrics: r };
  return { games };
}
function serve() {
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const s = http.createServer((q, res) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(site, p); if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(s)));
}
export async function probe(id, { ms = 30000, base = '', video = '' } = {}) {
  const { chromium } = await import('playwright-core'); const srv = base ? null : await serve(); const origin = base || 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ headless: true, executablePath: process.env.VOID_TEST_BROWSER || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(video ? { recordVideo: { dir: video, size: { width: 390, height: 844 } } } : {}) });
  const p = await c.newPage(), errors = []; p.on('pageerror', (e) => errors.push(String(e.message)));
  const st = () => p.evaluate(() => window.__game && window.__game()), bot = () => p.evaluate(() => window.__gameCheat && window.__gameCheat.bot && window.__gameCheat.bot());
  const r = { hook: false };
  try {
    const t0 = Date.now(); await p.goto(origin + '/games/' + id + '/?probe=1', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.__game === 'function', null, { timeout: 5000 }).catch(() => {});
    r.readyMs = Date.now() - t0; let s = await st(); if (!s) return r; r.hook = true;
    const toX = await p.evaluate(() => { const k = Math.min(innerWidth / 360, innerHeight / 640); return [(innerWidth - 360 * k) / 2, k]; }), px = (x) => toX[0] + x * toX[1];
    const t1 = Date.now(); await p.touchscreen.tap(195, 700); await p.waitForFunction(() => !window.__game().waiting, null, { timeout: 2000 }).catch(() => {}); r.startMs = (await st()).waiting ? 99999 : Date.now() - t1;
    let a = (await st()).paddle; await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(250); await p.keyboard.up('ArrowLeft'); r.keys = (await st()).paddle !== a;
    a = (await st()).paddle; await p.mouse.move(px(330), 700); await p.mouse.down(); await p.mouse.up(); await p.touchscreen.tap(px(330), 700); await p.waitForTimeout(250); r.touch = (await st()).paddle !== a;
    s = await st(); r.speedStart = s.speed; r.levelStart = s.level; const snd0 = s.sounds; let last = s.score, lastAt = Date.now(); r.rises = 0; r.deadMs = 0;
    for (const end = Date.now() + ms; Date.now() < end;) {
      const aim = await bot(); s = await st(); if (s.over) break;
      if (aim) { if (aim.launch) await p.touchscreen.tap(px(aim.x), 700); else await p.mouse.move(px(aim.x + (Math.random() - 0.5) * 24), 700); }
      if (s.score > last) { r.rises++; last = s.score; lastAt = Date.now(); } else if (!s.waiting) r.deadMs = Math.max(r.deadMs, Date.now() - lastAt);
      await p.waitForTimeout(20);
    }
    r.fps = await p.evaluate(() => new Promise((ok) => { let n = 0; const t = performance.now(); const f = (x) => { n++; if (x - t < 2000) requestAnimationFrame(f); else ok(Math.round(n / ((x - t) / 1000))); }; requestAnimationFrame(f); }));
    s = await st(); r.speedEnd = s.speed; r.levelEnd = s.level; r.sounds = s.sounds - snd0; r.audio = s.audio;
    const t2 = Date.now(); r.failMs = 99999;
    while (Date.now() - t2 < BAR.failMs + 5000) { s = await st(); if (s.over) { r.failMs = Date.now() - t2; break; } if (s.waiting) await p.touchscreen.tap(px(4), 700); await p.mouse.move(px(4), 700); await p.waitForTimeout(150); }
    await p.waitForTimeout(800); await p.touchscreen.tap(195, 700); await p.waitForTimeout(300); s = await st(); r.again = !s.over && s.score === 0;
  } catch (e) { errors.push('probe: ' + String(e.message || e).slice(0, 140)); }
  finally { r.errors = errors.length; r.errorText = errors[0] || ''; await c.close().catch(() => {}); await b.close().catch(() => {}); if (srv) srv.close(); }
  return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const id = process.argv[2], arg = (k) => (process.argv.find((x) => x.startsWith('--' + k + '=')) || '').split('=').slice(1).join('=');
  if (!id) { console.error('usage: node tools/game-fun.mjs <id> [--write] [--ms=30000] [--video=dir] [--base=https://a-to-mind.com]'); process.exit(2); }
  const r = await probe(id, { ms: +arg('ms') || 30000, base: arg('base'), video: arg('video') }), fails = funChecks(r);
  const man = JSON.parse(fs.readFileSync(path.join(repo, 'data/game-manifest.json'), 'utf8')).games[id] || {};
  if (process.argv.includes('--write')) { const f = path.join(repo, RECORD); const rec = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; fs.writeFileSync(f, JSON.stringify(withResult(rec, id, man.version || 0, r, fails, new Date().toISOString().slice(0, 10)), null, 1) + '\n'); }
  console.log((fails.length ? 'FAIL' : 'ok') + ' game-fun ' + id + ': ' + (fails.join('; ') || 'ready, starts on a tap, keys and touch move, the score climbs, it gets harder, idle loses, one-tap restart, sound, frame rate') + '\n' + JSON.stringify(r));
  process.exit(fails.length ? 1 : 0);
}
