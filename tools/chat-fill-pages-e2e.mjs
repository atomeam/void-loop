// node tools/chat-fill-pages-e2e.mjs: sentences on the stage fill the Calendar, Recipes and Generators pages: asked on the stage, then read back on the page in the same browser; Undo puts it back.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); } fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } }); const base = 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
const notes = () => page.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.notes.v1') || '{"docs":[]}').docs);
const ready = async () => { await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {}); };
const ask = async (q) => { await page.fill('#input', q); await page.keyboard.press('Enter'); await page.waitForTimeout(1800); };
const get = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), k);
await page.goto(base + '/'); await ready();
// calendar
await ask('meeting with Sam tomorrow 10am for an hour'); let c = await get('a2m.void.calendar.v1'); const ev = (c.events || [])[0];
ok(ev && ev.title === 'Meeting with Sam' && /T10:00$/.test(ev.start) && /T11:00$/.test(ev.end), 'calendar: event saved with the parsed time');
const said = await page.locator('#whisper').innerText().catch(() => ''); ok(/in the Calendar page: .*10:00 AM to 11:00 AM \(1 hour\)/.test(said), 'calendar: the stage says the parsed time in words: ' + said.slice(0, 120));
await ask('change the meeting with sam to 4pm'); c = await get('a2m.void.calendar.v1'); ok(/T16:00$/.test(c.events[0].start), 'calendar: moved to 4pm');
await page.getByRole('button', { name: 'Undo' }).last().click(); await page.waitForTimeout(300); c = await get('a2m.void.calendar.v1'); ok(/T10:00$/.test(c.events[0].start), 'calendar: Undo put it back to 10am');
// one store (lib/agenda.js): the stage's calendar card shows what chat moved, and the stage's older list is moved in once
await ask('agenda'); await ask('move the meeting with sam to 4pm'); ok(/Meeting with Sam/.test(await page.locator('.calendar-card').innerText().catch(() => '')) && /4:00/.test(await page.locator('.calendar-card').innerText().catch(() => '')), 'calendar: the stage card shows the chat move (4:00)');
await page.getByRole('button', { name: 'Undo' }).last().click(); await page.waitForTimeout(300);
await page.goto(base + '/calendar/?d=' + ev.start.slice(0, 10) + '&view=day'); await page.waitForTimeout(900); ok(/Meeting with Sam/.test(await page.locator('body').innerText()), 'calendar page shows the event'); await page.goto(base + '/'); await ready();
// recipes
await ask('save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix everything. bake 40 minutes'); let r = await get('a2m.void.recipes.v1');
ok(r.mine && r.mine[0] && r.mine[0].recipe.ingredients.length === 3 && r.mine[0].recipe.servings === 8, 'recipes: saved with 3 ingredients, 8 servings');
await ask('add salt to my lemon cake recipe'); r = await get('a2m.void.recipes.v1'); ok(r.mine[0].recipe.ingredients.length === 4, 'recipes: salt added');
await page.getByRole('button', { name: 'Undo' }).last().click(); await page.waitForTimeout(300); r = await get('a2m.void.recipes.v1'); ok(r.mine[0].recipe.ingredients.length === 3, 'recipes: Undo removed the salt');
await page.goto(base + '/recipes/?q=lemon%20cake'); await page.waitForTimeout(1200); const rt = await page.locator('body').innerText(); ok(/Lemon cake/.test(rt) && /flour/i.test(rt), 'recipes page opens the saved recipe by name'); ok(/My recipes/.test(rt), 'recipes page lists My recipes');
await page.goto(base + '/'); await ready();
// generators
await ask('make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge'); let g = await get('a2m.void.generators.v1'); ok(g.own && /Sea Wolf/.test(g.own.text), 'generators: own list saved');
await page.getByRole('button', { name: /^Keep / }).first().click(); await page.waitForTimeout(300); g = await get('a2m.void.generators.v1'); ok(g.favs && g.favs.length === 1, 'generators: a roll kept with its Keep button');
await ask('add Dread Maiden to my pirate ship names generator'); g = await get('a2m.void.generators.v1'); ok(/Dread Maiden/.test(g.own.text), 'generators: entry added');
await page.goto(base + '/generators/?g=own'); await page.waitForTimeout(900); ok(/Sea Wolf|Black Pearl|Revenge|Dread Maiden/.test(await page.locator('#res').innerText()) && /Dread Maiden/.test(await page.inputValue('#ownText')), 'generators page fills its own list and rolls from it'); ok((await page.locator('#favs li').count()) === 1, 'generators page lists the kept name');
ok(errs.length === 0, 'no page errors ' + errs.join('|')); await browser.close(); server.close(); process.exit(bad ? 1 : 0);
