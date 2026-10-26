// "Send to" between pages, played through in Chrome at 390 px (lib/handoff.js; owner, 2026-10-26: "and link them all if they are usable together"):
// a pasted trip to the calendar, the clocks and the map; a note to the board and the word counter; a quote to the notes; a PDF page to the photo
// tools and a photo into a PDF; an .ics file to the calendar through IndexedDB; the calendar's event to the clocks. Each hand-off is pressed the way
// a person would, the next page is checked for what arrived, and a screenshot of it is saved into the directory given.
//   node tools/heavy.mjs node tools/link-pages-e2e.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Europe/London' });
const errors = []; ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
// the later route wins in Playwright: every other /api/ call answers 'unavailable' first, the markets feed is stood in for after
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
await ctx.route('**/api/markets?**', (r) => { const q = new URL(r.request().url()).searchParams; // a quote for s=, empty lists for the strip, the watchlist and the movers
  const body = q.has('s') ? { ok: true, sym: 'AAPL', name: 'Apple Inc.', kind: 'stock', price: 201.5, change: 2.1, pct: 1.05, currency: 'USD', range: '1y', points: [] } : q.has('movers') ? { ok: true, up: [], down: [], of: 0 } : { ok: true, quotes: [] };
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }); });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
const shot = (n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
const send = async (to, kind) => { const sel = '.tk-send[data-to="' + to + '"]' + (kind ? '[data-kind="' + kind + '"]' : ''); await p.waitForSelector(sel, { timeout: 10000 }); await p.locator(sel).scrollIntoViewIfNeeded(); await Promise.all([p.waitForURL((u) => u.pathname.startsWith(to), { timeout: 15000 }), p.click(sel)]); await p.waitForLoadState('load'); };
const got = async () => (await p.waitForSelector('.tk-got', { timeout: 15000 }).catch(() => null)) ? (await p.innerText('.tk-got')).replace(/\s*✕\s*$/, '') : '';
const wide = async (name) => ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px');

// 1. a pasted trip -> the calendar
await p.goto(base + '/flights/trip/', { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1', null, { timeout: 10000 });
await p.fill('#i-paste', 'Booking reference: ABC123\nSaturday 12 December 2026\nBA 117 London Heathrow (LHR) 18:25 -> New York (JFK) 21:05\nSunday 13 December 2026\nUA 904 New York (JFK) 22:50 -> Lisbon (LIS) 10:40 +1');
await p.click('#i-read'); await p.waitForTimeout(200);
const btns = await p.$$eval('.tk-send', (x) => x.map((y) => y.textContent)); ok(btns.includes('Send the flights to Calendar') && btns.includes('Send the route to Flight map'), 'trip: offers ' + btns.join(' | '));
await shot('trip-send-row');
await send('/calendar/', 'event'); let note = await got(); ok(/From Flight itinerary.*added 2 events/i.test(note) || /added 2 events/.test(note), 'calendar: says what arrived (' + note + ')');
let cal = await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1') || '{}').events || []);
const ba = cal.find((e) => /BA 117/.test(e.title)); ok(!!ba && ba.start === '2026-12-12T18:25' && ba.tz === 'Europe/London' && ba.end === '2026-12-13T02:05', 'calendar: BA 117 kept at 18:25 London time, landing 02:05 on that clock (' + JSON.stringify(ba && [ba.start, ba.end, ba.tz]) + ')');
ok(cal.some((e) => /UA 904/.test(e.title) && e.tz === 'America/New_York'), 'calendar: UA 904 kept on New York time');
ok(!/send/.test(new URL(p.url()).hash), 'calendar: the hand-off is taken off the address');
ok(/BA 117/.test(await p.evaluate(() => document.body.innerText)), 'calendar: the flight shows in the month it falls in'); await wide('calendar'); await shot('calendar-from-trip');
// a reload does not add them twice
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800); cal = await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1') || '{}').events || []); ok(cal.filter((e) => /BA 117/.test(e.title)).length === 1, 'calendar: a reload adds nothing twice');

// 2. the trip -> the map and the clocks
await p.goto(base + '/flights/trip/', { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1');
await send('/flights/map/', 'route'); ok(new URL(p.url()).searchParams.get('route') === 'LHR-JFK-LIS', 'map: opens with the route LHR-JFK-LIS (' + p.url() + ')');
await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1'); await p.waitForTimeout(300); ok(/Total/.test(await p.evaluate(() => document.body.innerText)), 'map: the legs and the total are drawn'); await wide('map'); await shot('map-from-trip');
await p.goto(base + '/flights/trip/', { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1');
await send('/time/', 'event'); const tu = new URL(p.url()); ok(tu.searchParams.get('at') === '2026-12-12T18:25:00.000Z' && /London/.test(tu.searchParams.get('c')) && /New York/.test(tu.searchParams.get('c')), 'time: opens at the departure moment with London and New York (' + tu.search + ')');
await p.waitForTimeout(500); ok(/New York/.test(await p.evaluate(() => document.body.innerText)), 'time: New York is on the clocks'); await wide('time'); await shot('time-from-trip');

// 3. a note -> the board and the word counter
await p.goto(base + '/notes/?q=' + encodeURIComponent('note: Packing - passport, charger, socks'), { waitUntil: 'load' }); await p.waitForTimeout(800);
await send('/kanban/', 'text'); note = await got(); ok(/card/.test(note), 'kanban: says a card arrived (' + note + ')');
let kb = await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.kanban.v1') || '{}')); const cards = (kb.boards || []).flatMap((x) => x.columns.flatMap((c) => c.cards));
ok(cards.some((c) => /Packing/.test(c.title)), 'kanban: the note is a card titled after it (' + cards.map((c) => c.title).join(', ') + ')'); await wide('kanban'); await shot('kanban-from-note');
await p.goto(base + '/notes/', { waitUntil: 'load' }); await p.waitForTimeout(800);
await send('/word-count/', 'text'); note = await got(); ok(/counted \d+ words/.test(note), 'word count: counts the note (' + note + ')'); ok(/passport/.test(await p.inputValue('#text')), 'word count: the note is in the box'); await shot('wordcount-from-note');
// the board -> a note
await p.goto(base + '/kanban/', { waitUntil: 'load' }); await send('/notes/', 'list'); note = await got(); ok(/a new note/.test(note), 'notes: the board\'s cards arrive as a note (' + note + ')');
ok(/Packing/.test(await p.evaluate(() => document.getElementById('body').innerText)), 'notes: the note lists the cards'); await shot('notes-from-kanban');

// 4. a quote -> the notes (the markets feed is stood in for: the test is the hand-off)
await p.goto(base + '/markets/?s=AAPL', { waitUntil: 'load' }); await p.waitForTimeout(1500);
await send('/notes/', 'text'); note = await got(); ok(/a new note/.test(note), 'notes: the quote arrives (' + note + ')');
ok(/Apple Inc\. \(AAPL\): 201\.5/.test(await p.evaluate(() => document.getElementById('body').innerText)), 'notes: the note holds the price and the symbol'); await wide('notes'); await shot('notes-from-markets');

// 5. a PDF page -> the photo tools -> back into a PDF
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<<>>>>endobj\n4 0 obj<</Length 35>>stream\n0 0 1 rg 20 20 160 160 re f\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
await p.goto(base + '/pdf/?tool=pdf2img', { waitUntil: 'load' }); await p.setInputFiles('#app input.pick', { name: 'square.pdf', mimeType: 'application/pdf', buffer: pdf }); await p.waitForTimeout(1500);
await send('/photos/', 'file'); note = await got(); ok(/opened square-page-1\.png/.test(note), 'photos: page 1 of the PDF arrives as a picture (' + note + ')');
await p.waitForFunction(() => window.__photos && window.__photos.items().length === 1, null, { timeout: 10000 }).catch(() => {}); ok(await p.evaluate(() => !!window.__photos && window.__photos.items().length === 1), 'photos: the picture is open to edit'); await wide('photos'); await shot('photos-from-pdf');
await p.waitForTimeout(800); await send('/pdf/', 'file'); note = await got(); ok(/Images to PDF/.test(note), 'pdf: the photo lands in Images to PDF (' + note + ')');
ok(/square-page-1/.test(await p.evaluate(() => document.querySelector('ol.files').innerText)), 'pdf: the picture is in the list, ready'); ok(await p.evaluate(() => !document.querySelector('button.go').disabled), 'pdf: Images to PDF can be pressed'); await wide('pdf'); await shot('pdf-from-photos');

// 6. an .ics file -> the calendar, through IndexedDB (a file never rides in the address)
await p.goto(base + '/tools/', { waitUntil: 'load' });
const url = await p.evaluate(async () => { const H = await import('/lib/handoff.js'); const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1\r\nSUMMARY:Dentist\r\nDTSTART:20261120T150000\r\nDTEND:20261120T153000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  return H.send('/calendar/', { kind: 'file', from: '/tools/', data: { name: 'dentist.ics', type: 'text/calendar', blob: new Blob([ics], { type: 'text/calendar' }) } }, () => {}); });
ok(/^\/calendar\/#send-id=[a-z0-9]+$/.test(url), 'ics: a file goes by IndexedDB, only its id in the address (' + url + ')');
await p.goto(base + url, { waitUntil: 'load' }); note = await got(); ok(/added 1 event/.test(note), 'calendar: the .ics is read (' + note + ')');
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events)).some((e) => e.title === 'Dentist'), 'calendar: Dentist is kept');
await p.goto(base + url, { waitUntil: 'load' }); await p.waitForTimeout(1200); ok((await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events)).filter((e) => e.title === 'Dentist').length === 1, 'ics: the stored hand-off is read once, then gone');

// 7. the calendar's next events -> the clocks; a hostile payload stays text
await p.goto(base + '/calendar/', { waitUntil: 'load' }); await p.waitForTimeout(800); await send('/time/', 'event'); ok(new URL(p.url()).searchParams.has('at'), 'time: the calendar\'s next event opens on the clocks (' + new URL(p.url()).search + ')');
const evil = await p.evaluate(async () => { const H = await import('/lib/handoff.js'); return H.toHash(H.clean({ kind: 'text', from: '/x/', data: { title: '<img src=x onerror=window.__pwned=1>', text: '<script>window.__pwned=1</script>' } })); });
await p.goto(base + '/notes/' + evil, { waitUntil: 'load' }); await got(); await p.waitForTimeout(300);
ok(await p.evaluate(() => !window.__pwned && !document.querySelector('#body img, #body script')), 'notes: markup sent as text stays text'); await shot('notes-hostile');

// 7b. a job application's next step -> the calendar (the tracker on /jobs/)
await p.goto(base + '/jobs/', { waitUntil: 'load' }); await p.waitForSelector('#jb-addapp', { timeout: 15000 });
await p.evaluate(() => { const d = document.querySelector('#tracker details'); if (d) d.open = true; });
await p.fill('#ja-title', 'Designer'); await p.fill('#ja-company', 'Acme'); await p.selectOption('#ja-stage', 'interview'); await p.click('#jb-addapp button[type=submit]');
await p.waitForSelector('#jb-apps .app .nx', { timeout: 8000 }); await p.fill('#jb-apps .app .nx', '2026-11-04'); await p.dispatchEvent('#jb-apps .app .nx', 'change');
await send('/calendar/', 'job'); note = await got(); ok(/added 1 event/.test(note), 'calendar: the next step arrives (' + note + ')');
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events)).some((e) => e.title === 'Interview: Designer at Acme' && e.start === '2026-11-04' && e.allDay), 'calendar: "Interview: Designer at Acme" on 4 November, all day'); await shot('calendar-from-jobs');

// 8. the index of everything (/tools/): fast, still, searchable as you type, every page in it, and every page leads to it
{ const q = await ctx.newPage(); q.on('pageerror', (e) => errors.push(e.message));
  await q.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await q.goto(base + '/tools/', { waitUntil: 'load' }); const ms = Date.now() - t0; const fcp = await q.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0);
  ok(fcp < 200, 'everything: first paint ' + Math.round(fcp) + ' ms (load ' + ms + ' ms)'); await q.waitForTimeout(800); ok(await q.evaluate(() => window.__cls) < 0.05, 'everything: layout shift ' + (await q.evaluate(() => window.__cls)).toFixed(3));
  const big = await q.innerText('.count'); ok(/\d+\s*tools[\s\S]*\d+\s*skills[\s\S]*\d+\s*sites beaten/.test(big), 'everything: the count is shown big (' + big.replace(/\s+/g, ' ') + ')');
  await q.screenshot({ path: path.join(out, 'everything-top.png') });
  await q.fill('#q', 'pdf'); const n1 = await q.innerText('#hits'); const shown = await q.$$eval('main li:not([hidden]) > a', (a) => a.map((x) => x.getAttribute('href')));
  ok(/\d+ matches/.test(n1) && shown.includes('/pdf/') && !shown.includes('/wheel/'), 'everything: "pdf" as you type (' + n1 + ': ' + shown.slice(0, 5).join(' ') + ')'); ok(/[?&]q=pdf/.test(q.url()), 'everything: the search is in the link');
  await q.screenshot({ path: path.join(out, 'everything-pdf.png') });
  await q.fill('#q', 'wordcounter.net'); ok((await q.$$eval('main li:not([hidden]) > a', (a) => a.map((x) => x.getAttribute('href')))).includes('/word-count/'), 'everything: a beaten site finds the page that beat it');
  await q.fill('#q', 'zzqx nothing'); ok(await q.isVisible('#none'), 'everything: nothing found offers to ask Verse');
  await q.goto(base + '/tools/?q=flight', { waitUntil: 'load' }); ok((await q.$$eval('main li:not([hidden]) > a', (a) => a.map((x) => x.getAttribute('href')))).includes('/flights/trip/'), 'everything: ?q=flight opens filtered');
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= 390), 'everything: no sideways overflow at 390 px');
  const locs = [...fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/a-to-mind\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
  await q.goto(base + '/tools/', { waitUntil: 'load' }); const listed = new Set(await q.$$eval('main li[data-s] > a', (a) => a.map((x) => x.getAttribute('href')))); ok(locs.every((l) => listed.has(l)), 'everything: all ' + locs.length + ' sitemap pages are listed');
  await q.goto(base + '/store/', { waitUntil: 'load' }); await q.waitForSelector('#related a[href="/tools/"]', { timeout: 8000 }).catch(() => {}); ok(/Everything Verse does/.test(await q.innerText('#related').catch(() => '')), 'store: its row links "Everything Verse does"');
  await q.close(); }

ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
