// node tools/news-page-e2e.mjs: the News page in a real browser at 390 px with FIXTURE feeds (tools/news-fixtures.mjs; /api/news answered by the real
// route code over made-up feeds, no publisher is contacted): rows with source and age, 3 sources grouped, sections, search, follow, saved, text size,
// reading mode, language, layout shift, no sideways scroll, and a reload with the network cut. Saves tools/news.shot.png for a person to read.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { askIn, lookNews } from '../void-live-deploy/functions/api/news.js'; import { fixtureFor } from './news-fixtures.mjs';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'allow' }); const page = await ctx.newPage();
const base = 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
let hits = 0;
await ctx.route(/\/api\/news/, async (r) => { hits++; const out = await lookNews(askIn(r.request().url()), async (u) => new Response(fixtureFor(String(u)), { status: 200 })); await r.fulfill({ status: out.ok ? 200 : 502, contentType: 'application/json', body: JSON.stringify({ ...out, ...askIn(r.request().url()) }) }); });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
const t0 = Date.now(); await page.goto(base + '/news/?sec=world', { waitUntil: 'load' }); const loadMs = Date.now() - t0;
await page.waitForFunction(() => !document.getElementById('app').hasAttribute('aria-busy') && document.querySelectorAll('#list .story').length > 0, null, { timeout: 8000 });
ok(loadMs < 1500, 'load event in ' + loadMs + ' ms on localhost');
const rows = await page.locator('#list .story').count(); ok(rows >= 8, rows + ' headline rows');
const text = await page.locator('main').innerText();
const names = new Set([...text.matchAll(/(BBC News|The Guardian|NPR|DW|Al Jazeera|CBC News) · (?:just now|\d+ (?:min|h|d) ago)/g)].map((m) => m[1])); ok(names.size >= 3, 'source and age on rows from ' + names.size + ' sources: ' + [...names].join(', '));
ok(/Sources \((\d+) of \d+ answered\)/.test(text), 'the sources line: ' + (text.match(/Sources \(\d+ of \d+ answered\)/) || [''])[0]);
ok((await page.locator('.story .more', { hasText: '3 sources' }).count()) === 1, 'the quake story is one row with "3 sources"');
await page.locator('.story .more', { hasText: '3 sources' }).click(); ok((await page.locator('.also li').count()) === 3 && (await page.locator('.also a').first().getAttribute('href')).startsWith('https://'), 'it lists the three outlets, each linking out');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
await page.waitForTimeout(400); const cls = await page.evaluate(() => window.__cls); ok(cls < 0.05, 'layout shift ' + cls.toFixed(4));
ok(await page.evaluate(() => [...document.querySelectorAll('button,a,select,input')].filter((e) => e.offsetParent && !e.closest('#secs') && !e.closest('.story .t') && !e.closest('.also') && !e.closest('.srcs') && !e.closest('footer') && !e.closest('#related') && !e.closest('#asks')).every((e) => { const b = e.getBoundingClientRect(); return b.width >= 40 && b.height >= 40; })), 'controls are at least 40 px');
await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname), 'news.shot.png') });
// search, source filter
await page.fill('#q', 'budget'); await page.waitForTimeout(300); ok((await page.locator('#list .story').count()) === 2, 'search "budget" keeps 2 rows'); await page.fill('#q', ''); await page.waitForTimeout(300);
await page.selectOption('#src', 'dw'); ok((await page.locator('#list .story .src').allInnerTexts()).every((s) => s === 'DW') && (await page.locator('#list .story').count()) >= 1, 'the source filter shows only DW'); await page.selectOption('#src', '');
// save, follow
await page.locator('#list .story').first().locator('button[aria-pressed]').click(); await page.click('[data-sec=saved]'); ok((await page.locator('#list .story').count()) === 1, 'a starred story is in Saved');
await page.click('[data-sec=my]'); ok(/Follow a topic or a source/.test(await page.locator('#status').innerText()), 'My news asks you to follow something first');
await page.fill('#topic', 'wind'); await page.click('#addTopic'); await page.waitForTimeout(250);
ok((await page.locator('#list .story .t').allInnerTexts()).some((t) => /wind farm/i.test(t)), 'following "wind" brings the wind farm story to My news');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.news.v1')).topics.join() === 'wind'), 'the followed topic is kept on the device');
// text size and reading mode, language
await page.click('[data-sec=world]'); const fs0 = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)); await page.click('#size'); ok(await page.evaluate((a) => parseFloat(getComputedStyle(document.body).fontSize) > a, fs0), 'Aa + makes the text larger');
await page.click('#compact'); ok(await page.evaluate(() => getComputedStyle(document.querySelector('.story .s')).display === 'none'), 'Headlines only hides the summaries');
await page.selectOption('#lang', 'es'); await page.waitForTimeout(400); ok((await page.locator('#secs button:visible').count()) === 3 && (await page.evaluate(() => document.documentElement.lang)) === 'es', 'Español: top stories only, the page language follows');
await page.selectOption('#lang', 'en'); await page.waitForTimeout(300);
// offline: the service worker keeps the page; the headlines come from the device
await page.goto(base + '/news/'); await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || true); await page.waitForTimeout(1500); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
await ctx.setOffline(true); await ctx.unroute(/\/api\/news/);
await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForFunction(() => document.querySelectorAll('#list .story').length > 0, null, { timeout: 8000 }).catch(() => {});
ok((await page.locator('#list .story').count()) > 0 && /Offline|headlines kept|updated/.test(await page.locator('#status').innerText()), 'offline reload shows the page and the last headlines: ' + (await page.locator('#status').innerText()));
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close(); server.close(); console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
