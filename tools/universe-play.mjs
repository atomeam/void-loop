// Scores a game target for real: the play-bot plays Verse's own entry on a phone screen with the video on, and what it sees becomes marks on the Tower beyond websites
// (performance from a measured frame rate and the error log, controls from the screen answering the input, softlock from the screen still moving at the end).
// The look-and-feel checks (graphics, polish, game feel, fun, fair) come from the vision judge when a vision key is set (tools/game-updates.mjs judgePlay), or from a reviewer
// who looked at the saved video frames (--reviewer graphics=40,polish=55 ...), and each mark records which one judged it.
//   node tools/universe-play.mjs <target-id> [--ms=30000] [--reviewer k=v,...] [--write]      prints the marks; --write puts them in tower.universe.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { CHECK } from '../void-live-deploy/lib/universe.js';
import { gamesOf } from '../void-live-deploy/lib/game-updates.js';
import { load, save, markOf } from './universe.mjs';
import { loadBook, judgePlay } from './game-updates.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
/** what the play-bot measured -> marks 0-100. Pure. fps: frames a second; errors: how many; changed/probes: inputs the screen answered / inputs sent; moving: the screen still changed in the last third. */
export function measuredMarks({ fps, errors, changed, probes, moving }) {
  return { performance: clamp((100 * Math.min(60, fps)) / 60 - 25 * Math.min(2, errors)), controls: probes ? clamp((100 * changed) / probes) : 0, softlock: moving ? 100 : 40 };
}
const VISION = { juice: 'juice', fun: 'fun', polish: 'polish', fair: 'fair' };
/** the judge's parts (each 0-10) -> marks 0-100 for the checks they answer. Pure. */
export const visionMarks = (parts) => Object.fromEntries(Object.entries(VISION).filter(([p]) => Number.isFinite(+(parts || {})[p])).map(([p, c]) => [c, clamp(10 * +parts[p])]));
export const reviewerMarks = (s) => Object.fromEntries(String(s || '').split(',').map((x) => x.split('=')).filter(([k, v]) => CHECK[k] && Number.isFinite(+v)).map(([k, v]) => [k, clamp(+v)]));
export async function lap(game, { ms = 30000, dir = '/tmp/universe-play-' + game.id } = {}) {
  const { chromium } = await import('playwright-core'), http = await import('node:http'), site = path.join(ROOT, 'void-live-deploy'); fs.mkdirSync(dir, { recursive: true });
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(site, p); if (!f.startsWith(site) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const origin = 'http://127.0.0.1:' + srv.address().port, errors = [];
  const url = game.play === 'arcade' ? origin + '/arcade/?play=' + encodeURIComponent(game.id) : origin + '/arcade/harness.html?file=' + encodeURIComponent('/skills/' + String(game.file).split('/').pop());
  const b = await chromium.launch({ headless: true, executablePath: process.env.VOID_TEST_BROWSER || undefined, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, recordVideo: { dir, size: { width: 390, height: 844 } } }), p = await c.newPage();
  p.on('pageerror', (e) => errors.push(String(e.message))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(2500);
  const fps = await p.evaluate(() => new Promise((ok) => { let n = 0, t0 = performance.now(); const f = (t) => { n++; if (t - t0 >= 2000) ok((1000 * n) / (t - t0)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  const shot = async (n) => { const f = path.join(dir, n + '.png'); await p.screenshot({ path: f }).catch(() => {}); return fs.existsSync(f) ? fs.readFileSync(f).toString('base64').length + ':' + fs.readFileSync(f).subarray(2000, 4000).toString('base64') : ''; };
  let changed = 0, probes = 0; const keys = ['Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp'];
  for (let t = Date.now() + ms, i = 0; Date.now() < t; i++) {
    if (i % 4 === 0) { const before = await shot('before'); if (i % 8 === 0) await p.touchscreen.tap(195, 640).catch(() => {}); else await p.keyboard.press(keys[(i / 4) % 4 | 0]).catch(() => {}); await p.waitForTimeout(350); probes++; if ((await shot('after')) !== before) changed++; }
    else { await p.keyboard.press('Space').catch(() => {}); await p.waitForTimeout(450); }
    if (Date.now() > t - ms / 3 && !lap.mid) { lap.mid = await shot('late-a'); }
  }
  const late = await shot('late-b'), moving = lap.mid !== late; lap.mid = null; await shot('end');
  const video = p.video(); await c.close(); await b.close(); srv.close(); const vp = video ? await video.path() : ''; if (vp) fs.renameSync(vp, path.join(dir, game.id + '.webm'));
  return { fps, errors: errors.length, errorText: errors[0] || '', changed, probes, moving, dir, video: vp ? path.join(dir, game.id + '.webm') : '', shots: ['start', 'end'].map((n) => path.join(dir, n + '.png')) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2], arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=').slice(1).join('=');
  let u = load(); const t = u.targets.find((x) => x.id === id), gid = t && t.entry && t.entry.game, game = gid && gamesOf(loadBook(ROOT)).find((g) => g.id === gid);
  if (!game) { console.error('usage: node tools/universe-play.mjs <target-id of a game with an entry> [--ms=30000] [--reviewer k=v,..] [--write]'); process.exit(2); }
  const r = await lap(game, { ms: +arg('ms') || 30000 }), marks = {}, by = {};
  for (const [k, v] of Object.entries(measuredMarks(r))) { marks[k] = v; by[k] = 'play-bot'; }
  const judged = await judgePlay({ broken: r.errorText, shots: r.shots, text: '' }, { game }).catch(() => null);
  for (const [k, v] of Object.entries(judged && judged.parts ? visionMarks(judged.parts) : {})) { marks[k] = v; by[k] = 'vision'; }
  for (const [k, v] of Object.entries(reviewerMarks(arg('reviewer')))) { marks[k] = v; by[k] = 'reviewer'; }
  if (process.argv.includes('--write')) { for (const [k, v] of Object.entries(marks)) u = markOf(u, id, k, v, { judge: by[k] }); save(u); }
  console.log(JSON.stringify({ target: id, game: gid, fps: Math.round(r.fps), errors: r.errors, changed: r.changed + '/' + r.probes, moving: r.moving, marks, judged: by, video: r.video, dir: r.dir }));
}
