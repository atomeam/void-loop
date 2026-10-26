// A person-like run of the games pages at 390 px: /chess/ (moves by tap and by drag, the computer answers, takeback, flip, a puzzle, PGN in and
// out, a share link, arrows, German) and each page under /games/. Also on every page: no sideways overflow, no console errors, layout shift under
// 0.05, no control smaller than 24 px, and it opens again with the network cut. Saves screenshots into the directory given.
//   node tools/heavy.mjs node tools/games-page.mjs <dir> [chess|games|<name>]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.', only = process.argv[3] || '';
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, hasTouch: false }), p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|lichess/i.test(m.text())) p.errors.push(m.text()); }); await ctx.route(/lichess\.org|static\.cloudflareinsights/, (r) => r.abort()); return { ctx, p }; };
const open = async (p, url) => {
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForTimeout(900);
  const fp = await p.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || -1); return { ms, fp };
};
const sane = async (p, name, { fp }) => {
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px');
  const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (under 0.05)');
  ok(fp > 0 && fp < 200, name + ': first paint ' + Math.round(fp) + ' ms on this machine (under 200)');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea,summary')].filter((e) => { if (e.closest('#board, .grid, .tiles, .cboard, .kbd')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); }).map((e) => (e.id || e.textContent || e.tagName).slice(0, 20)));
  ok(!small.length, name + ': every control at least 24 px' + (small.length ? ' (small: ' + small.join(', ') + ')' : ''));
  ok(await p.evaluate(() => /og\/[a-z-]+\.png/.test((document.querySelector('meta[property="og:image"]') || {}).content || '')), name + ': its own og:image');
};
const offline = async (ctx, p, url, name, sel) => { await p.waitForTimeout(400); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600); await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(900); ok(await p.locator(sel).count() > 0 && !p.errors.some((e) => /is not defined|TypeError/.test(e)), name + ': opens again with the network cut'); await ctx.setOffline(false); };
const sq = (p, name) => p.locator(`#board button[aria-label^="${name}"]`);

{ const w = await mk(); await w.p.goto(base + '/tools/', { waitUntil: 'load' }); await w.ctx.close(); } // the browser's own first start is not the page's
if (!only || only === 'chess') {
  const { ctx, p } = await mk(); const m = await open(p, '/chess/?level=1&mode=ai'); await sane(p, 'chess', m);
  await p.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  await p.click('#new'); await p.waitForTimeout(200);
  await sq(p, 'e2').click(); ok(await p.locator('#board .tgt').count() === 2, 'chess: e2 pawn shows its two squares');
  await sq(p, 'e4').click(); await p.waitForTimeout(1500);
  let moves = await p.locator('#moves button[data-ply]').allInnerTexts(); ok(moves[0] === 'e4' && moves.length === 2, 'chess: 1. e4 and the computer answered (' + moves.join(' ') + ')');
  // a drag: the g1 knight to f3
  const a = await sq(p, 'g1').boundingBox(), c = await sq(p, 'f3').boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(a.x + 30, a.y - 30, { steps: 4 }); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1500);
  moves = await p.locator('#moves button[data-ply]').allInnerTexts(); ok(moves[2] === 'Nf3' && moves.length === 4, 'chess: a knight dragged to f3, the computer answered (' + moves.join(' ') + ')');
  await p.screenshot({ path: path.join(out, 'chess-game.png') });
  await p.click('#undo'); moves = await p.locator('#moves button[data-ply]').allInnerTexts(); ok(moves.length === 2, 'chess: takeback goes back to your move');
  await p.click('#flip'); ok((await p.locator('#board button').first().getAttribute('aria-label')).startsWith('h1'), 'chess: flip puts h1 top left');
  await p.click('#flip');
  // arrows: right-drag e2 to e4 draws one
  const e2 = await sq(p, 'd2').boundingBox(), e4 = await sq(p, 'd4').boundingBox();
  await p.mouse.move(e2.x + 20, e2.y + 20); await p.mouse.down({ button: 'right' }); await p.mouse.move(e4.x + 20, e4.y + 20, { steps: 4 }); await p.mouse.up({ button: 'right' });
  ok(await p.locator('#arrowg line').count() === 1, 'chess: a right-drag draws an arrow');
  await p.click('#hint'); await p.waitForTimeout(2000); ok(/Hint: /.test(await p.locator('#eval').innerText()) && await p.locator('#arrowg line').count() === 2, 'chess: a hint names a move and draws its arrow');
  // PGN and FEN
  await p.click('#io summary'); await p.fill('#pgnin', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O'); await p.click('#load');
  ok((await p.locator('#moves button[data-ply]').count()) === 16 && /Loaded: 16/.test(await p.locator('#ioerr').innerText()), 'chess: a PGN of the Ruy Lopez loads 16 half-moves');
  ok((await p.inputValue('#fenout')).startsWith('r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w'), 'chess: the FEN after 8. c3 O-O is right');
  ok((await p.getAttribute('#lichess', 'href')).startsWith('https://lichess.org/analysis/standard/r1bq1rk1/'), 'chess: the Lichess analysis link carries the position');
  await p.click('#analyse'); await p.waitForTimeout(2500); ok(/Depth \d+: [+-]?\d/.test(await p.locator('#eval').innerText()), 'chess: engine analysis shows a depth, a score and a line (' + (await p.locator('#eval').innerText()).slice(0, 60) + ')'); await p.click('#analyse');
  await p.screenshot({ path: path.join(out, 'chess-analysis.png'), fullPage: true });
  await p.click('#share'); await p.waitForTimeout(300); ok(/\/chess\/\?m=e2e4\.e7e5/.test(p.url()), 'chess: Share link puts the game in the address');
  const shared = p.url(); const two = await ctx.newPage(); await two.goto(shared, { waitUntil: 'load' }); await two.waitForTimeout(700); ok(await two.locator('#moves button[data-ply]').count() === 16, 'chess: the shared link opens the same 16 half-moves'); await two.close();
  // puzzles
  await p.click('#m-puzzle'); await p.waitForTimeout(800); ok(/Puzzle v\d+/.test(await p.locator('#puzinfo').innerText()), 'chess: a puzzle opens (' + (await p.locator('#puzinfo').innerText()) + ')');
  const pz = await p.evaluate(async () => { const id = document.getElementById('puzinfo').textContent.match(/Puzzle (v\d+)/)[1]; const j = await (await fetch('/chess/puzzles.json')).json(); return j.puzzles.find((x) => x.id === id); });
  for (let i = 0; i < pz.line.length; i += 2) { const u = pz.line[i]; await sq(p, u.slice(0, 2)).click(); await sq(p, u.slice(2, 4)).click(); if (u[4]) await p.click('#promobtns button >> nth=0'); await p.waitForTimeout(700); }
  ok(/Solved/.test(await p.locator('#status').innerText()), 'chess: the puzzle solved by playing its line (' + pz.theme + ')');
  await p.screenshot({ path: path.join(out, 'chess-puzzle.png') });
  ok(!p.errors.length, 'chess: no errors in the console' + (p.errors.length ? ': ' + p.errors.slice(0, 3).join(' | ') : ''));
  await offline(ctx, p, '/chess/', 'chess', '#board button');
  await ctx.close();
  const d = await mk('de-DE'); await open(d.p, '/chess/?mode=two'); const txt = await d.p.evaluate(() => document.body.innerText); ok(/Zwei Spieler/.test(txt) && /Brett drehen/.test(txt) && /Weiß am Zug/.test(txt), 'chess: German on a German browser'); await d.p.screenshot({ path: path.join(out, 'chess-de.png') }); await d.ctx.close();
}
export const GAME_RUNS = {};
if (!only || only === 'games' || only !== 'chess') {
  for (const [name, run] of Object.entries((await import('./games-page-runs.mjs').catch(() => ({ RUNS: {} }))).RUNS)) {
    if (only && only !== 'games' && only !== name) continue;
    const { ctx, p } = await mk(); try { await run({ p, ctx, ok, open, sane, out, offline, mk }); } catch (e) { ok(false, name + ': ' + String(e).slice(0, 200)); }
    ok(!p.errors.length, name + ': no errors in the console' + (p.errors.length ? ': ' + p.errors.slice(0, 3).join(' | ') : '')); await ctx.close();
  }
}
await b.close(); srv.close(); process.exit(fail);
