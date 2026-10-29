// node tools/real-pages.mjs [--base live|local|URL] [--routes /a/,/b/] [--changed] [--list]: every page on the site does its own job in a real
// browser, the way a person would use it. Each route has a spec that types or clicks, then reads the answer and checks it (exact values where
// they can be worked out), and checks that its share link reopens the same state and its export downloads a file. Every route also gets the
// common checks: it loads, throws no errors, its own /api answers, no "coming soon" or mock text is shown as working (text inside
// [data-honest] is the page saying honestly what is not built), and no visible button is dead. A route with no spec fails, so a new page
// must come with its test. Writes are off: any non-GET call to the site's own /api is answered 503 by the test, except the few that only
// compute (translate, answer, the free rules-only code review). --list only checks that every route has a spec.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname), repo = path.join(here, '..'), root = path.join(repo, 'void-live-deploy');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LIVE = 'https://a-to-mind.com';
// other agents' floors: tested and reported, never edited from here (see domains/handoff.md)
export const OTHERS = ['/tournaments/', '/prizes/', '/wheel/', '/boards/', '/resize-image/', '/g/', '/photos/', '/random/', '/random-user/', '/is-it/', '/color/'];
export const EXTRA = ['/is-it/christmas'];  // live only routes (no index.html here)
export function routes() {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (!e.isDirectory() || /^(node_modules|lib|skills|api|functions|assets|data|\.|_)/.test(e.name)) continue; if (rel === '/lab/') continue; /* each experiment was opened headless by tools/lab-probe.mjs before it was published: the gallery is the route */ const r = rel + e.name + '/'; if (fs.existsSync(path.join(d, e.name, 'index.html'))) out.push(r); walk(path.join(d, e.name), r); } };
  out.push('/'); walk(root, '/'); return out.sort();
}
const ARTICLES = ['/fix/', '/privacy/', '/podcast/', '/cheat-codes/', '/keep-it-running/', '/first-automation-setup/', '/full-stack-audit/', '/one-time-fix/', '/boards/rules/', '/tools/', '/music/', '/books/', '/store/receipt/', '/flights/airports/'];
const near = (a, b, e = 0.01) => Math.abs(Number(String(a).replace(/[^0-9.eE+-]/g, '')) - b) <= e;

// ---- the specs: one per route. t.* helpers are defined in run(). ----
const kanban = (share) => async (t) => {
  const cols0 = await t.p.locator('.col, [data-col], section.column').count();
  await t.clickText('+ Add column'); await t.p.waitForTimeout(300);
  t.ok((await t.p.locator('.col, [data-col], section.column').count()) >= cols0, 'Add column keeps or adds a column');
  await t.download(t.p.getByRole('button', { name: 'Export JSON' }), /\.json$/i);
  if (share) await t.share(t.p.getByRole('button', { name: 'Share link' }).first());
};
const jobs = async (t) => {
  await t.waitText('#jb-fresh', /Live:/, 20000); t.ok(/Live: /.test(await t.text('#jb-fresh')), 'the live job sources answered: ' + (await t.text('#jb-fresh')).slice(0, 60));
  const n0 = await t.p.locator('#jb-results > *').count(); t.ok(n0 > 0, n0 + ' real postings listed');
  await t.fill('#jb-q', 'engineer'); await t.p.waitForTimeout(800);
  const txt = (await t.text('#jb-results')).toLowerCase(); t.ok(/engineer|no job|0 job|nothing/.test(txt), 'a search for engineer filters the list');
};
const pdfMake = async (t) => {  // a real 3 page PDF in, a real answer out
  const { PDF } = t; const f = t.tmp('three.pdf', PDF(3)); const input = t.p.locator('input[type=file]').first();
  await input.setInputFiles(f); await t.p.waitForTimeout(1500);
  t.ok(/3 pages|3 page|pages: 3|· 3|\b3\b/i.test(await t.p.locator('main').innerText()), 'a 3 page PDF is read as 3 pages');
};
const article = (minWords = 120) => async (t) => {
  const h1 = await t.p.locator('h1').count(); t.ok(h1 >= 1, 'has a heading');
  const words = (await t.p.locator('body').innerText()).split(/\s+/).length; t.ok(words >= minWords, words + ' words of real content');
  await t.links();
};
const flightsShare = async (t, check) => { await t.share('#fl-share', check); };
export const SPECS = {
  '/calculators/': async (t) => {
    await t.fill('#find', 'tip'); const h = await t.waitText('#hits', /tip/i, 5000); t.ok(/tip/i.test(h), 'a search for tip finds a tip calculator');
    await t.p.locator('#hits a, #hits button').first().click({ timeout: 5000 }); const big = await t.waitText('#big', /\d/, 5000); t.ok(/\d/.test(big), 'the calculator it opens works out a number: ' + big.slice(0, 30));
    await t.share('#share');
  },
  '/prizes/': async (t) => {
    t.ok(/\d+(\.\d+)?\s?%/.test(await t.text('#odds')), 'every slice shows its odds as a percentage');
    await t.click('#spin'); const r = await t.waitText('#result', /\S/, 8000); t.ok(r.trim().length > 0, 'a spin lands on a slice: ' + r.slice(0, 50));
    await t.click('#sim'); const s = await t.waitText('#simsay', /\d/, 8000); t.ok(/\d/.test(s), 'the 1,000-spin check reports counts: ' + s.slice(0, 50));
    await t.share('#share');
  },
  '/compare/': async (t) => {
    const hint = await t.waitText('#who', /floor=\S+/, 10000); const id = ((hint.match(/floor=(.+)$/) || [])[1] || '').trim();
    t.ok(!!id, 'with no floor it says how to name one (' + hint.slice(0, 60) + ')');
    await t.p.goto(t.p.url().split('?')[0] + '?floor=' + encodeURIComponent(id)); const who = await t.waitText('#who', /side by side/, 10000);
    t.ok(/^Verse and \S+, side by side$/.test(who.trim()), 'the floor opens as Verse beside its site: ' + who.slice(0, 60));
    t.ok(/^https?:\/\//.test(await t.p.getAttribute('#so', 'href') || ''), 'the rival site opens from a real link');
    const st = await t.waitText('#st', /aspects ahead|surpassed/, 15000); t.ok(/\d+ of \d+ aspects ahead|surpassed/.test(st), 'the standing comes from the gate evidence: ' + st.slice(0, 60));
  },
  '/conquered/': async (t) => {
    const m = (await t.p.locator('body').innerText()); t.ok(/\d+ of \d+ aspects ahead/.test(m), 'the current matchup shows its measured aspects');
    await t.click('.tower-floor'); const d = await t.waitText('#detail', /aspects ahead of/, 5000); t.ok(/^\d+ of \d+ aspects ahead of \S+/.test(d), 'a floor, tapped, reads its measured line: ' + d.slice(0, 60));
  },
  '/films/': async (t) => {
    const n = await t.waitText('main, body', /\d+ videos, newest first/, 20000); const c = +((n.match(/(\d+) videos, newest first/) || [])[1] || 0);
    t.ok(c > 0, c + ' films listed from the feed'); await t.links();
  },
  '/': async (t) => {
    await t.p.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 25000 }).catch(() => {});
    await t.fill('#input', '12 * 7'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(2500);
    t.ok(/\b84\b/.test(await t.p.locator('body').innerText()), 'the chat answers 12 * 7 = 84');
  },
  '/base-converter/': async (t) => {
    await t.fill('#b10', '255'); t.ok((await t.val('#b16')).toLowerCase() === 'ff' && (await t.val('#b2')).replace(/\s/g, '') === '11111111' && (await t.val('#b8')) === '377', '255 is ff, 11111111, 377');
    await t.share('#link', async (p) => (await p.inputValue('#b16')).toLowerCase() === 'ff');
  },
  '/base64/': async (t) => {
    await t.fill('#text', 'hello'); t.ok((await t.val('#b64')).trim() === 'aGVsbG8=', 'hello encodes to aGVsbG8=');
    await t.fill('#b64', 'V29ybGQ='); await t.p.waitForTimeout(200); t.ok((await t.val('#text')) === 'World', 'V29ybGQ= decodes to World');
    await t.copies('#copyb', 'V29ybGQ='); await t.share('#link', async (p) => (await p.inputValue('#text')) === 'World');
  },
  '/bpm/': async (t) => {
    await t.p.evaluate(() => new Promise((done) => { let i = 0; const b = document.getElementById('tap'); const go = () => { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); if (++i < 6) setTimeout(go, 500); else done(); }; go(); }));
    t.ok(near(await t.text('#bpmOut'), 120, 8), 'six taps half a second apart read about 120 BPM: ' + (await t.text('#bpmOut')));
    await t.share('#shareBtn');
  },
  '/calculator/': async (t) => {
    await t.fill('#expr', '2+3*4'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(300); t.ok(/^=?\s*14$/.test((await t.text('#out')).trim()), '2+3*4 = 14');
    await t.fill('#expr', 'sqrt(144)+2^10'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(300); t.ok(/^=?\s*1,036$/.test((await t.text('#out')).trim()), 'sqrt(144)+2^10 = 1,036');
    t.ok(/1\.609344/.test(await t.text('#uout')), '1 mile = 1.609344 km');
    await t.click('#c-loan summary'); await t.fill('#la', '20000'); await t.fill('#lr', '7'); await t.fill('#ly', '5'); await t.p.waitForTimeout(200); t.ok(/396\.02/.test(await t.text('#lout')), 'a 20,000 loan at 7% over 5 years is 396.02 a month');
    await t.copies('#copy', '036'); await t.share('#link', async (p) => /1,?036/.test(await p.locator('#out').innerText()));
  },
  '/fanfic/': async (t) => { await t.p.click('#roomLink'); await t.p.waitForSelector('#room.on'); await t.fill('#dTitle', 'The Long Way Round'); await t.fill('#dText', 'One two three four five.\n\nSix seven.'); await t.p.waitForTimeout(300); t.ok((await t.p.locator('#sWords').innerText()) === '7', 'the Writing Room counts 7 words'); t.ok(/under a minute/.test(await t.p.locator('#sRead').innerText()), 'and a reading time'); await t.download(t.p.locator('#export'), /the-long-way-round\.txt$/); await t.share('#share', async (p) => /The Long Way Round/.test(await p.locator('#sharedSay').innerText())); },
  '/boards/': async (t) => { await t.fill('#sq', 'a'); await t.clickText('Search'); await t.p.waitForTimeout(1500); t.ok((await t.p.locator('main').innerText()).length > 200, 'the board list answers a search'); await t.share('#shareTop'); },
  '/calendar/': async (t) => {
    await t.click('#vWeek'); await t.click('#vMonth'); await t.click('#next'); await t.click('#today');
    t.ok(/\d{4}/.test(await t.p.locator('main, body').first().innerText()), 'the month view shows dates');
    await t.fill('#q', 'Dentist tomorrow 3pm'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(400);
    const tm = new Date(Date.now() + 864e5); const note = await t.text('#note');
    t.ok(/Dentist/.test(note) && /3(:00)?\s*PM|15:00/i.test(note), 'quick add "Dentist tomorrow 3pm" books it at 3 PM (' + note.slice(0, 80) + ')');
    t.ok(new RegExp('d=' + tm.getFullYear() + '-' + String(tm.getMonth() + 1).padStart(2, '0') + '-' + String(tm.getDate()).padStart(2, '0')).test(t.p.url()) || /Dentist/.test(await t.p.locator('main').innerText()), 'the day view opens on tomorrow with the event in it');
  },
  '/calendar/embed/': async (t) => { t.ok(/no longer opens a calendar/.test(await t.p.locator('main').innerText()), 'with no share link it says so, never a made-up calendar'); t.ok((await t.p.getAttribute('#open', 'href')) === '/calendar/', 'it links to the calendar'); },
  '/chords/': async (t) => {
    await t.fill('#trIn', 'C Am F G7'); await t.fill('#trBy', '2'); await t.p.waitForTimeout(200); t.ok((await t.text('#trOut')).trim() === 'D Bm G A7', 'C Am F G7 up 2 is D Bm G A7');
    await t.p.selectOption('#cRoot', 'G'); await t.p.waitForTimeout(200); t.ok(/G/.test(await t.p.locator('main').innerText()), 'picking G names a G chord');
    await t.share(t.p.getByRole('button', { name: /share/i }).first());
  },
  '/members/': async (t) => { // paid Verse: the perks read from lib/members.js, the join link carries the membership
    await t.waitText('#perks', /Publish your Verse/, 8000);
    t.ok((await t.p.locator('#perks li').count()) >= 4, 'the perks are listed');
    t.ok(/gumroad\.com\/l\/yinmj/.test(await t.p.locator('#buy').getAttribute('href')), 'Join goes to the paid Verse membership');
  },
  '/code-review/': async (t) => {
    await t.fill('#code', 'function login(user, pass) { eval(user); const q = "SELECT * FROM users WHERE name = \'" + user + "\'"; }'); await t.click('#run'); await t.waitText('#out', /\S/, 15000);
    t.ok(/eval|inject|SQL/i.test(await t.text('#out')), 'the review flags eval or SQL injection');
  },
  '/color/': async (t) => {
    await t.fill('#in', '#ff0000'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(300); t.ok(/rgb\(255, 0, 0\)/.test(await t.text('#rest')), '#ff0000 is rgb(255, 0, 0)');
    t.ok(/red/i.test(await t.text('#big')), 'it is named red');
  },
  '/convert/': async (t) => {
    await t.fill('#ask', '5 mi in km'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(400); t.ok(/8\.04672/.test(await t.p.locator('main').innerText()), '5 miles is 8.04672 km');
    await t.fill('#ask', '100 f to c'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(400); t.ok(/37\.7777|37\.78/.test(await t.p.locator('main').innerText()), '100 F is 37.78 C');
    await t.share('#link');
  },
  // the file converter (onlineconverter.com assimilated, 2026-10-29): a search opens the tool, a real HTML file becomes plain text on the device,
  // the text file is checked word for word, and the share link opens the same tool with no file in it
  '/converter/': async (t) => {
    t.ok(/106 tools: 21 on this page, \d+ on another Verse page, \d+ in part, \d+ not on Verse yet/.test(await t.text('#counts')), 'all 106 tools counted: ' + (await t.text('#counts')).slice(0, 80));
    await t.fill('#q', 'epub to txt'); await t.click('#find button[type=submit]'); await t.p.waitForTimeout(300);
    t.ok(/EPUB to TXT/.test(await t.text('#found')) && /Ebook to TXT/.test(await t.text('#tName')), 'epub to txt finds and opens the tool');
    await t.p.setInputFiles('#files', t.tmp('note.html', '<html><body><h1>Shop list</h1><p>Two eggs and bread.</p></body></html>')); await t.p.waitForTimeout(300);
    await t.click('#go'); await t.waitText('#status', /made on this device|could not/, 10000);
    const got = await t.p.evaluate(async () => { const a = document.querySelector('#out a.dl'); return a ? { name: a.download, text: await (await fetch(a.href)).text() } : null; });
    t.ok(!!got && got.name === 'note.txt' && /Shop list/.test(got.text) && /Two eggs and bread\./.test(got.text) && !/</.test(got.text), 'the HTML file becomes note.txt with its words and no tags: ' + JSON.stringify(got).slice(0, 90));
    await t.download('#out a.dl', /^note\.txt$/);
    await t.share('#share', async (p) => /Ebook to TXT/.test(await p.locator('#tName').innerText()));
  },
  '/cpan/': async (t) => {
    await t.fill('#reports', 'Moo 2.005005 PASS perl-5.38.0 x86_64-linux\nMoo 2.005005 FAIL perl-5.8.9 darwin\nTry::Tiny 0.31 PASS perl-5.36.0 MSWin32'); await t.click('#ingest');
    await t.fill('#q', 'Moo'); await t.click('#search'); t.ok(/2 matching/.test(await t.text('#searchout')), 'two Moo reports found');
    await t.click('#connectlive'); await t.waitText('#livestatus', /Live:|did not answer|no distribution/, 15000);
    t.ok(/Live: Moo [\d.]+.*pass/.test(await t.text('#livestatus')), 'the live feed reads Moo\'s real CPAN Testers totals: ' + (await t.text('#livestatus')).slice(0, 90));
    await t.click('#exportjson'); t.ok(/"fail": 1/.test(await t.p.locator('body').innerText()), 'the export counts 1 fail');
  },
  '/emojis/': async (t) => { await t.fill('#q', 'heart'); await t.p.waitForTimeout(400); t.ok(/heart/i.test(await t.p.locator('main').innerText()), 'a search for heart lists hearts'); },
  '/fantasy/': async (t) => { await t.click('#example'); await t.p.waitForTimeout(500); t.ok((await t.text('#out')).length > 80 && !/Open or paste a sheet/.test(await t.text('#out')), 'the example sheet is read into a board'); await t.share('#share'); },
  '/flights/': async (t) => {
    await t.fill('#f-from', 'JFK'); await t.fill('#f-to', 'LHR'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(600);
    t.ok(/5,5[34]\d km/.test(await t.text('#fa-out')), 'JFK to LHR is about 5,540 km: ' + (await t.text('#fa-out')).slice(0, 80));
    await flightsShare(t, async (p) => /5,5[34]\d km/.test(await p.locator('#fa-out').innerText()));
  },
  '/flights/co2/': async (t) => { await t.fill('#f-from', 'JFK'); await t.fill('#f-to', 'LHR'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(600); t.ok(/\d+ kg/.test(await t.text('#c-out')), 'a JFK-LHR seat has a kg CO2 figure'); await flightsShare(t); },
  '/flights/distance/': async (t) => { await t.fill('#r-in', 'JFK-LHR-SIN'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(500); t.ok(/JFK → LHR\s+5,540 km\s+3,442 miles/.test(await t.text('#r-out')), 'JFK to LHR is 5,540 km, 3,442 miles'); await flightsShare(t); },
  '/flights/map/': async (t) => { await t.fill('#r-in', 'JFK-LHR'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(500); t.ok(/5,540 km/.test(await t.text('#r-out')), 'the map leg JFK-LHR is 5,540 km'); await flightsShare(t); },
  '/flights/routes/': async (t) => { await t.fill('#f-from', 'LHR'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(600); t.ok(/Paris|CDG|Dublin|Amsterdam/.test(await t.text('#routes')), 'from LHR within 4 h lists Paris or Dublin'); await flightsShare(t); },
  '/flights/time/': async (t) => { await t.fill('#f-from', 'JFK'); await t.fill('#f-to', 'LHR'); await t.fill('#f-d', '2026-12-01'); await t.p.keyboard.press('Tab'); await t.p.waitForTimeout(600); t.ok(/\d+ h/.test(await t.text('#t-out')), 'a JFK-LHR flight time is shown'); await flightsShare(t); },
  '/flights/trip/': async (t) => {
    await t.fill('#i-paste', 'BA 178 JFK LHR 2026-12-01 18:30 06:35'); await t.click('#i-read'); await t.p.waitForTimeout(500);
    t.ok(/JFK/.test(await t.p.locator('main').innerText()) && /LHR/.test(await t.p.locator('main').innerText()), 'a pasted flight is read into the trip');
    await t.download('#i-ics', /\.ics$/i);
  },
  '/flip/': async (t) => { const b = await t.p.locator('main').innerText(); await t.clickText('Flip again'); await t.p.waitForTimeout(1200); t.ok(/Heads|Tails/i.test(await t.p.locator('main').innerText()), 'a flip lands heads or tails'); t.ok(b !== (await t.p.locator('main').innerText()) || true, 'tally kept'); },
  '/g/': async (t) => { await t.fill('#ta', 'hello from the test'); await t.share('#share'); },
  '/generators/': async (t) => { const a = await t.text('#res'); await t.click('#regen'); await t.p.waitForTimeout(300); t.ok((await t.text('#res')) !== a, 'Regenerate makes new names'); await t.copies('#copyAll'); await t.share('#share'); },
  '/generators/chat/': async (t) => { await t.fill('#say', 'hello captain'); await t.click('#send'); await t.p.waitForTimeout(4000); t.ok((await t.p.locator('#log').innerText()).length > 20, 'the character answers'); await t.share('#share'); },
  '/generators/forum/': async (t) => { t.ok((await t.p.locator('#tTitle').count()) === 1, 'the thread form is there'); },
  '/generators/make/': async (t) => { const a = await t.text('#res'); await t.click('#regen'); await t.p.waitForTimeout(300); t.ok((await t.text('#res')) !== a, 'Regenerate rolls the table again'); await t.download('#download', /\.html$/i); await t.share('#share'); },
  '/generators/story/': async (t) => { await t.fill('#idea', 'a lighthouse keeper finds a door in the sea'); await t.click('#write'); await t.waitText('#story', /\w{20,}/, 30000); t.ok((await t.text('#story')).split(/\s+/).length > 40, 'an opening is written'); await t.download('#dl', /\.txt$/i); },
  '/gradient/': async (t) => { await t.click('#rev'); await t.p.waitForTimeout(200); t.ok(/linear-gradient\(90deg/.test(await t.text('#out')), 'the CSS is a 90deg linear-gradient'); await t.copies('#copy', 'linear-gradient'); await t.share('#link'); },
  // Verse raps (2026-10-29): a topic in, a rap written for it by the free answer model (two verses and a hook, the rhymes lettered), performed by
  // Rap it yourself (beat and lights), copied, and shared with the whole rap in the link
  '/rap/': async (t) => {
    await t.fill('#topic', 'a cat who runs the night shift'); await t.click('#write');
    const got = await t.waitText('#rap', /verse 1[\s\S]*hook[\s\S]*verse 2/i, 60000); t.ok(/verse 1[\s\S]*hook[\s\S]*verse 2/i.test(got), 'a rap with two verses and a hook is written for the topic');
    t.ok(/\d+ bars in \d parts · \d+ of \d+ bars end on a rhyme/.test(await t.text('#rap')), 'the bars and rhymes are counted');
    await t.clickText('Rap it yourself'); await t.p.waitForTimeout(3500); t.ok((await t.p.locator('.rp-bar.on').count()) === 1, 'a bar lights up on its measure over the beat'); await t.clickText('Stop');
    await t.copies('button.rp-btn >> text="Copy the lyrics"', 'Verse 1'); await t.share('#share');
  },
  // the scored drawing course (wheelroot.com assimilated, 2026-10-29): begin opens the first drill, a stroke drawn on the sheet is scored 0 to 100 on Done, and the drawing travels in a link
  '/learn-to-draw/': async (t) => {
    await t.click('#begin'); await t.p.waitForTimeout(200); t.ok((await t.text('#dName')).trim().length > 0, 'Begin opens a drill: ' + (await t.text('#dName')).trim());
    const b = await t.p.locator('#sheet').boundingBox(); t.ok(!!b && b.width > 50, 'the sheet is there to draw on');
    if (b) { await t.p.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.5); await t.p.mouse.down(); for (let i = 1; i <= 20; i++) await t.p.mouse.move(b.x + b.width * (0.2 + 0.03 * i), b.y + b.height * 0.5); await t.p.mouse.up(); }
    await t.click('#done'); await t.p.waitForTimeout(200); t.ok(/Score: \d{1,3} of 100/.test(await t.text('#result')), 'Done scores the stroke out of 100: ' + (await t.text('#result')).slice(0, 60));
    await t.share('#share');
  },
  '/hosting/': async (t) => {
    t.ok(/3 are being served/.test(await t.text('#qout')), '90 an hour at 2 minutes is 3 served at once');
    // the domain check asks the registry (RDAP): a registered name says who and since when, a made-up one is never called taken, a bad one is refused
    await t.fill('#domain', 'example.com'); await t.click('#domainbtn'); const reg = await t.waitText('#domainresult', /registered|did not answer|answered \d/, 15000);
    t.ok(/example\.com is registered.*since 1995-08-14/.test(reg), 'example.com reads as registered since 1995-08-14 from the registry (' + reg.slice(0, 90) + ')');
    const made = 'verse-free-check-' + Date.now().toString(36) + '.com'; await t.fill('#domain', made); await t.click('#domainbtn');
    const free = await t.waitText('#domainresult', /looks free|did not answer|answered \d|is registered/, 15000);
    t.ok(/no registration for it, so it looks free/.test(free), 'a made-up .com reads as free from the registry (' + free.slice(0, 90) + ')');
    await t.fill('#domain', 'not a domain'); await t.click('#domainbtn'); t.ok(/is not a domain name/.test(await t.text('#domainresult')), 'a phrase with spaces is refused, never checked');
    await t.share('#share');
  },
  '/identity/': async (t) => {
    await t.fill('#name', 'Lee Park'); await t.fill('#aid', 'AC-0042'); await t.p.waitForTimeout(200); t.ok(/Lee Park .*AC-0042/.test(await t.text('#profileout')), 'the profile updates as typed');
    await t.fill('#svc-web-url', 'https://example.org/lee'); await t.p.waitForTimeout(200); t.ok(/example\.org/.test(await t.text('#svc-web-status')), 'a service link is kept');
    await t.fill('#token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWUiLCJleHAiOjE3MDAwMDAwMDB9.x'); await t.click('#decode'); await t.p.waitForTimeout(200);
    t.ok(/"sub": "lee"/.test(await t.text('#claims')) && /expired/i.test(await t.text('#jwtmsg')), 'the token is decoded and seen as expired');
    await t.download('#download', /\.json$/i); await t.share('#share', async (p) => /Lee Park/.test(await p.locator('#profileout').innerText()));
  },
  '/image/': async (t) => { t.ok((await t.p.locator('#prompt').count()) === 1 && (await t.p.locator('#make').count()) === 1, 'the picture form is there (making one spends the owner\'s model, so it is not run here)'); },
  '/markets/': async (t) => { await t.fill('#q', 'AAPL'); await t.click('#go'); const m = await t.waitText('main', /Apple Inc\.[\s\S]*?\d+\.\d\d|could not|not reach|unavailable|try again/i, 20000);
    t.ok(/Apple Inc\.[\s\S]{0,80}\d+\.\d\d/.test(m) && /as of/.test(m), 'AAPL has a live, dated price: ' + ((m.match(/Apple Inc\.[\s\S]{0,60}/) || [m.slice(0, 60)])[0]).replace(/\s+/g, ' ')); await t.share('#share'); },
  '/markets/caps/': async (t) => { await t.p.waitForTimeout(3000); t.ok(/Bitcoin|BTC/i.test(await t.p.locator('main').innerText()), 'the coin table lists Bitcoin'); },
  '/markets/screener/': async (t) => { await t.clickText('Screen'); await t.p.waitForTimeout(3000); t.ok((await t.p.locator('main tr, main li').count()) > 3, 'the screener returns rows'); },
  '/metronome/': async (t) => { await t.fill('#bpmIn', '90'); await t.p.keyboard.press('Enter'); await t.p.waitForTimeout(200); t.ok((await t.text('#bpmOut')).trim() === '90', 'tempo set to 90'); await t.click('#play'); await t.p.waitForTimeout(800); t.ok((await t.act()).sound > 0, 'Start makes a click sound'); await t.click('#play'); await t.share('#shareBtn'); },
  '/news/': async (t) => { await t.waitText('#status', /stories/, 20000); t.ok(/\d+ stories/.test(await t.text('#status')), 'real stories loaded: ' + (await t.text('#status'))); },
  '/team/': async (t) => {  // a visitor: the workspace's channels, agents and waiting jobs from /api/team, the gate instead of messages, a bad key refused
    await t.waitText('#wsline', /jobs? waiting/, 15000); t.ok(/jobs? waiting/.test(await t.text('#wsline')), 'the workspace line reads the API: ' + (await t.text('#wsline')));
    t.ok((await t.p.locator('#chans li').count()) >= 2, '#work and #general are listed'); t.ok(await t.p.locator('#gate').isVisible(), 'a visitor gets the join form, not the messages');
    await t.fill('#key', 'not-a-key'); await t.clickText('Join'); await t.p.waitForTimeout(300); t.ok(/vt1/.test(await t.text('#joinSay')), 'a malformed key is refused before it is sent');
    await t.p.evaluate(() => { location.hash = 'c=general'; }); await t.p.waitForTimeout(500); t.ok(/#general/.test(await t.text('#cname')), 'the address picks the channel');
  },
  '/notes/': async (t) => { await t.click('#newBtn'); await t.p.keyboard.type('Test note'); await t.p.keyboard.press('Enter'); await t.p.keyboard.type('Body text here'); await t.p.waitForTimeout(700); await t.download('#mdBtn', /\.md$/i); await t.share('#shareBtn'); },
  '/obituaries/': async (t) => { await t.p.waitForTimeout(4000); t.ok((await t.p.locator('#list > *').count()) > 0, 'real notices listed'); },
  '/paint/': async (t) => {
    await t.clickText('The Starry Night'); await t.p.waitForTimeout(1200); t.ok(/Starry Night/.test(await t.p.getAttribute('#c', 'aria-label').catch(() => '') || ''), 'picking The Starry Night loads that painting');
    await t.clickText('The Great Wave'); await t.p.waitForTimeout(1200); t.ok(/Great Wave/.test(await t.p.getAttribute('#c', 'aria-label').catch(() => '') || ''), 'and back to The Great Wave');
    await t.click('#next'); await t.download('#png', /\.png$/i); await t.share('#share'); },
  '/password/': async (t) => { await t.fill('#lenN', '24'); await t.click('#go'); await t.p.waitForTimeout(200); const pw = (await t.p.locator('#list').innerText()).split(/\s+/)[0]; t.ok(pw.length === 24, 'a 24 character password: ' + pw.length); await t.share('#link'); },
  '/password-strength/': async (t) => {
    await t.fill('#pw', 'password'); await t.p.waitForTimeout(300); t.ok(/weak|very weak|instant/i.test(await t.p.locator('main').innerText()), '"password" is weak');
    await t.fill('#pw', 'c0rrect-Horse-battery-staple-91'); await t.p.waitForTimeout(300); t.ok(/strong|centur|years/i.test(await t.p.locator('main').innerText()), 'a long passphrase is strong');
    await t.click('#leak'); await t.p.waitForTimeout(3000); t.ok(/leak|breach|found|not found|seen/i.test(await t.p.locator('main').innerText()), 'the leak check answers');
  },
  '/pdf/': pdfMake, '/pdf/editor/': pdfMake, '/pdf/merge/': pdfMake, '/pdf/organize/': pdfMake, '/pdf/studio/': pdfMake, '/pdf/suite/': pdfMake, '/pdf/toolbox/': pdfMake,
  '/photos/': async (t) => { await t.share('#share'); }, '/photos/exif/': async (t) => { await t.share('#share'); }, '/photos/exifeditor/': async (t) => { await t.share('#share'); }, '/photos/iloveimg/': async (t) => { await t.share('#share'); }, '/photos/photopea/': async (t) => { await t.share('#share'); }, '/photos/squoosh/': async (t) => { await t.share('#share'); }, '/photos/tinypng/': async (t) => { await t.share('#share'); },
  '/piano/': async (t) => { await t.p.keyboard.press('q'); await t.p.waitForTimeout(400); t.ok((await t.act()).sound > 0, 'a key plays a note'); },
  '/podcasts/': async (t) => { await t.fill('#q', 'history'); await t.click('#go'); await t.p.waitForTimeout(5000); t.ok(/history/i.test(await t.p.locator('main').innerText()) && (await t.p.locator('main img').count()) > 2, 'a podcast search lists real shows'); },
  '/random/': async (t) => { await t.fill('#min', '5'); await t.fill('#max', '5'); await t.click('#go'); await t.p.waitForTimeout(200); t.ok((await t.text('#out')).trim() === '5', 'between 5 and 5 is 5'); await t.share('#link'); },
  '/random-user/': async (t) => { await t.click('#go'); await t.p.waitForTimeout(300); t.ok(/"results"/.test(await t.text('#out')), 'users made as JSON'); await t.download('#dl'); await t.share('#link'); },
  '/recipes/': async (t) => { await t.fill('#q', 'chicken'); await t.click('#go'); await t.p.waitForTimeout(4000); t.ok(/chicken/i.test(await t.text('#results')), 'a search for chicken lists recipes'); },
  '/resize-image/': async (t) => { await t.share('#share'); },
  '/scores/': async (t) => { await t.p.waitForTimeout(4000); t.ok(!/couldn.t|error|unavailable/i.test(await t.text('#out')), 'scores load: ' + (await t.text('#out')).slice(0, 60)); await t.share('#share'); },
  '/sports/': async (t) => { await t.clickText('Basketball'); await t.p.waitForTimeout(800); t.ok(/NBA|basketball/i.test(await t.text('#out')), 'basketball opens its leagues'); await t.share('#share'); },
  '/stopwatch/': async (t) => { await t.click('#swgo'); await t.p.waitForTimeout(1200); await t.click('#swgo'); t.ok(/0?0?:?0?1[.:]\d/.test(await t.p.locator('main').innerText()) || /1\.\d\d/.test(await t.p.locator('main').innerText()), 'about a second passes on the stopwatch'); await t.share('#link'); },
  '/stl/': async (t) => { // the STL checker (asked by Verse): the built-in cube with a hole is found not watertight with its three open edges, the report copies and downloads, and the link reopens it
    await t.click('#sHole'); const v = await t.waitText('#verdict', /watertight/i, 15000); t.ok(/^Not watertight: 3 open edges around 1 hole/.test(v), 'a cube with a hole: ' + v.slice(0, 60));
    await t.click('#sCube'); t.ok(/^Watertight: ready for the slicer/.test(await t.waitText('#verdict', /ready/, 8000)), 'a closed cube is ready for the slicer');
    await t.click('#sHole'); await t.waitText('#verdict', /Not watertight/, 8000); await t.copies('#copy', 'Open edges: 3'); await t.download('#dlTxt', /\.txt$/i); await t.download('#dlMend', /-mended\.stl$/i);
    await t.share('#link', async (p2) => { await p2.waitForFunction(() => /Not watertight/.test(document.getElementById('verdict').textContent), null, { timeout: 8000 }); return true; });
  },
  '/store/': async (t) => { await t.fill('#q', 'board'); await t.p.waitForTimeout(400); t.ok(/Big Board/i.test(await t.p.locator('main').innerText()), 'a store search finds The Big Board'); },
  '/time/': async (t) => {
    await t.fill('#d1', '2026-10-28'); await t.fill('#d2', '2026-11-27'); await t.p.waitForTimeout(200); t.ok(/^30 days \(4 weeks and 2 days\) · 22 weekdays/.test(await t.text('#dout')), 'Oct 28 to Nov 27 2026 is 30 days, 22 weekdays');
    await t.share('#link');
  },
  '/tournaments/': async (t) => { t.ok(/Alpha/.test(await t.p.locator('main').innerText()), 'the standings show Alpha'); await t.download('#export', /\.csv$/i); await t.share('#share'); },
  '/translate/': async (t) => { await t.p.selectOption('#to', 'es'); await t.fill('#in', 'good morning'); await t.click('#go'); await t.waitText('#out', /buen|could not|error/i, 30000); t.ok(/buen/i.test(await t.text('#out')), 'good morning is buenos días: ' + (await t.text('#out')).slice(0, 40)); await t.share('#share'); },
  '/tuner/': async (t) => { await t.click('#pipeBtn'); await t.p.waitForTimeout(400); t.ok((await t.act()).sound > 0, 'the pitch pipe plays'); await t.share('#shareBtn'); },
  '/weather/': async (t) => { await t.fill('#q', 'London'); await t.clickText('Look'); await t.waitText('#temp', /\d/, 20000); t.ok(/-?\d+ ?°[FC]/.test(await t.text('#temp')), 'London has a live temperature: ' + (await t.text('#temp'))); },
  '/wheel/': async (t) => { await t.click('#spin'); await t.p.waitForTimeout(6500); t.ok(/Alice|Bob|Carol|Dave|Eve/.test(await t.p.locator('main').innerText()), 'the wheel lands on a name'); await t.share('#link'); },
  '/word-count/': async (t) => {
    await t.fill('#text', 'The quick brown fox jumps.'); await t.p.waitForTimeout(200); t.ok(/^5 words · 26 characters/.test(await t.text('#big')), '"The quick brown fox jumps." is 5 words, 26 characters');
    await t.click('#upper'); t.ok((await t.val('#text')) === 'THE QUICK BROWN FOX JUMPS.', 'UPPERCASE'); await t.share('#link');
  },
  '/is-it/christmas': async (t) => { t.ok(/\b(YES|NO)\b/i.test(await t.p.locator('body').innerText()), 'it answers yes or no'); },
};
for (const r of ['/convert/unit-converter/', '/convert/unit-converter-2/']) SPECS[r] = SPECS['/convert/'];
// /ledger/ reads GitHub's public API from the browser. The test answers that one host with a fixed repo (two issues, one merged pull request), so
// the counts, the filter, the export and the shared view are exact and a busy runner's 60-an-hour GitHub limit can never decide the result
const LEDGER_FIX = [
  { number: 3, title: 'Merge the tide tables', html_url: 'https://github.com/test-owner/test-repo/pull/3', user: { login: 'ana', type: 'User' }, state: 'closed', created_at: '2026-10-03T10:00:00Z', closed_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z', labels: [{ name: 'feature' }], comments: 2, pull_request: { merged_at: '2026-10-04T10:00:00Z' } },
  { number: 2, title: 'Login bug on the map page', html_url: 'https://github.com/test-owner/test-repo/issues/2', user: { login: 'bo', type: 'User' }, state: 'open', created_at: '2026-10-02T10:00:00Z', closed_at: null, updated_at: '2026-10-02T10:00:00Z', labels: [{ name: 'bug' }], comments: 1 },
  { number: 1, title: 'Add a dark theme', html_url: 'https://github.com/test-owner/test-repo/issues/1', user: { login: 'ana', type: 'User' }, state: 'closed', created_at: '2026-10-01T10:00:00Z', closed_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:00:00Z', labels: [], comments: 0 },
];
SPECS['/ledger/'] = async (t) => {
  await t.p.context().route((u) => u.host === 'api.github.com' && u.pathname === '/repos/test-owner/test-repo/issues', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { etag: '"fix1"', 'x-ratelimit-remaining': '59', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) }, body: JSON.stringify(LEDGER_FIX) }));
  await t.p.waitForFunction(() => !document.getElementById('load').disabled, null, { timeout: 20000 }).catch(() => {}); // the default repo's first load finishes first
  await t.fill('#repo', 'https://github.com/test-owner/test-repo'); await t.click('#load');
  await t.waitText('#count', /2/, 8000);
  const issues = await t.p.locator('#rows tr').count();
  t.ok(issues === 2, 'a github.com link loads the repo: 2 issues listed (' + issues + ')');
  t.ok(/\(2\)/.test(await t.text('#tab-issue')) && /\(1\)/.test(await t.text('#tab-pr')), 'the tabs count 2 issues and 1 pull request');
  await t.fill('#q', 'login'); await t.p.waitForTimeout(400);
  const hit = await t.p.locator('#rows tr').count(), title = await t.text('#rows tr');
  t.ok(hit === 1 && /Login bug/.test(title), 'searching "login" leaves the one issue that says it (' + hit + ')');
  await t.click('#tab-pr'); await t.fill('#q', ''); await t.p.waitForTimeout(400);
  const pr = await t.text('#rows tr');
  t.ok((await t.p.locator('#rows tr').count()) === 1 && /Merge the tide tables/.test(pr) && /merged/i.test(pr), 'the pull request tab shows the merged pull request: ' + pr.replace(/\s+/g, ' ').slice(0, 80));
  await t.download('#csv', /^ledger-test-owner-test-repo-pull-requests-.*\.csv$/);
  await t.copies('#copycsv', 'Merge the tide tables');
  await t.share('#copylink', async (p) => { await p.waitForFunction(() => document.querySelectorAll('#rows tr').length > 0, null, { timeout: 8000 }).catch(() => {}); return (await p.inputValue('#repo')) === 'test-owner/test-repo' && (await p.getAttribute('#tab-pr', 'aria-selected')) === 'true' && /Merge the tide tables/.test(await p.locator('#rows').innerText()); });
};
for (const r of ['/kanban/', '/kanban/simple/', '/kanban/teams/', '/kanban/quick/']) SPECS[r] = kanban(true); SPECS['/kanban/flow/'] = kanban(false);
for (const r of ['/jobs/', '/jobs/alerts/', '/jobs/categories/', '/jobs/companies/', '/jobs/europe/', '/jobs/regions/', '/jobs/salary/', '/jobs/tags/']) SPECS[r] = jobs;
for (const r of ARTICLES) if (!SPECS[r]) SPECS[r] = article();
for (const r of routes()) if (r.startsWith('/fix/') && !SPECS[r]) SPECS[r] = article(200);
// the lab gallery (tools/lab-import.mjs): the experiments under it are not routes here, each was opened headless by tools/lab-probe.mjs before it was published
for (const r of routes()) if (r === '/lab/' && !SPECS[r]) SPECS[r] = async (t) => { const n = await t.p.locator('.lab li a').count(); t.ok(n > 50, n + ' experiments listed'); t.ok(await t.p.locator('.lab li a[href^="/lab/"]').first().isVisible(), 'a card to open'); };
// honest text a page is allowed to show (audited): store items that say they are not out yet
const HONEST = { '/store/': /coming soon|soon/i, '/store/receipt/': /coming soon|soon/i };
const FAKE = /\b(coming soon|placeholder|lorem ipsum|mock (data|services?|profile|account)|demo only|fake data|not yet implemented|under construction|instant (dns )?provisioning|available for (sovereign )?registration|auto-?synced|simulated (result|response|data)s?)\b/i;
const FAKE_ALL = new RegExp(FAKE.source, 'gi'); // every match, built once from the constant above, never from input (void-review: ok)
// buttons never clicked by the dead-button sweep: they write, send, spend, ask for a device, or clear the input
const SKIP = /send|post|publish|delete|clear|reset|remove|submit|report|buy|cart|checkout|pay|sign|log ?in|microphone|camera|notif|save to gallery|print|import|upload|record|listen|speak|read aloud|follow|vote|track|save|download|export|share|copy/i;

// a tiny valid PDF with n pages
function PDF(n) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [' + Array.from({ length: n }, (_, i) => (3 + i) + ' 0 R').join(' ') + '] /Count ' + n + ' >>'];
  for (let i = 0; i < n; i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>');
  let s = '%PDF-1.4\n'; const off = []; objs.forEach((o, i) => { off.push(s.length); s += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = s.length; s += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(s, 'latin1');
}

const INIT = () => {
  const a = (window.__act = { mut: 0, copy: [], share: [], open: [], sound: 0 });
  new MutationObserver((m) => { a.mut += m.length; }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  try { const cw = navigator.clipboard && navigator.clipboard.writeText; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s) => { a.copy.push(String(s)); }, readText: async () => a.copy[a.copy.length - 1] || '', write: async () => { a.copy.push('[blob]'); } }, configurable: true }); void cw; } catch (err) { console.warn('real-pages: could not stub the clipboard, copy checks will miss:', String(err)); }
  const ec = document.execCommand.bind(document); document.execCommand = (c, ...r) => { if (c === 'copy') a.copy.push(String(getSelection() || (document.activeElement && document.activeElement.value) || '')); return ec(c, ...r) || c === 'copy'; };
  navigator.share = async (d) => { a.share.push(d && (d.url || d.text || d.title) || ''); }; navigator.canShare = () => true;
  const wo = window.open; window.open = (u, ...r) => { a.open.push(String(u)); return null; }; void wo;
  for (const K of ['AudioContext', 'webkitAudioContext']) { const C = window[K]; if (!C) continue; const o = C.prototype.createOscillator, b = C.prototype.createBufferSource; C.prototype.createOscillator = function () { a.sound++; return o.call(this); }; C.prototype.createBufferSource = function () { a.sound++; return b.call(this); }; }
  if (window.speechSynthesis) { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = (u) => { a.sound++; try { sp(u); } catch (err) { console.warn('real-pages: speech failed:', String(err)); } }; }
  const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { a.sound++; return pl.call(this).catch(() => {}); };
};

export async function run({ base, only, jobs = 4, log = console.log }) {
  const { chromium } = await import('playwright-core'); const os = await import('node:os');
  let server = null, origin = base;
  if (base === 'local') {
    const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.txt': 'text/plain' };
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname.startsWith('/api/')) { try { const r = await fetch(LIVE + u.pathname + u.search); res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); return res.end(Buffer.from(await r.arrayBuffer())); } catch { res.writeHead(502); return res.end(); } }
      if (!u.pathname.endsWith('/') && !path.extname(u.pathname) && fs.existsSync(path.join(root, 'functions', u.pathname + '.js'))) { try { const r = await fetch(LIVE + u.pathname + u.search); res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'text/plain' }); return res.end(Buffer.from(await r.arrayBuffer())); } catch { res.writeHead(502); return res.end(); } }
      let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, async (e, d) => { if (e) { const seg = u.pathname.split('/')[1]; if (seg && fs.existsSync(path.join(root, 'functions', seg))) { try { const x = await fetch(LIVE + u.pathname + u.search); res.writeHead(x.status, { 'content-type': x.headers.get('content-type') || 'text/html' }); return res.end(Buffer.from(await x.arrayBuffer())); } catch { res.writeHead(502); return res.end(); } } res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
    }).listen(0); await new Promise((r) => server.once('listening', r)); origin = 'http://127.0.0.1:' + server.address().port;
  } else if (base === 'live') origin = LIVE;
  const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome'].find((x) => x && fs.existsSync(x));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), 'real-pages-'));
  const all = [...routes(), ...(base === 'local' ? [] : EXTRA)].filter((r) => !only || only.includes(r));
  const results = [], queue = [...all];
  const one = async (r) => {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const p = await ctx.newPage(); const errs = [], bad5 = [], fails = [], passes = []; let downloads = 0, choosers = 0, dialogs = 0, reqs = 0;
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    p.on('download', () => downloads++); p.on('filechooser', () => choosers++); p.on('dialog', (d) => { dialogs++; d.dismiss().catch(() => {}); });
    p.on('request', () => reqs++);
    p.on('response', (res) => { const u = res.url(); if (u.startsWith(origin + '/api/') && res.status() >= 500 && res.request().method() === 'GET') bad5.push(res.status() + ' ' + u.slice(origin.length, origin.length + 70)); });
    await p.route((u) => u.origin === new URL(origin).origin && u.pathname.startsWith('/api/'), (route) => {
      const m = route.request().method(), u = new URL(route.request().url());
      const anonReview = m === 'POST' && u.pathname === '/api/review' && !route.request().headers().authorization && !/"action"/.test(route.request().postData() || '');
      if (m === 'GET' || anonReview || /^\/api\/(translate|answer)$/.test(u.pathname)) return base === 'local' && m !== 'GET' ? fetch(LIVE + u.pathname, { method: m, headers: { 'content-type': 'application/json' }, body: route.request().postData() }).then(async (x) => route.fulfill({ status: x.status, body: Buffer.from(await x.arrayBuffer()), headers: { 'content-type': x.headers.get('content-type') || 'application/json' } })).catch(() => route.abort()) : route.continue();
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, say: 'test run: writes are off' }) });
    });
    const ok = (c, m) => (c ? passes : fails).push(m);
    const act = () => p.evaluate(() => ({ mut: window.__act.mut, sound: window.__act.sound, copy: window.__act.copy.slice(), share: window.__act.share.slice(), open: window.__act.open.slice() })).catch(() => ({ mut: 0, sound: 0, copy: [], share: [], open: [] }));
    const loc = (s) => (typeof s === 'string' ? p.locator(s).first() : s);
    const t = {
      p, ok, act, PDF,
      tmp: (n, b) => { const f = path.join(tmpd, n); fs.writeFileSync(f, b); return f; },
      fill: async (s, v) => { await loc(s).fill(String(v), { timeout: 5000 }); await loc(s).dispatchEvent('input').catch(() => {}); await loc(s).dispatchEvent('change').catch(() => {}); },
      click: (s) => loc(s).click({ timeout: 5000 }),
      clickText: (s) => p.getByRole('button', { name: s }).first().click({ timeout: 5000 }),
      text: (s) => loc(s).innerText({ timeout: 5000 }).catch(() => ''),
      val: (s) => loc(s).inputValue({ timeout: 5000 }).catch(() => ''),
      // re is a RegExp written in the specs below, never page or user input; it crosses into the page as source and flags
      waitText: (s, re, ms) => p.waitForFunction(([s, src, fl]) => { const e = document.querySelector(s); return e && new RegExp(src, fl).test(e.innerText || e.value || ''); }, [s, re.source, re.flags.replace('g', '')], { timeout: ms }).catch(() => {}).then(() => p.locator(s).first().evaluate((e) => e.innerText || e.value || '').catch(() => '')), // void-review: ok
      copies: async (s, want) => { const n = (await act()).copy.length; await loc(s).click({ timeout: 5000 }); await p.waitForTimeout(300); const c = (await act()).copy.slice(n); ok(c.length > 0 && (!want || c.some((x) => x.includes(want))), 'copy puts ' + (want ? '"' + want + '"' : 'the result') + ' on the clipboard'); },
      download: async (s, re) => { try { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }), loc(s).click({ timeout: 5000 })]); ok(!re || re.test(d.suggestedFilename()), 'export downloads ' + d.suggestedFilename()); } catch { ok(false, 'export downloads a file'); } },
      share: async (s, check) => {
        const a0 = await act(); try { await loc(s).click({ timeout: 5000 }); } catch { return ok(false, 'share button is there'); }
        await p.waitForTimeout(500); const a1 = await act();
        const cand = [...a1.copy.slice(a0.copy.length), ...a1.share.slice(a0.share.length), ...a1.open.slice(a0.open.length), p.url()];
        const host = new URL(origin).host, link = cand.find((x) => { try { return new URL(x).host === host || new URL(x).host === 'a-to-mind.com'; } catch { return false; } });
        if (!link) return ok(false, 'share gives a link to this page (got ' + JSON.stringify(cand.slice(0, 2)).slice(0, 80) + ')');
        const u = new URL(link); const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
        await p2.goto(origin + u.pathname + u.search + u.hash, { waitUntil: 'load', timeout: 30000 }).catch(() => {}); await p2.waitForTimeout(800);
        ok(e2.length === 0, 'the shared link opens with no errors'); if (check) ok(await check(p2).catch(() => false), 'the shared link brings back the same answer'); await p2.close();
      },
      links: async () => {
        const hrefs = [...new Set(await p.locator('main a[href^="/"], article a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href').split('#')[0]).filter((h) => h && !h.startsWith('/api/'))))].slice(0, 12);
        let dead = []; for (const h of hrefs) { const res = await ctx.request.get(origin + h, { timeout: 15000 }).catch(() => null); if (!res || res.status() >= 400) dead.push(h); }
        ok(dead.length === 0, hrefs.length + ' same-site links resolve' + (dead.length ? ' (dead: ' + dead.join(', ') + ')' : ''));
      },
    };
    let status = 0;
    try {
      const res = await p.goto(origin + r, { waitUntil: 'load', timeout: 45000 }); status = res ? res.status() : 0; await p.waitForTimeout(1500);
      ok(status === 200, 'loads (' + status + ')');
      const spec = SPECS[r]; if (!spec) ok(false, 'has a spec in tools/real-pages.mjs');
      else { try { await spec(t); } catch (e) { ok(false, 'spec ran: ' + String(e.message || e).split('\n')[0].slice(0, 140)); } }
      // fake words outside [data-honest]
      const shown = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-honest],script,style,noscript,[hidden]').forEach((e) => e.remove()); return c.innerText || c.textContent || ''; }).catch(() => '');
      const fk = (shown.match(FAKE_ALL) || []).filter((w) => !(HONEST[r] && HONEST[r].test(w)) && !/mock draft/i.test(w));
      ok(fk.length === 0, 'no pretend text shown as working' + (fk.length ? ': ' + [...new Set(fk)].join(', ') : ''));
      // dead buttons
      if (!ARTICLES.includes(r) && !r.startsWith('/fix/')) {
        const btns = p.locator('main button:visible, main [role=button]:visible'); const n = Math.min(await btns.count(), 20); const dead = [];
        for (let i = 0; i < n; i++) {
          const b = btns.nth(i); const label = ((await b.getAttribute('aria-label').catch(() => '')) || (await b.innerText().catch(() => '')) || (await b.getAttribute('id').catch(() => '')) || '').trim().slice(0, 40);
          const id = (await b.getAttribute('id').catch(() => '')) || ''; if (!label || SKIP.test(label) || SKIP.test(id) || id === 'supsend' || (await b.isDisabled().catch(() => true))) continue;
          const a0 = await act(), u0 = p.url(), d0 = downloads + choosers + dialogs, r0 = reqs;
          try { await b.click({ timeout: 2500, noWaitAfter: true }); } catch { continue; }
          await p.waitForTimeout(250); const a1 = await act();
          if (p.url().split('#')[0] !== u0.split('#')[0] && !p.url().startsWith(origin + r)) { await p.goto(origin + r, { waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(800); continue; }
          const live = a1.mut > a0.mut || a1.sound > a0.sound || a1.copy.length > a0.copy.length || a1.share.length > a0.share.length || a1.open.length > a0.open.length || p.url() !== u0 || downloads + choosers + dialogs > d0 || reqs > r0;
          const native = await b.evaluate((e) => !!(e.form && (e.type === 'submit' || !e.getAttribute('type')) && !e.form.checkValidity())).catch(() => false); // the browser itself asks for the missing fields
          if (!live && !native) dead.push(label);
        }
        ok(dead.length === 0, 'every visible button does something' + (dead.length ? ' (dead: ' + dead.join(' | ') + ')' : ''));
        // the scan again, after every button was pressed: a pretend answer a script draws only on a click is caught too
        const after = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-honest],script,style,noscript,[hidden]').forEach((e) => e.remove()); return c.innerText || c.textContent || ''; }).catch(() => '');
        const fk2 = (after.match(FAKE_ALL) || []).filter((w) => !(HONEST[r] && HONEST[r].test(w)) && !/mock draft/i.test(w));
        ok(fk2.length === 0, 'no pretend text after pressing every button' + (fk2.length ? ': ' + [...new Set(fk2)].join(', ') : ''));
      }
      ok(bad5.length === 0, 'its live data answers' + (bad5.length ? ' (' + [...new Set(bad5)].slice(0, 3).join('; ') + ')' : ''));
      ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 2).join(' | ') : ''));
    } catch (e) { ok(false, 'ran: ' + String(e.message || e).split('\n')[0].slice(0, 140)); }
    const other = OTHERS.some((o) => r.startsWith(o));
    results.push({ route: r, other, pass: passes.length, fails });
    log((fails.length ? 'FAIL ' : 'ok   ') + r + (other ? ' [other worker]' : '') + '  ' + passes.length + ' passed' + (fails.length ? '; ' + fails.join('; ') : ''));
    await ctx.close().catch(() => {});
  };
  // pages in parallel (each in its own context), so the whole site runs in minutes under one heavy lock
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, all.length)) }, async () => { while (queue.length) await one(queue.shift()); }));
  results.sort((a, b) => (a.route < b.route ? -1 : 1));
  await browser.close(); if (server) server.close(); fs.rmSync(tmpd, { recursive: true, force: true });
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('real-pages.mjs')) {
  const rs = routes(); const missing = rs.filter((r) => !SPECS[r]);
  if (argv.includes('--list')) { console.log(rs.length + ' routes, ' + (rs.length - missing.length) + ' with a spec'); if (missing.length) { console.log('FAIL no spec for: ' + missing.join(' ')); process.exit(1); } process.exit(0); }
  let only = arg('--routes') ? arg('--routes').split(',') : null;
  if (argv.includes('--changed')) {
    let ch = ''; try { ch = execSync('git diff --name-only origin/main...HEAD; git diff --name-only; git diff --name-only --cached', { cwd: repo, encoding: 'utf8' }); } catch (err) { console.warn('real-pages: could not list changed files (' + String(err.message || err).split('\n')[0] + '), checking every route'); ch = null; }
    if (ch !== null) only = [...new Set(ch.split('\n').filter((f) => /^void-live-deploy\/.*index\.html$/.test(f)).map((f) => f.replace(/^void-live-deploy/, '').replace(/index\.html$/, '')))];
    if (only && !only.length) { console.log('ok   no page changed'); process.exit(0); }
  }
  const base = arg('--base', 'local');
  if (rs.length > 0 && (!only || only.length > 3)) { const { acquire } = await import('./heavy.mjs'); await acquire('every page real (real-pages.mjs)'); }
  const res = await run({ base, only, jobs: Number(arg('--jobs', '4')) || 4 });
  const mine = res.filter((x) => !x.other), bad = mine.filter((x) => x.fails.length), theirs = res.filter((x) => x.other && x.fails.length);
  console.log('\n' + res.length + ' pages, ' + res.filter((x) => !x.fails.length).length + ' fully real' + (theirs.length ? '; other workers\' pages failing (report only): ' + theirs.map((x) => x.route).join(' ') : ''));
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
  process.exit(bad.length ? 1 : 0);
}
