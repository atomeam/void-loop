// node tools/pdf-kanban-e2e.mjs [--shots <dir>]: the PDF and Kanban pages in a real browser at phone width: files chosen, tools pressed, downloads read back;
// cards added, moved by keyboard and pointer, opened, labelled, exported. Run it through node tools/heavy.mjs.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { chromium } from 'playwright-core';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null; if (shots) fs.mkdirSync(shots, { recursive: true });
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
globalThis.self ??= globalThis; vm.runInThisContext(fs.readFileSync(path.join(root, 'vendor/pdf-lib-1.17.1/pdf-lib.min.js'), 'utf8')); const L = globalThis.PDFLib;
const mk = async (n, w = 300, h = 400, label = 'Page') => { const d = await L.PDFDocument.create(); const f = await d.embedFont(L.StandardFonts.Helvetica); for (let i = 1; i <= n; i++) { const p = d.addPage([w, h]); p.drawText(label + ' ' + i, { x: 40, y: h / 2, size: 36, font: f }); } return Buffer.from(await d.save()); };
const tmp = fs.mkdtempSync('/tmp/pdfk-'); const A = path.join(tmp, 'alpha.pdf'), B = path.join(tmp, 'beta.pdf'), PNG = path.join(tmp, 'pic.png');
const mkW = async () => { const d = await L.PDFDocument.create(); for (let i = 1; i <= 3; i++) d.addPage([200 + i, 300]); return Buffer.from(await d.save()); }; const C = path.join(tmp, 'gamma.pdf'); fs.writeFileSync(C, await mkW());
fs.writeFileSync(A, await mk(3, 300, 400, 'Alpha')); fs.writeFileSync(B, await mk(2, 500, 300, 'Beta'));
fs.writeFileSync(PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGP4z8Dwn4EBAAkEAgCG0d3sAAAAAElFTkSuQmCC', 'base64'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, hasTouch: true }); const page = await ctx.newPage(); const base = 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = [];
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
const shot = (n) => shots ? page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true }) : null;
const pagesOf = async (file) => (await L.PDFDocument.load(fs.readFileSync(file))).getPageCount();
async function download(trigger) { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), trigger()]); const f = path.join(tmp, 'out-' + Math.random().toString(36).slice(2) + '-' + dl.suggestedFilename()); await dl.saveAs(f); return f; }

// ---- PDF ----
await page.goto(base + '/pdf/?tool=merge'); await page.waitForSelector('.drop');
ok(/Merge/.test(await page.locator('h2').first().innerText()), 'merge tool opens from ?tool=merge');
await page.setInputFiles('input.pick', [A, B]); await page.waitForSelector('.files li:nth-child(2)'); await shot('pdf-merge-files');
await page.locator('.files li').nth(1).locator('input.pg').fill('2');
let out = await download(async () => { await page.click('button.go'); await page.waitForSelector('a.dl'); await page.click('a.dl'); });
ok((await pagesOf(out)) === 4, 'merge: 3 pages + page 2 of the second file = 4 pages (' + (await pagesOf(out)) + ')'); await shot('pdf-merge-done');
await page.click('[data-tool=split]'); await page.setInputFiles('input.pick', A); await page.waitForSelector('.files li');
await page.locator('select').first().selectOption('each'); await page.click('button.go'); await page.waitForSelector('a.dl');
ok((await page.locator('a.dl').count()) === 4, 'split each page: 3 files and a zip'); 
await page.click('[data-tool=compress]'); await page.setInputFiles('input.pick', A); await page.waitForSelector('.files li');
await page.locator('select').first().selectOption('pictures'); await page.click('button.go'); await page.waitForFunction(() => { const t = document.querySelector('.status').innerText; return t && !/^(Compressing|Page \d)/.test(t); }, null, { timeout: 40000 }); const st = await page.locator('.status').innerText(); ok(/Done|already as small/.test(st), 'compress by pictures answers: ' + st);
await page.click('[data-tool=img2pdf]'); await page.setInputFiles('input.pick', PNG); await page.waitForSelector('.files li'); out = await download(async () => { await page.click('button.go'); await page.waitForSelector('a.dl'); await page.click('a.dl'); });
ok((await pagesOf(out)) === 1, 'images to pdf makes one page');
await page.click('[data-tool=pdf2img]'); await page.setInputFiles('input.pick', B); await page.waitForSelector('.files li'); await page.locator('select').nth(1).selectOption('72'); await page.click('button.go'); await page.waitForSelector('a.dl', { timeout: 20000 });
ok((await page.locator('a.dl').count()) === 3, 'pdf to images: 2 pictures and a zip');
// the pages tool: thumbnails, keyboard move, delete, rotate, save
await page.click('[data-tool=pages]'); await page.setInputFiles('input.pick', [A, B]); await page.waitForFunction(() => document.querySelectorAll('.thumb canvas').length === 5, null, { timeout: 20000 }); await shot('pdf-pages');
ok((await page.locator('.thumb').count()) === 5, 'pages: 5 thumbnails drawn from two files');
await page.locator('.thumb').first().focus(); await page.keyboard.press('Alt+ArrowRight'); ok(/p2/.test(await page.locator('.thumb .cap span').first().innerText()), 'Alt+Right moves the first page one place later');
await page.keyboard.press('Delete'); ok((await page.locator('.thumb').count()) === 4, 'Delete removes the focused page');
await page.locator('.thumb').first().focus(); await page.keyboard.press('r');
out = await download(async () => { await page.click('button.go'); await page.waitForSelector('a.dl'); await page.click('a.dl'); });
const d = await L.PDFDocument.load(fs.readFileSync(out)); ok(d.getPageCount() === 4 && d.getPage(0).getRotation().angle === 90, 'saved: 4 pages, the first turned 90 degrees');
for (const p of ['/pdf/', '/pdf/merge/', '/pdf/organize/', '/pdf/toolbox/', '/pdf/editor/', '/pdf/suite/', '/pdf/studio/']) { await page.goto(base + p); await page.waitForSelector('.tabs button'); const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= 391, p + ' has no horizontal scroll at 390 px (' + w + ')'); }
await page.goto(base + '/pdf/'); await shot('pdf-home');

// a page built for one job still turns, deletes and reorders pages, and shares a link
await page.goto(base + '/pdf/merge/'); await page.waitForSelector('.also');
const mtxt = await page.locator('main').innerText(); ok(/Rotate/.test(mtxt) && /Extract or delete pages/.test(mtxt) && /Reorder by number/.test(mtxt) && /Images to PDF/.test(mtxt) && /Split/.test(mtxt), '/pdf/merge/ shows page tools, split and images to PDF under the merge panel');
ok((await page.locator('button.share').count()) === 1 && /Share link/.test(await page.locator('button.share').innerText()), 'a visible Share link button');
const orderSection = page.locator('.also', { has: page.locator('h2', { hasText: 'Reorder by number' }) }); await orderSection.locator('input.pick').setInputFiles(C); await orderSection.locator('.files li').waitFor();
await orderSection.locator('input[type=text]').fill('3,1'); out = await download(async () => { await orderSection.locator('button.go').click(); await page.waitForSelector('a.dl'); await page.click('a.dl'); });
{ const dd = await L.PDFDocument.load(fs.readFileSync(out)); ok(dd.getPages().map((x) => Math.round(x.getWidth())).join() === '203,201,202', 'reorder 3,1 gives pages 3,1,2'); }
await page.goto(base + '/pdf/organize/'); await page.waitForSelector('.tabs'); ok(/Split/.test(await page.locator('.tabs').innerText()), '/pdf/organize/ has a Split tab');
const metas = await page.evaluate(() => ({ img: document.querySelector('meta[property="og:image"]').content, w: document.querySelector('meta[property="og:image:width"]').content }));
ok(/\/og\/pdf-organize\.png$/.test(metas.img) && fs.existsSync(path.join(root, 'og', 'pdf-organize.png')), 'its own share picture: ' + metas.img);

// ---- Kanban ----
await page.evaluate(() => localStorage.clear()); await page.goto(base + '/kanban/'); await page.waitForSelector('.col'); await shot('kanban-empty');
ok((await page.locator('.col h3').allInnerTexts()).join() === 'To do,Doing,Done', 'a fresh board starts To do, Doing, Done');
const add = (col, t) => page.locator('.col').nth(col).locator('.addcard').fill(t).then(() => page.locator('.col').nth(col).locator('.addcard').press('Enter'));
await add(0, 'Write the brief'); await add(0, 'Book the room'); await add(1, 'Draw the plan'); ok((await page.locator('.card').count()) === 3, 'three cards added');
await page.locator('.card').first().focus(); await page.keyboard.press('Alt+ArrowRight'); ok((await page.locator('.col').nth(1).locator('.card').count()) === 2, 'Alt+Right moves a card to the next column');
await page.locator('.col').nth(1).locator('.card').first().click(); await page.waitForSelector('dialog[open]');
await page.locator('dialog .newlabel').fill('Hot'); await page.locator('dialog .newlabel').press('Enter');
await page.locator('dialog input[type=date]').fill('2020-01-01'); await page.locator('dialog input[type=date]').dispatchEvent('change');
await page.locator('dialog input[placeholder="Add an item"]').fill('first step'); await page.locator('dialog input[placeholder="Add an item"]').press('Enter');
await page.locator('dialog input[type=checkbox]').first().check(); await page.locator('dialog input[placeholder="Add a comment"]').fill('looks good'); await page.locator('dialog input[placeholder="Add a comment"]').press('Enter'); await shot('kanban-card');
await page.click('dialog button.go'); await page.waitForTimeout(150);
const txt = await page.locator('.col').nth(1).innerText(); ok(/2020-01-01/.test(txt) && /1 of 1/.test(txt) && /Hot/.test(txt), 'the card shows its label, overdue date and checklist progress');
ok((await page.locator('.badge.overdue').count()) === 1, 'the past due date is marked overdue');
// pointer drag by touch from the grip: Done column
const grip = await page.locator('.col').nth(0).locator('.grip').first().boundingBox(), target = await page.locator('.col').nth(2).locator('.cards').boundingBox();
await page.evaluate(() => { window.__pd = (t, x, y) => { const g = document.querySelector('.col .grip'); g.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); }; });
await page.evaluate(([x, y, tx, ty]) => { const g = document.querySelectorAll('.col')[0].querySelector('.grip'); const fire = (t, cx, cy) => g.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true, cancelable: true })); g.setPointerCapture = () => {}; fire('pointerdown', x, y); fire('pointermove', tx, ty); fire('pointerup', tx, ty); }, [grip.x + 5, grip.y + 5, target.x + 20, target.y + 20]);
await page.waitForTimeout(200); ok((await page.locator('.col').nth(2).locator('.card').count()) === 1, 'a touch drag from the grip drops the card in Done');
// WIP limit
await page.locator('.col').nth(1).locator('.cmenu summary').click(); await page.locator('.col').nth(1).locator('.wipl input').fill('1'); await page.locator('.col').nth(1).locator('.wipl input').dispatchEvent('change'); await page.waitForTimeout(150);
ok(/\/ 1/.test(await page.locator('.col').nth(1).locator('.count').innerText()) && (await page.locator('.col.wipover').count()) === 1, 'a WIP limit of 1 marks the column over its limit');
// search, export
ok(/Add column/.test(await page.locator('.bar').first().innerText()) && /Add a board/.test(await page.locator('.bar').first().innerText()), 'Add column and Add a board show on the first screen');
page.once('dialog', (d) => d.accept('Review')); await page.click('button.addcolbtn'); await page.waitForTimeout(150); ok((await page.locator('.col h3').allInnerTexts()).includes('Review'), 'Add column adds a column');
await page.fill('input[type=search]', 'plan'); await page.waitForTimeout(100); ok((await page.locator('.card:visible').count()) === 1, 'search narrows to one card');
await page.fill('input[type=search]', '');
const exp = await download(() => page.click('button:has-text("Export JSON")')); const j = JSON.parse(fs.readFileSync(exp, 'utf8')); ok(j.boards[0].columns.flatMap((c) => c.cards).length === 3, 'Export JSON holds the 3 cards');
await page.setInputFiles('input[type=file][accept*=json]', exp); await page.waitForTimeout(200); ok((await page.locator('.bar select').first().locator('option').count()) === 2, 'Import adds the board as a second board');
await page.click('button.lang'); ok(/Karte hinzufügen|Exportieren|Importieren/.test(await page.locator('main').innerText()), 'German on a tap'); await shot('kanban-de');
await page.click('button.lang');
for (const p of ['/kanban/', '/kanban/simple/', '/kanban/quick/', '/kanban/teams/', '/kanban/flow/']) { await page.goto(base + p); await page.waitForSelector('.col'); const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= 391, p + ' has no horizontal scroll at 390 px (' + w + ')'); }
await page.goto(base + '/kanban/simple/'); await page.waitForSelector('.col'); const st2 = await page.locator('main').innerText(); ok(/Add a board/.test(st2) && /several boards/.test(st2) && /Drag and drop cards between columns/.test(st2) && /cards with a title and description/.test(st2) && /Share link/.test(st2), 'the simple page says and has several boards, cards with a title and description, drag and drop, a share link');
await page.evaluate(() => localStorage.clear()); await page.goto(base + '/kanban/quick/'); await page.waitForSelector('.col'); ok(/checklists/.test(await page.locator('main').innerText()), '/kanban/quick/ says checklists');
await add(0, 'Pack'); await page.locator('.card').first().click(); await page.waitForSelector('dialog[open]'); await page.locator('dialog input[placeholder="Add an item"]').fill('passport'); await page.locator('dialog input[placeholder="Add an item"]').press('Enter'); await page.locator('dialog input[type=checkbox]').first().check();
await page.click('dialog button.go'); await page.waitForTimeout(150); ok(/1 of 1/.test(await page.locator('.card').first().innerText()), 'quick page: a checklist item ticked shows 1 of 1 on the card');
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.kanban.v1')).boards[0].columns[0].cards[0].checklist); ok(kept.length === 1 && kept[0].done === true, 'the checklist is kept in the board JSON');
await page.goto(base + '/kanban/'); await shot('kanban-home');
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close(); server.close(); console.log(bad ? bad + ' FAILED' : 'all ok'); process.exit(bad ? 1 : 0);
