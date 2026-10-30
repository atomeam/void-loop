// node tools/generators-e2e.mjs [--shots <dir>]: the random generators floor as a person uses it, at 390 px, in a real browser on this machine.
// The static pages are served from void-live-deploy/; /api/image and /api/generators run the REAL route code (functions/api/image.js,
// functions/api/generators.js) with a stand-in D1 (node:sqlite), a stand-in edge cache, and a STUB painter: the image model answers with a
// made-up PNG drawn here (no Workers AI, no Pollinations, nothing leaves the machine). Then the painter is switched off to see the honest
// "resting" answer. What it does: writes a generator with nested lists and odds, reads the results, a plain error, the share link round trip,
// remix, publish and the hub; types a prompt and gets two pictures; the gate's own picture check (tools/tower-gate.mjs pictureOf) on /image/.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright-core';
import * as imageRoute from '../void-live-deploy/functions/api/image.js';
import * as hubRoute from '../void-live-deploy/functions/api/generators.js';
import * as galleryRoute from '../void-live-deploy/functions/api/gallery.js';
import * as genRoute from '../void-live-deploy/functions/gen/[id].js';
import * as answerRoute from '../void-live-deploy/functions/api/answer.js';
import * as commentsRoute from '../void-live-deploy/functions/api/comments.js';
import { pictureOf } from './tower-gate.mjs';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql) };
}
// a stub picture: a 256 x 256 PNG of soft colour bands, different for each seed (stored, not compressed, so it is big enough to pass imageOf)
function png(seed) {
  const w = 256, h = 256, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (x + seed * 37) & 255; raw[o + 1] = (y * 2 + seed * 11) & 255; raw[o + 2] = ((x ^ y) + seed * 5) & 255; } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
let painterOn = true;
const env = { DB: d1(), SALT: 'e2e-salt', READ_TOKEN: 'e2e-owner', AI: { run: async (_m, input) => { if (input.messages) { const sys = input.messages[0].content; return { response: /random generator/.test(sys) ? 'Stub words for: ' + input.messages.at(-1).content : /storyteller/.test(sys) ? 'The Stub Tale\nOnce upon a stub, a story began.' : 'Beep. A stub reply to: ' + input.messages.at(-1).content }; } if (!painterOn) throw new Error('stub painter off'); const f = await new Response(input.multipart.body, { headers: { 'content-type': input.multipart.contentType } }).formData(); return { image: png(+f.get('seed') || 0) }; } } }; // secret-scan: ok (made-up values for a local test)
const freeDown = async () => new Response('stub: the free painter is not called in this test', { status: 503, headers: { 'content-type': 'text/plain' } });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const gm = u.pathname.match(/^\/gen\/([a-z2-7]{8})$/);
  if (gm) { const r = await genRoute.onRequestGet({ env: { ...env, ASSETS: { fetch: async () => new Response(fs.readFileSync(path.join(root, 'generators/make/index.html'))) } }, params: { id: gm[1] }, request: new Request('http://' + req.headers.host + req.url) }); res.writeHead(r.status, { 'content-type': 'text/html' }); res.end(await r.text()); return; }
  if (u.pathname === '/api/answer') {
    const body = await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
    const r = await answerRoute.onRequestPost({ request: new Request('http://' + req.headers.host + req.url, { method: 'POST', headers: { ...req.headers, 'cf-connecting-ip': '198.51.100.21' }, body }), env, waitUntil: () => {} });
    res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (u.pathname === '/api/comments') {
    const body = req.method === 'POST' ? await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); }) : undefined;
    const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '198.51.100.22' }, body });
    const r = req.method === 'POST' ? await commentsRoute.onRequestPost({ request, env }) : await commentsRoute.onRequestGet({ request, env });
    res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (u.pathname === '/api/gallery') {
    const body = req.method === 'POST' ? await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); }) : undefined;
    const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '198.51.100.20' }, body });
    const r = req.method === 'POST' ? await galleryRoute.onRequestPost({ request, env }) : await galleryRoute.onRequestGet({ request, env });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (u.pathname === '/api/image' || u.pathname === '/api/generators') {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
    const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '198.51.100.20' }, body });
    const r = u.pathname === '/api/image' ? (req.method === 'POST' ? await imageRoute.onRequestPost({ request, env }, freeDown) : await imageRoute.onRequestGet({ request, env }))
      : req.method === 'POST' ? await hubRoute.onRequestPost({ request, env }) : req.method === 'DELETE' ? await hubRoute.onRequestDelete({ request, env }) : await hubRoute.onRequestGet({ request, env });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage(); let bad = 0; const errs = [];
page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.accept());
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const shot = async (name, p = page) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); } };
const lines = async () => (await page.locator('#res .txt').allInnerTexts()).map((s) => s.trim());

// 1. write a generator: nested lists, odds, an inline choice, a kept value, a picture prompt
const GEN = ['$title = Pet shop', 'output', '  [p = pet, ""]{A} [size] [p.titleCase] named [name]. {Cheap|Pricey}, {1-3} toy{s}.', 'image', '  a [size] [p] in a pet shop window, cozy', 'pet', '  bird', '    parrot', '    finch', '  lizard ^0', '  fish ^2', '    goldfish', 'size', '  tiny', '  huge', 'name', '  Pip', '  Moss'].join('\n');
await page.goto(base + '/generators/make/'); await page.waitForSelector('#res li');
ok(/Tavern/.test(await page.locator('#res').innerText()) || (await lines()).length === 5, 'the editor opens with the starter and five results');
await page.fill('#src', GEN); await page.waitForTimeout(400);
let out = await lines();
ok(out.length === 5 && out.every((l) => /^(?:A|An) (?:tiny|huge) (?:Parrot|Finch|Goldfish) named (?:Pip|Moss)\. (?:Cheap|Pricey), (?:1 toy|[23] toys)\.$/.test(l)), 'five results, every one from the nested lists, a/an and toy{s} right: ' + out[0]);
ok(!out.some((l) => /Lizard/.test(l)), 'the ^0 entry is never picked');
ok(/Picture prompt: a (?:tiny|huge) (?:parrot|finch|goldfish) in a pet shop window/.test(await page.locator('#res').innerText()), 'each result shows its picture prompt, with the same pet');
await shot('1-editor-results');
// a plain error, then fixed
await page.fill('#src', GEN.replace('[name]', '[nmae]')); await page.waitForTimeout(400);
ok(/line 3.*there is no list called nmae/s.test(await page.locator('#errs').innerText()), 'an unknown list is named, with its line: ' + (await page.locator('#errs').innerText()).replace(/\s+/g, ' '));
await shot('2-editor-error');
await page.fill('#src', GEN); await page.waitForTimeout(400);
ok((await page.locator('#errs li').count()) === 0, 'fixed: no errors');
const before = await lines(); await page.click('#regen'); await page.waitForTimeout(200); ok(JSON.stringify(before) !== JSON.stringify(await lines()), 'Regenerate gives new results');
// 2. share link round trip
await page.fill('#name', 'Pet shop'); await page.click('#share'); await page.waitForTimeout(300);
const link = await page.evaluate(() => navigator.clipboard.readText());
ok(/\/generators\/make\/#g=z\./.test(link), 'Share link copies a link that holds the generator: ' + link.length + ' characters');
const other = await ctx.newPage(); other.on('pageerror', (e) => errs.push(e.message)); await other.goto(link.replace(/^https?:\/\/[^/]+/, base)); await other.waitForSelector('#res li');
ok((await other.inputValue('#src')).includes('fish ^2') && (await other.locator('#remix').isVisible()), 'the link opens the same generator, with Remix');
ok((await other.locator('#res .txt').allInnerTexts()).every((l) => /named (?:Pip|Moss)/.test(l)), 'and its results work there');
await other.click('#remix'); await other.waitForTimeout(200);
ok(/^Remix of Pet shop/.test(await other.inputValue('#name')) && (await other.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.listgen.v1')).mine.length)) >= 1, 'Remix keeps a copy of your own on this device');
await other.close();
// 3. publish, open it from the hub, play counted
await page.click('#publish'); await page.waitForFunction(() => /Published/.test(document.getElementById('note').textContent), null, { timeout: 5000 }).catch(() => {});
const note = await page.locator('#note').innerText(); const id = (note.match(/\/gen\/([a-z2-7]{8})/) || [])[1];
ok(!!id, 'Publish puts it in the hub with a short link: ' + note);
await page.goto(base + '/generators/'); await page.waitForSelector('#hubList a', { timeout: 5000 }).catch(() => {});
ok(/Pet shop/.test(await page.locator('#hubList').innerText()), 'the hub on /generators/ lists it (newest)');
await page.locator('#hub').scrollIntoViewIfNeeded(); await shot('3-hub');
await page.click('#hubList a'); await page.waitForSelector('#res li');
ok(/From the hub: "Pet shop"/.test(await page.locator('#from').innerText()) && (await page.locator('#report').isVisible()) && /\/gen\//.test(page.url()), 'opening it from the hub (its /gen/ link) shows where it came from, Remix and Report');
// inputs, conditional odds, [names[gender]] and if/else, live in the editor
await page.goto(base + '/generators/make/'); await page.waitForSelector('#res li');
await page.fill('#src', '$inputs\n  gender = select female|male\noutput\n  [names[gender]] the [cls]. [if (gender == "male") {He} else {She}] waves.\nnames\n  female\n    Ada\n  male\n    Bo\ncls\n  wizard ^[gender == "female"]\n  knight ^[gender == "male"]\n'); await page.waitForTimeout(400);
ok((await lines()).every((l) => l === 'Ada the wizard. She waves.'), 'inputs: female by default, the conditional odds and if/else follow it');
await page.selectOption('#inputs select', 'male'); await page.waitForTimeout(200);
ok((await lines()).every((l) => l === 'Bo the knight. He waves.'), 'choosing male changes every result');
await shot('6-editor-inputs');
// 4. the image page: a prompt, two pictures
await page.goto(base + '/image/'); await page.fill('#prompt', 'a red fox curled up in the snow'); await page.click('#styles button[data-k="watercolor"]'); await page.selectOption('#many', '2');
await page.click('#make'); await page.waitForFunction(() => document.querySelectorAll('#pics img').length === 2, null, { timeout: 10000 }).catch(() => {});
const srcs = await page.locator('#pics img').evaluateAll((l) => l.map((i) => [i.getAttribute('src').slice(0, 22), i.naturalWidth, i.alt]));
ok(srcs.length === 2 && srcs.every(([s, w]) => s === 'data:image/png;base64,' && w > 0), 'two pictures came back as images: ' + JSON.stringify(srcs.map((x) => x.slice(0, 2))));
ok(/seed \d+ · Watercolour · Square · Verse/.test(await page.locator('#pics figcaption').first().innerText()), 'each shows its seed, style, shape and painter');
await shot('4-image-pictures');
await page.locator('#pics figure').first().getByRole('button', { name: 'Keep' }).click(); await page.waitForTimeout(300);
ok(await page.locator('#galBox').isVisible() && (await page.locator('#gal img').count()) === 1, 'Keep puts it in the gallery on this device');
const dl = await page.locator('#pics figure a[download]').first().getAttribute('download'); ok(/^a-red-fox-curled-up-in-the-snow-\d+\.(?:png|jpg)$/.test(dl), 'Download names the file after the prompt and seed: ' + dl);
// same seed again: the picture comes back from the cache, identical
const first = await page.locator('#pics img').first().getAttribute('src');
await page.locator('#pics figure').first().getByRole('button', { name: 'Same seed again' }).click(); await page.waitForFunction(() => document.querySelectorAll('#pics img').length === 1, null, { timeout: 8000 }).catch(() => {});
ok((await page.locator('#pics img').first().getAttribute('src')) === first, 'Same seed again makes the same picture');
// share to the public gallery, then vote
await page.locator('#pics figure').first().getByRole('button', { name: 'Share to the gallery' }).click(); await page.waitForTimeout(500);
await page.waitForSelector('#pub img', { timeout: 5000 }).catch(() => {});
ok((await page.locator('#pub figure').count()) === 1 && /a red fox/.test(await page.locator('#pub').innerText()), 'the shared picture is in the public gallery with its words');
const vb = page.locator('#pub figure button').first(); await vb.click(); await page.waitForTimeout(300); ok(/▲ 1/.test(await vb.innerText()), 'a vote counts');
ok(await page.locator('#pub img').first().evaluate((i) => i.complete && i.naturalWidth > 0), 'the gallery picture loads from its own address');
await page.locator('#gallery').scrollIntoViewIfNeeded(); await shot('7-gallery');
// a refusal and the painter resting
await page.fill('#prompt', 'photo of Taylor Swift'); await page.click('#make'); await page.waitForTimeout(600);
ok(/real people/.test(await page.locator('#note').innerText()), 'a photo of a named real person is refused in plain words');
painterOn = false; await page.fill('#prompt', 'a lighthouse at dawn'); await page.selectOption('#many', '1'); await page.click('#make'); await page.waitForTimeout(1200);
ok(/painter is resting/i.test(await page.locator('#pics').innerText()), 'with no painter answering, the page says the painter is resting: ' + (await page.locator('#pics').innerText()).trim());
await shot('5-image-resting');
// 5. the gate's own check on this page
painterOn = true;
const g = await pictureOf(browser, base + '/image/?' + new URLSearchParams({ prompt: 'a red fox curled up in the snow', style: 'watercolor', seed: '7', n: '1', go: '1' }), 15000, '#pics img');
ok(g.n === 1, 'the gate\'s picture check (tower-gate.mjs pictureOf) sees a generated picture on /image/');
painterOn = false; store.clear(); resetGuard(); // a new minute for the per-connection limit
const g0 = await pictureOf(browser, base + '/image/?' + new URLSearchParams({ prompt: 'a castle on a hill', seed: '8', n: '1', go: '1' }), 5000, '#pics img');
ok(g0.n === 0 && /resting/.test(g0.missing[0]), 'and does not count the page when the painter rests: ' + g0.missing[0]);
// 6. character chat: a starter, a message, a reply kept on the device, a character shared by link
await page.goto(base + '/generators/chat/'); await page.waitForSelector('#chars button');
await page.locator('#chars button', { hasText: 'Bolt' }).click();
ok(/Is it true that humans laugh at puns/.test(await page.locator('#log').innerText()), 'a starter character greets');
await page.fill('#say', 'What is a pun?'); await page.keyboard.press('Enter'); await page.waitForFunction(() => /stub reply/.test(document.getElementById('log').innerText), null, { timeout: 8000 }).catch(() => {});
ok(/Beep\. A stub reply to: What is a pun\?/.test(await page.locator('#log').innerText()), 'the message gets a reply from the answer route (stub model)');
await page.reload(); await page.waitForSelector('#log li');
ok(/What is a pun\?/.test(await page.locator('#log').innerText()), 'the chat is still there after a reload (kept on the device)');
await shot('8-chat');
await page.click('#share'); await page.waitForTimeout(300); const clink = await page.evaluate(() => navigator.clipboard.readText());
const p3 = await ctx.newPage(); p3.on('pageerror', (e) => errs.push(e.message)); await p3.goto(clink.replace(/^https?:\/\/[^/]+/, base)); await p3.waitForSelector('#log li');
ok(/#c=/.test(clink) && (await p3.locator('#keepShared').isVisible()) && /Bolt/.test(await p3.locator('#h').innerText()), 'a shared character opens from its link, with Keep');
ok(!/What is a pun/.test(await p3.locator('#log').innerText()), 'the link carries the character, never the chat'); await p3.close();
await page.fill('#say', 'say something nsfw'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
ok(/not something this character will talk about/.test(await page.locator('#note').innerText()), 'a refused message is said plainly');
// 7. tap a word to reroll it, {ai: ...} filled, a story
await page.goto(base + '/generators/make/'); await page.waitForSelector('#res li');
await page.fill('#src', 'output\n  {A} [adj] owl. {ai: one line about a [adj] owl}\nadj\n  odd\n  eager\n  big\n  icy\n'); await page.waitForTimeout(400);
const firstTap = page.locator('#res li').first().locator('.tap').nth(0); const was = await firstTap.innerText(); let changed = false;
for (let k = 0; k < 8 && !changed; k++) { await page.locator('#res li').first().locator('.tap').nth(0).click(); await page.waitForTimeout(80); changed = (await page.locator('#res li').first().locator('.tap').nth(0).innerText()) !== was; }
const firstLine = (await page.locator('#res .txt').first().innerText()).trim();
ok(changed && /^(?:An odd|An eager|A big|An icy) owl\./.test(firstLine), 'tapping a word rolls just that word, and "a"/"an" follows it: ' + firstLine);
await page.waitForFunction(() => /Stub words for: one line about an? (?:odd|eager|big|icy) owl/.test(document.getElementById('res').innerText), null, { timeout: 8000 }).catch(() => {});
ok(/Stub words for: one line about/.test(await page.locator('#res').innerText()), '{ai: ...} is filled by the answer route (stub model)');
await shot('9-tap-ai');
await page.goto(base + '/generators/story/'); await page.fill('#idea', 'a fox opens a bakery'); await page.click('#write'); await page.waitForFunction(() => /Once upon a stub/.test(document.getElementById('story').innerText), null, { timeout: 8000 }).catch(() => {});
ok(/The Stub Tale/.test(await page.locator('#story').innerText()), 'the story writer writes an opening');
await page.click('#more'); await page.waitForTimeout(800); ok((await page.locator('#story p').count()) === 2, 'Continue adds a part');
await page.reload(); await page.waitForSelector('#story p'); ok((await page.locator('#story p').count()) === 2, 'the story is kept on the device');
await shot('10-story');
// 8. comments under /image/
await page.goto(base + '/image/'); await page.waitForSelector('#comments label', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(3300);
const q = await page.locator('#comments label').nth(2).innerText(); const sm = q.match(/(\d) \+ (\d)/);
await page.locator('#comments textarea').fill('Lovely foxes!'); await page.locator('#comments input').nth(1).fill(String(+sm[1] + +sm[2])); await page.locator('#comments button[type=submit]').click();
await page.waitForFunction(() => /Lovely foxes!/.test(document.getElementById('comments').innerText), null, { timeout: 5000 }).catch(() => {});
ok(/Anonymous[\s\S]*Lovely foxes!/.test(await page.locator('#comments').innerText()), 'a comment under /image/ after the sum, shown as text');
await page.locator('#comments').scrollIntoViewIfNeeded(); await shot('11-comments');
// 9. a wheel in a generator, the layer maker, the forum
await page.goto(base + '/generators/make/'); await page.waitForSelector('#res li');
await page.fill('#src', '$layout = cards\noutput\n  Lunch: {wheel: food}\nfood\n  pizza ^3\n  soup\n  salad\n'); await page.waitForTimeout(400);
const won = (await page.locator('#res .txt').first().innerText()).replace('Lunch: ', '').trim();
await page.locator('#res li').first().getByRole('button', { name: 'Spin the wheel' }).click(); await page.waitForTimeout(3600);
ok((await page.locator('#res li').first().locator('.wheel button').innerText()) === 'Landed on: ' + won, 'the wheel spins and lands on the result it says: ' + won);
ok(await page.locator('#res').evaluate((e) => e.classList.contains('lay-cards')), '$layout = cards lays the results out as cards');
await shot('12-wheel');
await page.goto(base + '/image/'); await page.fill('#prompt', 'a moon over hills'); await page.selectOption('#many', '2'); await page.click('#make'); await page.waitForFunction(() => document.querySelectorAll('#pics img').length === 2, null, { timeout: 10000 }).catch(() => {});
await page.click('#layersH'); await page.waitForSelector('.lm-picks button', { timeout: 5000 }).catch(() => {});
await page.locator('.lm-picks button').nth(0).click(); await page.locator('.lm-picks button').nth(1).click(); await page.waitForTimeout(400);
const painted = await page.locator('.lm-canvas').evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n++; return n; });
ok((await page.locator('.lm-list li').count()) === 2 && painted > 50, 'two pictures stacked as layers on the canvas');
const lmBefore = await page.locator('.lm-canvas').evaluate((c) => c.toDataURL().length); await page.locator('.lm-list li').nth(1).getByLabel('Size').fill('30'); await page.waitForTimeout(200);
ok((await page.locator('.lm-canvas').evaluate((c) => c.toDataURL().length)) !== lmBefore, 'a layer\'s size changes the stack');
await page.locator('#layersBox').scrollIntoViewIfNeeded(); await shot('13-layers');
await page.goto(base + '/generators/forum/'); await page.waitForTimeout(3300); await page.click('#newH');
const fq = (await page.locator('#tSumL').innerText()).match(/(\d) \+ (\d)/);
await page.fill('#tTitle', 'Share your tavern generators'); await page.fill('#tText', 'Post your best ones below.'); await page.fill('#tSum', String(+fq[1] + +fq[2])); await page.click('#tGo');
await page.waitForURL(/\/generators\/forum\/\?t=/, { timeout: 5000 }).catch(() => {}); await page.waitForSelector('#posts .cm-text', { timeout: 5000 }).catch(() => {});
ok(/Share your tavern generators/.test(await page.locator('#topicTitle').innerText()) && /Post your best ones below/.test(await page.locator('#posts').innerText()), 'a forum topic is started and opens with its first post');
await page.goto(base + '/generators/forum/'); await page.waitForSelector('#topics a'); ok(/Share your tavern generators/.test(await page.locator('#topics').innerText()), 'the forum lists it');
await shot('14-forum');
// sideways overflow at 390 px on the pages
for (const u of ['/generators/', '/generators/make/', '/image/', '/generators/chat/', '/generators/story/', '/generators/forum/']) { await page.goto(base + u); await page.waitForTimeout(300); const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(o <= 0, u + ' has no sideways scroll at 390 px (' + o + ')'); }
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
