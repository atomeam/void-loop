// Persona playtests (Adam: "Verse needs to learn to check things it can't think of yet"): a headless browser opens every game as four kinds
// of player (new on a desktop, power user on the keyboard, phone, screen reader) and logs anything stuck, missing, cut off or unlabelled.
// Only topics are logged (game, persona, problem kind), never anyone's words. Screenshots with --shots <dir>.
//   node tools/persona-playtest.mjs [--shots /workspace] [--only chess,monopoly]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright-core';
import { acquire as acquireHeavy } from './heavy.mjs';
import { loadGames } from './completeness.mjs';
await acquireHeavy('persona playtests (persona-playtest.mjs)');
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '..', 'void-live-deploy');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const shots = arg('--shots'), only = (arg('--only') || '').split(',').filter(Boolean);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
export const PERSONAS = [
  { id: 'new', viewport: { width: 1280, height: 800 } },
  { id: 'phone', viewport: { width: 390, height: 760 }, touch: true },
  { id: 'keyboard', viewport: { width: 1280, height: 800 } },
  { id: 'reader', viewport: { width: 1280, height: 800 } },
];
let pass = 0, fail = 0; const topics = {};
const check = (name, ok, kind) => { if (ok) pass++; else { fail++; topics[kind] = (topics[kind] || 0) + 1; } console.log((ok ? 'pass ' : 'FAIL ') + name); };
// the quiz is asked about a card already on the page ("quiz me on this"), so it has no cold start to play
const NEEDS_CONTEXT = ['quiz'];
const games = (await loadGames()).filter((g) => !NEEDS_CONTEXT.includes(g.name)).filter((g) => !only.length || only.includes(g.name));
for (const g of games) {
  const mod = (await import(path.join(root, 'skills', g.file))).default; const ask = mod.examples && mod.examples[0]; if (!ask) continue;
  for (const per of PERSONAS) {
    const ctx = await browser.newContext({ viewport: per.viewport, hasTouch: !!per.touch, reducedMotion: per.id === 'reader' ? 'reduce' : 'no-preference' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
    await ctx.route(/127\.0\.0\.1:\d+\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base); await page.fill('#input', ask); await page.keyboard.press('Enter');
    let card = page.locator('.game-card, .kept-card').last();
    const shown = await card.waitFor({ timeout: 6000 }).then(() => true, () => false);
    await page.waitForTimeout(700); // a 3D board moves the controls into a side card beside it (skills/side-card.js)
    // a board lifted by skills/lift3d.js moves its controls out only once its miniature has loaded, and that load can take
    // longer than 700 ms on CI: read the card before the move and the move empties it mid-read (2026-10-29, monopoly on
    // a7aad196: "says how to play" and "status is announced" failed while the side card held both). Wait while its 3D
    // view is still hidden (a load in flight), up to 10 s; a load that fails leaves the flat card, which is then checked.
    if (shown) await page.waitForFunction(() => { const c = [...document.querySelectorAll('.game-card, .kept-card')].pop();
      const v = c && c.querySelector('.lift3d-view'); return !v || v.style.visibility !== 'hidden'; }, null, { timeout: 10000 }).catch(() => {});
    if (await page.locator('.side-card').count()) card = page.locator('.side-card').last();
    const tag = g.name + ' ' + per.id;
    check(tag + ': the card opens', shown, 'stuck: card did not open');
    if (shown) {
      const r = await card.evaluate((el, pid) => {
        const box = el.getBoundingClientRect(), out = {};
        out.offscreen = box.right > innerWidth + 2 || box.left < -2; // the whole card fits the window
        out.clipped = [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.textContent.trim() && getComputedStyle(n).overflow === 'hidden' && getComputedStyle(n).textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1).length;
        out.unlabelled = [...el.querySelectorAll('button, input')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.title || b.placeholder)).length;
        out.live = !!el.querySelector('[aria-live]');
        out.rules = !!el.querySelector('.g-rules') || /how to play|tap|drop|roll|steer|aim/i.test(el.textContent);
        return out;
      }, per.id);
      if (per.id === 'phone') check(tag + ': fits the phone width', !r.offscreen, 'ugly: card wider than a phone');
      check(tag + ': no cut-off text', r.clipped === 0, 'ugly: cut-off text');
      if (per.id === 'reader') { check(tag + ': every control has a name', r.unlabelled === 0, 'missing: unlabelled control'); check(tag + ': status is announced', r.live || /arcade|pong|snake/.test(g.name), 'missing: no announced status'); }
      if (per.id === 'new') check(tag + ': says how to play', r.rules, 'confusing: no how-to-play');
      if (per.id === 'keyboard') { await page.keyboard.press('Tab'); const f = await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body); check(tag + ': reachable by keyboard', f, 'stuck: keyboard cannot reach the card'); }
      if (shots) await page.screenshot({ path: path.join(shots, 'complete-' + g.name + '-' + per.id + '.png') }).catch(() => {});
    }
    check(tag + ': no page errors', errors.length === 0, 'stuck: page error');
    await ctx.close();
  }
}
await browser.close(); server.close();
console.log('topics: ' + JSON.stringify(topics));
console.log(pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
