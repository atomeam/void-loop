// A person-like run of the flights pages at 390 px (Chrome): the hub searches, opens the provider links, works out a route, keeps fares and a watch, reads a pasted
// confirmation into a trip with a layover warning and a calendar file; each lane page does its one job; German on a German browser; the pages open offline after a visit;
// no sideways overflow, no console errors, layout shift under 0.05. Saves screenshots into the directory given. node tools/heavy.mjs node tools/flights-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
const errors = [];
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write', 'notifications'] }), p = await ctx.newPage(); p.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); return { ctx, p }; };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const open = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains('pick') && !e.closest('footer') && e.type !== 'radio' && e.type !== 'checkbox'; }).map((e) => e.outerHTML.slice(0, 80))); ok(small.length === 0, name + ': every control is at least 24 px' + (small.length ? ' ' + small.join(' | ') : '')); };
const future = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const d1 = future(40), d2 = future(47), shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });

{ // ---- the hub ----
  const { ctx, p } = await mk(); const ms = await open(p, '/flights/?from=JFK&to=LIS&d=' + d1 + '&r=' + d2); await sane(p, 'hub', ms);
  let txt = await p.evaluate(() => document.body.innerText);
  ok(/Verse has no live fares/.test(txt), 'hub: says on the first screen that there are no live fares');
  ok(await p.evaluate(() => { const r = document.querySelector('.notice').getBoundingClientRect(); return r.top < 844; }), 'hub: the no-live-fares notice is on the first screen');
  const links = await p.$$eval('#pv-list a', (a) => a.map((x) => [x.href, x.rel, x.target])); ok(links.length === 5 && links.every((l) => /noopener/.test(l[1]) && /noreferrer/.test(l[1]) && l[2] === '_blank'), 'hub: five provider links, each with noopener noreferrer');
  const hosts = links.map((l) => new URL(l[0]).host); ok(['www.google.com', 'www.skyscanner.net', 'www.kayak.com', 'www.momondo.com', 'www.expedia.com'].every((h) => hosts.includes(h)), 'hub: Google Flights, Skyscanner, Kayak, Momondo and Expedia');
  ok(links.every((l) => l[0].includes(d1.slice(2).replace(/-/g, '')) || l[0].includes(d1) || l[0].includes(encodeURIComponent(+d1.slice(5, 7) + '/' + +d1.slice(8, 10) + '/' + d1.slice(0, 4)))), 'hub: every link carries the departure date');
  ok(/5,4\d\d km/.test(txt) && /3,3\d\d miles/.test(txt), 'hub: JFK to LIS is about 5,400 km and 3,360 miles'); ok(/Typical flight time\s+7 h/.test(txt.replace(/\n/g, ' ')) || /Typical flight time[\s\S]{0,10}[67] h/.test(txt), 'hub: a flight time of about 7 hours');
  ok(/Time difference[\s\S]{0,40}\+?[−-]?5 h/.test(txt) || /Time difference[\s\S]{0,40}5 h/.test(txt), 'hub: Lisbon is 5 hours ahead of New York'); ok(/CO2 per ticket/.test(txt), 'hub: CO2 per ticket');
  await shot(p, 'hub-390');
  // airport search by city: type lisbon in To, get LIS first
  await p.fill('#f-to', 'lon'); await p.waitForTimeout(150); let sug = await p.$$eval('#f-to-list button', (x) => x.map((y) => y.innerText)); ok(sug.length >= 4 && /LHR/.test(sug[0]), 'hub: typing "lon" lists London\'s airports, Heathrow first (' + sug.slice(0, 4).map((s) => s.slice(0, 3)).join(' ') + ')');
  await p.fill('#f-to', 'Zürich'); await p.waitForTimeout(150); sug = await p.$$eval('#f-to-list button', (x) => x.map((y) => y.innerText)); ok(/ZRH/.test(sug[0] || ''), 'hub: "Zürich" finds ZRH');
  await p.fill('#f-to', 'FRA'); await p.waitForTimeout(150); await p.click('#f-to-list button >> nth=0'); ok((await p.inputValue('#f-to')).includes('FRA'), 'hub: picking an airport fills the field');
  const near = await p.$$eval('#fa-near .chip', (x) => x.map((y) => y.dataset.code)); ok(near.length > 0, 'hub: nearby airports are offered (' + near.join(' ') + ')');
  await p.fill('#f-to', 'NYC'); await p.waitForTimeout(150); sug = await p.$$eval('#f-to-list button', (x) => x.map((y) => y.innerText.slice(0, 3))); ok(['JFK', 'LGA', 'EWR'].every((c) => sug.includes(c)), 'hub: the city code NYC lists JFK, LGA and EWR');
  await p.click('#f-to-list button >> nth=0');
  // the airline's own site
  await p.selectOption('#pv-al', 'TP'); ok((await p.getAttribute('#pv-aw', 'href')) === 'https://www.flytap.com/', 'hub: the airline picker opens that airline\'s own site');
  // price tracker
  await p.fill('#p-route', 'JFK-LIS'); await p.fill('#p-price', '480'); await p.click('#p-add'); await p.fill('#p-price', '420'); await p.click('#p-add'); await p.fill('#p-price', '455'); await p.click('#p-add');
  await p.fill('#w-route', 'JFK-LIS'); await p.fill('#w-target', '430'); await p.click('#w-add'); txt = await p.evaluate(() => document.body.innerText);
  ok(/Lowest seen[\s\S]{0,120}420 EUR/.test(txt), 'hub: the lowest seen of three fares is 420 EUR'); ok(/your target is met/.test(txt), 'hub: the watch at 430 says the target is met');
  ok((await p.locator('#p-chart svg').count()) === 1, 'hub: a chart of the fares is drawn'); await shot(p, 'hub-tracker-390');
  const dl = p.waitForEvent('download'); await p.click('#p-exp'); const f = await dl; const csv = fs.readFileSync(await f.path(), 'utf8'); ok(/^route,travel_date/.test(csv) && /JFK-LIS/.test(csv) && /420/.test(csv), 'hub: the fares export as CSV');
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1'); txt = await p.evaluate(() => document.body.innerText); ok(/420 EUR/.test(txt), 'hub: the fares survive a reload (kept on the device)');
  // import the csv back: no duplicates
  await p.setInputFiles('#p-imp', { name: 'f.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await p.waitForTimeout(300); ok(/Imported 0 fares/.test(await p.innerText('#p-msg')), 'hub: importing the same CSV adds nothing twice');
  await p.setInputFiles('#p-imp', { name: 'g.csv', mimeType: 'text/csv', buffer: Buffer.from('route,travel_date,return_date,price,currency,source,seen,note\nLHR-BCN,' + d1 + ',,39.5,GBP,Kayak,2026-10-01T10:00,=cmd\n') }); await p.waitForTimeout(300); ok(/Imported 1 fares/.test(await p.innerText('#p-msg')), 'hub: a CSV with a new fare is imported');
  // trip: paste a confirmation
  await p.fill('#i-paste', 'Booking reference: ABC123\nSaturday 12 December 2026\nBA 117 London Heathrow (LHR) 18:25 -> New York (JFK) 21:05\nSunday 13 December 2026\nUA 904 New York (JFK) 22:50 -> Lisbon (LIS) 10:40 +1');
  await p.click('#i-read'); await p.waitForTimeout(200); txt = await p.evaluate(() => document.body.innerText); ok(/2 flights read/.test(txt) && /ABC123/.test(txt), 'hub: two flights and the booking reference are read from the pasted text');
  ok(/Wait: 25 h 45 min/.test(txt) || /Wait: 25 h/.test(txt), 'hub: the wait between the flights is worked out across time zones (25 h 45 min)');
  await p.fill('#i-paste', 'BA 117 LHR 18:25 21:05\n2026-12-12\nIB 3170 JFK 21:30 05:15\n'); await shot(p, 'hub-trip-390');
  const ics = p.waitForEvent('download'); await p.click('#i-ics'); const fi = await ics; const icsText = fs.readFileSync(await fi.path(), 'utf8'); ok(/BEGIN:VCALENDAR/.test(icsText) && /DTSTART:20261212T182500Z/.test(icsText) && /SUMMARY:✈ BA 117 LHR/.test(icsText), 'hub: the trip downloads as a calendar file with the flight in UTC');
  await p.click('#i-link'); const link = await p.evaluate(() => navigator.clipboard.readText()); ok(/#trip=/.test(link), 'hub: the trip link is copied (' + link.length + ' characters)');
  const q = await mk(); await open(q.p, link.replace(/^https?:\/\/[^/]+/, '')); txt = await q.p.evaluate(() => document.body.innerText); ok(/BA\s*117/.test(txt) && /came from a link/.test(txt), 'hub: opening the trip link in another browser shows the trip'); await q.ctx.close();
  await ctx.close();
}
for (const [path_, name, check] of [
  ['/flights/trip/', 'trip', async (p) => { await p.fill('#i-paste', 'Confirmation code: XY12Z9\n3 Mar 2027\nLH 400 Frankfurt (FRA) 10:30 - New York JFK (JFK) 13:00\nLH 401 JFK 21:00 FRA 10:45 +1'); await p.click('#i-read'); await p.waitForTimeout(200); const t = await p.evaluate(() => document.body.innerText); ok(/2 flights read/.test(t), 'trip: reads two flights from a confirmation'); }],
  ['/flights/airports/?code=LIS', 'airports', async (p) => { const t = await p.evaluate(() => document.body.innerText); ok(/Lisbon/.test(t) && /LPPT/.test(t) && /Europe\/Lisbon/.test(t), 'airports: LIS is Lisbon, ICAO LPPT, zone Europe/Lisbon'); await p.fill('#a-q', 'japan'); await p.waitForTimeout(200); ok((await p.locator('#a-list li').count()) > 5, 'airports: a country lists its airports'); }],
  ['/flights/time/?from=JFK&to=LHR&d=' + future(30), 'time', async (p) => { const t = await p.evaluate(() => document.body.innerText); ok(/JFK → LHR/.test(t) && /7 h/.test(t) && /Arrives/.test(t) && /\+5 h/.test(t), 'time: JFK to LHR is about 7 h, arrives the next morning, +5 h time difference'); await p.fill('#f-via', 'Reykjavik'); await p.waitForTimeout(150); await p.click('#f-via-list button >> nth=0'); await p.waitForTimeout(150); ok(/Wait at/.test(await p.evaluate(() => document.body.innerText)), 'time: a stop and its wait show the whole journey'); }],
  ['/flights/distance/?from=LHR&to=JFK', 'distance', async (p) => { const t = await p.evaluate(() => document.body.innerText); ok(/5,5\d\d km/.test(t) && /3,4\d\d miles/.test(t) && /nm/.test(t), 'distance: LHR to JFK in km, miles and nautical miles'); ok((await p.locator('#r-map svg').count()) === 1, 'distance: a map of chained airports'); }],
  ['/flights/map/?route=JFK-LHR-SIN', 'map', async (p) => { const t = await p.evaluate(() => document.body.innerText); ok(/JFK → LHR/.test(t) && /LHR → SIN/.test(t) && /Total/.test(t), 'map: two legs and a total'); ok((await p.locator('#r-map path').count()) >= 3, 'map: a path per leg over the coastlines'); ok((await p.locator('#r-map path.coast').count()) === 1, 'map: the coastlines are drawn'); }],
  ['/flights/co2/?from=LHR&to=JFK', 'co2', async (p) => { const t = await p.evaluate(() => document.body.innerText); const kg = +((t.match(/([\d,]+)\s*kg CO2/) || [])[1] || '0').replace(/,/g, ''); ok(kg > 450 && kg < 700, 'co2: London to New York economy is ' + kg + ' kg (450 to 700 expected)'); ok(/How this is worked out/.test(t) && /0\.09 kg/.test(t), 'co2: the method is written out'); await p.selectOption('#f-c', 'business'); await p.waitForTimeout(150); const t2 = await p.evaluate(() => document.body.innerText); const kg2 = +((t2.match(/([\d,]+)\s*kg CO2/) || [])[1] || '0').replace(/,/g, ''); ok(kg2 > kg * 2.5 && kg2 < kg * 3.2, 'co2: business class is about 2.9 times economy (' + kg2 + ' kg)'); }],
  ['/flights/routes/?from=LIS', 'routes', async (p) => { const t = await p.evaluate(() => document.body.innerText); ok(/nonstop route from Lisbon/.test(t) && /MAD/.test(t) && /nonstop in 2014/.test(t) && /June 2014/.test(t) && /ODbL/.test(t), 'routes: nonstop from Lisbon to Madrid in the June 2014 data, credited under the ODbL'); await p.uncheck('#w-n'); await p.waitForTimeout(100); ok(/Airports a flight from Lisbon/.test(await p.evaluate(() => document.body.innerText)), 'routes: without the nonstop filter, every airport in range'); }],
]) {
  const { ctx, p } = await mk(); const ms = await open(p, path_); await sane(p, name, ms); await check(p); await shot(p, name + '-390'); await ctx.close();
}
{ // ---- German ----
  const { ctx, p } = await mk('de-DE'); await open(p, '/flights/?from=BER&to=BCN&d=' + d1); const t = await p.evaluate(() => document.body.innerText);
  ok(/Flüge/.test(t) && /Suche über mehrere Anbieter/.test(t) && /Streckendaten/.test(t) && !/Search across providers/.test(t), 'German browser: the hub speaks German'); await shot(p, 'hub-de-390'); await ctx.close();
}
{ // ---- offline ----
  const { ctx, p } = await mk(); await open(p, '/flights/airports/?code=LIS'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1', null, { timeout: 6000 }).catch(() => {}); const t = await p.evaluate(() => document.body.innerText);
  ok(/Lisbon/.test(t) && /Airport finder|Airport codes/.test(t), 'offline: the airport page reloads with the network cut and still knows Lisbon'); await ctx.close();
}
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
