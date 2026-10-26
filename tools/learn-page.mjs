// A person-like run of the learning pages at 390 px (Chrome): the hub checks an answer, climbs a level, gives a hint and a worked solution, keeps progress over a
// reload and makes a worksheet; each lane page does its one job (an element, a times fact and the speed test, the word quiz, a deck studied, shared and matched,
// a typing lesson typed, a fraction worked out); German on a German browser; the pages open offline after a visit; no sideways overflow, no console errors,
// layout shift under 0.05, every control at least 24 px. Saves screenshots into the directory given. node tools/heavy.mjs node tools/learn-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
const errors = [];
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }), p = await ctx.newPage(); p.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); p.on('dialog', (d) => d.accept()); return { ctx, p }; };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const open = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.learnReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
  const fp = await p.evaluate(() => (performance.getEntriesByName('first-paint')[0] || {}).startTime || 0); return { ms, fp }; };
const sane = async (p, name, { ms, fp }) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms, first paint ' + Math.round(fp) + ' ms)'); ok(fp > 0 && fp < 200, name + ': first paint under 200 ms');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && cs.visibility !== 'hidden' && (r.width < 24 || r.height < 24) && !e.classList.contains('pick') && !e.closest('footer') && !(e.tagName === 'A' && e.parentElement && [...e.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())); }).map((e) => e.outerHTML.slice(0, 80)));
  ok(small.length === 0, name + ': every control is at least 24 px' + (small.length ? ' ' + small.slice(0, 4).join(' | ') : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
const text = (p) => p.evaluate(() => document.body.innerText);

{ // ---- the hub ----
  const { ctx, p } = await mk(); const t = await open(p, '/learn/?skill=fadd&p=3,4,1,6'); await sane(p, 'hub', t);
  ok((await p.textContent('#pr-q')) === '3/4 + 1/6 = ?', 'hub: the asked problem 3/4 + 1/6 is shown'); await shot(p, 'hub-390');
  await p.fill('#pr-a', '4/10'); await p.click('#pr-check'); ok(/Not yet/.test(await p.textContent('#pr-fb')), 'hub: a wrong answer says not yet');
  await p.click('#pr-hint'); ok((await p.locator('#pr-steps li').count()) === 1 && /least common multiple of 4 and 6 is 12/.test(await p.textContent('#pr-steps')), 'hub: the first hint is the common denominator');
  await p.click('#pr-solve'); ok((await p.locator('#pr-steps li').count()) === 3 && /11\/12/.test(await p.textContent('#pr-steps')), 'hub: the worked solution ends at 11/12');
  await p.fill('#pr-a', '22/24'); await p.click('#pr-check'); ok(/Correct/.test(await p.textContent('#pr-fb')), 'hub: 22/24 is accepted as equal to 11/12'); await shot(p, 'hub-solved-390');
  // three right in a row without a hint: Familiar
  await p.selectOption('#pr-skill', 'times');
  for (let i = 0; i < 3; i++) { const q = await p.textContent('#pr-q'), m = /(\d+) × (\d+)/.exec(q); await p.fill('#pr-a', String(+m[1] * +m[2])); await p.press('#pr-a', 'Enter'); await p.waitForTimeout(80); await p.press('#pr-a', 'Enter'); await p.waitForTimeout(80); }
  ok((await p.textContent('#pr-level')) === 'Familiar', 'hub: three right in a row make the skill Familiar');
  ok(/Times tables\s*Familiar/.test(await text(p)), 'hub: the course shows Times tables as Familiar');
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.learnReady === '1');
  const tx = await text(p); ok(/Times tables\s*Familiar/.test(tx) && /Streak\s*1 days in a row/.test(tx) && /Today\s*4 questions, 3 right/.test(tx), 'hub: the level, the streak and today\'s count survive a reload (kept on the device)');
  ok(/Due for review today|Nothing is due/.test(tx), 'hub: the spaced review says what is due');
  const dl = p.waitForEvent('download'); await p.click('#pg-exp'); const f = await dl; const j = JSON.parse(fs.readFileSync(await f.path(), 'utf8')); ok(j.app === 'verse-learn' && j.data.skills.times.level === 2, 'hub: progress exports as a file');
  await p.selectOption('#ws-skill', 'longdiv'); ok((await p.locator('#ws-list li').count()) === 20 && / R | \d+$/.test(await p.textContent('#ws-key')), 'hub: a worksheet of 20 long divisions with an answer key');
  ok((await p.getAttribute('a[href*="khanacademy.org/math/arithmetic"]', 'target')) === '_blank', 'hub: a unit links to Khan Academy\'s free lessons in a new tab');
  await ctx.close();
}
for (const [url, name, check] of [
  ['/learn/periodic/?el=Fe', 'periodic', async (p) => { let t = await text(p); ok(/Iron/.test(t) && /55\.845/.test(t) && /\[Ar\] 3d6 4s2/.test(t), 'periodic: Fe is iron, 55.845, [Ar] 3d6 4s2');
    await p.click('.pt[data-z="79"]'); t = await text(p); ok(/Gold/.test(t) && /196\.97/.test(t), 'periodic: tapping 79 shows gold');
    await p.fill('#pt-q', 'Sauerstoff'); await p.waitForTimeout(100); ok(/Oxygen/.test(await p.textContent('#pt-card')), 'periodic: the German name finds oxygen');
    await p.selectOption('#pt-by', 'state'); ok(/Liquid/.test(await p.textContent('#pt-legend')), 'periodic: colour by state');
    await p.click('#pt-quizb'); await p.click('#pt-quiz .choices button >> nth=0'); await p.waitForTimeout(100); ok(/Correct|Not quite/.test(await text(p)), 'periodic: the symbol quiz answers'); }],
  ['/learn/times/?q=7x8', 'times', async (p) => { await p.fill('#tt-a', '54'); await p.click('#tt-check'); ok(/Not yet/.test(await p.textContent('#tt-fb')), 'times: 54 is not 7 × 8'); await p.click('#tt-hintb'); ok(/35 \+ 21 = 56/.test(await p.textContent('#tt-hint')), 'times: the hint works out 56');
    await p.fill('#tt-a', '56'); await p.press('#tt-a', 'Enter'); ok(/Correct/.test(await p.textContent('#tt-fb')), 'times: 56 is right');
    await p.click('#tt-speed'); await p.waitForTimeout(200); const q = await p.textContent('#tt-q'), m = /(\d+) × (\d+)/.exec(q); await p.fill('#tt-a', String(+m[1] * +m[2])); await p.press('#tt-a', 'Enter'); await p.waitForTimeout(100); ok(/Points: 1\d\b/.test(await p.textContent('#tt-score')) || /Correct/.test(await p.textContent('#tt-fb')), 'times: the speed test scores a quick answer');
    ok((await p.locator('#tt-grid .cell').count()) === 144, 'times: the 12 by 12 grid'); ok((await p.locator('#tt-sheet li').count()) > 0, 'times: a worksheet'); }],
  ['/learn/vocab/?word=candid', 'vocab', async (p) => { ok((await p.textContent('#vc-q')) === 'candid', 'vocab: the asked word'); await p.click('#vc-choices button:has-text("frank and honest")'); ok(/Correct/.test(await p.textContent('#vc-fb')), 'vocab: the right meaning is right');
    await p.waitForTimeout(1300); ok(/candid/.test(await p.textContent('#vc-learned')), 'vocab: candid is in the words learned'); }],
  ['/learn/cards/', 'cards', async (p) => { ok(/Element symbols \(20\)/.test(await text(p)), 'cards: a ready deck'); await p.click('#fc-show'); await p.click('.g-good'); ok(/Due today: 19/.test(await p.textContent('#fc-info')), 'cards: a card rated Good leaves today\'s pile');
    await p.click('#fc-new'); await p.fill('#fc-name', 'Capitals'); await p.press('#fc-name', 'Tab'); await p.fill('#fc-paste', 'France\tParis\nSpain = Madrid\nItaly - Rome\nJapan, Tokyo'); await p.click('#fc-add'); ok(/Capitals \(4\)/.test(await text(p)), 'cards: four cards pasted in four formats');
    await p.click('#fc-match'); const tiles = await p.$$eval('.match button', (x) => x.map((y) => y.textContent)); ok(tiles.length === 8, 'cards: the matching game lays out 8 tiles');
    const pairs = { France: 'Paris', Spain: 'Madrid', Italy: 'Rome', Japan: 'Tokyo' }; for (const [a, c] of Object.entries(pairs)) { await p.click('.match button:text-is("' + a + '")'); await p.click('.match button:text-is("' + c + '")'); } ok(/All matched in/.test(await text(p)), 'cards: all pairs matched');
    await p.click('#fc-share'); const link = await p.evaluate(() => navigator.clipboard.readText()); ok(/#deck=/.test(link), 'cards: the deck link is copied');
    const q = await mk(); await open(q.p, link.replace(/^https?:\/\/[^/]+/, '')); ok(/Capitals \(4\)/.test(await text(q.p)) && /came from a link/.test(await text(q.p)), 'cards: the link opens the deck in another browser'); await q.ctx.close(); }],
  ['/learn/typing/?text=the%20quick%20brown%20fox', 'typing', async (p) => { ok(/0 \/ 19/.test(await p.textContent('#ty-live')), 'typing: the own text is ready'); await p.click('#ty-in'); await p.keyboard.type('thx', { delay: 30 }); ok(/2 \/ 19/.test(await p.textContent('#ty-live')) && /Accuracy: 67%/.test(await p.textContent('#ty-live')), 'typing: a wrong key is counted and not taken');
    await p.keyboard.type('e quick brown fox', { delay: 25 }); await p.waitForTimeout(100); ok(/Lesson done/.test(await p.textContent('#ty-live')) && /WPM/.test(await p.textContent('#ty-live')), 'typing: the lesson finishes with a speed'); }],
  ['/learn/fractions/?a=1%201/2&op=mul&b=2/3', 'fractions', async (p) => { let t = await text(p); ok(/1 1\/2 × 2\/3 = 1\b/.test(t) && /improper fraction: 3\/2/.test(t), 'fractions: 1 1/2 × 2/3 = 1, with the improper fraction step');
    await p.fill('#fr-a', '5/6'); await p.selectOption('#fr-op', 'div'); await p.fill('#fr-b', '1/3'); await p.click('#fr-go'); t = await text(p); ok(/= 5\/2/.test(t) && /2 1\/2/.test(t) && /2\.5/.test(t) && /reciprocal 3\/1/.test(t), 'fractions: 5/6 ÷ 1/3 = 5/2 = 2 1/2 = 2.5 by the reciprocal');
    ok(/18\/24 = 3\/4/.test(t) && /3\/8/.test(t), 'fractions: 18/24 simplifies to 3/4 and 0.375 is 3/8'); }],
]) {
  const { ctx, p } = await mk(); const t = await open(p, url); await sane(p, name, t); await check(p); await shot(p, name + '-390'); await ctx.close();
}
{ // ---- German ----
  const { ctx, p } = await mk('de-DE'); await open(p, '/learn/?skill=fadd&p=3,4,1,6&show=1'); const t = await text(p);
  ok(/Mathe lernen/.test(t) && /Gemeinsamer Nenner: Das kleinste gemeinsame Vielfache von 4 und 6 ist 12/.test(t) && /Tipp holen/.test(t) && !/Get a hint/.test(t), 'German browser: the hub and its worked solution speak German'); await shot(p, 'hub-de-390');
  await open(p, '/learn/periodic/?el=Fe'); ok(/Eisen/.test(await text(p)) && /Ordnungszahl/.test(await text(p)), 'German browser: the periodic table speaks German'); await ctx.close();
}
{ // ---- offline ----
  const { ctx, p } = await mk(); await open(p, '/learn/times/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.learnReady === '1', null, { timeout: 6000 }).catch(() => {});
  ok(/Times tables 1 to 12/.test(await text(p)) && (await p.locator('#tt-grid .cell').count()) === 144, 'offline: the times tables reload with the network cut and still work'); await ctx.close();
}
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
