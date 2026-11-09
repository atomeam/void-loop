// node tools/translate-rivals-e2e.mjs: what /translate/ took from DeepL Write and the other translators, in a real browser at desktop and
// phone width: Improve writing with a style and a tone and the changes shown, Use it to translate, Ctrl+Enter, Ctrl+Shift+S, a document dropped
// on the text box, and the saved phrases as CSV. /api/translate is the real route (functions/api/translate.js) with a fixed stand-in for the
// model binding, so the page, the route and lib/translate-write.js are all in play. TRANSLATE_BASE=https://a-to-mind.com runs it live instead.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core'; import { acquire as acquireHeavy } from './heavy.mjs';
import { onRequestPost } from '../void-live-deploy/functions/api/translate.js';
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const FIX = { 'I has a apple. It are red.': 'I have an apple. It is red.' };
const env = { AI: { run: async (m, a) => {
  if (a.messages) { const t = /"""([\s\S]*?)"""/.exec(a.messages[1].content)[1]; return { response: FIX[t] || t }; }
  return { translated_text: a.text.replace(/apple/g, 'manzana').replace(/^I have an?/, 'Tengo una') };
} } };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/translate' && req.method === 'POST') { let b = ''; for await (const c of req) b += c; const r = await onRequestPost({ request: new Request('http://127.0.0.1' + u.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: b }), env }); res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text()); }
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
await new Promise((r) => server.once('listening', r));
await acquireHeavy('translate rivals in a browser (translate-rivals-e2e.mjs)');
const browser = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const live = !!process.env.TRANSLATE_BASE, base = process.env.TRANSLATE_BASE || 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(tag + ': ' + e.message));
  if (!live) await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto(base + '/translate/?from=en&to=es'); await page.waitForFunction(() => document.querySelectorAll('#wrStyle option').length === 5, null, { timeout: 15000 });
  ok(!(await page.locator('#langHits').isVisible()), tag + ': no empty pill under the language search');
  // improve writing
  await page.fill('#in', 'I has a apple. It are red.'); await page.click('#writeB');
  ok(await page.locator('#writeD').evaluate((d) => d.open) && (await page.inputValue('#wrIn')) === 'I has a apple. It are red.', tag + ': Improve writing opens with the text');
  await page.selectOption('#wrStyle', 'simple'); await page.selectOption('#wrTone', 'friendly'); await page.click('#wrGo');
  await page.waitForFunction(() => !document.getElementById('wrRes').hidden && /changed|nothing changed/.test(document.getElementById('wrNote').textContent), null, { timeout: 30000 }).catch(() => {});
  const ins = await page.locator('#wrOut ins').allInnerTexts(), note = await page.locator('#wrNote').innerText();
  if (live) ok(ins.length > 0 && /words? changed/.test(note), tag + ': live: the model improved it (' + note + '; added: ' + ins.join('|') + ')');
  else { ok(ins.join('|') === 'have|an|is' && /3 words changed/.test(note), tag + ': the changes are marked word by word (' + note + ')'); ok((await page.locator('#wrOut del').count()) === 3, tag + ': the old words shown struck through'); }
  await page.uncheck('#wrShow'); ok(!(await page.locator('#wrOut del').first().isVisible()), tag + ': Show changes off leaves the clean text'); await page.check('#wrShow');
  await page.click('#wrUse'); await page.waitForTimeout(300); const used = await page.inputValue('#in'); ok(used !== 'I has a apple. It are red.' && used.length > 10, tag + ': Use it to translate puts it in the box');
  // shortcuts
  await page.fill('#in', 'I have an apple'); await page.focus('#in'); await page.keyboard.press('Control+Enter');
  await page.waitForFunction(() => { const t = document.getElementById('out').textContent.trim(); return t && !/…$/.test(t); }, null, { timeout: 20000 }).catch(() => {});
  ok(/manzana|apple/i.test(await page.locator('#out').innerText()) && !/…$/.test((await page.locator('#out').innerText()).trim()), tag + ': Ctrl+Enter translates (' + (await page.locator('#out').innerText()).trim().slice(0, 40) + ')');
  await page.keyboard.press('Control+Shift+S'); await page.waitForTimeout(400); ok((await page.inputValue('#from')) === 'es' && (await page.inputValue('#to')) === 'en', tag + ': Ctrl+Shift+S swaps the languages');
  await page.keyboard.press('Control+Shift+S'); await page.waitForTimeout(400);
  // a file dropped on the text box goes to the document translator
  const dropped = await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['Hello world'], 'hi.txt', { type: 'text/plain' })); const p = document.getElementById('in').closest('.pane'); let got = ''; addEventListener('change', (e) => { if (e.target.id === 'doc') got = e.target.files[0] && e.target.files[0].name; }, { once: true, capture: true }); p.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); const hl = p.classList.contains('drop'); p.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return { hl, got }; });
  ok(dropped.hl && dropped.got === 'hi.txt', tag + ': a file dropped on the text box goes to Document (' + JSON.stringify(dropped) + ')');
  // saved phrases as CSV
  await page.waitForTimeout(800); await page.fill('#in', 'I have an apple'); await page.click('#go'); await page.waitForFunction(() => !document.getElementById('save').disabled, null, { timeout: 20000 }).catch(() => {}); await page.click('#save'); await page.waitForTimeout(200);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#csvB')]);
  const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : ''; ok(/^Text,Translation,From,To\r\n/.test(csv) && /I have an apple/.test(csv), tag + ': Export .csv gives the saved phrases');
  await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'translate-rivals-' + tag + (live ? '-live' : '') + '.png'), fullPage: tag === 'desktop' });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(over <= 1, tag + ': nothing wider than the screen (' + over + ' px)');
  await ctx.close();
}
ok(errs.length === 0, 'no page errors ' + errs.join('|')); await browser.close(); server.close(); process.exit(bad ? 1 : 0);
