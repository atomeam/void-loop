// A person's play-through of /photos/ at 390 px (real browser, local server, outside hosts blocked): a real photo with camera and place data goes in,
// is compressed and compared, cropped, adjusted, drawn on, texted, stripped; a batch comes out as a zip. Screenshots go to PHOTOS_SHOTS (default: temp).
//   node tools/heavy.mjs node tools/photos-e2e.mjs
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { readMeta } from '../void-live-deploy/lib/photo-edit.js';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), shots = process.env.PHOTOS_SHOTS || os.tmpdir();
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r)); const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true });
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, acceptDownloads: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message)); await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
// a real photograph-like picture (sky, hills, sun, noise), then a camera's EXIF block with a place spliced in after the JPEG header
await page.goto(base + '/photos/');
const jpg = Buffer.from(await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 1200); g.addColorStop(0, '#3b6fb6'); g.addColorStop(.6, '#f2b866'); g.addColorStop(1, '#2d4a2b'); x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
  x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(1150, 380, 90, 0, 7); x.fill(); for (let k = 0; k < 4; k++) { x.fillStyle = ['#3c5a35', '#2f4a2c', '#243d24', '#1b301c'][k]; x.beginPath(); x.moveTo(0, 800 + k * 90); for (let i = 0; i <= 16; i++) x.lineTo(i * 100, 780 + k * 90 + Math.sin(i * 1.3 + k) * 60); x.lineTo(1600, 1200); x.lineTo(0, 1200); x.fill(); }
  const id = x.getImageData(0, 0, 1600, 1200); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - .5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95)); return [...new Uint8Array(await b.arrayBuffer())]; }));
const le = (n, k) => { const a = []; for (let i = 0; i < k; i++) a.push((n >> (8 * i)) & 255); return a; }, ent = (tag, type, count, val) => [...le(tag, 2), ...le(type, 2), ...le(count, 4), ...val], asc = (s) => [...Buffer.from(s + '\0')], rat = (n, d) => [...le(n, 4), ...le(d, 4)];
const make = asc('Fujifilm'), model = asc('X100V'), date = asc('2024:06:15 18:30:05'), serial = asc('SN-4471-9920'), ifd0Len = 2 + 4 * 12 + 4, makeAt = 8 + ifd0Len, modelAt = makeAt + make.length, exifAt = modelAt + model.length, exifLen = 2 + 2 * 12 + 4, dateAt = exifAt + exifLen, serAt = dateAt + date.length, gpsAt = serAt + serial.length, ratAt = gpsAt + 2 + 4 * 12 + 4;
const tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0, ...le(4, 2), ...ent(0x010f, 2, make.length, le(makeAt, 4)), ...ent(0x0110, 2, model.length, le(modelAt, 4)), ...ent(0x8769, 4, 1, le(exifAt, 4)), ...ent(0x8825, 4, 1, le(gpsAt, 4)), ...le(0, 4), ...make, ...model,
  ...le(2, 2), ...ent(0x9003, 2, date.length, le(dateAt, 4)), ...ent(0xa431, 2, serial.length, le(serAt, 4)), ...le(0, 4), ...date, ...serial, ...le(4, 2), ...ent(1, 2, 2, [78, 0, 0, 0]), ...ent(2, 5, 3, le(ratAt, 4)), ...ent(3, 2, 2, [87, 0, 0, 0]), ...ent(4, 5, 3, le(ratAt + 24, 4)), ...le(0, 4), ...rat(38, 1), ...rat(42, 1), ...rat(0, 1), ...rat(9, 1), ...rat(8, 1), ...rat(0, 1)];
const body = [...Buffer.from('Exif\0\0'), ...tiff], photo = Buffer.concat([jpg.subarray(0, 2), Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), Buffer.from(body), jpg.subarray(2)]);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-e2e-')), f1 = path.join(dir, 'Lisbon trip.jpg'), f2 = path.join(dir, 'second.jpg'); fs.writeFileSync(f1, photo); fs.writeFileSync(f2, jpg);
ok(readMeta(photo).has.gps, 'the test photo carries a place (' + (photo.length / 1000).toFixed(0) + ' KB)');
const t0 = Date.now(); await page.goto(base + '/photos/', { waitUntil: 'load' }); const loadMs = Date.now() - t0; await page.waitForFunction(() => document.documentElement.dataset.photos === 'ready', null, { timeout: 15000 });
const cls = await page.evaluate(() => new Promise((res) => { let v = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} setTimeout(() => res(v), 400); }));
ok(loadMs < 400, 'load event in ' + loadMs + ' ms (local, cold)'); ok(cls < 0.05, 'layout shift ' + cls.toFixed(3));
await page.screenshot({ path: path.join(shots, 'photos-1-empty.png') });
await page.setInputFiles('#file', f1); await page.waitForFunction(() => window.__photos.items().length === 1);
await page.waitForFunction(() => /→/.test(document.getElementById('line').textContent), null, { timeout: 15000 });
const line = await page.textContent('#line'); ok(/KB|MB/.test(line) && /saved/.test(line), 'compress says what was saved: ' + line);
await page.fill('#q', '40').catch(() => {}); await page.$eval('#q', (e) => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(900);
const line40 = await page.textContent('#line'); ok(line40 !== line, 'a lower quality changes the size: ' + line40);
await page.screenshot({ path: path.join(shots, 'photos-2-compare.png') });
// the saved copy has no camera or place data
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dl')]); const saved = fs.readFileSync(await dl.path()); const sm = readMeta(saved);
ok(saved[0] === 0xff && sm.items.length === 0 && !sm.has.gps, 'the saved JPEG (' + dl.suggestedFilename() + ', ' + saved.length + ' B) has no camera or place data');
// format: WebP and a 16-colour PNG
await page.selectOption('#fmt', 'image/png'); await page.selectOption('#cols', '16'); await page.waitForTimeout(1500); const png = await page.textContent('#line'); ok(/→/.test(png), 'PNG with 16 colours: ' + png);
const [dp] = await Promise.all([page.waitForEvent('download'), page.click('#dl')]); const pb = fs.readFileSync(await dp.path()); ok(pb[1] === 0x50 && readMeta(pb).width > 0, 'a real PNG came back (' + pb.length + ' B)');
await page.selectOption('#fmt', 'image/webp'); await page.waitForTimeout(2500); ok(/WebP|webp/i.test(await page.textContent('#note')), 'WebP: ' + await page.textContent('#note'));
await page.click('#pcts button[data-p="25"]'); await page.waitForTimeout(900); ok(/400 × 300/.test(await page.textContent('#note')), 'resized to 25%: ' + await page.textContent('#note'));
await page.click('#pcts button[data-p="100"]'); await page.selectOption('#fmt', 'keep');
// crop 1:1, rotate, adjust, filter, draw, text, undo
await page.click('#tabs [data-t=crop]'); await page.click('#aspects button:nth-child(2)'); await page.waitForTimeout(200); await page.screenshot({ path: path.join(shots, 'photos-3-crop.png') }); await page.click('#docrop'); await page.waitForTimeout(300);
let dims = await page.evaluate(() => { const b = window.__photos.items()[0].base; return [b.width, b.height]; }); ok(dims[0] === dims[1] && dims[0] === 1200, 'crop 1:1 gives ' + dims.join(' × '));
await page.click('#rotr'); await page.click('#flh');
await page.click('#tabs [data-t=adj]'); await page.$eval('[data-a=bri]', (e) => { e.value = 25; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.$eval('[data-a=sat]', (e) => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); });
await page.click('#tabs [data-t=fil]'); await page.click('#filters [data-f=warm]');
await page.click('#tabs [data-t=draw]'); const box = await page.$eval('#ov', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.move(box.x + box.w * .2, box.y + box.h * .3); await page.mouse.down(); await page.mouse.move(box.x + box.w * .5, box.y + box.h * .5, { steps: 8 }); await page.mouse.move(box.x + box.w * .8, box.y + box.h * .3, { steps: 8 }); await page.mouse.up();
await page.click('#tabs [data-t=text]'); await page.fill('#ttxt', 'Lisbon 2024'); const tb = await page.$eval('#ov', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }); await page.mouse.click(tb.x + tb.w * .5, tb.y + tb.h * .85); await page.waitForTimeout(300);
const hist = await page.textContent('#histn'); ok(/\d+ steps/.test(hist), 'history counts the steps: ' + hist); await page.evaluate(() => document.getElementById('stage').scrollIntoView());
await page.screenshot({ path: path.join(shots, 'photos-4-edited.png') });
await page.click('#undo'); await page.click('#redo'); await page.click('#tabs [data-t=out]'); await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shots, 'photos-5-result.png') });
// exif view and strip-only
await page.click('#tabs [data-t=info]'); const info = await page.textContent('#p-info'); ok(/Fujifilm/.test(info) && /X100V/.test(info) && /SN-4471-9920/.test(info) && /38\.70000/.test(info), 'EXIF shows camera, serial and GPS'); ok(/place it was taken/.test(await page.textContent('#priv')), 'privacy line names the place');
await page.screenshot({ path: path.join(shots, 'photos-6-exif.png') });
const [ds] = await Promise.all([page.waitForEvent('download'), page.click('#stripOnly2')]); const sb = fs.readFileSync(await ds.path()); const sm2 = readMeta(sb); ok(sm2.items.length === 0 && sm2.width === 1600 && sb.length < photo.length, 'strip-only keeps the pixels (' + sm2.width + ' × ' + sm2.height + ') and drops the metadata (' + (photo.length - sb.length) + ' B)');
// batch: a second photo, a zip of both
await page.setInputFiles('#file', f2); await page.waitForFunction(() => window.__photos.items().length === 2); await page.click('#tabs [data-t=out]'); await page.waitForTimeout(800); await page.screenshot({ path: path.join(shots, 'photos-7-batch.png') });
const [dz] = await Promise.all([page.waitForEvent('download'), page.click('#zip')]); const zb = fs.readFileSync(await dz.path()); ok(zb[0] === 0x50 && zb[1] === 0x4b && zb.includes(Buffer.from('Lisbon_trip-verse')) && zb.includes(Buffer.from('second-verse')), 'a zip of two named files came back (' + zb.length + ' B)');
// German
await page.click('#lang'); ok(/Komprimieren/.test(await page.textContent('#tabs')) && /Foto-Werkzeuge/.test(await page.textContent('h1')), 'German on the switch'); await page.screenshot({ path: path.join(shots, 'photos-8-de.png') }); await page.click('#lang');
// the lane's own pages: each opens on its own first tab with everything else a tab away; the gate's one-pixel PNG gets the probe's truth on /photos/
const PIX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
for (const [slug, tab] of [['exif', 'p-info'], ['exifeditor', 'p-info'], ['photopea', 'p-adj'], ['iloveimg', 'p-crop'], ['squoosh', 'p-out'], ['tinypng', 'p-out']]) {
  const q = await ctx.newPage(); await q.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' })); await q.goto(base + '/photos/' + slug + '/'); await q.waitForFunction(() => document.documentElement.dataset.photos === 'ready');
  await q.setInputFiles('#file', f1); await q.waitForFunction(() => window.__photos.items().length === 1); await q.waitForTimeout(700);
  ok(await q.$eval('#' + tab, (e) => !e.hidden), '/photos/' + slug + '/ opens on its own tab (' + tab + ') and says "' + (await q.textContent('h1')) + '"'); await q.screenshot({ path: path.join(shots, 'photos-site-' + slug + '.png') }); await q.close();
}
{ const q = await ctx.newPage(); await q.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' })); await q.goto(base + '/photos/'); await q.waitForFunction(() => document.documentElement.dataset.photos === 'ready');
  const fx = fs.writeFileSync(path.join(dir, 'photo.png'), PIX); await q.setInputFiles('#file', path.join(dir, 'photo.png')); await q.waitForTimeout(1800); const txt = await q.evaluate(() => document.body.innerText);
  ok(/\b1 [×x] 1 px\b/.test(txt) && /\b\d+ B → \d+ B\b/.test(txt) && /\bPNG\b/.test(txt), 'the gate\'s one-pixel PNG: the page names 1 × 1 px, its size before and after, and PNG'); await q.close(); }
// paste
await page.evaluate(async (arr) => { const f = new File([new Uint8Array(arr)], 'pasted.jpg', { type: 'image/jpeg' }), dt = new DataTransfer(); dt.items.add(f); window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt })); }, [...jpg.subarray(0, 60000)]); await page.waitForTimeout(500);
// no horizontal scroll at 390 px; offline module list
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll at 390 px'); ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close(); server.close(); console.log(bad ? bad + ' FAILED' : 'photos e2e: all ok (screenshots in ' + shots + ')'); process.exit(bad ? 1 : 0);
