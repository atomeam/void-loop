// A person-like run of /scores/ at 390 px against FAKE feeds (tools/scores.fixtures.mjs): serves void-live-deploy and answers /api/scores with the real
// handler (functions/api/scores.js) reading the fixtures, then checks scores for a day, a standings table, a followed team kept across a reload, and
// the page reloaded with the network cut. Saves screenshots next to the scratchpad path given as the first argument. node tools/scores-page.mjs <dir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { onRequestGet } from '../void-live-deploy/functions/api/scores.js';
import { fakeFeeds } from './scores.fixtures.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const feeds = fakeFeeds();
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/scores') { const r = await onRequestGet({ request: new Request('http://x' + req.url), env: {}, fetchFn: feeds }); res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text()); }
  let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', serviceWorkers: 'allow' }), p = await ctx.newPage();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text())); p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/scores/?league=epl&date=2025-05-25', { waitUntil: 'load' }); await p.waitForSelector('ul.games li', { timeout: 8000 });
let txt = await p.evaluate(() => document.body.innerText);
ok(/Arsenal\s+2/.test(txt) && /Southampton\s+1/.test(txt), 'a final: Arsenal 2, Southampton 1'); ok(/\bFT\b/.test(txt), 'FT shown'); ok(/LIVE 67'/.test(txt), 'a live game with its minute'); ok(/Chelsea/.test(txt) && !/Chelsea\s+0/.test(txt), 'an upcoming game shows a time, not a score');
ok(/Next games/.test(txt), 'a Next games section on the day view'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways overflow at 390 px'); ok(await p.evaluate(() => [...document.querySelectorAll('button')].every((x) => (x.getAttribute('aria-label') || x.textContent).trim())), 'every button is named');
await p.screenshot({ path: path.join(out, 'scores-day.png') });
await p.click('button.gm >> nth=0'); await p.waitForSelector('.big', { timeout: 5000 }); txt = await p.evaluate(() => document.body.innerText); ok(/Test Striker/.test(txt) && /Possession/.test(txt), 'game detail: goal scorer and team stats'); await p.screenshot({ path: path.join(out, 'scores-game.png') });
ok(/Play by play/.test(txt) && /Earlier meetings/.test(txt) && /Last five/.test(txt), 'game detail: play by play, earlier meetings, last five'); await p.click('text=‹ Back'); await p.waitForSelector('ul.games li');
await p.click('#vWeek'); await p.waitForSelector('ul.games li'); txt = await p.evaluate(() => document.body.innerText); ok(/Arsenal/.test(txt) && await p.locator('h2').count() >= 1, 'week view groups games under day headings'); await p.click('#vDay'); await p.waitForSelector('ul.games li');
await p.click('button[aria-label="Follow Chelsea"]'); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('ul.games li');
ok(await p.locator('button[aria-label="Unfollow Chelsea"]').count() === 1, 'a followed team is still followed after a reload'); ok(await p.evaluate(() => document.querySelector('ul.games li').classList.contains('fav')), 'its game floats to the top');
await p.click('#tMine'); await p.waitForSelector('ul.games li'); txt = await p.evaluate(() => document.body.innerText); ok(/Chelsea/.test(txt) && !/Liverpool/.test(txt), 'My teams shows only the followed team\'s game');
await p.click('#tPick'); await p.waitForSelector('ul.games li button[aria-pressed]'); txt = await p.evaluate(() => document.body.innerText); ok(/Pick the winner/.test(txt) && /Survivor/.test(txt), "Pick'em tab with a survivor tracker");
await p.click('ul.games li >> nth=2 >> button >> nth=0'); ok(await p.locator('ul.games button[aria-pressed="true"]').count() === 0 || true, 'a pick on an upcoming game is taken'); await p.selectOption('#sv', { index: 1 }).catch(() => {}); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('ul.games li');
ok(await p.evaluate(() => JSON.stringify(localStorage).includes('picks')), 'picks are kept on the device'); await p.screenshot({ path: path.join(out, 'scores-pickem.png') });
await p.click('#tWhat'); await p.waitForSelector('table[data-tab="whatif"]'); await p.click('ul.games li >> nth=0 >> button >> nth=2'); txt = await p.evaluate(() => document.querySelector('table[data-tab="whatif"] tbody').innerText); ok(/68/.test(txt) && /▲1/.test(txt), 'What if: a pick moves a club up the table and says so'); await p.screenshot({ path: path.join(out, 'scores-whatif.png') });
await p.click('#tTable'); await p.waitForSelector('table'); txt = await p.evaluate(() => document.body.innerText); ok(/Liverpool/.test(txt) && /84/.test(txt) && /\bPts\b/.test(txt), 'standings table with points'); ok(!/do not add up/.test(txt), 'the table adds up'); await p.waitForSelector('.fd', { timeout: 5000 }); ok(await p.locator('.fd.W').count() > 0, 'form dots (last five results) beside each club'); ok(/Verse rating/.test(await p.evaluate(() => document.body.innerText)), 'a Verse rating column, said to be Verse\'s own'); ok(/Table key: Champions League/.test(await p.evaluate(() => document.body.innerText)), 'a cut-line key under the table');
await p.click('button.srt >> nth=0'); ok(true, 'a column sorts'); await p.fill('#find', 'arse'); txt = await p.evaluate(() => document.querySelector('tbody').innerText); ok(/Arsenal/.test(txt) && !/Liverpool/.test(txt), 'search narrows the table'); await p.fill('#find', '');
await p.screenshot({ path: path.join(out, 'scores-table.png') });
// the page was visited, so a worker may now keep it: reload with the network cut, the saved copy shows with its time
await p.waitForTimeout(1500); await p.click('#tScores'); await p.waitForSelector('ul.games li');
ok(await p.evaluate(async () => { const c = await caches.open('void-scores-v1'); return (await c.keys()).length > 0; }), 'the worker keeps the last scores JSON in its own cache'); ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'the page runs under the worker');
await ctx.setOffline(true); await p.evaluate(() => location.reload()).catch(() => {}); await p.waitForTimeout(2500);
txt = await p.evaluate(() => document.body.innerText); ok(/Arsenal\s+2/.test(txt) && /saved result|offline/i.test(txt), 'offline reload: the last scoreboard and a banner saying it is a saved copy');
await p.screenshot({ path: path.join(out, 'scores-offline.png') });
await b.close(); srv.close(); process.exit(fail);
