// A person-like run of /video/ and /code/ at 390 px (Chrome). Video: the open shelf shows, a search reads Commons and the Archive (their answers are served
// here from fixtures, a real local film plays as the Commons file), the film plays in the page's player with speed, quality, captions, chapters, keys and
// picture-in-picture offered; watch later, a playlist shared by link and opened in another browser, a chapter marked, saved for offline and played with the
// network cut, a YouTube link through its official embed, recommendations from the history. Code: a real public repository read through GitHub's API
// (the proxy's network), the tree, a coloured file with lines lit, commits, issues, pull requests and a pull request's files reviewed by Verse on the
// device, a pasted diff side by side, two texts compared, go to file, offline reload. Both: German, no sideways overflow, tap targets, layout shift, the
// gate's design look, sharing and offline. node tools/heavy.mjs node tools/video-code-page.mjs <dir> [media dir with small.webm and big.webm]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { designLook, sharingScore, defects } from './tower-gate.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.', media = process.argv[3] || out;
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}) });
const errors = []; let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const small = fs.readFileSync(path.join(media, 'small.webm')), big = fs.readFileSync(path.join(media, 'big.webm'));
const VTT = 'WEBVTT\n\n00:00:00.500 --> 00:00:03.000\nHello from the captions\n';
// what Commons, the Archive and Verse's own API answer, as fixtures in their documented shapes; the film files are real
const commonsPage = (title, i, h) => ({ index: i, title: 'File:' + title, videoinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/x/xx/' + title, mime: 'video/webm', mediatype: 'VIDEO', height: 360, duration: 12, size: big.length, thumburl: 'https://upload.wikimedia.org/thumb/' + title + '.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + title,
  extmetadata: { ObjectName: { value: h }, LicenseShortName: { value: 'CC BY 3.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/3.0' }, Artist: { value: '<a href="https://www.blender.org">Blender Foundation</a>' }, ImageDescription: { value: 'An open film.<br>0:00 Opening<br>0:04 The chase<br>0:08 The end' }, Categories: { value: 'Animation|Blender' } },
  derivatives: [{ src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/x/xx/' + title + '/' + title + '.180p.webm', type: 'video/webm; codecs="vp8"', height: 180, transcodekey: '180p.webm' }] }] });
async function routes(ctx) {
  await ctx.route('https://commons.wikimedia.org/w/api.php**', (r) => { const u = new URL(r.request().url()); if (u.searchParams.get('action') === 'timedtext') return u.searchParams.get('lang') === 'en' ? r.fulfill({ status: 200, contentType: 'text/vtt', body: VTT, headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '', headers: { 'access-control-allow-origin': '*' } });
    const titles = u.searchParams.get('titles'); const pages = titles ? { 1: commonsPage(titles.replace(/^File:/, ''), 1, titles.replace(/^File:|_|\.webm$/g, ' ').trim()) } : { 1: commonsPage('Big_Buck_Bunny_4K.webm', 1, 'Big Buck Bunny'), 2: commonsPage('Rabbit_in_the_garden.webm', 2, 'Rabbit in the garden') };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: { pages } }), headers: { 'access-control-allow-origin': '*' } }); });
  await ctx.route('https://upload.wikimedia.org/**', (r) => { const u = r.request().url(); if (/\.jpg$/.test(u)) return r.fulfill({ status: 404, body: '' }); const body = /180p/.test(u) ? small : big; return r.fulfill({ status: 200, contentType: 'video/webm', body, headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'none' } }); });
  await ctx.route('https://archive.org/**', (r) => { const u = r.request().url(); if (/advancedsearch/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ response: { docs: [{ identifier: 'bunny_film_1950', title: 'A bunny film', collection: ['feature_films'], year: '1950', runtime: '0:12' }, { identifier: 'not_free_upload', title: 'Somebody\'s upload', collection: ['opensource_movies'] }] } }) });
    if (/services\/img/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ status: 404, body: '' }); });
  await ctx.route('**/api/films', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ films: [{ id: 'verse-test-film', title: 'Verse grows a garden', description: 'A film Verse made.', tags: ['garden'], src: 'https://upload.wikimedia.org/verse-film.webm' }] }) }));
  await ctx.route('**/api/video**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hits: [], video: { title: 'A YouTube video', channel: 'Someone' } }) }));
  await ctx.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title><p>YouTube embed</p>' }));
}
const mk = async (locale = 'en-US', mock = true) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, ignoreHTTPSErrors: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); if (mock) await routes(ctx); const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && !/favicon|404|Failed to load resource|ERR_|net::/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); return { ctx, p }; };
const open = async (p, url, ready) => { await p.addInitScript(() => { window.__cls = 0; window.__towerCls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__towerCls += e.value; } }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction((k) => document.documentElement.dataset[k] === '1', ready, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500); return ms; };
const sane = async (p, name, ms) => {
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load event ' + ms + ' ms)');
  const fcp = await p.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0); ok(fcp > 0 && fcp < 200, name + ': first paint ' + Math.round(fcp) + ' ms (under 200)');
  const look = await p.evaluate(designLook); ok(defects(look) === 0, name + ': the gate\'s design look: ' + JSON.stringify(look));
  const sh = await p.evaluate(() => { const meta = (k) => !!document.querySelector('meta[property="' + k + '"],meta[name="' + k + '"]'); return { ogTitle: meta('og:title'), ogImage: meta('og:image'), desc: meta('og:description') || meta('twitter:description') || meta('description'), control: [...document.querySelectorAll('button,a,[role=button]')].some((e) => /\b(?:share|copy (?:the )?link|copy url|permalink)\b/i.test((e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.title || ''))) }; });
  ok(sharingScore(sh) === 4, name + ': sharing 4 of 4 (og:title, og:image, description, a Share link)');
  const img = await p.evaluate(() => { const m = document.querySelector('meta[property="og:image"]'); return m && m.content; }); ok(/\/og\/[a-z-]+\.png$/.test(img || '') && fs_exists(img), name + ': the og:image is a 1200x630 picture that exists (' + img + ')');
};
const fs_exists = (u) => { const f = path.join(root, new URL(u).pathname); if (!fs.existsSync(f)) return false; const buf = fs.readFileSync(f); return buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630; };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
const txt = (p) => p.evaluate(() => document.body.innerText);

{ // ---------------- video ----------------
  const { ctx, p } = await mk(); const ms = await open(p, '/video/', 'videoReady'); await sane(p, 'video', ms);
  let t = await txt(p); ok(/Start here: open films/.test(t) && /Big Buck Bunny/.test(t) && /Night of the Living Dead/.test(t), 'video: the open shelf shows the open films'); ok(/CC BY 3\.0/.test(t) && /Public domain/.test(t), 'video: each shelf film shows its licence');
  await shot(p, 'video-390');
  await p.fill('#v-q', 'bunny'); await p.click('#v-form button[type=submit]'); await p.waitForFunction(() => /Results for/.test(document.body.innerText)); t = await txt(p);
  ok(/Rabbit in the garden/.test(t) && /A bunny film/.test(t) && !/Somebody's upload/.test(t), 'video: a search reads Commons and the Archive, and leaves out an Archive item with no open licence');
  ok(/Also search/.test(t) && (await p.$$eval('#v-results .out a', (a) => a.map((x) => new URL(x.href).host))).includes('www.youtube.com'), 'video: the results offer the same search on YouTube and the open archives');
  await p.click('#v-results .vplay >> nth=0'); await p.waitForFunction(() => { const v = document.querySelector('#v-stage video'); return v && v.readyState >= 1; }, null, { timeout: 15000 }).catch(() => {});
  t = await txt(p); ok(/Now playing/.test(t) && /Big Buck Bunny/.test(t) && /CC BY 3\.0/.test(t) && /Blender Foundation/.test(t) && /Open on Wikimedia Commons/.test(t), 'video: the film plays with its licence, credit and a link to its source');
  const dur = await p.evaluate(() => document.querySelector('#v-stage video').duration); ok(dur > 11 && dur < 13, 'video: the player has the real film (' + dur.toFixed(1) + ' s)');
  await p.selectOption('#v-speed', '1.5'); ok(await p.evaluate(() => document.querySelector('#v-stage video').playbackRate) === 1.5, 'video: speed 1.5× from the speed list');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('>'); ok(await p.evaluate(() => document.querySelector('#v-stage video').playbackRate) === 1.75, 'video: > makes it faster (1.75×)');
  await p.keyboard.press('5'); await p.waitForTimeout(200); const at5 = await p.evaluate(() => document.querySelector('#v-stage video').currentTime); ok(at5 > 5 && at5 < 7, 'video: the key 5 jumps to half way (' + at5.toFixed(1) + ' s)');
  await p.keyboard.press('j'); await p.waitForTimeout(150); ok((await p.evaluate(() => document.querySelector('#v-stage video').currentTime)) < 1, 'video: j goes back 10 s');
  const ql = await p.$$eval('#v-quality option', (o) => o.map((x) => x.textContent)); ok(ql.includes('180p') && ql.some((x) => /Original/.test(x)), 'video: quality offers 180p and the original (' + ql.join(', ') + ')');
  await p.selectOption('#v-quality', { label: '180p' }); await p.waitForTimeout(400); ok(/180p/.test(await p.evaluate(() => document.querySelector('#v-stage video').currentSrc)), 'video: picking 180p plays the 180p file');
  await p.waitForFunction(() => document.querySelectorAll('#v-cc option').length > 1, null, { timeout: 5000 }).catch(() => {}); ok((await p.$$eval('#v-cc option', (o) => o.map((x) => x.textContent))).includes('English'), 'video: English captions from Commons are offered');
  await p.keyboard.press('c'); ok(await p.evaluate(() => [...document.querySelector('#v-stage video').textTracks].some((x) => x.mode === 'showing')), 'video: c turns captions on');
  t = await txt(p); ok(/Chapters/.test(t) && /0:04 The chase/.test(t), 'video: chapters read from the description');
  await p.click('#v-chapters button >> nth=1'); await p.waitForTimeout(200); const atc = await p.evaluate(() => document.querySelector('#v-stage video').currentTime); ok(atc >= 4 && atc < 5.5, 'video: a chapter jumps to its time (' + atc.toFixed(1) + ' s)');
  await p.fill('#v-chname', 'My bit'); await p.click('#v-mark'); ok(/My bit/.test(await p.innerText('#v-chapters')), 'video: a chapter of your own is marked and listed');
  ok(await p.isVisible('#v-pip') === (await p.evaluate(() => !!document.pictureInPictureEnabled)), 'video: picture-in-picture is offered where the browser has it (' + (await p.evaluate(() => !!document.pictureInPictureEnabled)) + ')');
  await p.click('#v-later'); ok(/In watch later/.test(await p.innerText('#v-later')) && /Big Buck Bunny/.test(await p.innerText('#v-later-h + p + ul, #v-later')), 'video: watch later keeps it');
  await p.fill('#v-plname', 'Sunday'); await p.click('#v-newpl button'); p.once('dialog', (d) => d.dismiss()); await p.selectOption('#v-addpl', 'Sunday'); ok(/Sunday · 1 videos/.test(await p.innerText('#v-lists')), 'video: a playlist made and the film added');
  await p.click('#v-share'); let link = await p.evaluate(() => navigator.clipboard.readText()); ok(/\/video\/\?v=commons%3ABig_Buck_Bunny_4K\.webm&t=\d+/.test(link), 'video: Share at this moment copies a link with the time (' + link.replace(/^.*\/video/, '/video') + ')');
  await shot(p, 'video-player-390');
  await p.click('#v-lists summary'); await p.click('#v-lists button:has-text("Share playlist link")'); link = await p.evaluate(() => navigator.clipboard.readText()); ok(/#pl=/.test(link), 'video: the playlist shares as a link');
  { const q = await mk(); await open(q.p, link.replace(/^https?:\/\/[^/]+/, ''), 'videoReady'); ok(/Sunday · 1 videos/.test(await q.p.innerText('#v-lists')) && /shared playlist came from the link/.test(await txt(q.p)), 'video: the playlist link opens in another browser with the list'); await q.ctx.close(); }
  await p.click('#v-save'); await p.waitForFunction(() => /Saved on this device/.test(document.getElementById('v-pstatus').textContent), null, { timeout: 10000 }).catch(() => {}); ok(/Saved on this device/.test(await p.innerText('#v-pstatus')), 'video: Save for offline keeps the open film on the device');
  ok(/Because you watched|Rabbit in the garden|A bunny film/.test(await p.innerText('#v-recs')), 'video: recommendations are drawn from what was watched');
  await p.fill('#v-link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'); await p.click('#v-linkf button[type=submit]'); await p.waitForSelector('#v-stage iframe');
  const src = await p.getAttribute('#v-stage iframe', 'src'), rp = await p.getAttribute('#v-stage iframe', 'referrerpolicy'); ok(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/.test(src) && /start=42/.test(src) && rp === 'strict-origin-when-cross-origin', 'video: a YouTube link plays through its official embed at 0:42, with the origin it needs');
  await shot(p, 'video-youtube-390');
  // offline: the page reloads with the network cut and the saved film still plays
  await p.goto(base + '/video/?v=commons:Big_Buck_Bunny_4K.webm', { waitUntil: 'load' }); await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  await ctx.setOffline(true); await ctx.unrouteAll({ behavior: 'ignoreErrors' }); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.videoReady === '1', null, { timeout: 10000 }).catch(() => {});
  await p.waitForFunction(() => { const v = document.querySelector('#v-stage video'); return v && v.readyState >= 1; }, null, { timeout: 8000 }).catch(() => {});
  t = await txt(p); ok(/Video/.test(t) && /saved on this device/i.test(t) && (await p.evaluate(() => { const v = document.querySelector('#v-stage video'); return !!v && v.duration > 11; })), 'video offline: the page reloads with the network cut and plays the saved film');
  await shot(p, 'video-offline-390'); await ctx.close();
}
{ const { ctx, p } = await mk('de-DE'); await open(p, '/video/', 'videoReady'); const t = await txt(p); ok(/Hier anfangen: offene Filme/.test(t) && /Später ansehen/.test(t) && /Link teilen/.test(t) && !/Watch later/.test(t), 'video German: the page speaks German'); await shot(p, 'video-de-390'); await ctx.close(); }

{ // ---------------- code (GitHub through the network) ----------------
  const { ctx, p } = await mk('en-US', false); const ms = await open(p, '/code/', 'codeReady'); await sane(p, 'code', ms);
  await p.fill('#c-in', 'https://github.com/atomeam/void-loop'); await p.click('#c-form button[type=submit]'); await p.waitForSelector('#c-tree', { timeout: 20000 }).catch(() => {});
  let t = await txt(p); ok(/atomeam\/void-loop/.test(t) && /stars/.test(t) && /AGENTS\.md/.test(t) && /void-live-deploy/.test(t), 'code: the repository opens with its numbers and its tree');
  ok(/requests left this hour/.test(await p.innerText('#c-rate')), 'code: GitHub\'s hourly allowance is shown (' + (await p.innerText('#c-rate')).slice(0, 60) + ')');
  await shot(p, 'code-repo-390');
  await p.click('#c-tree a:has-text("tools")'); await p.waitForFunction(() => /lane-pages\.test\.mjs/.test(document.body.innerText)); await p.click('#c-tree a:has-text("lane-pages.test.mjs")'); await p.waitForSelector('#c-file .gist-pre', { timeout: 15000 }).catch(() => {});
  ok((await p.locator('#c-file .gist-pre .k').count()) > 5, 'code: a file opens coloured, with line numbers'); await p.fill('#c-lines', '3-5'); await p.click('form:has(#c-lines) button[type=submit]'); ok((await p.locator('#c-file .lit').count()) === 3 && /L=3-5/.test(p.url()), 'code: lines 3 to 5 are lit and in the link');
  ok(/github\.com\/atomeam\/void-loop\/blob\/main\/tools\/lane-pages\.test\.mjs/.test(await p.getAttribute('a:has-text("Open on GitHub") >> nth=1', 'href')), 'code: Open on GitHub goes to the same file');
  await shot(p, 'code-file-390');
  await p.click('nav.tabs a:has-text("Commits")'); await p.waitForSelector('#c-commits li', { timeout: 15000 }).catch(() => {}); ok((await p.locator('#c-commits li').count()) >= 10, 'code: commits listed');
  await p.click('#c-commits a >> nth=0'); await p.waitForSelector('.diff table', { timeout: 15000 }).catch(() => {}); ok((await p.locator('.diff tr.add, .diff tr.del').count()) > 0, 'code: a commit opens with its diff');
  await p.click('nav.tabs a:has-text("Pull requests")'); await p.click('a.chip:has-text("Closed")'); await p.waitForSelector('#c-list li', { timeout: 15000 }).catch(() => {}); ok((await p.locator('#c-list li').count()) > 0, 'code: closed pull requests listed');
  await p.click('#c-list a.it >> nth=0'); await p.waitForSelector('#c-files', { timeout: 15000 }).catch(() => {}); t = await txt(p); ok(/files changed/.test(t) && /Conversation/.test(t), 'code: a pull request opens with its numbers and its words');
  await p.click('#c-files'); await p.waitForSelector('#c-review', { timeout: 20000 }).catch(() => {}); await p.click('#c-review'); await p.waitForFunction(() => /review/i.test(document.getElementById('c-revmsg').textContent), null, { timeout: 20000 }).catch(() => {});
  ok(/Verse’s review/.test(await p.innerText('#c-revmsg')), 'code: Verse reviews the pull request on the device (' + (await p.innerText('#c-revmsg')).slice(0, 80) + ')');
  await shot(p, 'code-pull-390');
  await p.click('nav.tabs a:has-text("Issues")'); await p.click('a.chip:has-text("All")'); await p.waitForTimeout(1500); ok((await p.locator('#c-list li').count()) + (/No issues here/.test(await txt(p)) ? 1 : 0) > 0, 'code: issues listed (or none said)');
  await p.click('nav.tabs a:has-text("Go to file")'); await p.fill('#c-find', 'lanepages'); await p.waitForTimeout(200); ok(/tools\/lane-pages\.test\.mjs/.test(await p.innerText('#c-found')), 'code: go to file finds lane-pages.test.mjs from "lanepages"');
  // a pasted diff, side by side, reviewed
  await p.fill('#c-dtext', 'diff --git a/x.js b/x.js\n--- a/x.js\n+++ b/x.js\n@@ -1,2 +1,3 @@\n const a = 1;\n-if (a == 1) go();\n+if (a = 2) go();\n+eval(input);\n'); // void-review: ok (bad lines on purpose, for Verse's review to find)
  await p.click('#c-dshow'); await p.click('#c-dout #c-split'); ok((await p.locator('#c-dout td.n').count()) >= 4, 'code: a pasted diff shows side by side');
  await p.click('#c-dout #c-review'); await p.waitForFunction(() => document.querySelectorAll('#c-dout tr.find').length > 0, null, { timeout: 15000 }).catch(() => {}); ok((await p.locator('#c-dout tr.find').count()) > 0, 'code: Verse\'s review marks the bad added lines (' + (await p.locator('#c-dout tr.find').count()) + ' findings)');
  await p.click('#c-dt2'); await p.fill('#c-da', 'one\ntwo\nthree'); await p.fill('#c-db', 'one\n2\nthree\nfour'); await p.fill('#c-dname', 'n.txt'); await p.click('#c-dcmp'); ok((await p.locator('#c-dout tr.add').count()) >= 2 || (await p.locator('#c-dout td').count()) > 4, 'code: two texts compared');
  await shot(p, 'code-diff-390');
  await p.goto(base + '/code/?r=atomeam/void-loop', { waitUntil: 'load' }); await p.waitForSelector('#c-tree', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForSelector('#c-tree', { timeout: 10000 }).catch(() => {}); t = await txt(p); ok(/AGENTS\.md/.test(t), 'code offline: the repository reloads with the network cut, from this device');
  await ctx.close();
}
{ const { ctx, p } = await mk('de-DE', false); await open(p, '/code/', 'codeReady'); const t = await txt(p); ok(/Ein Repository öffnen/.test(t) && /Zwei Texte vergleichen/.test(t) && !/Open a repository/.test(t), 'code German: the page speaks German'); await shot(p, 'code-de-390'); await ctx.close(); }
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
