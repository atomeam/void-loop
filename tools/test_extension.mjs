// node tools/test_extension.mjs — the Void extension (extension/) loaded in Chromium, with a-to-mind.com served from this checkout.
// B1: Void reads the tab you point it at (title, address, selection) into a card. B2: a draft goes into the box you were typing in.
// Page text never leaves the browser: no request carries it, and the saved stage (which syncs when signed in) never holds it.
// The keypress that gives the extension activeTab can't be pressed headless, so the test copy of the extension also gets
// <all_urls> (only here); everything after the grant is the shipped code.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const answerFn = await import(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url).href);

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const live = path.join(repo, 'void-live-deploy');
const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const PINNED = 'dcjdpaeachfmfndklkiglgebfflamhkg';
const SECRET = 'PLUM-7731 is the secret on this page';
const DRAFT = 'Thanks, Void drafted this';

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('pass ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  -> ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); } }

const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'void-ext-'));
for (const f of fs.readdirSync(path.join(repo, 'extension'))) if (!f.endsWith('.zip')) fs.copyFileSync(path.join(repo, 'extension', f), path.join(extDir, f));
const man = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
{ const bg = fs.readFileSync(path.join(repo, 'extension', 'background.js'), 'utf8');
  const titles = [...bg.matchAll(/contextMenus\.create\(\{[^}]*title: '([^']+)'/g)].map((m) => m[1]);
  check('menus: each one says whether the page stays in the browser or is sent to Void, and the old "Ask Void about \'…\'" (selection sent as an ask) is gone',
    titles.length === 3 && titles.every((t) => /stays in your browser|sends it to Void/.test(t)) && !/ask-void|Ask Void about “%s”/.test(bg), titles); }
check('manifest: only activeTab and scripting reach into pages (no host permissions shipped)', man.permissions.includes('activeTab') && man.permissions.includes('scripting') && !man.host_permissions && !man.optional_host_permissions, man.permissions);
man.host_permissions = ['<all_urls>'];
fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(man));

{ // the zip people install must be the folder, byte for byte (the two drifted apart for days once)
  const { spawnSync } = await import('node:child_process');
  const zip = path.join(repo, 'extension', 'void-extension.zip'), names = fs.readdirSync(path.join(repo, 'extension')).filter((f) => !f.endsWith('.zip')).sort();
  const list = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
  if (list.error) console.log('skip zip check: unzip is not installed here');
  else {
    const inZip = list.stdout.trim().split('\n').sort();
    const same = inZip.join() === names.join() && names.every((f) => spawnSync('unzip', ['-p', zip, f]).stdout.equals(fs.readFileSync(path.join(repo, 'extension', f))));
    check('zip: void-extension.zip holds the folder byte for byte (re-zip: cd extension && zip -X void-extension.zip ' + names.join(' ') + ')', same, { inZip, names });
  }
}
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'void-ext-user-'));
const ctx = await chromium.launchPersistentContext(userDir, { executablePath: exe, headless: true, args: ['--disable-extensions-except=' + extDir, '--load-extension=' + extDir] });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const out = []; // every request that left for anywhere, with its body
ctx.on('request', (r) => out.push(r.url() + ' ' + (r.postData() || '')));
const FIXTURE = 'https://fixture.test/';
const OWNER = 'owner-token-for-the-extension-test', records = []; // B3's execution records, as /api/actions would keep them
await ctx.route(/^https?:\/\//, (r) => {
  const u = new URL(r.request().url());
  if (u.origin === 'https://fixture.test') {
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture page</title><p id="p">' + SECRET + '</p>'
      + '<form id="f" onsubmit="window.submitted=true;return false"><textarea id="reply" aria-label="Reply"></textarea><button>send</button></form>'
      + '<button type="button" id="save" onclick="window.saved=(window.saved||0)+1">Save</button>' });
  }
  if (u.origin === 'https://a-to-mind.com') {
    if (u.pathname === '/api/actions' && r.request().method() === 'POST') { // the execution record, in memory (lib/actions.js keeps it in D1)
      if (r.request().headers().authorization !== 'Bearer ' + OWNER) return r.fulfill({ status: 401, body: 'no' });
      const b = JSON.parse(r.request().postData() || '{}');
      if (b.op === 'begin' || b.op === 'stub') { const rec = { id: 'act-' + (records.length + 1), kind: b.kind, ref: b.ref, state: b.op === 'begin' ? 'running' : 'stubbed', result: b.op === 'stub' ? b.text : null }; records.push(rec); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: rec.id, state: rec.state }) }); }
      const rec = records.find((x) => x.id === b.id);
      if (b.op === 'end' && rec && rec.state === 'running') { rec.state = b.state; rec.result = b.text; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: rec.id, state: rec.state }) }); }
      return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    }
    if (u.pathname.startsWith('/api/answer') && /"mode":"draft"/.test(r.request().postData() || '')) { // the tab card's "draft for me": the real handler, no model
      return answerFn.onRequestPost({ request: new Request('http://x/api/answer', { method: 'POST', body: r.request().postData() }), env: { AI: undefined } })
        .then(async (res) => r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }));
    }
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    const f = u.pathname === '/' || u.pathname === '/index.html' ? path.join(repo, 'void.html') : path.join(live, decodeURIComponent(u.pathname));
    if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  }
  return r.abort();
});

const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
check('the extension id is the one Void trusts (pinned by the manifest key)', id === PINNED && fs.readFileSync(path.join(repo, 'void.html'), 'utf8').includes("'chrome-extension://" + PINNED + "'"), id);

const page = await ctx.newPage();
await page.goto(FIXTURE);
await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('p')); getSelection().removeAllRanges(); getSelection().addRange(r); });
const read = (url) => sw.evaluate(async (u) => { const [t] = await chrome.tabs.query({ url: u }); return readTab(t); }, url);
const r1 = await read(FIXTURE);
check('B1: reading the tab works once Chrome lets the extension in', r1 && r1.ok && r1.readable, r1);

const panel = await ctx.newPage();
await panel.goto('chrome-extension://' + id + '/sidepanel.html');
const voidFrame = async () => { for (let i = 0; i < 100; i++) { const f = panel.frames().find((x) => x.url().startsWith('https://a-to-mind.com')); if (f) return f; await panel.waitForTimeout(100); } return null; };
const V = await voidFrame();
await V.waitForSelector('.tab-card', { timeout: 15000 }).catch(() => {});
const card = await V.evaluate(() => { const c = document.querySelector('.tab-card'); return c ? c.innerText : ''; });
check('B1: the panel shows the tab in Void: its title, address and the selected text, marked as staying in this browser',
  /Fixture page/.test(card) && /fixture\.test/.test(card) && card.includes(SECRET) && /stays in this browser/.test(card), card.slice(0, 300));

// a new read replaces the card's contents while the panel is open
await page.evaluate(() => { getSelection().removeAllRanges(); document.getElementById('reply').focus(); });
await read(FIXTURE);
await V.waitForFunction(() => { const c = document.querySelector('.tab-card'); return c && /nothing selected/.test(c.innerText); }, null, { timeout: 5000 }).catch(() => {});
const card2 = await V.evaluate(() => (document.querySelector('.tab-card') || {}).innerText || '');
check('B1: reading again updates the card (no selection now; the box you are in is named)', /nothing selected/.test(card2) && /goes into: Reply/.test(card2), card2.slice(0, 300));

// B2: the draft goes into the box, as typing would, and nothing is sent or submitted
await V.fill('.tab-draft', DRAFT);
await V.click('.tab-put');
await V.waitForFunction(() => /in the page/.test((document.querySelector('.tab-said') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
const said = await V.evaluate(() => (document.querySelector('.tab-said') || {}).textContent || '');
const box = await page.evaluate(() => ({ v: document.getElementById('reply').value, submitted: !!window.submitted }));
check('B2: "put in the page" types the draft into the box you were in and submits nothing', box.v === DRAFT && !box.submitted && /in the page/.test(said), { box, said });

// an answer card in the panel has "into the page" next to "copy" (countdown is answered in the browser)
await V.fill('#input', 'days until new year');
await V.press('#input', 'Enter');
await V.waitForSelector('.vput', { state: 'visible', timeout: 10000 }).catch(() => {});
await page.evaluate(() => { const t = document.getElementById('reply'); t.value = ''; t.focus(); });
// a real click, as a person makes it: the stage keeps the countdown card clear of the tab card (lib/placement.js). force only
// skips Playwright's wait for the card to hold still (cards tilt toward the pointer); the press and release are real mouse events
const vputErr = await V.click('.vput', { timeout: 5000, force: true }).then(() => '', (e) => String(e.message).split('\n')[0]);
const vputs = await V.evaluate(() => Array.from(document.querySelectorAll('.vput')).map((b) => ({ shown: !!b.offsetParent, in: (b.parentElement.className || '') })));
await page.waitForFunction(() => document.getElementById('reply').value.length > 0, null, { timeout: 5000 }).catch(() => {});
const box2 = await page.evaluate(() => document.getElementById('reply').value);
const whisper2 = await V.evaluate(() => document.getElementById('whisper').textContent);
const cardHtml = await V.evaluate(() => (document.querySelector('.countdown-card') || {}).outerHTML || '');
check('B2: an answer\'s "into the page" puts that answer into the box', /new year/i.test(box2) && /day/i.test(box2), { box2: box2.slice(0, 120), vputErr, vputs, whisper2, cardHtml: cardHtml.slice(0, 600) });

const stored = await V.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
check('local only: the saved stage (synced when signed in) holds no page text, no draft and no tab card at all', !stored.includes('PLUM-7731') && !stored.includes(DRAFT) && !/"kind":"tab"/.test(stored) && /days until|countdown/i.test(stored), stored.slice(0, 200));
const leaked = out.filter((x) => x.includes('PLUM-7731') || x.includes(encodeURIComponent('PLUM-7731')) || x.includes(DRAFT) || x.includes(encodeURIComponent(DRAFT)));
check('local only: no request anywhere carried the page text or the draft', leaked.length === 0, leaked.slice(0, 3));

// "draft for me" on the tab card (sends it to Void, lib/draft.js): the card's box fills with the draft (rules draft here, no model),
// the card flags what left and for what, and the one request carried the title, address and selection, nothing else of the page
await V.evaluate(() => { const t = document.querySelector('.tab-draft'); t.value = 'keep it short'; t.dispatchEvent(new Event('input', { bubbles: true })); });
const beforeDraft = out.length;
await V.click('.tab-ask-summary', { force: true }); // a real click: the countdown card no longer lands over the tab card (lib/placement.js)
await V.waitForFunction(() => /from Void/.test((document.querySelector('.tab-said') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
const dSaid = await V.evaluate(() => (document.querySelector('.tab-said') || {}).textContent || '');
const dBox = await V.evaluate(() => (document.querySelector('.tab-draft') || {}).value || '');
const dFoot = await V.evaluate(() => (document.querySelector('.tab-foot') || {}).textContent || '');
const dPosts = out.slice(beforeDraft).filter((x) => /a-to-mind\.com\/api\/answer /.test(x));
let dBody = null; try { dBody = JSON.parse(dPosts[0].slice(dPosts[0].indexOf(' ') + 1)); } catch (_) {}
check('draft for me: the summary comes back into the card\'s box, the card says it is from Void and what was sent, and the one request carried mode draft with the title, address, the selection (none now) and the box as a note',
  /summary from Void/.test(dSaid) && /Fixture page/.test(dBox) && /sent to a-to-mind\.com for a summary draft · not kept there/.test(dFoot)
  && dPosts.length === 1 && dBody && dBody.mode === 'draft' && dBody.intent === 'summary' && dBody.title === 'Fixture page' && dBody.url === 'https://fixture.test/' && dBody.note === 'keep it short' && !('text' in dBody) && !('field' in dBody),
  { dSaid, dBox: dBox.slice(0, 120), dFoot, dBody });
check('draft for me: rewrite is disabled with nothing selected', await V.evaluate(() => !!(document.querySelector('.tab-ask-rewrite') || {}).disabled));

// inside the panel, a message that doesn't come from the panel itself (here: the page posting to itself) changes nothing
await V.evaluate(() => window.postMessage({ type: 'void-ext:tab', tab: { title: 'forged', url: 'https://evil.test/', selection: 'forged' } }, '*'));
await V.waitForTimeout(500);
const card3 = await V.evaluate(() => (document.querySelector('.tab-card') || {}).innerText || '');
check('trust: in the panel, a tab message from the Void page itself is ignored (only the extension\'s panel is heard)', /Fixture page/.test(card3) && !/forged/.test(card3), card3.slice(0, 120));

// --- B3: Void proposes one step; the extension's panel shows it with Yes / No; it runs only on an allowed site and only on Yes
await V.evaluate((k) => localStorage.setItem('a2m.void.owner.v1', k), OWNER);
await page.evaluate(() => { document.getElementById('reply').value = 'before'; window.submitted = false; });
const EXACT = 'Thanks, Sam. Friday works: 10:30?';
const propose = async (ask) => { await V.fill('.tab-step', ask); await V.click('.tab-propose'); };
const cardOn = () => panel.evaluate(() => document.getElementById('act').classList.contains('on'));
const actSaid = () => V.evaluate(() => (document.querySelector('.tab-act-said') || {}).textContent || '');
await propose('fill Reply with ' + EXACT);
await V.waitForFunction(() => /not on your list/.test((document.querySelector('.tab-act-said') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
check('B3: a site not on the allow list gets no card, and nothing on the page changes',
  !(await cardOn()) && /not on your list/.test(await actSaid()) && (await page.evaluate(() => document.getElementById('reply').value)) === 'before' && records.length === 0, { said: await actSaid(), records });

// a button in the panel's own chrome, pressed until what it does has happened. Not the stage overlap (that was fixed in
// lib/placement.js and those checks click for real): with a real mouse here, about 1 run in 4 a click on this extension tab
// never reaches its handler in headless Chromium (8 runs, 2026-10-10), so the button's own click handler is what is tested
const press = async (sel, landed) => { for (let i = 0; i < 5; i++) { await panel.evaluate((q) => document.querySelector(q).click(), sel); for (let j = 0; j < 10; j++) { if (await landed()) return true; await panel.waitForTimeout(100); } } return false; };
await panel.click('#sites summary');
await panel.waitForSelector('#sites .add:not([hidden])', { timeout: 5000 }).catch(() => {});
await press('#sites .add', async () => ((await sw.evaluate(() => chrome.storage.local.get('allow'))).allow || []).includes('fixture.test'));
for (let i = 0; i < 50 && !((await sw.evaluate(() => chrome.storage.local.get('allow'))).allow || []).includes('fixture.test'); i++) await panel.waitForTimeout(100);
await propose('fill Reply with ' + EXACT);
await panel.waitForFunction(() => document.getElementById('act').classList.contains('on'), null, { timeout: 5000 }).catch(() => {});
const shownCard = await panel.evaluate(() => document.getElementById('act').innerText);
await page.waitForTimeout(300);
check('B3: on an allowed site the panel shows the card (site, the field\'s label, the text, Yes / No) and nothing changes until Yes',
  /fixture\.test/.test(shownCard) && /Reply/.test(shownCard) && shownCard.includes(EXACT) && /Yes/.test(shownCard) && /No/.test(shownCard)
  && (await page.evaluate(() => document.getElementById('reply').value)) === 'before' && records.length === 0, { shownCard, records });

await press('.act-yes', async () => !(await cardOn()));
await V.waitForFunction(() => /recorded/.test((document.querySelector('.tab-act-said') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
const filled = await page.evaluate(() => ({ v: document.getElementById('reply').value, submitted: !!window.submitted }));
const rec1 = records[0] || {};
check('B3: Yes fills the field exactly, submits nothing, and leaves an extension.act record: running first, then done',
  filled.v === EXACT && !filled.submitted && records.length === 1 && rec1.kind === 'extension.act' && rec1.ref === 'fixture.test · Reply' && rec1.state === 'done' && /filled Reply on fixture\.test/.test(rec1.result) && !(await cardOn()),
  { filled, records, said: await actSaid() });

await propose('click Save');
await panel.waitForFunction(() => document.getElementById('act').classList.contains('on'), null, { timeout: 5000 }).catch(() => {});
await press('.act-no', async () => !(await cardOn()));
await V.waitForFunction(() => /you said no/.test((document.querySelector('.tab-act-said') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
const rec2 = records[1] || {};
check('B3: No changes nothing and writes a stubbed record (what would have happened)',
  !(await page.evaluate(() => window.saved)) && records.length === 2 && rec2.state === 'stubbed' && rec2.kind === 'extension.act' && rec2.ref === 'fixture.test · Save' && /would have clicked Save/.test(rec2.result),
  { records, said: await actSaid() });

await propose('click send');
await panel.waitForFunction(() => document.getElementById('act').classList.contains('on'), null, { timeout: 5000 }).catch(() => {});
await press('.act-yes', async () => !(await cardOn()));
await V.waitForFunction(() => /press it yourself/.test((document.querySelector('.tab-act-said') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
const rec3 = records[2] || {};
check('B3: even after Yes, a button that would submit its form is refused (you press send yourself), and the record says it failed',
  !(await page.evaluate(() => window.submitted)) && rec3.state === 'failed' && /submits/.test(rec3.result || ''), { records, said: await actSaid() });

// B3 joined to the drafts: a "draft for me: reply" on an allowed site comes back as a proposed step, the same card with the
// draft in it; on a site not on the list the draft stays copy-only, with no card and nothing said about acting
const draftReply = async () => { await V.evaluate(() => document.querySelector('.tab-ask-reply').click()); await V.waitForFunction(() => /^reply from Void/.test((document.querySelector('.tab-said') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {}); };
await draftReply();
await panel.waitForFunction(() => document.getElementById('act').classList.contains('on'), null, { timeout: 5000 }).catch(() => {});
const replyDraft = await V.evaluate(() => (document.querySelector('.tab-draft') || {}).value || '');
const autoCard = await panel.evaluate(() => ({ on: document.getElementById('act').classList.contains('on'), what: document.querySelector('.act-what').textContent, text: document.querySelector('.act-text').textContent, site: document.querySelector('.act-site').textContent }));
await press('.act-no', async () => !(await cardOn()));
await sw.evaluate(() => chrome.storage.local.set({ allow: [] }));
await page.waitForTimeout(200);
await draftReply();
await page.waitForTimeout(800);
const offList = { on: await cardOn(), said: await V.evaluate(() => (document.querySelector('.tab-said') || {}).textContent || ''), act: await actSaid(), box: await V.evaluate(() => (document.querySelector('.tab-draft') || {}).value || '') };
check('B3 from a draft: a "draft for me: reply" on an allowed site yields the Yes / No card to fill the box you were in with the draft; on a site not listed, no card and the draft stays copy-only',
  autoCard.on && replyDraft.length > 0 && autoCard.text === replyDraft && /Reply/.test(autoCard.what) && autoCard.site === 'fixture.test'
  && !offList.on && /^reply from Void/.test(offList.said) && !/not on your list/.test(offList.act) && offList.box.length > 0,
  { autoCard, replyDraft: replyDraft.slice(0, 80), offList });

// "Ask Void about this page" (sent to Void, #134): the answer card says the page left the browser for this answer
await sw.evaluate(() => chrome.storage.session.set({ ask: { q: 'What is this page about?', page: { title: 'Fixture page', url: 'https://fixture.test/', selection: '', field: '', text: 'fixture text' }, at: Date.now() } }));
await V.waitForSelector('.page-sent', { timeout: 10000 }).catch(() => {});
const sent = await V.evaluate(() => (document.querySelector('.page-sent') || {}).textContent || '');
const answerPosts = out.filter((x) => /a-to-mind\.com\/api\/answer /.test(x) && x.includes('fixture text'));
check('sent to Void: "Ask Void about this page" posts the page to /api/answer and the card flags it ("sent to a-to-mind.com for this answer")',
  /sent to a-to-mind\.com for this answer/.test(sent) && answerPosts.length === 1, { sent, posts: answerPosts.length });

// outside the panel, Void takes no tab from anyone: the same message posted on a-to-mind.com itself does nothing
const plain = await ctx.newPage();
await plain.goto('https://a-to-mind.com/');
await plain.evaluate(() => window.postMessage({ type: 'void-ext:tab', tab: { title: 'forged', url: 'https://evil.test/', selection: 'forged' } }, '*'));
await plain.waitForTimeout(500);
check('trust: a tab message from anything but the pinned extension\'s panel is ignored', !(await plain.$('.tab-card')) && !(await plain.evaluate(() => document.body.classList.contains('in-ext-panel'))));

await ctx.close();
fs.rmSync(extDir, { recursive: true, force: true }); fs.rmSync(userDir, { recursive: true, force: true });
console.log(pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
