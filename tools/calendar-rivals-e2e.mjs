// node tools/calendar-rivals-e2e.mjs: what /calendar/ took from Google Calendar, Outlook Bookings, Proton and Cozi, in a real browser at
// desktop and phone width: a booking link made from the free times, opened by a guest in another time zone who books one, the pick's link
// opened by the host and added; time insights for the week; undo after deleting an event. Rules: lib/cal-booking.js.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core'; import { acquire as acquireHeavy } from './heavy.mjs';
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); } fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
await acquireHeavy('calendar rivals in a browser (calendar-rivals-e2e.mjs)');
const browser = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const live = !!process.env.CALENDAR_BASE, base = process.env.CALENDAR_BASE || 'http://127.0.0.1:' + server.address().port; let bad = 0; const errs = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const ready = (p) => p.waitForFunction(() => document.getElementById('view') && document.getElementById('view').children.length > 0 && !!document.getElementById('insBtn'), null, { timeout: 15000 }).catch(() => {});
for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
  const host = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/New_York', locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] });
  const guest = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Europe/Berlin', locale: 'en-GB' });
  for (const c of [host, guest]) { c.on('page', (p) => p.on('pageerror', (e) => errs.push(tag + ': ' + e.message))); if (!live) await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' })); }
  const hp = await host.newPage(); await hp.goto(base + '/calendar/'); await ready(hp);
  // the host: an event to keep a slot busy, then the booking link
  await hp.fill('#q', 'Dentist tomorrow 10am'); await hp.click('#add'); await hp.waitForTimeout(300);
  await hp.click('#findBtn'); await hp.selectOption('#fLen', '30'); await hp.fill('#bkTitle', 'Intro call'); await hp.fill('#bkHost', 'Sam'); await hp.fill('#bkEmail', 'sam@example.com'); await hp.click('#bkGo');
  const link = await hp.inputValue('#bkOut'); ok(/\/calendar\/\?book=/.test(link) && /\d+ times, 30 min/.test(await hp.locator('#bkNote').innerText()), tag + ': Make a booking link (' + (await hp.locator('#bkNote').innerText()) + ')');
  // the guest, six hours ahead: the same instants in their own time
  const gp = await guest.newPage(); await gp.goto(link.replace(/^https?:\/\/[^/]+/, base)); await ready(gp); await gp.waitForFunction(() => /Intro call/.test(document.getElementById('bkBody').innerText) && document.querySelectorAll('#bkTimes .bkSlots button').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(await gp.locator('#bookCard').isVisible() && /Intro call/.test(await gp.locator('#bkBody').innerText()) && /Europe\/Berlin/.test(await gp.locator('#bkBody').innerText()), tag + ': the guest sees the booking card in their own time zone (' + (await gp.locator('#bkBody').innerText()).replace(/\s+/g,' ') + ')');
  const hostFirst = await hp.evaluate((u) => { const o = JSON.parse(atob(new URL(u).searchParams.get('book').replace(/-/g, '+').replace(/_/g, '/'))); return o.s[0]; }, link);
  const firstBtn = gp.locator('#bkTimes .bkSlots button').first(); const shown = await firstBtn.innerText();
  const expect = new Date(hostFirst * 60000).toLocaleTimeString('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', minute: '2-digit' });
  ok(shown.replace(/\s/g, '').includes(expect.replace(/\s/g, '')), tag + ': the first time shows as ' + shown + ' in Berlin (' + expect + ')');
  ok((await gp.locator('#bkTimes .bkSlots button').count()) >= 2, tag + ': several times to pick from');
  await firstBtn.click(); await gp.fill('#bkName', 'Ana'); await gp.fill('#bkMsg', 'About the shop'); await gp.click('#bkBook'); await gp.waitForTimeout(200);
  ok(/Booked and in your calendar/.test(await gp.locator('#bkDoneT').innerText()), tag + ': Book this time confirms');
  const gEv = await gp.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events.find((e) => /Intro call with Sam/.test(e.title))); ok(!!gEv, tag + ': the guest\'s calendar has "Intro call with Sam"');
  ok(/^mailto:sam@example\.com/.test(await gp.locator('#bkMail').getAttribute('href') || ''), tag + ': Send it by email is addressed to the host');
  const back = await gp.locator('#bkDone').getAttribute('data-back');
  // the host opens the pick
  await hp.goto(back.replace(/^https?:\/\/[^/]+/, base)); await ready(hp); await hp.waitForFunction(() => /booked/.test(document.getElementById('bdBody').innerText), null, { timeout: 15000 }).catch(() => {});
  ok(/Ana booked Intro call/.test(await hp.locator('#bdBody').innerText()), tag + ': the host sees who booked what (' + (await hp.locator('#bdBody').innerText()).replace(/\s+/g,' ') + ')');
  await hp.click('#bdAdd'); await hp.waitForTimeout(200);
  const hEv = await hp.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events.find((e) => /Intro call with Ana/.test(e.title)));
  ok(hEv && new Date(hEv.start).getTime() === new Date(gEv.start).getTime() - 6 * 3600000 + (new Date(gEv.start).getTimezoneOffset() - new Date(hEv.start).getTimezoneOffset()) * 60000 || (hEv && hEv.id === gEv.id), tag + ': the host\'s calendar has "Intro call with Ana", the same booking');
  ok(hEv && hEv.notes === 'About the shop', tag + ': with the guest\'s note');
  // time insights
  await hp.goto(base + '/calendar/?d=' + hEv.start.slice(0, 10)); await ready(hp); await hp.click('#insBtn');
  const sum = await hp.locator('#insSum').innerText(); ok(/\d+ (?:h|min)/.test(sum) && /event/.test(sum), tag + ': Time insights sums the week (' + sum.slice(0, 80) + ')');
  ok((await hp.locator('#insDays .bar').count()) === 7 && (await hp.locator('#insCals .bar').count()) >= 1, tag + ': by day and by calendar');
  // undo a delete
  const n0 = await hp.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events.length);
  await hp.fill('#q', 'Throwaway tomorrow 4pm'); await hp.click('#add'); await hp.waitForSelector('#detail:not([hidden])'); hp.once('dialog', (d) => d.accept()); await hp.click('#detDel'); await hp.waitForTimeout(200);
  ok(await hp.locator('#undoB').isVisible() && (await hp.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events.length)) === n0, tag + ': Delete offers Undo');
  await hp.click('#undoB'); await hp.waitForTimeout(150); ok((await hp.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.calendar.v1')).events.some((e) => e.title === 'Throwaway'))), tag + ': Undo brings it back');
  await hp.click('#findBtn'); await hp.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'calendar-rivals-' + tag + '.png'), fullPage: tag === 'desktop' });
  await gp.goto(link.replace(/^https?:\/\/[^/]+/, base)); await ready(gp); await gp.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'calendar-booking-' + tag + '.png'), fullPage: false });
  for (const [p, who] of [[hp, 'host'], [gp, 'guest']]) { const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(over <= 1, tag + ' ' + who + ': nothing wider than the screen (' + over + ' px)'); }
  await host.close(); await guest.close();
}
ok(errs.length === 0, 'no page errors ' + errs.join('|')); await browser.close(); server.close(); process.exit(bad ? 1 : 0);
