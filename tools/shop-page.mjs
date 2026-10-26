// A person-like run of the shopping pages at 390 px (Chrome), and the gate's own measure of each (tools/tower-gate.mjs measure: speed, sharing, offline, German, design
// look, the probe's truth and facts) on the questions the gate asks. The open product databases are answered by a stand-in here (the run must not depend on their network
// or spend their rate limit); everything else is the real page. Saves screenshots into the directory given.  node tools/heavy.mjs node tools/shop-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { measure, defects } from './tower-gate.mjs';
import { probeFor, score, withFeatureFacts } from './tower-probes.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
process.env.TOWER_PRIVATE = process.env.TOWER_PRIVATE || path.join(out, 'private'); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
// the stand-in for Open Food Facts and its sisters: one product by code, a short list by name, nothing else known
const NUT = { code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g', categories: 'Spreads,Sweet spreads', nutriscore_grade: 'e' };
const stub = async (ctx) => ctx.route(/open(?:food|products|beauty)facts\.org/, (r) => { const u = r.request().url(), off = /openfoodfacts/.test(u);
  if (/\/api\/v2\/product\/(\d+)/.test(u)) { const code = u.match(/product\/(\d+)/)[1]; return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(off && (code === NUT.code || code === '4006381333931') ? { status: 1, product: code === NUT.code ? NUT : { code, product_name: 'Fineliner', brands: 'Stabilo', quantity: '1 pen' } } : { status: 0 }) }); }
  if (/search\.pl/.test(u)) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ products: off && /nutella/i.test(u) ? [NUT, { ...NUT, code: '3017620422003', quantity: '750 g' }] : [] }) });
  return r.fulfill({ status: 404, body: '' }); });
const orig = b.newContext.bind(b); b.newContext = async (o) => { const c = await orig(o); await stub(c); return c; };
const errors = [];
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }), p = await ctx.newPage(); p.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); return { ctx, p }; };
const open = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.shopReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)');
  const fp = await p.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0); ok(fp > 0 && fp < 200, name + ': first paint ' + Math.round(fp) + ' ms');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea,summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains('pick') && e.type !== 'radio' && e.type !== 'checkbox' && !(e.tagName === 'A' && e.closest('p,li') && e.closest('p,li').textContent.trim() !== e.textContent.trim()); }).map((e) => e.outerHTML.slice(0, 80))); ok(small.length === 0, name + ': every control is at least 24 px' + (small.length ? ' ' + small.join(' | ') : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
const txt = (p) => p.evaluate(() => document.body.innerText);

// ---- 1. the gate's own measure of each shopping floor, on the question it asks ----
for (const f of FLOORS.filter((x) => x.id === 'shopping' || x.lane === 'shopping')) {
  const pr = withFeatureFacts(probeFor(f.id), f.id), m = await measure(b, base + pr.ask.verse, 'shop-' + f.page.replace(/\W+/g, '-') + 'verse', null, pr);
  const look = m.design || {}, parts = Object.entries(pr.askParts).map(([a, l]) => [a, score(m.text, l)]);
  ok(m.truth.n === m.truth.of, f.id + ': truth ' + m.truth.n + '/' + m.truth.of + (m.truth.missing.length ? ' missing ' + m.truth.missing.join(', ') : ''));
  ok(m.facts.n === m.facts.of, f.id + ': facts ' + m.facts.n + '/' + m.facts.of + (m.facts.missing.length ? ' missing ' + m.facts.missing.join(', ') : ''));
  for (const [a, s] of parts) ok(s.n === s.of, f.id + ': ' + a + ' ' + s.n + '/' + s.of + (s.missing.length ? ' missing ' + s.missing.join(', ') : ''));
  ok(m.sharing === 4, f.id + ': sharing ' + m.sharing + '/4'); ok(m.offline === 1, f.id + ': offline ' + m.offline); ok(m.german === 1, f.id + ': German ' + m.german); ok(m.mobile === 0 && m.a11y === 0, f.id + ': mobile overflow ' + m.mobile + ', unnamed controls ' + m.a11y);
  ok(defects(look) === 0, f.id + ': design look contrast ' + look.contrast + ', small targets ' + look.targets + ', shift ' + (look.cls || 0).toFixed(3)); ok(m.speed < 200, f.id + ': load ' + m.speed + ' ms');
}

// ---- 2. a person on the hub: a parcel, a barcode, a product into the list, the cart's totals, CSV, a list link opened elsewhere ----
{
  const { ctx, p } = await mk(); const ms = await open(p, '/shop/?track=1Z999AA10123456784&code=3017624010701'); await sane(p, 'hub', ms);
  ok(await p.evaluate(() => document.querySelector('.notice').getBoundingClientRect().top < 844), 'hub: "does not stock or ship goods" is on the first screen');
  await p.waitForSelector('#l-out li', { timeout: 5000 }).catch(() => {}); let t = await txt(p);
  ok(/Nutella/.test(t) && /Ferrero/.test(t) && /400 g/.test(t), 'hub: the barcode finds Nutella, Ferrero, 400 g'); ok(/EAN-13 3017624010701: the check digit is right/.test(t), 'hub: the barcode\'s check digit is right');
  const ups = await p.$eval('#t-out a.go', (a) => [a.href, a.rel, a.target]); ok(/^https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784$/.test(ups[0]) && /noopener/.test(ups[1]) && ups[2] === '_blank', 'hub: the parcel opens on UPS\'s own page');
  const stores = await p.$$eval('#s-list a', (a) => a.map((x) => x.href)); ok(stores.length >= 7 && stores.some((u) => u === 'https://www.amazon.com/s?k=3017624010701'), 'hub: the barcode is searched on ' + stores.length + ' stores');
  await shot(p, 'hub-390');
  await p.click('#l-out .add'); await p.fill('#c-name', 'Milk'); await p.fill('#c-qty', '2'); await p.fill('#c-price', '1.19'); await p.fill('#c-store', 'Aldi'); await p.click('#c-add');
  await p.fill('#c-name', 'Headphones'); await p.fill('#c-price', '49.99'); await p.fill('#c-store', 'Amazon'); await p.click('#c-add');
  await p.click('#cart details summary'); await p.fill('#c-tax', '10'); await p.dispatchEvent('#c-tax', 'change'); await p.waitForTimeout(100);
  t = await txt(p); ok(/Ferrero Nutella/.test(t), 'hub: the product went into the list'); ok(/\$57\.61\s*in all/.test(t.replace(/\n/g, ' ')), 'hub: 2 x 1.19 at Aldi and 49.99 at Amazon with 10% tax rounded per store (0.24 + 5.00) = $57.61 in all');
  ok(/Headphones on Amazon/.test(t), 'hub: a check-out link per item at the store');
  await shot(p, 'hub-cart-390');
  const dl = p.waitForEvent('download'); await p.click('#c-csv'); const csv = fs.readFileSync(await (await dl).path(), 'utf8'); ok(/^name,qty,price/.test(csv) && /Headphones,1,49\.99,49\.99,Amazon/.test(csv) && /grand total/.test(csv), 'hub: the list exports as CSV with totals');
  await p.click('#c-link'); const link = await p.evaluate(() => navigator.clipboard.readText()); ok(/#list=/.test(link), 'hub: the list link is copied');
  const q = await mk(); await open(q.p, link.replace(/^https?:\/\/[^/]+/, '')); t = await txt(q.p); ok(/came from a link/.test(t) && /Headphones/.test(t), 'hub: the list link opens the list in another browser'); await q.ctx.close();
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.shopReady === '1'); ok(/Headphones/.test(await txt(p)), 'hub: the list survives a reload (kept on the device)');
  // the unit price comparer, a return window, a price log with a target
  t = await txt(p); ok(/best buy/.test(t), 'hub: the unit price comparer marks the best buy');
  await p.fill('#r-name', 'Shoes'); await p.fill('#r-days', '14'); await p.click('#r-add'); ok(/14 days left/.test(await txt(p)), 'hub: a return window bought today has 14 days left');
  await p.fill('#p-name', 'Headphones'); await p.fill('#p-price', '59.99'); await p.fill('#p-target', '45'); await p.click('#p-add'); await p.fill('#p-price', '44.50'); await p.click('#p-add');
  t = await txt(p); ok(/your target is met/.test(t) && /Lowest seen\s*\$44\.50/.test(t), 'hub: two prices logged, the lowest $44.50 and the target met');
  await shot(p, 'hub-more-390');
  await ctx.close();
}
// ---- 3. each lane page does its one job ----
for (const [url, name, check] of [
  ['/shop/track/?track=' + encodeURIComponent('1Z999AA10123456785'), 'track', async (p) => { const t = await txt(p); ok(/check digit wrong: a typo\?/.test(t), 'track: a 1Z number with a wrong last digit is flagged as a typo');
    await p.fill('#t-in', 'TBA123456789012'); await p.click('#t-go'); await p.fill('#t-out .lab', 'Book'); await p.fill('#t-out .exp', new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)); await p.click('#t-out .keep');
    ok(/Book[\s\S]{0,80}Amazon Logistics[\s\S]{0,60}expected in [23] days/.test(await txt(p)), 'track: an Amazon parcel kept with its expected day');
    const dl = p.waitForEvent('download'); await p.click('#t-ics'); const ics = fs.readFileSync(await (await dl).path(), 'utf8'); ok(/BEGIN:VCALENDAR/.test(ics) && /SUMMARY:📦 Book/.test(ics), 'track: the parcel goes to the calendar'); }],
  ['/shop/barcode/?code=4006381333932', 'barcode', async (p) => { ok(/the check digit is wrong \(it should be 1\)/.test(await txt(p)), 'barcode: a wrong EAN check digit names the right one'); }],
  ['/shop/product/?q=nutella', 'product', async (p) => { await p.waitForSelector('#l-out li'); const t = await txt(p); ok(/2 products found/.test(t) && /750 g/.test(t), 'product: a name search lists the products'); }],
  ['/shop/wishlist/', 'wishlist', async (p) => { await p.fill('#w-name', 'Rain jacket'); await p.fill('#w-url', 'javascript:alert(1)'); await p.click('#w-add'); ok(/A link starts with https/.test(await txt(p)), 'wishlist: a link that is not http(s) is refused');
    await p.fill('#w-url', 'https://example.com/jacket'); await p.fill('#w-price', '89'); await p.click('#w-add'); await p.click('#w-link'); const link = await p.evaluate(() => navigator.clipboard.readText());
    const q = await mk(); await open(q.p, link.replace(/^https?:\/\/[^/]+/, '')); await q.p.check('#w-items .bought'); ok(/Rain jacket[\s\S]{0,60}bought/.test(await txt(q.p)), 'wishlist: a giver opens the link and marks the jacket bought'); await shot(q.p, 'wishlist-shared-390'); await q.ctx.close(); }],
  ['/shop/list/', 'list', async (p) => { await p.fill('#c-name', 'Apples'); await p.fill('#c-qty', '6'); await p.click('#c-add'); await p.check('#c-list .tick'); await p.click('#c-clear'); ok(/1 ticked items cleared/.test(await txt(p)), 'list: a ticked item is cleared'); }],
  ['/shop/parcels/?track=' + encodeURIComponent('RA123456785US\nCP123456785CN'), 'parcels', async (p) => { const t = await txt(p); ok(/2 numbers read/.test(t) && /China Post/.test(t) && /USPS/.test(t), 'parcels: two international numbers, each to its post'); }],
]) { const { ctx, p } = await mk(); const ms = await open(p, url); await sane(p, name, ms); await check(p); await shot(p, name + '-390'); await ctx.close(); }
{ // ---- German ----
  const { ctx, p } = await mk('de-DE'); await open(p, '/shop/'); const t = await txt(p);
  ok(/Einkaufen/.test(t) && /Liste und Warenkorb/.test(t) && /Ein Paket verfolgen/.test(t) && !/List and cart/.test(t), 'German browser: the hub speaks German'); await shot(p, 'hub-de-390'); await ctx.close();
}
{ // ---- offline: a parcel number read with the network cut ----
  const { ctx, p } = await mk(); await open(p, '/shop/track/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.goto(base + '/shop/track/?track=3318810025', { waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.shopReady === '1', null, { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(300);
  ok(/DHL Express/.test(await txt(p)), 'offline: the tracker opens with the network cut and names DHL Express'); await ctx.close();
}
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
