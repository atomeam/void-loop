// The first writer's path on /fanfic/ (coordinator, 2026-10-29: "make the path for the first real writer as good as the sycophanthex.com one, with
// no accounts and no seeded stories"): a writer whose fandom is not here names it in the post form, and one press opens the fandom and posts the
// story in it. The page runs in a real browser against a fake /api/boards that keeps what it is sent in memory, so nothing reaches the live
// archive and no story is seeded anywhere. Run: node --test tools/fanfic-first-writer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/opt/cft/chrome-headless-shell-linux64/chrome-headless-shell', '/usr/bin/google-chrome'].find((x) => x && fs.existsSync(x));

/** the boards as the page sees them, in memory: boards, threads per board, and every write in the order it came. postFails: refuse that many story posts first. */
function fakeBoards(boards = [], postFails = 0) {
  const s = { boards: boards.map((b) => ({ created: 1, ...b })), threads: {}, writes: [], postFails, no: 100 };
  const answer = (url, body) => {
    const q = new URL(url).searchParams;
    if (!body) {
      if (q.has('config')) return { ok: true };
      if (q.has('challenge')) return { ok: true, c: 'test', sig: 'sig', bits: 1 };
      if (q.has('b')) return { ok: true, threads: s.threads[q.get('b')] || [] };
      if (q.has('q')) return { ok: true, results: [] };
      return { ok: true, boards: s.boards };
    }
    s.writes.push(body);
    if (body.do === 'board') {
      if (s.boards.some((b) => b.code === body.code)) return { ok: false, say: 'that board is here already' };
      s.boards.push({ code: body.code, title: body.title, about: body.about, nsfw: !!body.nsfw, created: Date.now() }); return { ok: true };
    }
    if (body.do === 'post') {
      if (!s.boards.some((b) => b.code === body.b)) return { ok: false, say: 'no such board' };
      if (s.postFails > 0) { s.postFails--; return { ok: false, say: 'one new thread every 3 minutes; reply to one meanwhile', kind: 'limited' }; }
      const no = ++s.no; (s.threads[body.b] = s.threads[body.b] || []).push({ no, sub: body.sub, body: body.body, name: 'Anonymous', at: Date.now(), bumped: Date.now(), replies: 0 });
      return { ok: true, thread: no, trip: 'abc123' };
    }
    return { ok: false, say: 'not in this test' };
  };
  return { s, answer };
}

async function withPage(fake, fn) {
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (u.endsWith('/')) u += 'index.html';
    const f = path.join(site, u);
    if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block' }), page = await ctx.newPage();
    await ctx.route((u) => u.pathname.startsWith('/api/'), async (route) => {
      const r = route.request();
      if (!r.url().includes('/api/boards')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' });
      const body = r.method() === 'POST' ? JSON.parse(r.postData() || '{}') : null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake.answer(r.url(), body)) });
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/fanfic/?new=story', { waitUntil: 'load' });
    await fn(page);
  } finally { await browser.close(); server.close(); }
}

const say = (page) => page.locator('#stForm [data-say]').innerText();
async function fillStory(page, title) {
  await page.fill('#stForm [name=title]', title);
  await page.selectOption('#stForm [name=rating]', 'General');
  await page.fill('#stForm [name=text]', 'The ship left the dock at dawn.\n\nNobody waved.');
}

test('an empty archive: the post form opens on "A new fandom", and one press opens the fandom and posts the story in it', { skip: !exe && 'no browser here' }, async () => {
  const fake = fakeBoards([{ code: 'g', title: 'General', about: 'Anything' }]);
  await withPage(fake, async (page) => {
    await page.waitForFunction(() => document.getElementById('stFandom').value === '+new');
    assert.equal(await page.locator('#stNew').isVisible(), true, 'the new fandom fields show at once');
    assert.match(await say(page), /No fandom is here yet/);
    assert.doesNotMatch(await say(page), /Start one first/, 'never sent away to another form');
    await page.fill('#stForm [name=newFandom]', 'Star Trek');
    await fillStory(page, 'Shore Leave');
    await page.click('#stForm button[type=submit]');
    await page.waitForFunction(() => /Posted\./.test(document.querySelector('#stForm [data-say]').textContent) || !document.getElementById('post').classList.contains('on'), null, { timeout: 30000 });
    const kinds = fake.s.writes.map((w) => w.do + ':' + (w.code || w.b));
    assert.deepEqual(kinds, ['board:ficstartre', 'post:ficstartre'], 'the fandom first, then the story in it, once each');
    assert.equal(fake.s.writes[0].title, 'Star Trek'); assert.equal(fake.s.writes[0].nsfw, false);
    assert.equal(fake.s.writes[1].sub, 'Shore Leave');
  });
});

test('a typed name that is here already (any case) posts in that fandom and opens no second one', { skip: !exe && 'no browser here' }, async () => {
  const fake = fakeBoards([{ code: 'ficdune', title: 'Dune', about: 'Fan fiction: Dune' }]);
  await withPage(fake, async (page) => {
    await page.waitForFunction(() => document.querySelector('#stFandom option[value="ficdune"]'));
    assert.equal(await page.locator('#stNew').isVisible(), false, 'a fandom is here, so the picker waits for a choice');
    await page.selectOption('#stFandom', '+new');
    assert.equal(await page.locator('#stNew').isVisible(), true);
    await page.fill('#stForm [name=newFandom]', 'dune');
    await fillStory(page, 'Sand');
    await page.click('#stForm button[type=submit]');
    await page.waitForFunction(() => /Posted\./.test(document.querySelector('#stForm [data-say]').textContent) || !document.getElementById('post').classList.contains('on'), null, { timeout: 30000 });
    assert.deepEqual(fake.s.writes.map((w) => w.do + ':' + (w.code || w.b)), ['post:ficdune']);
  });
});

test('a story post the boards refuse leaves the new fandom open, and the second press posts without opening it again', { skip: !exe && 'no browser here' }, async () => {
  const fake = fakeBoards([], 1);
  await withPage(fake, async (page) => {
    await page.waitForFunction(() => document.getElementById('stFandom').value === '+new');
    await page.fill('#stForm [name=newFandom]', 'Original Fiction');
    await fillStory(page, 'First Light');
    await page.click('#stForm button[type=submit]');
    await page.waitForFunction(() => /one new thread every 3 minutes/i.test(document.querySelector('#stForm [data-say]').textContent), null, { timeout: 30000 });
    assert.equal(await page.locator('#stFandom').inputValue(), 'ficorigina', 'the picker now holds the fandom that opened');
    assert.equal(await page.locator('#stNew').isVisible(), false);
    await page.click('#stForm button[type=submit]');
    await page.waitForFunction(() => /Posted\./.test(document.querySelector('#stForm [data-say]').textContent) || !document.getElementById('post').classList.contains('on'), null, { timeout: 30000 });
    assert.deepEqual(fake.s.writes.map((w) => w.do + ':' + (w.code || w.b)), ['board:ficorigina', 'post:ficorigina', 'post:ficorigina']);
  });
});

test('the person check says what it checked, never that a post will go through', () => {
  const app = fs.readFileSync(path.join(site, 'fanfic', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /Checked: you can post/);
  assert.match(app, /Checked: you are a person\./);
});
