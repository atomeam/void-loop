// node tools/notes-rivals-e2e.mjs: what /notes/ took from Simplenote and Google Keep, played in a real browser on a desktop and a phone width:
// sort orders, tag:/is:/color: search, renaming a tag, the archive, a colour per note, a copy, ticked items to the bottom, line starts that
// format as you type, focus mode and text size, a backup and its import, and Simplenote's and Keep's own exports imported. Rules: lib/note-organise.js.
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright-core'; import { acquire as acquireHeavy } from './heavy.mjs';
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); } fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
await acquireHeavy('notes rivals in a browser (notes-rivals-e2e.mjs)');
const browser = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const base = process.env.NOTES_BASE || 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-rivals-'));
for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(tag + ': ' + e.message));
  if (!process.env.NOTES_BASE) await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
  const store = () => page.evaluate(() => (() => { try { return JSON.parse(localStorage.getItem('a2m.void.notes.v1') || '{"docs":[]}'); } catch (_) { return { docs: [] }; } })());
  const listTitles = async () => (await page.locator('#list li .t').allInnerTexts()).map((t) => t.replace(/^\u2605 /, ''));
  const ready = () => page.waitForFunction(() => document.querySelectorAll('#sortSel option').length === 6 && document.querySelectorAll('#colors button').length === 12, null, { timeout: 10000 });
  await page.goto(base + '/notes/'); await ready();
  const write = async (title, body) => { await page.click('#newBtn'); await page.keyboard.type(title); await page.keyboard.press('Enter'); if (body) await page.keyboard.type(body); await page.waitForTimeout(550); };
  await page.click('#dtitle'); await page.keyboard.type('Banana'); await page.keyboard.press('Enter'); await page.keyboard.type('yellow fruit'); await page.waitForTimeout(550);
  await write('apple', 'red fruit'); await write('Cherry', 'small fruit');
  // sort orders
  await page.selectOption('#sortSel', 'name-az'); ok((await listTitles()).join() === 'apple,Banana,Cherry', tag + ': Sort Name A-Z');
  await page.selectOption('#sortSel', 'created-old'); ok((await listTitles()).join() === 'Banana,apple,Cherry', tag + ': Sort Created oldest');
  await page.selectOption('#sortSel', 'modified-new'); ok((await listTitles())[0] === 'Cherry', tag + ': Sort Modified newest');
  ok((await page.evaluate(() => (() => { try { return JSON.parse(localStorage.getItem('a2m.void.notes.prefs')).sort; } catch (_) { return null; } })())) === 'modified-new', tag + ': the sort order is kept');
  // tags, tag: search, renaming a tag on every note
  await page.fill('#tagsIn', 'fruit, red'); await page.keyboard.press('Tab'); await page.waitForTimeout(150);
  await page.locator('#list li button', { hasText: 'apple' }).click(); await page.fill('#tagsIn', 'fruit'); await page.keyboard.press('Tab'); await page.waitForTimeout(150);
  await page.fill('#sq', 'tag:red'); await page.waitForTimeout(100); ok((await listTitles()).join() === 'Cherry', tag + ': tag:red finds the tagged note');
  await page.fill('#sq', 'fruit tag:fruit'); await page.waitForTimeout(100); ok((await listTitles()).length === 2, tag + ': words and tag: together');
  await page.fill('#sq', ''); await page.locator('#tagchips button', { hasText: '#fruit' }).click(); ok(await page.locator('#tagTools').isVisible(), tag + ': a tag filter shows Rename and Remove');
  page.once('dialog', (d) => d.accept('food')); await page.click('#tagRen'); await page.waitForTimeout(150);
  let s = await store(); ok(s.docs.filter((d) => (d.tags || []).includes('food')).length === 2 && !s.docs.some((d) => (d.tags || []).includes('fruit')), tag + ': Rename tag renames it on every note');
  page.once('dialog', (d) => d.accept()); await page.click('#tagDel'); await page.waitForTimeout(150); s = await store(); ok(!s.docs.some((d) => (d.tags || []).includes('food')), tag + ': Remove tag takes it off every note, the notes stay'); ok(s.docs.length === 3, tag + ': three notes still');
  // colour
  await page.locator('#list li button', { hasText: 'Banana' }).click(); await page.click('#colors button[aria-label="Sand"]'); await page.waitForTimeout(150);
  s = await store(); ok(s.docs.find((d) => d.title === 'Banana').color === 'sand', tag + ': a colour is kept on the note');
  ok((await page.locator('#doc').getAttribute('data-color')) === 'sand' && (await page.locator('#list li[data-color=sand]').count()) === 1, tag + ': the note and its row in the list take the colour');
  await page.fill('#sq', 'color:sand'); await page.waitForTimeout(100); ok((await listTitles()).join() === 'Banana', tag + ': color:sand finds it'); await page.fill('#sq', '');
  // copy
  await page.click('#copyBtn'); await page.waitForTimeout(150); s = await store(); const cp = s.docs.find((d) => d.title === 'Banana (copy)'); ok(cp && cp.color === 'sand' && /yellow fruit/.test(cp.html), tag + ': Make a copy');
  // archive
  await page.click('#arcBtn'); await page.waitForTimeout(150); ok(!(await listTitles()).includes('Banana (copy)'), tag + ': Archive takes the note out of the list');
  await page.click('#fArc'); ok((await listTitles()).join() === 'Banana (copy)', tag + ': the Archive view shows it'); await page.click('#fArc');
  await page.fill('#sq', 'is:archived'); await page.waitForTimeout(100); ok((await listTitles()).join() === 'Banana (copy)', tag + ': is:archived finds it'); await page.fill('#sq', '');
  // line starts that format as you type, then ticked items going to the bottom
  await write('Packing', ''); await page.keyboard.type('# Trip'); await page.keyboard.press('Enter'); await page.keyboard.type('[] passport'); await page.keyboard.press('Enter'); await page.keyboard.type('socks'); await page.keyboard.press('Enter'); await page.keyboard.type('charger');
  await page.waitForTimeout(550);
  ok((await page.locator('#body h1').innerText()).trim() === 'Trip', tag + ': "# " makes a heading');
  ok((await page.locator('#body ul.todo li.chk').count()) === 3, tag + ': "[] " makes a checklist');
  const first = page.locator('#body li.chk').first(); const bx = await first.boundingBox(); await page.mouse.click(bx.x + 8, bx.y + bx.height / 2); await page.waitForTimeout(550);
  ok((await page.locator('#body li.chk').allInnerTexts()).join() === 'socks,charger,passport' && (await page.locator('#body li.chk.done').innerText()) === 'passport', tag + ': a ticked item goes to the bottom');
  await page.locator('#body').click(); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.type('> mind the gap'); await page.waitForTimeout(550);
  ok((await page.locator('#body blockquote').count()) === 1, tag + ': "> " makes a quote ' + ((await page.locator('#body blockquote').count()) === 1 ? '' : await page.locator('#body').innerHTML()));
  // focus mode and size
  await page.click('#focusBtn'); ok(!(await page.locator('#side').isVisible()) && await page.locator('#body').isVisible(), tag + ': focus mode leaves only the note'); await page.click('#focusBtn'); ok(await page.locator('#side').isVisible(), tag + ': and comes back');
  const f0 = await page.locator('#body').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)); await page.click('#sizeUp'); await page.click('#sizeUp'); const f1 = await page.locator('#body').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  ok(f1 > f0 + 2, tag + ': A+ makes the text larger (' + f0 + ' to ' + f1 + ')'); await page.click('#sizeDn'); await page.click('#sizeDn');
  // backup, wipe, import the backup back, then Simplenote's and Keep's files
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bakBtn')]); const bp = path.join(tmp, tag + '-backup.json'); await dl.saveAs(bp);
  const bk = JSON.parse(fs.readFileSync(bp, 'utf8')); ok(bk.kind === 'verse-notes-backup' && bk.docs.length === 5, tag + ': Back up all notes saves all five in one file');
  await page.evaluate(() => localStorage.removeItem('a2m.void.notes.v1')); await page.reload(); await ready();
  await page.setInputFiles('#file', bp); await page.waitForTimeout(400); s = await store(); ok(s.docs.filter((d) => d.title).length === 5 && s.docs.some((d) => d.archived && d.color === 'sand'), tag + ': importing the backup brings back every note, archive and colour');
  const sn = path.join(tmp, 'notes.json'); fs.writeFileSync(sn, JSON.stringify({ activeNotes: [{ id: 'x', content: 'From Simplenote\n\nline one', creationDate: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-02T00:00:00.000Z', tags: ['old'] }], trashedNotes: [] }));
  const kp = path.join(tmp, 'Keep list.json'); fs.writeFileSync(kp, JSON.stringify({ color: 'BLUE', isTrashed: false, isPinned: false, isArchived: false, title: 'From Keep', userEditedTimestampUsec: 1700000000000000, createdTimestampUsec: 1700000000000000, listContent: [{ text: 'eggs', isChecked: false }], labels: [{ name: 'Shop' }] }));
  await page.setInputFiles('#file', [sn, kp]); await page.waitForTimeout(400); s = await store();
  ok(s.docs.some((d) => d.title === 'From Simplenote' && (d.tags || []).includes('old')), tag + ': a Simplenote export imports with its tags');
  ok(s.docs.some((d) => d.title === 'From Keep' && d.color === 'fog' && /<li class="chk">eggs/.test(d.html)), tag + ': a Google Keep Takeout note imports as a coloured checklist');
  await page.screenshot({ path: path.join(process.env.SHOTS || tmp, 'notes-rivals-' + tag + '.png'), fullPage: tag === 'desktop' });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(over <= 1, tag + ': nothing wider than the screen (' + over + ' px)' + (over > 1 ? ' ' + await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map((e) => e.tagName + '#' + e.id + '.' + e.className).join(' ')) : ''));
  await ctx.close();
}
ok(errs.length === 0, 'no page errors ' + errs.join('|')); await browser.close(); server.close(); process.exit(bad ? 1 : 0);
