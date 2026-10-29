// A person-like run of /email/ at 390 px: it says on the first screen that Verse does not send or receive mail; a template fills a draft, the
// spam check moves as the words change, the draft opens as mailto:, Gmail and Outlook.com links and saves as an .eml that reads back; an .mbox and
// an .eml are opened, searched with operators, a message is read with its HTML in a sandbox (remote pictures blocked), its attachment downloads,
// its headers and unsubscribe links are shown; pasted headers are checked; German on a German browser; offline after a visit; no sideways overflow,
// layout shift under 0.05, no console errors.   node tools/heavy.mjs node tools/email-page.mjs <screenshot dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { NEWSLETTER } from './email-fixtures.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); if (u.pathname.startsWith('/api/')) { res.writeHead(404); return res.end('{}'); } let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
const errors = [], net = []; let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }), p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && !/favicon|404|ERR_INTERNET_DISCONNECTED|Failed to load resource|Content Security Policy/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && !r.url().startsWith('about:')) net.push(r.url()); }); return { ctx, p }; };
const openPage = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.mailReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); if (ms != null) { const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)'); }
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href],input:not(.pick),select,textarea,summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !(e.tagName === 'A' && e.closest('footer,p,li,.mtext')); }).map((e) => e.outerHTML.slice(0, 70)));
  ok(small.length === 0, name + ': every tap target is at least 24 px' + (small.length ? ' (' + small.join(' | ') + ')' : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
const text = (p) => p.evaluate(() => document.body.innerText);

const { ctx, p } = await mk();
let ms = await openPage(p, '/email/'); await sane(p, 'write', ms);
ok(await p.evaluate(() => { const r = document.getElementById('m-honest').getBoundingClientRect(); return r.top < 844 && /cannot send or receive email/.test(document.getElementById('m-honest').textContent); }), 'the first screen says Verse cannot send or receive email');
await p.selectOption('#w-tpl', 'meeting'); ok((await p.inputValue('#w-subject')).startsWith('Could we meet'), 'a template fills the subject and the message');
await p.fill('#w-to', 'ana@example.org'); await p.fill('#w-subject', 'Lunch on Saturday'); await p.fill('#w-body', 'Hi Ana, are you free at noon on Saturday? Ben'); await p.waitForTimeout(100);
let score = +(await p.textContent('#w-score .big')).split(' ')[0]; ok(score < 3 && /reads clean/.test(await p.textContent('#w-score')), 'a plain note reads clean (' + score + ')');
await p.fill('#w-subject', 'URGENT!!! YOU HAVE WON'); await p.fill('#w-body', 'CLICK HERE to claim $5000. Act now! https://bit.ly/xyz'); await p.waitForTimeout(100);
score = +(await p.textContent('#w-score .big')).split(' ')[0]; ok(score >= 5 && /SHORT_LINK/.test(await p.textContent('#w-score')), 'a shouting draft with a short link is likely junk (' + score + '), each reason named');
await p.fill('#w-subject', 'Lunch on Saturday'); await p.fill('#w-body', 'Hi Ana,\nare you free at noon? Café Rosa.\nBen');
const mt = await p.getAttribute('#w-mailto', 'href'); ok(mt === 'mailto:ana@example.org?subject=Lunch%20on%20Saturday&body=Hi%20Ana%2C%0D%0Aare%20you%20free%20at%20noon%3F%20Caf%C3%A9%20Rosa.%0D%0ABen', 'Open in my mail app is a correct mailto: link');
ok(/^https:\/\/mail\.google\.com\/mail\/\?view=cm/.test(await p.getAttribute('#w-gmail', 'href')) && /outlook\.live\.com/.test(await p.getAttribute('#w-outlook', 'href')), 'the draft opens in Gmail\'s and Outlook.com\'s own compose windows');
const dl = p.waitForEvent('download'); await p.click('#w-eml'); const f = await dl; const eml = fs.readFileSync(await f.path(), 'utf8');
ok(/X-Unsent: 1/.test(eml) && /Subject: Lunch on Saturday/.test(eml) && /Caf=C3=A9 Rosa/.test(eml), 'Save as .eml writes a ready-to-send mail file (' + eml.length + ' bytes)');
await p.click('#w-save'); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.mailReady === '1'); ok(/Drafts on this device/.test(await text(p)) && /Lunch on Saturday/.test(await text(p)), 'a saved draft is still there after a reload');
await shot(p, 'email-write-390');
// read: an .mbox of two and an .eml
await p.click('#tab-read');
const mbox = 'From ben@example.net Tue Oct 20 10:00:00 2026\nFrom: Ben <ben@example.net>\nTo: ana@example.org\nSubject: Saturday\nDate: Tue, 20 Oct 2026 10:00:00 +0000\n\nNoon at Café Rosa?\n\nFrom c@example.com Wed Oct 21 10:00:00 2026\nFrom: Carla <c@example.com>\nSubject: Invoice\nDate: Wed, 21 Oct 2026 10:00:00 +0000\n\nAttached.\n';
await p.setInputFiles('#r-file', [{ name: 'box.mbox', mimeType: 'application/mbox', buffer: Buffer.from(mbox) }, { name: 'news.eml', mimeType: 'message/rfc822', buffer: Buffer.from(NEWSLETTER) }, { name: 'phish.eml', mimeType: 'message/rfc822', buffer: Buffer.from('From: PayPal <service@paypa1-secure.example>\nReply-To: claims@freemail.example\nAuthentication-Results: mx; spf=fail; dkim=fail; dmarc=fail\nSubject: Your account is limited\nDate: Sun, 25 Oct 2026 08:00:00 +0000\n\nVerify your account now: http://192.0.2.7/login\n') }]); await p.waitForTimeout(300);
ok(/4 messages/.test(await text(p)), 'an .mbox of two and two .eml files make four messages');
ok(/⚠ likely junk · Your account is limited/.test(await text(p)), 'the phishing mail is flagged as likely junk in the list');
await p.fill('#r-q', 'is:junk'); await p.waitForTimeout(100); ok(/1 message/.test(await text(p)) && /Your account is limited/.test(await text(p)), 'is:junk finds it');
await p.fill('#r-q', 'has:attachment'); await p.waitForTimeout(100); ok(/1 message/.test(await text(p)) && /Grüße aus dem Café/.test(await text(p)), 'has:attachment finds the one with a PDF');
await p.fill('#r-q', 'from:ben OR from:carla'); await p.waitForTimeout(100); ok(/2 messages/.test(await text(p)), 'from:ben OR from:carla finds two');
await p.fill('#r-q', 'cafe'); await p.waitForTimeout(100); ok(/2 messages/.test(await text(p)), 'a word finds it with or without its accent');
await sane(p, 'read', null);
await p.fill('#r-q', 'subject:grüße'); await p.click('.mrow');
let t = await text(p); ok(/Kürbissuppe/.test(t) && /Café Shop <news@shop.example>/.test(t), 'a message opens with its sender and words decoded');
ok(/SPF\s*pass/.test(t) && /DKIM\s*pass/.test(t) && /DMARC\s*pass/.test(t) && /Return-Path/.test(t), 'the headers: SPF, DKIM and DMARC pass, and the Return-Path on another domain is said');
ok(/one-click unsubscribe offered/.test(t) && await p.locator('#m-unsub a[href="https://shop.example/u/123"]').count() === 1, 'the unsubscribe links are found, one-click said');
await p.click('#m-html'); await p.waitForTimeout(500);
const fr = p.frameLocator('#m-frame iframe'); ok(/Herbstmenü/.test(await fr.locator('body').innerText()), 'the formatted mail shows in a sandbox');
ok(!net.some((u) => /track\.example/.test(u)), 'the tracking pixel was not fetched');
ok(/1 remote picture blocked/.test(await p.textContent('#m-blocked')), 'the page says one remote picture was blocked');
const dl2 = p.waitForEvent('download'); await p.click('button:has-text("Menü.pdf")'); const f2 = await dl2; ok(fs.readFileSync(await f2.path(), 'utf8') === '%PDF-1.4 fake', 'the attachment downloads as it was sent');
await p.locator('#m-frame iframe').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(out, 'email-html-390.png') }); ok(await p.evaluate(() => document.querySelector('.mtext').hidden), 'the plain text steps aside while the formatted mail shows');
await shot(p, 'email-read-390');
// check pasted headers
await p.click('#tab-check'); await p.fill('#c-raw', 'From: PayPal <service@paypa1-secure.example>\nReply-To: claims@freemail.example\nAuthentication-Results: mx.example.org; spf=fail; dkim=none; dmarc=fail\nSubject: Your account is limited'); await p.click('#c-go');
t = await text(p); ok(/Reply-To goes to freemail\.example/.test(t) && /SPF: fail/.test(t) && /DMARC: fail/.test(t), 'pasted phishing headers: the Reply-To and the failed checks are warned about');
await shot(p, 'email-check-390');
// the gate's addresses: the sample checked, a junk draft from the link, a search from the link
await p.goto(base + '/email/?tab=check&sample=1'); await p.waitForFunction(() => document.documentElement.dataset.mailReady === '1'); t = await text(p);
ok(/SPF\s*pass/.test(t) && /one-click unsubscribe offered/.test(t) && /Its spam score: \d/.test(t), '/email/?tab=check&sample=1 checks the sample at once');
await p.goto(base + '/email/?tab=read&sample=1&q=from:shop'); await p.waitForFunction(() => document.documentElement.dataset.mailReady === '1'); await p.waitForTimeout(100); t = await text(p);
ok(/1 message/.test(t) && /Our autumn menu is here/.test(t), '/email/?tab=read&sample=1&q=from:shop searches the sample from the link');
await ctx.close();
{ const { ctx, p } = await mk('de-DE'); await openPage(p, '/email/'); const t = await text(p);
  ok(await p.evaluate(() => document.documentElement.lang) === 'de' && /Schreiben/.test(t) && /kein Postfach|keine E-Mails senden/.test(t) && !/Write an email/.test(t), 'German browser: the page speaks German'); await shot(p, 'email-de-390'); await ctx.close(); }
{ const { ctx, p } = await mk(); await openPage(p, '/email/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1200); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(1500); const t = await text(p);
  ok(/Email/.test(t) && /Spam check/.test(t), 'offline: /email/ reloads with the network cut and its tools still work'); await ctx.close(); }
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
