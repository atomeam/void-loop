// tools/tower-gate.mjs and tools/tower-probes.mjs: the scores behind the aspects the gate measures, and the probes' answers worked out by hand
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, rescore, germanScore, sharingScore, MEASURES, UA, GATE_FLOORS } from './tower-gate.mjs';
import { probeFor, score, PROBES, timesIn, tokyoNow } from './tower-probes.mjs';
import { FLOORS, aspectsOf } from '../void-live-deploy/lib/tower.js';

test('the gate presents as an ordinary browser, not a headless one', () => { assert.doesNotMatch(UA, /headless/i); assert.match(UA, /Chrome\/\d+/); });
test('local language: a German browser gets German when the page says so or speaks it', () => {
  assert.equal(germanScore('de-DE', ''), 1); assert.equal(germanScore('en', 'Ist heute Weihnachten? Nein, und morgen ist es nicht.'), 1);
  assert.equal(germanScore('en', 'Is it Christmas? No, and not tomorrow either.'), 0); assert.equal(germanScore('', 'Die'), 0, 'one word is not a language');
});
test('sharing: title, image, description and a share control, one each', () => {
  assert.equal(sharingScore({ ogTitle: true, ogImage: true, desc: true, control: true }), 4); assert.equal(sharingScore({}), 0); assert.equal(sharingScore({ desc: true }), 1);
});
test('verdicts for the new aspects: the ideal tie passes, a lower count loses, accuracy and completeness tie only at full marks', () => {
  assert.equal(verdict(1, 1, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal-and-better'); assert.equal(verdict(0, 0, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal');
  assert.equal(verdict(3, 4, MEASURES.sharing.hi, MEASURES.sharing.ideal), 'worse'); assert.equal(verdict(48, 30, MEASURES['big answer'].hi), 'better');
  const rows = rescore({ accuracy: { verdict: 'x', verse: 4, best: 4, of: 4 }, completeness: { verdict: 'x', verse: 9, best: 9, of: 13 } });
  assert.equal(rows.accuracy.verdict, 'equal-and-better'); assert.equal(rows.completeness.verdict, 'equal', 'both missing the same things is not beaten');
});
test('the colour probe: #ff5733 by hand, and a page that shows it passes every truth', () => {
  const p = probeFor('colour'), page = 'HEX #FF5733 RGB rgb(255, 87, 51) HSL hsl(11, 100%, 60%) CMYK 0%, 66%, 80%, 0% shades tints tones complementary triadic analogous contrast HSV lab nearest name tomato';
  assert.equal(score(page, p.truth).n, 4); assert.equal(score(page, p.facts).n, p.facts.length);
  const wrong = score('rgb(255, 88, 51) hsl(11, 100%, 61%) cmyk 0 65 80 0', p.truth); assert.equal(wrong.n, 0, 'a near miss is a miss: ' + wrong.has.join());
  assert.equal(probeFor('colour codes').facts.length, p.facts.length); assert.equal(probeFor('colour codes').site, 'https://hexcolor16.com/ff5733');
});
test('is it: the right answer depends on the day', () => {
  const t = probeFor('is it').truth; assert.equal(t.length, 1);
  const dec25 = new Date().getUTCMonth() === 11 && new Date().getUTCDate() === 25; assert.equal(score(dec25 ? 'YES' : 'NO', t).n, 1); assert.equal(score(dec25 ? 'NO' : 'YES', t).n, 0);
});
test('a probe exists only for a floor on the tower, and floors with no fair question leave accuracy unverified', () => {
  for (const id of Object.keys(PROBES)) assert.ok(GATE_FLOORS.some((f) => f.id === id), id); // the gate's floors: the tower's, and a frontier site's own page by its host (sycophanthex.com)
  assert.equal(probeFor('coin flip').ask.presses, 10, 'coin flip: ten flips pressed on both, checked for their shape');
  // the base converter's question is typed into hextobinary.com's box: exact digits pass, a rounded answer does not
  const bc = probeFor('base converter'); assert.equal(bc.ask.type, '123456789abcdef0123456789abcdef'); assert.ok(bc.askParts['huge numbers'].length === 3);
  assert.ok(bc.truth.every(([, re]) => re.test('1 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111 = 1,512,366,075,204,170,929,049,582,354,406,559,215')));
  assert.ok(!bc.truth[1][1].test('1512366075204170900000000000000000000') && !bc.truth[1][1].test('1.512366075204171e+36'), 'rounded is wrong');
  assert.ok(probeFor('random number').ask && probeFor('random number').truth.length === 1, 'random number: the same question at addresses made for it');
  assert.ok(probeFor('finance') && probeFor('finance').truth.length >= 1, 'finance: the markets page has its own probe'); assert.equal(probeFor('docs and notes').truth.length, 4, 'notes: the title and the three things'); assert.equal(probeFor('calendar').truth.length, 5, 'calendar: the event, tomorrow, 3:00 PM, the reminder, the repeat'); assert.equal(probeFor('recipes').truth.length, 5, 'recipes: flour, an egg, milk, the servings, the steps numbered'); assert.ok(probeFor('weather').truth.length === 5, 'weather: the place, both scales agreeing, today first, the hours, sunrise and sunset');
  for (const f of FLOORS) assert.ok(aspectsOf(f).includes('offline') && aspectsOf(f).includes('sharing'), f.id);
});
test('the colour floors\' own aspects are lists both pages are scored on, and they tell the models apart', async () => {
  const { PARTS } = await import('./tower-probes.mjs');
  const models = probeFor('colour codes').parts['every colour model'], palettes = probeFor('colour').parts['shades and palettes'];
  assert.equal(models.length, 15); assert.equal(palettes.length, 12); const known = ['base converter', 'calculator', 'coin flip', 'colour', 'colour codes', 'encoder', 'gradient', 'password', 'password strength', 'random number', 'random user', 'stopwatch', 'time zones', 'unit converter', 'wheel', 'word count']; assert.deepEqual(known.filter((k) => !PARTS[k]), [], 'every floor that had its own aspects still has them'); // new floors add theirs (several builders at once, 2026-10-25)
  // the unit converter's own aspects: how many of unitconverters.net's kinds a page names, and whether it converts both ways
  const breadth = probeFor('unit converter').parts['unit breadth'], ways = probeFor('unit converter').parts['both directions']; assert.equal(breadth.length, 21); assert.equal(ways.length, 2);
  assert.equal(score('Length Temperature Area Volume Weight Time', breadth).n, 6, "unitconverters.net's common six"); assert.deepEqual(score('Swap the two units. From °C to °F, the formula', ways).has, ['swap', 'from and to']);
  assert.equal(score('100 Celsius = 212 Fahrenheit', ways).n, 0); assert.equal(probeFor('unit converter').facts.length, 26);
  const has = (t) => score(t, models).has;
  assert.deepEqual(has('OKLCH'), ['OKLCH']); assert.deepEqual(has('Hunter Lab'), ['Hunter Lab']); assert.deepEqual(has('CIE Lab'), ['CIELab']); assert.deepEqual(has('CIELCH'), ['CIELCh']); assert.deepEqual(has('CIELUV'), ['CIELUV']);
  // hexcolor16.com's list, as the owner read it off the page on 2026-10-24
  assert.equal(score('Hexadecimal Decimal RGB CMYK HSL HSV XYZ CIELab CIELUV CIELCH', models).n, 10);
  assert.equal(score('shades tints tones complementary analogous triadic split-complementary tetradic square VGA random', palettes).missing.join(), 'monochromatic');
  assert.deepEqual(probeFor('is it').parts, {}); assert.equal(probeFor('base converter').parts['all four bases'].length, 4); assert.equal(score('Binary Octal Decimal Hex', probeFor('base converter').parts['all four bases']).n, 4);
});
test('design polish counts what a design review fails first, lower is better and 0 is the best there is', async () => {
  const { defects, designLook } = await import('./tower-gate.mjs');
  assert.equal(defects({ contrast: 2, targets: 1, cls: 0.3 }), 4); assert.equal(defects({ contrast: 0, targets: 0, cls: 0.05 }), 0); assert.ok(Number.isNaN(defects(null)));
  assert.equal(verdict(0, 0, MEASURES['design polish'].hi, MEASURES['design polish'].ideal), 'equal-and-better'); assert.equal(verdict(0, 2, false, 0), 'better'); assert.equal(verdict(1, 0, false, 0), 'worse');
  const { createRequire } = await import('node:module'), req = createRequire(import.meta.url); let pw = null; for (const n of ['playwright-core', 'playwright']) { try { pw = req(n); break; } catch (_) { /* next */ } }
  if (!pw) return; // the in-page part needs a browser
  // CHROME_PATH or VOID_TEST_BROWSER (the suite's own), else a machine's pre-installed Chromium (the session containers keep one at /opt/pw-browsers/chromium, a build the repo's
  // playwright-core may not ship), else the library's own
  const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || ((await import('node:fs')).existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
  const b = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 800 } });
    await p.setContent('<body style="background:#fff;color:#111"><p>plain text</p><p style="color:#bbb">faint</p><span aria-hidden="true" style="background:#ffeb3b;color:#fff">Aa</span><button style="width:10px;height:10px;padding:0;border:0">x</button><p>a line with <a href="#" style="font-size:10px">a small link</a> in it</p></body>');
    const l = await p.evaluate(designLook);
    assert.equal(l.contrast, 1, 'the faint line fails, the aria-hidden sample on yellow does not count'); assert.equal(l.targets, 1, 'the tiny button counts, the link inside a line does not');
  } finally { await b.close(); }
});
test('a run after a deploy measures the current fight, the floors whose page changed and the ones missing a measurable aspect, at most three', async () => {
  const { pick, measurable } = await import('./tower-gate.mjs'), { FLOORS: F } = await import('../void-live-deploy/lib/tower.js');
  const full = (id) => Object.fromEntries(measurable(F.find((f) => f.id === id)).map((a) => [a, { verdict: 'better', evidence: 'x', verse: 1, best: 2 }]));
  assert.ok(measurable(F.find((f) => f.id === 'colour codes')).includes('every colour model')); assert.ok(['accuracy', 'flip animation'].every((a) => measurable(F.find((f) => f.id === 'coin flip')).includes(a)), 'ten flips have a right shape, and a flip can be seen moving');
  const ev = Object.fromEntries(F.map((f) => [f.id, full(f.id)])); // every floor fully measured: only the fight is picked
  const t = pick(ev, null, []); assert.equal(t.length, 1);
  assert.deepEqual(pick(ev, null, ['void-live-deploy/flip/index.html']).slice(1), ['coin flip'], 'a changed page adds its floor');
  delete ev.calculator.speed; assert.ok(pick(ev, null, []).includes('calculator'), 'a missing row adds its floor');
  assert.ok(pick({}, null, [], 3).length === 3 && pick({}, null, [], 1).length === 1);
  for (const id of pick({}, { sites: [{ site: 'only-on-the-frontier.example', hardness: 1 }] }, [])) assert.ok(F.some((f) => f.id === id), 'a frontier site has no Verse page to measure: ' + id);
});

// the gate types a question into a site's own box (tower-probes.mjs `type`), against two local pages built like the real ones
test('a typed question: the From box and its Convert button, the largest text area, and only what typing changed counts', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const PAGES = {
    '/c2f': '<p>Water boils at 212°F.</p><form onsubmit="event.preventDefault();document.getElementById(\'ucto\').value=String(+document.getElementById(\'ucfrom\').value*9/5+32)"><input type="text" id="ucfrom"><input type="text" id="ucto"><input type="submit" value="Convert"></form>',
    '/wc': '<input type="search" placeholder="search"><textarea id="t" style="width:600px;height:300px"></textarea><p id="n">0 words 0 characters</p><script>t.oninput=()=>{const v=t.value;n.textContent=(v.match(/[A-Za-z0-9\'-]+/g)||[]).length+" words "+v.length+" characters"}</script>',
  };
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><body>' + (PAGES[q.url] || '') + '</body>'); }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u;
  try {
    const uc = probeFor('unit converter'), wc = probeFor('word count');
    const blank = await answer(b, at('/c2f'), 'zzz'); // typing something that converts to nothing: the 212°F in the page text does not count
    assert.equal(score(blank, uc.truth).n, 0, 'text the page had before typing is not an answer');
    assert.equal(score(await answer(b, at('/c2f'), '100'), uc.truth).n, 1, 'typed into From, Convert pressed, 212 read from the To box');
    assert.deepEqual(score(await answer(b, at('/wc'), wc.ask.type), wc.truth).n, 2, '13 words and 63 characters... read live from the big text area');
  } finally { await b.close(); server.close(); }
});

test('made-up people are read the same way from randomuser.me\'s JSON and Verse\'s, and checked for holding together', async () => {
  const { peopleIn, ageOn, probeFor: pf, score: sc } = await import('./tower-probes.mjs');
  const nested = JSON.stringify({ results: [{ email: 'a@example.com', phone: '(212) 555-0142', dob: { date: '1990-06-01T00:00:00Z', age: ageOn('1990-06-01') }, location: { country: 'United States' } }] });
  const flat = 'Copy\n' + JSON.stringify({ results: [{ email: 'a@example.com', phone: '(212) 555-0142', dob: '1990-06-01', age: ageOn('1990-06-01'), country: 'United States' }] }, null, 2) + '\nmore page text {';
  assert.deepEqual(peopleIn(nested), peopleIn(flat));
  const t = pf('random user').truth; assert.equal(sc(flat, t).missing.join(), 'five people, as asked', 'one person: every check but the count holds');
  assert.equal(sc(flat.replace(/"age": \d+/, '"age": 3'), t).missing.includes('every age right for its birthday'), true);
  assert.deepEqual(peopleIn('no json here'), []);
});

test('a spin: a tap at the wheel\'s centre, the winner must be one of its own names, and a wheel that never spins is not measured', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const wheel = (winner, spins = true) => '<div contenteditable>Ali<br>Beatriz<br>Charles</div><canvas id=c width=300 height=300></canvas><div id=d></div><script>' + (spins ? 'c.onclick=()=>setTimeout(()=>{d.innerHTML="<h2>We have a winner!</h2><p>' + winner + '</p><button>Close</button> <button>Remove</button>"},1500)' : '') + '</script>';
  const PAGES = { '/good': wheel('Charles'), '/wrong': wheel('Zed'), '/stuck': wheel('', false) };
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><body>' + (PAGES[q.url] || '')); }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, w = probeFor('wheel');
  try {
    const good = await answer(b, at('/good'), null, true);
    assert.equal(score(good, w.truth).n, 2, 'a winner, and one of its own names (already on the page before the spin)');
    assert.equal(score(good, w.askParts['remove the winner']).n, 1);
    assert.equal(score(await answer(b, at('/wrong'), null, true), w.truth).n, 1, 'a winner not on the wheel is wrong');
    assert.equal(await answer(b, at('/stuck'), null, true), null, 'no spin, no measurement');
  } finally { await b.close(); server.close(); }
});

test('an answer that belongs in a box: a box that never fills is not measured, a filled one is scored', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const page = (works) => '<textarea id=i style="width:500px;height:200px"></textarea><button id=e>ENCODE</button><textarea id=o style="width:500px;height:200px"></textarea><script>e.onclick=()=>{' + (works ? 'o.value=btoa(i.value)' : '') + '}</script>';
  // the ways a real encoder page differs from that: its answer comes back from its server after a while; a cookie wall sits over its button; its
  // output box is the bigger one and read only, and a header link names encoding before the button does (base64encode.org links to its decoder)
  const PAGES = { '/ok': page(true), '/stuck': page(false),
    '/slow': '<textarea id=i style="width:500px;height:200px"></textarea><button id=e>&lt; ENCODE &gt;</button><textarea id=o style="width:500px;height:200px"></textarea><script>e.onclick=()=>{setTimeout(()=>{o.value=btoa(i.value)},3000)}</script>',
    '/wall': page(true) + '<div id=w style="position:fixed;inset:0;background:rgba(0,0,0,.5)"><div style="background:#fff;padding:20px">We use cookies. <button id=a>Accept all</button></div></div><script>a.onclick=()=>w.remove()</script>',
    '/readonly': '<nav><a href="/decode">Base64 Decode</a> <a href="/readonly">Base64 Encode</a></nav><textarea id=i style="width:300px;height:100px"></textarea><button id=e>ENCODE</button><textarea id=o readonly style="width:500px;height:300px"></textarea><script>e.onclick=()=>{o.value=btoa(i.value)}</script>',
    // a banner with nothing to accept sits over the button (an ad): the pointer never reaches it, a keyboard press does
    '/covered': page(true) + '<div style="position:fixed;left:0;right:0;top:0;height:100vh;background:rgba(0,0,0,.01)"></div>' };
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><body>' + (PAGES[q.url] || '<p>nothing</p>')); }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, e = probeFor('encoder');
  try {
    assert.equal(score(await answer(b, at('/ok'), e.ask.type, false, e.ask.box), e.truth).n, 1);
    assert.equal(await answer(b, at('/stuck'), e.ask.type, false, e.ask.box), null, 'an empty output box is no answer, not a wrong one');
    assert.match(answer.lastSeen, /pressed "ENCODE".*textarea#o empty/, 'the evidence says what the gate pressed and which box stayed empty: ' + answer.lastSeen);
    assert.equal(score(await answer(b, at('/slow'), e.ask.type, false, e.ask.box), e.truth).n, 1, 'an answer that takes its server 3 s is waited for');
    assert.equal(score(await answer(b, at('/wall'), e.ask.type, false, e.ask.box), e.truth).n, 1, 'a cookie wall is accepted first, then the box is typed into and the button pressed');
    assert.equal(score(await answer(b, at('/readonly'), e.ask.type, false, e.ask.box), e.truth).n, 1, 'the read-only output box is never typed into, and the header link is not the press');
    assert.equal(score(await answer(b, at('/covered'), e.ask.type, false, e.ask.box), e.truth).n, 1, 'a button under a banner is pressed with Enter');
    assert.equal(await answer(b, at('/decode'), e.ask.type, false, e.ask.box), null, 'no box at all: not measured');
    assert.match(answer.lastSeen, /no box took the typing/, answer.lastSeen);
  } finally { await b.close(); server.close(); }
});

test('Verse\'s own /password-strength/ answers the password strength floor: qwerty123 typed into its box (never its address) scores the whole truth and its asked parts, and the page shows every fact and the leak check at load', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const root = new URL('../void-live-deploy/', import.meta.url);
  const server = http.createServer((q, r) => {
    const u = q.url.split('?')[0], file = new URL('.' + (u.endsWith('/') ? u + 'index.html' : u), root);
    if (!fsm.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': /\.js$/.test(file.pathname) ? 'text/javascript' : 'text/html' }); r.end(fsm.readFileSync(file));
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, p = probeFor('password strength');
  try {
    assert.equal(p.ask.verseType, 'qwerty123'); assert.ok(!p.ask.verse.includes('qwerty'), 'the password is never in the address');
    const typed = await answer(b, at(p.ask.verse), p.ask.verseType, false, false);
    assert.ok(typed && !typed.includes('qwerty123'), 'what was typed is taken out of the answer');
    const truth = score(typed, p.truth); assert.equal(truth.n, 5, 'the truth: ' + truth.missing.join(', '));
    for (const [a, items] of Object.entries(p.askParts)) { const s = score(typed, items); assert.equal(s.n, s.of, a + ': ' + s.missing.join(', ')); }
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }), pg = await ctx.newPage(); await pg.goto(at('/password-strength/'), { waitUntil: 'load' });
    const text = await pg.evaluate(() => document.body.innerText); await ctx.close();
    const facts = score(text, p.facts); assert.equal(facts.n, facts.of, 'facts at load: ' + facts.missing.join(', '));
    assert.equal(score(text, p.parts['leak check']).n, 1, 'a leak check offered at load');
  } finally { await b.close(); server.close(); }
});
test('Verse\'s own /resize-image/ answers the photo resizer floor: the gate puts in its one-pixel PNG with the size in the link and reads 276 by 197 px under 50 KB, a quality, a PDF; the page shows every fact at load', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer, PIXEL } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const root = new URL('../void-live-deploy/', import.meta.url);
  const server = http.createServer((q, r) => {
    const u = q.url.split('?')[0], file = new URL('.' + (u.endsWith('/') ? u + 'index.html' : u), root);
    if (!fsm.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': /\.js$/.test(file.pathname) ? 'text/javascript' : 'text/html' }); r.end(fsm.readFileSync(file));
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, p = probeFor('photo resizer');
  try {
    assert.ok(p.ask.verseFile);
    const got = await answer(b, at(p.ask.verse), null, false, false, 0, 0, PIXEL);
    const truth = score(got, p.truth); assert.equal(truth.n, 3, 'the truth: ' + truth.missing.join(', ') + ' in ' + JSON.stringify(got));
    for (const [a, items] of Object.entries(p.askParts)) { const s = score(got, items); assert.equal(s.n, s.of, a + ': ' + s.missing.join(', ')); }
    assert.equal(await answer(b, at('/password-strength/'), null, false, false, 0, 0, PIXEL), null, 'a page with no file box is not measured');
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }), pg = await ctx.newPage(); await pg.goto(at('/resize-image/'), { waitUntil: 'load' });
    const text = await pg.evaluate(() => document.body.innerText); await ctx.close();
    const facts = score(text, p.facts); assert.equal(facts.n, facts.of, 'facts at load: ' + facts.missing.join(', '));
  } finally { await b.close(); server.close(); }
});
test('Verse\'s own /base64/ answers the encoder floor both ways the gate asks: the text in its link, and the text typed into its box', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const root = new URL('../void-live-deploy/', import.meta.url);
  const server = http.createServer((q, r) => {
    const u = q.url.split('?')[0], file = new URL('.' + (u.endsWith('/') ? u + 'index.html' : u), root);
    if (!fsm.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': /\.js$/.test(file.pathname) ? 'text/javascript' : 'text/html' }); r.end(fsm.readFileSync(file));
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, e = probeFor('encoder');
  try {
    assert.equal(e.verse, '/base64/');
    assert.equal(score(await answer(b, at(e.ask.verse), null), e.truth).n, 1, 'the link carries the text and the page shows its Base64');
    assert.equal(score(await answer(b, at('/base64/'), e.ask.type, false, e.ask.box), e.truth).n, 1, 'typed into the largest box, the Base64 fills the other');
  } finally { await b.close(); server.close(); }
});
test('a stopwatch run timed by the gate: Verse\'s own /stopwatch/ shows the real length and holds it; a fast clock is wrong; a drawn clock is read off the screen; a clock it cannot read is not measured', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer } = await import('./tower-gate.mjs'), { probeFor, score } = await import('./tower-probes.mjs');
  const root = new URL('../void-live-deploy/', import.meta.url);
  // a stopwatch that runs twice as fast, and one drawn on a canvas with no text the gate can read
  const fake = '<div id=f>0:00.00</div><button id=g>Start</button><script>let t0=0,iv;g.onclick=()=>{if(g.textContent==="Start"){t0=Date.now();g.textContent="Stop";iv=setInterval(()=>{f.textContent="0:"+String(((Date.now()-t0)*2/1000).toFixed(2)).padStart(5,"0")},30)}else{clearInterval(iv);g.textContent="Start"}}</script>';
  // a stopwatch drawn on a canvas that starts and stops on a tap, with no text anywhere (the gate reads it off the screen)
  const drawn = '<canvas id=c width=420 height=160 style="background:#fff"></canvas><script>const g=c.getContext("2d");let t0=0,acc=0,run=false;const show=()=>{const ms=acc+(run?Date.now()-t0:0),s=ms/1000;g.fillStyle="#fff";g.fillRect(0,0,420,160);g.fillStyle="#000";g.font="bold 72px monospace";g.fillText("0:"+s.toFixed(2).padStart(5,"0"),40,105);requestAnimationFrame(show)};show();c.onclick=()=>{if(run){acc+=Date.now()-t0;run=false}else{t0=Date.now();run=true}}</script>';
  const PAGES = { '/fast': fake, '/canvas': '<canvas width=300 height=200></canvas>', '/drawn': drawn };
  const server = http.createServer((q, r) => {
    if (PAGES[q.url]) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><body>' + PAGES[q.url]); }
    const file = new URL('.' + (q.url.split('?')[0].endsWith('/') ? q.url.split('?')[0] + 'index.html' : q.url.split('?')[0]), root);
    if (!fsm.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': /\.js$/.test(file.pathname) ? 'text/javascript' : 'text/html' }); r.end(fsm.readFileSync(file));
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, s = probeFor('stopwatch');
  try {
    assert.equal(score(await answer(b, at(s.ask.verse), null, false, false, s.ask.time), s.truth).n, 2, 'the real length of the run, held once stopped');
    assert.equal(score(await answer(b, at('/fast'), null, false, false, s.ask.time), s.truth).n, 0, 'a clock running twice as fast is wrong');
    assert.equal(await answer(b, at('/canvas'), null, false, false, s.ask.time), null, 'a clock the gate cannot read is not measured, never a loss');
    assert.equal(score(await answer(b, at('/drawn'), null, false, false, s.ask.time), s.truth).n, 2, 'a clock drawn on a canvas, started by a tap and read off the screen');
  } finally { await (await import('./screen-read.mjs')).closeEyes(); await b.close(); server.close(); }
});

test('a coin: its own flip control pressed 10 times by the gate, every side read, the count checked, the flip seen moving; a coin it cannot read is not measured', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { answer, motionOf } = await import('./tower-gate.mjs'), { probeFor, score, scoreOf } = await import('./tower-probes.mjs');
  const root = new URL('../void-live-deploy/', import.meta.url);
  // a coin that swaps its word at once with no motion; one whose count is off by one; one that always lands heads; one drawn with no text
  const coin = (js) => '<h1 id=w>Heads</h1><p id=c></p><button id=b>Flip</button><script>let h=0,n=0;b.onclick=()=>{' + js + '}</script>';
  const PAGES = { '/swap': coin('const x=Math.random()<.5;w.textContent=x?"Heads":"Tails";'), '/miscount': coin('const x=Math.random()<.5;if(x)h++;n++;w.textContent=x?"Heads":"Tails";c.textContent="Heads "+h+" · Tails "+(n-h+1)'),
    '/always': coin('w.textContent="Heads";c.textContent="flip "+(++n)'), '/drawn': '<canvas width=200 height=200 onclick="this.getContext(\'2d\').fillRect(0,0,9,9)"></canvas>', '/plain': '<p>No coin here.</p>' };
  const server = http.createServer((q, r) => {
    const u = q.url.split('?')[0]; if (PAGES[u]) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><body>' + PAGES[u]); }
    const file = new URL('.' + (u.endsWith('/') ? u + 'index.html' : u), root);
    if (!fsm.existsSync(file)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': /\.js$/.test(file.pathname) ? 'text/javascript' : 'text/html' }); r.end(fsm.readFileSync(file));
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u, c = probeFor('coin flip');
  try {
    const verse = await answer(b, at(c.ask.verse), null, false, false, 0, c.ask.presses), v = score(verse, c.truth);
    // both sides in 10 fair flips fails 2 times in 1024: the check allows that one, never the other two
    assert.ok(v.n === 3 || (v.n === 2 && v.missing[0] === 'both sides come up in 10 fair flips'), 'Verse\'s /flip/: ' + v.missing.join());
    assert.equal(score(await answer(b, at('/miscount'), null, false, false, 0, 10), c.truth).has.includes('any count it shows adds up to the flips made'), false, 'a count off by one is wrong');
    assert.deepEqual(score(await answer(b, at('/always'), null, false, false, 0, 10), c.truth).missing, ['both sides come up in 10 fair flips'], 'a coin that always lands heads is not fair');
    assert.equal(await answer(b, at('/drawn'), null, false, false, 0, 10), null, 'a side the gate cannot read is not measured, never a loss');
    const look = async (u) => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }), p = await ctx.newPage(); try { await p.goto(at(u)); await p.waitForTimeout(1500); return await motionOf(p); } finally { await ctx.close(); } };
    const mv = await look('/flip/'), still = await look('/swap');
    assert.equal(scoreOf(mv, c.motion['flip animation']).n, 1, 'Verse\'s coin turns: ' + JSON.stringify(mv));
    assert.equal(scoreOf(still, c.motion['flip animation']).n, 0, 'a word swapped at once is not an animation: ' + JSON.stringify(still));
    assert.equal(await look('/plain'), null, 'no flip control: not measured');
  } finally { await (await import('./screen-read.mjs')).closeEyes(); await b.close(); server.close(); }
});
test('the time zones probe: Tokyo now worked out from its zone rules, read in 12- or 24-hour form, on both pages; a wrong hour or offset is wrong', () => {
  assert.deepEqual(timesIn('9:05 PM · 21:05 · 9:05:07 pm · 09:05 · 25:00 · 3:61'), [1265, 1265, 1265, 545]);
  assert.deepEqual(tokyoNow(new Date('2026-10-25T12:19:30Z')), { min: 21 * 60 + 19, day: 25, month: 'October' });
  const p = probeFor('time zones'), n = tokyoNow(), h = Math.floor(n.min / 60), mm = String(n.min % 60).padStart(2, '0'), off = String((h + 5) % 24);
  const verse = 'Time in Tokyo\n' + ((h % 12) || 12) + ':' + mm + ':30 ' + (h < 12 ? 'AM' : 'PM') + '\nSunday, ' + n.month + ' ' + n.day + ', 2026\nAsia/Tokyo · GMT+9 · UTC+9';
  const site = 'Current Local Time in Tokyo, Japan\n' + h + ':' + mm + ':30\nSunday, ' + n.day + ' ' + n.month + ' 2026\nUTC/GMT +9 hours';
  assert.equal(score(verse, p.truth).n, 3); assert.equal(score(site, p.truth).n, 3); assert.equal(score(off + ':' + mm + ' UTC+10', p.truth).n, 0);
  // the calculator's truth is Verse's own answer to "17% of 240" through its page link (2026-10-25: accuracy is judged against the worked-out answer, never the rival)
  assert.equal(probeFor('calculator').ask.verse, '/calculator/?q=17%25%20of%20240'); assert.equal(score('17% of 240 = 40.8', probeFor('calculator').truth).n, 1); assert.equal(score('40.80 or 408', probeFor('calculator').truth).n, 0); assert.ok(probeFor('calculator').facts.length >= 15);
});

test('a site icon is kept only when it is a small raster image', async () => {
  const { iconExt } = await import('./tower-gate.mjs');
  assert.equal(iconExt('image/png'), 'png'); assert.equal(iconExt('image/x-icon; charset=binary'), 'ico'); assert.equal(iconExt('image/vnd.microsoft.icon'), 'ico'); assert.equal(iconExt('image/svg+xml'), 'svg');
  assert.equal(iconExt('text/html'), ''); assert.equal(iconExt(''), ''); assert.equal(iconExt(null), '');
});

test('a deploy re-measures every unbeaten floor on a changed page, and every floor whose offline reading is not a win when the worker changed', async () => {
  const { pick } = await import('./tower-gate.mjs');
  const got = pick({}, null, ['void-live-deploy/colour/index.html', 'void-live-deploy/color/index.html']);
  assert.ok(got.includes('colour') && got.includes('colour codes'), 'both floors on /color/: ' + got.join(','));
  const sw = pick({}, null, ['void-live-deploy/sw.js']);
  assert.ok(sw.length >= 2 && sw.length <= 10, 'the worker change: ' + sw.length);
});

test('a lane site is measured at its own address, never at its leader\'s (the lane probe carries the leader\'s site)', async () => {
  const { siteOf } = await import('./tower-gate.mjs');
  assert.equal(siteOf({ id: 'docs and notes: quillpad.in', lane: 'docs and notes', url: 'https://quillpad.in/' }, { site: 'https://docs.google.com/' }), 'https://quillpad.in/');
  assert.equal(siteOf({ id: 'docs and notes', url: 'https://docs.google.com/' }, { site: 'https://docs.google.com/document/' }), 'https://docs.google.com/document/');
  assert.equal(siteOf({ id: 'x', url: 'https://x.example/' }, null), 'https://x.example/');
});

test('the image boards floor and its lane are never pictured (noShot): no screenshot kept, /compare/ says so; the probe posts nothing and reads the preview', async () => {
  const { keepShot, siteOf } = await import('./tower-gate.mjs');
  const { noShotOf, LANES } = await import('../void-live-deploy/lib/tower.js');
  const leader = FLOORS.find((f) => f.id === 'image boards'), lane = FLOORS.filter((f) => f.lane === 'image boards');
  assert.equal(leader.url, 'https://www.4chan.org/'); assert.equal(leader.page, '/boards/'); assert.deepEqual(leader.extra, ['catalog', 'replies and quoting', 'image posts', 'archive']);
  assert.equal(lane.length, LANES['image boards'].length); assert.ok(lane.length >= 8);
  const order = FLOORS.map((f) => f.id), at = order.indexOf('image boards'); assert.ok(lane.every((f) => order.indexOf(f.id) < at), 'the leader is the lane\'s last fight');
  for (const f of [leader, ...lane]) { assert.equal(noShotOf(f), true, f.id); assert.equal(keepShot('x-site', noShotOf(f)), false, f.id); }
  for (const f of lane) assert.equal(siteOf(f, probeFor(f.id)), f.url, 'a lane site is measured at its own address');
  assert.equal(keepShot('x-site', noShotOf(FLOORS.find((f) => f.id === 'recipes'))), true, 'other floors keep their picture'); assert.equal(keepShot('x-verse', false), false);
  const p = probeFor('image boards: lainchan.org'); assert.match(p.ask.verse, /^\/boards\/\?preview=/); assert.deepEqual(Object.keys(p.parts), leader.extra);
  const shown = 'Anonymous Oct 25 No. 1\n>be me\n>>2 quoted\nhello hidden words\nReport'; assert.equal(score(shown, p.truth).n, 5);
  assert.equal(score('>be me\n>>2 quoted\nhello [spoiler]hidden words[/spoiler]', p.truth).n < 5, true, 'the raw text alone is not a right answer');
  const fs = await import('node:fs'); const page = fs.readFileSync(new URL('../void-live-deploy/compare/index.html', import.meta.url), 'utf8');
  assert.match(page, /noShotOf\(f\)/); assert.match(page, /No picture kept for this kind of site/);
  const boards = fs.readFileSync(new URL('../void-live-deploy/boards/index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>|<[^>]+>/g, ' ');
  for (const [a, items] of Object.entries(p.parts)) assert.equal(score(boards, items).n, items.length, a + ': the page says it before any board exists');
});
test('image generation needs a picture the page really made: a button, a placeholder or a "resting" message is not one', async (t) => {
  const http = await import('node:http'), fsm = await import('node:fs');
  const exe = process.env.CHROME_PATH || (fsm.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  if (!exe) return t.skip('no browser here');
  const { chromium } = await import('playwright-core'), { pictureOf, MADE_SRC } = await import('./tower-gate.mjs');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const PAGES = {
    '/made': '<main><p>Painting…</p></main><script>setTimeout(()=>{const i=new Image();i.alt="a fox";i.src="' + PNG + '";document.querySelector("main").replaceChildren(i)},1200)</script>',
    '/button': '<main><button>Picture it</button><img src="/logo.png" alt="logo"></main>',
    '/resting': '<main><p>The painter is resting right now.</p></main>',
    '/gallery-only': '<main><section id="pics"><p>The painter is resting.</p></section><section><img alt="shared" src="' + PNG + '"></section></main>',
  };
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><body>' + (PAGES[q.url] || '')); }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const b = await chromium.launch({ executablePath: exe }), at = (u) => 'http://127.0.0.1:' + server.address().port + u;
  try {
    assert.equal((await pictureOf(b, at('/made'), 6000)).n, 1, 'a data: picture that loaded');
    const btn = await pictureOf(b, at('/button'), 2000); assert.equal(btn.n, 0); assert.match(btn.missing[0], /Picture it/);
    assert.equal((await pictureOf(b, at('/gallery-only'), 2000, '#pics img')).n, 0, 'a gallery picture below the results does not count');
    const rest = await pictureOf(b, at('/resting'), 2000); assert.equal(rest.n, 0); assert.match(rest.missing[0], /resting/);
    assert.ok(MADE_SRC.test('blob:https://a-to-mind.com/x') && MADE_SRC.test('/api/image/x') && !MADE_SRC.test('/og.png'));
  } finally { await b.close(); server.close(); }
});
test('the random generators floor: image generation, list language and publish and remix are asked at their own pages, never a button', async () => {
  const p = probeFor('random generators'), { LIST_PROBE } = await import('./tower-probes.mjs'), L = await import('../void-live-deploy/lib/listgen.js');
  assert.equal(p.pageParts['image generation'].img, true); assert.match(p.pageParts['image generation'].verse, /^\/image\/\?.*go=1/);
  assert.ok(!Object.values(p.parts).flat().some(([l]) => /picture/i.test(l)) && !p.askParts['image generation'], 'no picture button counts');
  for (const a of ['image generation', 'list language', 'publish and remix']) assert.ok(aspectsOf(FLOORS.find((f) => f.id === 'random generators')).includes(a), a);
  const text = await L.unpackShare(LIST_PROBE), out = L.generate(text, 11, 8).results.map((r) => r.output).join('\n');
  assert.equal(score(out, p.pageParts['list language'].items).n, 2, 'a working engine passes');
  assert.equal(score('Cat x #7\nOwl x #7', p.pageParts['list language'].items).n, 0, 'a page that ignores odds or shows too few fails');
});

test('a lane site with a page of its own asks its own question; the others keep their leader\'s', async () => {
  const { probeFor, score, withFeatureFacts } = await import('./tower-probes.mjs'), { FLOORS } = await import('../void-live-deploy/lib/tower.js');
  const own = probeFor('sports: thesportsdb.com'), lead = probeFor('sports'), other = probeFor('sports: besoccer.com');
  assert.equal(own.verse, '/sports/'); assert.equal(own.ask.verse, '/sports/?q=arsenal'); assert.deepEqual(Object.keys(own.askParts), ['sport search', 'born on this day', 'sport grid', 'free api']); assert.deepEqual(own.pageParts, {});
  assert.match(lead.verse, /^\/scores\//); assert.equal(other.verse, lead.verse, 'a lane site with no page of its own is measured against its leader\'s'); assert.deepEqual(Object.keys(other.pageParts), ['live scores', 'schedules', 'standings']);
  assert.equal(withFeatureFacts(own, 'sports: thesportsdb.com').facts.length, own.facts.length, 'its own facts are not topped up with its leader\'s features');
  assert.deepEqual(FLOORS.find((f) => f.id === 'sports: thesportsdb.com').extra, ['sport search', 'born on this day', 'sport grid', 'free api']); assert.deepEqual(FLOORS.find((f) => f.id === 'sports: besoccer.com').extra, ['live scores', 'schedules', 'standings']);
  const page = 'Click a sport to browse Soccer Basketball Tennis Cricket Search every sport Teams Arsenal English Premier League Soccer Venues Players Born on this day 1984 Test Footballer — English footballer Free API read only openapi.json TheSportsDB On this device no betting';
  for (const [a, items] of Object.entries(own.askParts)) assert.equal(score(page, items).n, items.length, a);
  assert.equal(score(page, own.truth).n, own.truth.length); assert.ok(score('Loading', own.truth).n === 0, 'a page that shows only a loading state fails');
  assert.equal(score('Click a sport to browse Born on this day', own.askParts['born on this day']).n, 1, 'the title alone, without a person born that day, is half');
});
test('a frontier site with a Verse page in LANE_PAGES is a floor the gate measures (sycophanthex.com: /fanfic/); one with no page is not', async () => {
  const { GATE_FLOORS, pick } = await import('./tower-gate.mjs'), { LANE_PAGES } = await import('../void-live-deploy/lib/tower.js');
  const f = GATE_FLOORS.find((x) => x.id === 'sycophanthex.com'); assert.ok(f, 'sycophanthex.com is measured'); assert.equal(f.page, LANE_PAGES['sycophanthex.com']); assert.equal(f.url, 'https://sycophanthex.com/');
  assert.ok(!GATE_FLOORS.some((x) => x.id === 'only-on-the-frontier.example'));
  assert.equal(new Set(GATE_FLOORS.map((x) => x.id)).size, GATE_FLOORS.length, 'no floor twice');
  assert.equal(pick({}, { sites: [{ site: 'sycophanthex.com', hardness: 1 }] }, [], 3, null, null, 'sycophanthex.com')[0], 'sycophanthex.com', 'the tower target is measured first');
});
