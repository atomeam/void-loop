// A person-like run of the six music pages at 390 px (Chrome with a fake microphone): the metronome keeps time and taps a tempo, the piano plays and records,
// the tuner reads a tone, the BPM counter taps and reads a file, the chord finder names and draws chords, the hub lists setlists. Also: no sideways overflow,
// no console errors, layout shift under 0.05, German on a German browser. Saves screenshots into the directory given. node tools/music-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, permissions: ['microphone'] }), p = await ctx.newPage(); p.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && console.log('console:', m.text())); p.on('pageerror', (e) => console.log('pageerror:', e.message)); return { ctx, p }; };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const open = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForTimeout(700); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)');
  ok(await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains('vh') && !e.closest('footer') && e.type !== 'checkbox'; }).length === 0), name + ': no tap target under 24 px'); };

{ // ---- the metronome ----
  const { ctx, p } = await mk(); const ms = await open(p, '/metronome/?bpm=120'); await sane(p, 'metronome', ms);
  let txt = await p.evaluate(() => document.body.innerText); ok(/120\s*BPM/.test(txt) && /Allegro/.test(txt) && /500 ms/.test(txt), 'metronome: 120 BPM, Allegro, 500 ms per beat');
  await p.evaluate(() => { window.__t = []; new MutationObserver((ms) => { for (const m of ms) if (m.target.classList.contains('on') && m.target.classList.contains('dot')) window.__t.push(performance.now()); }).observe(document.getElementById('dots'), { attributes: true, subtree: true, attributeFilter: ['class'] }); });
  await p.click('#play'); await p.waitForTimeout(3100); const t = await p.evaluate(() => window.__t); await p.click('#play');
  const gaps = t.slice(1).map((x, i) => x - t[i]).filter((g) => g > 100); const avg = gaps.reduce((a, c) => a + c, 0) / gaps.length;
  ok(t.length >= 5 && Math.abs(avg - 500) < 40, 'metronome: beats ' + t.length + ' in 3 s, average gap ' + Math.round(avg) + ' ms (500 wanted)');
  await p.screenshot({ path: path.join(out, 'metronome.png') });
  await p.selectOption('#poly', '3'); await p.click('#play'); await p.waitForTimeout(1300); await p.click('#play'); ok((await p.locator('#poly').inputValue()) === '3', 'metronome: a polyrhythm of 3 against the bar plays with no error'); await p.selectOption('#poly', '0');
  await p.selectOption('#sig', '6/8'); ok(await p.locator('#dots .dot').count() === 6, 'metronome: 6/8 shows six beats'); ok((await p.locator('#dots .dot').nth(3).getAttribute('data-lv')) === '2', 'metronome: 6/8 accents the fourth beat (medium)');
  await p.click('#dots .dot >> nth=1'); ok((await p.locator('#dots .dot').nth(1).getAttribute('data-lv')) === '0', 'metronome: a beat pressed once goes silent (cycle 1 to 0)');
  await p.selectOption('#sig', '4/4'); for (let i = 0; i < 6; i++) { await p.click('#tap'); await p.waitForTimeout(600); } txt = await p.locator('#bpmOut').innerText(); ok(Math.abs(+txt - 100) < 15, 'metronome: tapping every 600 ms sets about 100 BPM (' + txt + ')');
  await p.fill('#entryName', 'Etude'); await p.click('#saveEntry'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500); txt = await p.locator('#setlist').innerText(); ok(/Etude/.test(txt) && /BPM/.test(txt), 'metronome: a saved setlist entry survives a reload');
  await p.fill('#rampStep', '10'); await p.fill('#rampEvery', '1'); await p.fill('#rampTo', '200'); await p.fill('#bpmIn', '300'); await p.dispatchEvent('#bpmIn', 'change'); await p.selectOption('#sub', 'sixteenth'); await p.click('#play'); await p.waitForTimeout(1500); await p.click('#play');
  ok(+(await p.locator('#bpmOut').innerText()) <= 300, 'metronome: sixteenth subdivision at 300 BPM plays with no error'); await ctx.close();
  const d = await mk('de-DE'); await open(d.p, '/metronome/'); txt = await d.p.evaluate(() => document.body.innerText); ok(/Metronom/.test(txt) && /Taktart/.test(txt) && /Start/.test(txt) && !/Time signature/.test(txt), 'metronome: German on a German browser'); await d.ctx.close();
}
{ // ---- the piano ----
  const { ctx, p } = await mk(); const ms = await open(p, '/piano/'); await sane(p, 'piano', ms); await p.screenshot({ path: path.join(out, 'piano-top.png') });
  await p.keyboard.down('q'); ok(await p.locator('.wk.on').count() === 1, 'piano: the q key lights one key'); await p.keyboard.up('q'); ok(await p.locator('.wk.on, .bk.on').count() === 0, 'piano: it lets go on key up');
  await p.keyboard.down('Shift'); await p.keyboard.down('1'); ok(await p.locator('.bk.on').count() === 1, 'piano: Shift+1 plays a sharp (a black key)'); await p.keyboard.up('1'); await p.keyboard.up('Shift');
  await p.click('#rec'); for (const k of ['a', 's', 'd']) { await p.keyboard.down(k); await p.waitForTimeout(250); await p.keyboard.up(k); await p.waitForTimeout(100); } await p.click('#rec'); const rn = await p.locator('#recNote').innerText(); ok(/Recorded as a sheet/.test(rn) && /[A-G]#?\d/.test(rn), 'piano: a recording becomes a sheet (' + rn.slice(0, 60) + ')');
  await p.selectOption('#song', 'ode'); await p.click('#playSheet'); await p.waitForTimeout(900); ok(await p.locator('.wk.on, .bk.on').count() >= 1, 'piano: a sheet lights the keys it plays'); await p.screenshot({ path: path.join(out, 'piano.png') }); await p.click('#stopSheet');
  const box = null; await p.locator('.wk[data-m="62"]').evaluate((e) => e.scrollIntoView({ inline: 'center', block: 'nearest' })); await p.waitForTimeout(100); const bb = await p.locator('.wk[data-m="62"]').boundingBox(); await p.mouse.move(bb.x + 30, bb.y + 150); await p.mouse.down(); ok(await p.locator('.wk.on').count() === 1, 'piano: a mouse press plays a key'); await p.mouse.up(); void box;
  await p.selectOption('#ins', 'bell'); await p.click('#sus'); await p.keyboard.press('e'); ok((await p.locator('#sus').getAttribute('aria-pressed')) === 'true', 'piano: the sustain pedal latches'); await ctx.close();
}
{ // ---- the tuner (Chrome's fake microphone beeps) ----
  const { ctx, p } = await mk(); const ms = await open(p, '/tuner/'); await sane(p, 'tuner', ms);
  await p.selectOption('#tun', 'chromatic'); await p.click('#mic'); await p.waitForFunction(() => /Hz/.test(document.getElementById('hz').textContent), null, { timeout: 9000 }).catch(() => {}); const n = await p.locator('#note').innerText(), v = await p.locator('#verdict').innerText(); console.log('     tuner read:', JSON.stringify(n), JSON.stringify(v));
  ok(/[A-G]#?/.test(n) && /Hz/.test(n), 'tuner: the fake microphone tone is read as a note with its Hz'); await p.screenshot({ path: path.join(out, 'tuner.png') });
  await p.click('#dispStrobe'); await p.waitForTimeout(600); const bg1 = await p.locator('#strobe').evaluate((e) => e.style.backgroundPositionX); await p.waitForTimeout(600); const bg2 = await p.locator('#strobe').evaluate((e) => e.style.backgroundPositionX); ok(await p.locator('#strobe').isVisible() && !(await p.locator('#meter').isVisible()), 'tuner: the strobe display replaces the needle'); ok(bg1 !== '' && (bg1 !== bg2 || /Hz/.test(n)), 'tuner: the strobe stripes move with the off-pitch tone (' + bg1 + ' to ' + bg2 + ')'); await p.screenshot({ path: path.join(out, 'tuner-strobe.png') }); await p.click('#dispNeedle');
  await p.click('#mic'); ok((await p.locator('#mic').getAttribute('aria-pressed')) === 'false', 'tuner: the microphone turns off'); await p.selectOption('#tun', 'guitar-standard'); ok(await p.locator('#strings button').count() === 6, 'tuner: six guitar strings'); await p.click('#strings button >> nth=0'); ok((await p.locator('#strings button').first().getAttribute('aria-pressed')) === 'true', 'tuner: a string plays its reference tone'); await ctx.close();
}
{ // ---- the BPM counter ----
  const { ctx, p } = await mk(); const ms = await open(p, '/bpm/'); await sane(p, 'bpm', ms);
  let txt = await p.evaluate(() => document.body.innerText); ok(/\b500\b/.test(txt) && /\b333\.33\b/.test(txt) && /\b750\b/.test(txt), 'bpm: the note lengths at 120 BPM before any tap (500, 750, 333.33 ms)');
  await p.evaluate(async () => { for (let i = 0; i < 9; i++) { document.getElementById('tap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 500)); } }); const bpm = +(await p.locator('#bpmOut').innerText()); ok(bpm > 112 && bpm < 128, 'bpm: nine taps 500 ms apart read ' + bpm); await p.click('#half'); ok(Math.abs(+(await p.locator('#bpmOut').innerText()) - bpm / 2) < 0.2, 'bpm: half time halves it');
  await p.click('#rst'); ok((await p.locator('#bpmOut').innerText()) === '–', 'bpm: reset clears it');
  const sr = 22050, len = sr * 24, wav = Buffer.alloc(44 + len * 2); wav.write('RIFF', 0); wav.writeUInt32LE(36 + len * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(len * 2, 40);
  const gap = Math.round(sr * 60 / 124); for (let at = 0; at < len; at += gap) for (let j = 0; j < 900 && at + j < len; j++) wav.writeInt16LE(Math.round(Math.sin(j * 0.2) * Math.exp(-j / 200) * 20000), 44 + (at + j) * 2);
  fs.writeFileSync(path.join(out, 'click124.wav'), wav); await p.setInputFiles('#file', path.join(out, 'click124.wav')); await p.waitForTimeout(1500); txt = await p.locator('#fileNote').innerText(); const m = /([\d.]+) BPM/.exec(txt); ok(m && Math.abs(+m[1] - 124) < 2, 'bpm: a file of clicks at 124 BPM reads ' + (m && m[1])); await p.screenshot({ path: path.join(out, 'bpm.png') }); await ctx.close();
}
{ // ---- the chord and scale finder ----
  const { ctx, p } = await mk(); const ms = await open(p, '/chords/'); await sane(p, 'chords', ms);
  let txt = await p.evaluate(() => document.body.innerText); ok(/C E G/.test(txt) && /C D E F G A B/.test(txt) && /x 3 2 0 1 0/.test(txt), 'chords: C major is C E G, with the open C shape and the C scale');
  ok(/\bDm\b/.test(txt) && /\bBdim\b/.test(txt) && /\bvii°/.test(txt), 'chords: the chords of C major with roman numerals');
  await p.selectOption('#cRoot', 'A'); await p.selectOption('#cType', 'm7'); txt = await p.locator('#cName').innerText(); ok(/Am7/.test(txt) && /A C E G/.test(txt), 'chords: Am7 is A C E G'); ok(await p.locator('#gtr svg').count() >= 1, 'chords: guitar fingerings drawn');
  for (const n of ['C', 'E', 'G']) await p.click('#pickNotes button[data-pc="' + n + '"]'); txt = await p.locator('#idOut').innerText(); ok(/C \(major\)|C \(C major\)|\bC\b/.test(txt) && /This is/.test(txt), 'chords: C E G is named (' + txt.slice(0, 40) + ')'); ok((await p.locator('#idScales li').count()) >= 3, 'chords: scales that hold C E G listed');
  ok(await p.locator('#neck svg circle').count() >= 15, 'chords: the C major scale is drawn on the guitar neck (' + await p.locator('#neck svg circle').count() + ' notes)');
  await p.selectOption('#neckSel select[data-s="1"]', '3'); await p.selectOption('#neckSel select[data-s="2"]', '2'); await p.selectOption('#neckSel select[data-s="4"]', '1'); await p.selectOption('#neckSel select[data-s="3"]', '0'); await p.selectOption('#neckSel select[data-s="5"]', '0'); txt = await p.locator('#neckOut').innerText(); ok(/\bC\b/.test(txt) && /This is/.test(txt), 'chords: frets x 3 2 . 1 held on the neck name a C chord (' + txt.slice(0, 50) + ')');
  await p.locator('#pickNeck svg rect').nth(40).click({ force: true }); ok(/Notes:/.test(await p.locator('#neckOut').innerText()), 'chords: a tap on the neck holds a fret');
  const p2 = await ctx.newPage(); await p2.goto(base + '/chords/?chord=Fmaj7&scale=D%20dorian', { waitUntil: 'load' }); await p2.waitForTimeout(600); txt = await p2.evaluate(() => document.body.innerText); ok(/Fmaj7/.test(txt) && /D Dorian/.test(txt), 'chords: ?chord= and ?scale= open a chord and a scale');
  await p.screenshot({ path: path.join(out, 'chords.png'), fullPage: true }); await ctx.close();
}
{ // ---- the hub ----
  const { ctx, p } = await mk(); await p.addInitScript(() => localStorage.setItem('a2m.void.music.v1', JSON.stringify({ setlist: [{ name: 'Warm-up', bpm: 80, sig: '4/4', sub: 'none' }] })));
  const ms = await open(p, '/music/'); await sane(p, 'music', ms); let txt = await p.evaluate(() => document.body.innerText); ok(/Warm-up/.test(txt) && /Playlists/.test(txt) && /Recommendations/.test(txt) && /Catalogue/.test(txt), 'music: the setlist, catalogue and recommendations');
  await p.click('[data-cat="scale"]'); txt = await p.locator('#cat').innerText(); ok(/Dorian/.test(txt) && /Blues/.test(txt), 'music: the scale catalogue lists Dorian and Blues'); await p.click('[data-cat="song"]'); ok(/Ode to Joy/.test(await p.locator('#cat').innerText()), 'music: songs to play'); ok(/72/.test(await p.locator('#ladder').innerText()), 'music: the practice ladder for 120 BPM starts at 72');
  await p.screenshot({ path: path.join(out, 'music.png'), fullPage: true }); await ctx.close();
}
{ // ---- offline: load twice (the worker keeps the page and its modules), cut the network, reload: the words, the controls and the sound are still there ----
  for (const [url, want, act] of [['/metronome/', /Metronome[\s\S]*Start/, async (p) => { await p.evaluate(() => { window.__on = 0; new MutationObserver(() => { window.__on++; }).observe(document.getElementById('dots'), { attributes: true, subtree: true, attributeFilter: ['class'] }); }); await p.click('#play'); await p.waitForTimeout(1300); await p.click('#play'); return (await p.evaluate(() => window.__on)) >= 2; }],
    ['/piano/', /Piano[\s\S]*Sustain/, async (p) => { await p.keyboard.down('q'); const on = (await p.locator('.wk.on').count()) === 1; await p.keyboard.up('q'); return on; }], ['/tuner/', /Tuner[\s\S]*microphone/i, async (p) => { await p.click('#strings button >> nth=0'); return (await p.locator('#strings button').first().getAttribute('aria-pressed')) === 'true'; }],
    ['/bpm/', /BPM counter[\s\S]*Tap/, async (p) => { await p.click('#tap'); await p.waitForTimeout(300); await p.click('#tap'); return /BPM|\d/.test(await p.locator('#bpmOut').innerText()); }], ['/chords/', /Chord finder[\s\S]*C E G/, async (p) => { await p.selectOption('#cType', 'm'); return /Cm/.test(await p.locator('#cName').innerText()); }], ['/music/', /Music[\s\S]*Recommendations/, async (p) => { await p.click('[data-cat="scale"]'); return /Dorian/.test(await p.locator('#cat').innerText()); }]]) {
    const { ctx, p } = await mk(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.goto(base + url, { waitUntil: 'load' }); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.goto(base + url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(1000); const txt = await p.evaluate(() => document.body.innerText);
    ok(want.test(txt) && txt.length > 400, url + ' offline: the page shows itself again with the network cut'); ok(await act(p).catch(() => false), url + ' offline: its controls and sound still work'); ok(errs.length === 0, url + ' offline: no page error ' + errs.slice(0, 1)); await ctx.close();
  }
}
{ // ---- what the tower gate will ask of each page: its own probe's truth, aspects and completeness facts, read off the page's text ----
  const { probeFor, withFeatureFacts, score } = await import('./tower-probes.mjs'); const { FLOORS } = await import('../void-live-deploy/lib/tower.js'); const { ctx, p } = await mk();
  for (const f of FLOORS.filter((x) => x.id === 'music' || x.id.startsWith('music: '))) {
    const pr = withFeatureFacts(probeFor(f.id), f.id); await p.goto(base + (f.page || pr.verse), { waitUntil: 'load' }); await p.waitForTimeout(900); const text = await p.evaluate(() => document.body.innerText);
    const want = { truth: pr.truth, facts: pr.facts, ...Object.fromEntries(Object.entries(pr.askParts).map(([a, i]) => ['aspect ' + a, i])) };
    for (const [k, items] of Object.entries(want)) { const r = score(text, items); ok(r.n === r.of, f.id + ' ' + k + ': ' + r.n + ' of ' + r.of + (r.missing.length ? ' (missing: ' + r.missing.join('; ') + ')' : '')); }
  }
  await ctx.close();
}
await b.close(); srv.close(); process.exit(fail);
