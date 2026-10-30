// node tools/notes-page-e2e.mjs: the Notes page's Notion-style parts in a real browser: slash menu, table bar, [[links]] and backlinks, pin and tag filter, templates, and chat-made tables.
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
await page.goto(base + '/notes/'); await page.waitForFunction(() => document.getElementById('related') && document.getElementById('related').children.length, null, { timeout: 8000 }).catch(() => {});
await page.click('#dtitle'); await page.keyboard.type('Lisbon trip'); await page.keyboard.press('Enter');
// slash menu: / then "tab" then Enter makes a table
await page.keyboard.type('Plan /tab'); await page.waitForSelector('#slash:not([hidden])'); ok(/Table/.test(await page.locator('#slash').innerText()), 'slash menu opens and filters');
await page.keyboard.press('Enter'); await page.waitForTimeout(200); ok((await page.locator('#body table').count()) === 1 && !/\/tab/.test(await page.locator('#body').innerText()), 'slash table inserted, the typed text gone');
// table bar: type in cells, add a row, sort
await page.locator('#body th').first().click(); await page.waitForSelector('#tblbar:not([hidden])'); ok(true, 'table bar shows with the caret in a table');
await page.locator('#body td').first().click(); await page.keyboard.type('Zed'); await page.locator('#body tbody tr').nth(1).locator('td').first().click(); await page.keyboard.type('Alpha');
await page.locator('#body td').first().click(); await page.click('#tblbar [data-t=up]'); await page.waitForTimeout(150);
ok((await page.locator('#body tbody tr td').first().innerText()) === 'Alpha', 'Sort A-Z orders the rows');
await page.locator('#body td').first().click(); await page.click('#tblbar [data-t=row]'); ok((await page.locator('#body tbody tr').count()) === 3, 'Row + adds a row');
await page.locator('#body td').first().click(); page.once('dialog', (d) => d.accept('Status')); await page.click('#tblbar [data-t=col]'); ok(/Status/.test(await page.locator('#body thead').innerText()), 'Column + adds a column named Status');
// divider, todo through the slash menu
await page.locator('#body').click(); await page.keyboard.press('Control+End'); await page.keyboard.type(' /div'); await page.waitForSelector('#slash:not([hidden])'); await page.keyboard.press('Enter'); ok((await page.locator('#body hr').count()) === 1, 'divider');
await page.keyboard.type('/todo'); await page.waitForSelector('#slash:not([hidden])'); await page.keyboard.press('Enter'); await page.keyboard.type('pack bag'); ok((await page.locator('#body ul.todo li.chk').count()) === 1, 'to-do');
await page.waitForTimeout(700);
// links and backlinks
await page.click('#newBtn'); await page.keyboard.type('Packing'); await page.keyboard.press('Enter'); await page.keyboard.type('Socks and see [[Lisbon trip]]'); await page.waitForTimeout(700);
ok(/Lisbon trip/.test(await page.locator('#links').innerText()), 'a [[link]] shows under Links to');
await page.locator('#links button', { hasText: 'Lisbon trip' }).first().click(); await page.waitForTimeout(200);
ok(/Packing/.test(await page.locator('#links').innerText()) && (await page.locator('#dtitle').innerText()) === 'Lisbon trip', 'following it opens that note, which lists Packing under Linked from');
// pin and tags
await page.click('#pinBtn'); await page.fill('#tagsIn', 'travel, #work'); await page.keyboard.press('Tab'); await page.waitForTimeout(200);
let d = await notes(); const t = d.find((x) => x.title === 'Lisbon trip'); ok(t.pinned === true && t.tags.join() === 'travel,work', 'pin and tags kept in the store');
await page.click('#fPin'); ok((await page.locator('#list li button').count()) === 1, 'Pinned filter shows only the pinned note'); await page.click('#fPin');
await page.locator('#tagchips button', { hasText: '#work' }).click(); ok((await page.locator('#list li button').count()) === 1, 'tag chip filters'); await page.click('#fAll');
// template
await page.selectOption('#tplSel', 'meeting'); await page.waitForTimeout(200); ok(/Agenda/.test(await page.locator('#body').innerText()) && /Meeting/.test(await page.locator('#dtitle').innerText()), 'template starts a meeting note');
// find and replace, outline, trash
await page.locator('#dtitle').click(); await page.keyboard.type(' x'); await page.locator('#body').click(); await page.keyboard.press('Control+End'); await page.keyboard.type(' Agenda again');
await page.click('#frBtn'); await page.fill('#frF', 'agenda'); await page.fill('#frR', 'Plan'); await page.click('#frGo'); await page.waitForTimeout(200);
ok(/2 replaced|replaced/.test(await page.locator('#frMsg').innerText()) && !/agenda/i.test(await page.locator('#body').innerText()), 'find and replace changed the text');
ok((await page.locator('#links button', { hasText: 'Plan' }).count()) >= 1, 'outline lists the headings');
const nBefore = (await notes()).length; await page.click('#delBtn'); await page.waitForTimeout(200); d = await notes(); const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.notes.v1')));
ok(raw.docs.length === nBefore - 1 && raw.trash.length === 1, 'Delete moves the note to the trash'); await page.click('#trashBtn'); await page.locator('#tlist button', { hasText: 'Restore' }).first().click(); await page.waitForTimeout(200);
ok((await notes()).length === nBefore, 'Restore brings it back');
// reload keeps the table (clean whitelist) and a Notes page without errors
await page.reload(); await page.waitForTimeout(800); d = await notes(); ok(d.some((x) => /<table>/.test(x.html) && /<hr>/.test(x.html)), 'table and divider survive in the store');
// chat on the stage writes a table into the same store
await page.goto(base + '/'); await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {});
const ask = async (q) => { await page.fill('#input', q); await page.keyboard.press('Enter'); await page.waitForTimeout(1800); };
await ask('add a column Owner to my lisbon trip note'); d = await notes(); ok(/<th>Owner<\/th>/.test(d.find((x) => x.title === 'Lisbon trip').html), 'chat: add a column Owner');
await ask('start a trip note for Rome'); d = await notes(); ok(d.some((x) => x.title === 'Rome trip'), 'chat: start a trip note');
ok(errs.length === 0, 'no page errors ' + errs.join('|')); await browser.close(); server.close(); process.exit(bad ? 1 : 0);
