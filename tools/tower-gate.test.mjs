// tools/tower-gate.mjs and tools/tower-probes.mjs: the scores behind the aspects the gate measures, and the probes' answers worked out by hand
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, rescore, germanScore, sharingScore, MEASURES, UA } from './tower-gate.mjs';
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
  for (const id of Object.keys(PROBES)) assert.ok(FLOORS.some((f) => f.id === id), id);
  assert.equal(probeFor('coin flip').ask.presses, 10, 'coin flip: ten flips pressed on both, checked for their shape');
  // the base converter's question is typed into hextobinary.com's box: exact digits pass, a rounded answer does not
  const bc = probeFor('base converter'); assert.equal(bc.ask.type, '123456789abcdef0123456789abcdef'); assert.ok(bc.askParts['huge numbers'].length === 3);
  assert.ok(bc.truth.every(([, re]) => re.test('1 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111 = 1,512,366,075,204,170,929,049,582,354,406,559,215')));
  assert.ok(!bc.truth[1][1].test('1512366075204170900000000000000000000') && !bc.truth[1][1].test('1.512366075204171e+36'), 'rounded is wrong');
  assert.ok(probeFor('random number').ask && probeFor('random number').truth.length === 1, 'random number: the same question at addresses made for it');
  assert.equal(probeFor('weather'), null);
  for (const f of FLOORS) assert.ok(aspectsOf(f).includes('offline') && aspectsOf(f).includes('sharing'), f.id);
});
test('the colour floors\' own aspects are lists both pages are scored on, and they tell the models apart', async () => {
  const { PARTS } = await import('./tower-probes.mjs');
  const models = probeFor('colour codes').parts['every colour model'], palettes = probeFor('colour').parts['shades and palettes'];
  assert.equal(models.length, 15); assert.equal(palettes.length, 12); assert.deepEqual(Object.keys(PARTS).sort(), ['base converter', 'calculator', 'coin flip', 'colour', 'colour codes', 'encoder', 'gradient', 'random number', 'random user', 'stopwatch', 'time zones', 'wheel', 'word count']);
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
  // CHROME_PATH, else a machine's pre-installed Chromium (the session containers keep one at /opt/pw-browsers/chromium, a build the repo's
  // playwright-core may not ship), else the library's own
  const exe = process.env.CHROME_PATH || ((await import('node:fs')).existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
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
  assert.equal(probeFor('calculator').truth, null, "calculator.net's address cannot carry a sum: accuracy unverified"); assert.ok(probeFor('calculator').facts.length >= 15);
});
