// The handoffs built from docs/HANDOFF-GAPS.md, tested end to end in a real browser (owner, 2026-10-28: build the top few each lap and
// test them end to end). The pages are served from the files in void-live-deploy (the browser's requests are answered from disk; every
// outside host is cut off), a person's steps are played, and after every step the page must hold no error, stub or placeholder.
//   node tools/handoff-e2e.mjs        (VOID_TEST_BROWSER: the browser, default /usr/bin/google-chrome)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy'), ORIGIN = 'https://verse.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
/** the negative control: what a page must never show after a step */
const BAD = /coming soon|placeholder|lorem ipsum|something went wrong|not implemented|undefined|NaN/i;

function serve(r) {
  const u = new URL(r.request().url());
  if (u.origin !== ORIGIN || u.pathname.startsWith('/api/')) return r.abort('internetdisconnected');
  let f = path.join(site, decodeURIComponent(u.pathname)); if (!f.startsWith(site)) return r.abort();
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
  return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
}

/** the journeys: each a list of steps on one page object; a step throws to fail */
export const JOURNEYS = {
  'tap a tempo on the BPM counter, play it on the metronome, and come back for its note lengths': async (p, check) => {
    await p.goto(ORIGIN + '/bpm/', { waitUntil: 'load' }); await p.waitForSelector('#tap'); await check('the BPM counter opened');
    if (await p.locator('#toMetro').isVisible()) throw new Error('the metronome link shows before any tempo was tapped');
    for (let i = 0; i < 9; i++) { await p.locator('#tap').dispatchEvent('pointerdown'); await p.waitForTimeout(500); }
    const tapped = parseFloat(await p.locator('#bpmOut').textContent());
    if (!(Math.abs(tapped - 120) <= 4)) throw new Error('nine taps 500 ms apart read ' + tapped + ' BPM, not about 120');
    await check('tapped ' + tapped + ' BPM');
    if (!(await p.locator('#toMetro').isVisible())) throw new Error('no link to the metronome after a tempo was tapped');
    await Promise.all([p.waitForURL(/\/metronome\//), p.locator('#toMetro').click()]); await p.waitForFunction(() => document.getElementById('bpmOut'));
    const metro = parseFloat(await p.locator('#bpmOut').textContent());
    if (Math.abs(metro - tapped) > 0.5) throw new Error('the metronome opened at ' + metro + ', not the tapped ' + tapped);
    await check('the metronome opened at ' + metro + ' BPM');
    await p.locator('#m10').click(); const slower = parseFloat(await p.locator('#bpmOut').textContent());
    if (Math.abs(slower - (metro - 10)) > 0.5) throw new Error('−10 gave ' + slower);
    await Promise.all([p.waitForURL(/\/bpm\//), p.locator('#toBpm').click()]); await p.waitForSelector('#lensFor');
    const back = parseFloat(await p.locator('#bpmOut').textContent()), lens = await p.locator('#lensFor').textContent();
    if (Math.abs(back - slower) > 0.5 || !lens.includes(String(back))) throw new Error('the BPM counter came back at ' + back + ' ("' + lens.slice(0, 60) + '"), not ' + slower);
    const quarter = await p.locator('#lens tbody tr:nth-child(3) td:nth-child(2)').textContent();
    if (Math.abs(parseFloat(quarter) - 60000 / slower) > 1) throw new Error('a quarter note at ' + slower + ' BPM read ' + quarter + ' ms');
    await check('note lengths at ' + back + ' BPM (a quarter note ' + quarter + ' ms)');
  },
  'pick a chord on the chord finder, play it on the piano, then play a chord there and have the chord finder name it': async (p, check) => {
    await p.goto(ORIGIN + '/chords/?chord=Am7', { waitUntil: 'load' }); await p.waitForFunction(() => /sheet=/.test(document.getElementById('toPiano').href));
    const name = (await p.locator('#cName').textContent()).trim(); if (!/^Am7\b/.test(name)) throw new Error('the chord finder opened on ' + name + ', not Am7');
    await check('the chord finder opened on Am7');
    await Promise.all([p.waitForURL(/\/piano\/\?sheet=/), p.locator('#toPiano').click()]); await p.waitForFunction(() => document.getElementById('song').value === 'own');
    const sheet = await p.locator('#sheet').inputValue(), bpm = await p.locator('#songBpm').inputValue();
    if (!sheet.startsWith('[A3 C4 E4 G4]:2')) throw new Error('the piano opened with the sheet "' + sheet.slice(0, 60) + '", not the Am7 chord');
    if (bpm !== '90') throw new Error('the piano opened at ' + bpm + ' BPM, not the 90 the link carries');
    if (await p.locator('#toChords').isVisible()) throw new Error('the chord finder link shows before any notes were played');
    await check('the piano opened with the Am7 chord as a sheet at 90 BPM');
    await p.locator('h1').click(); for (const k of ['KeyT', 'KeyU', 'KeyO']) await p.keyboard.down(k); for (const k of ['KeyT', 'KeyU', 'KeyO']) await p.keyboard.up(k);
    if (!(await p.locator('#toChords').isVisible())) throw new Error('no link to the chord finder after C4 E4 G4 were held together');
    await Promise.all([p.waitForURL(/\/chords\/\?notes=/), p.locator('#toChords').click()]); await p.waitForFunction(() => /\(C major\)/.test(document.getElementById('idOut').textContent));
    const said = await p.locator('#idOut').textContent(), on = await p.locator('#pickNotes [aria-pressed="true"]').allTextContents();
    if (!/^This is C \(C major\)/.test(said)) throw new Error('the chord finder named the notes as "' + said + '"');
    if (on.join(' ') !== 'C E G') throw new Error('the chord finder picked ' + on.join(' ') + ', not C E G');
    await check('the chord finder named C E G as C major');
  },
};

async function run() {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  let failed = 0;
  for (const [name, steps] of Object.entries(JOURNEYS)) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), p = await ctx.newPage(), errors = [], said = [];
    p.on('pageerror', (e) => errors.push(String(e.message || e)));
    await ctx.route('**/*', serve);
    const check = async (what) => {
      const text = await p.evaluate(() => document.body.innerText);
      if (errors.length) throw new Error(what + ', but the page threw: ' + errors[0]);
      const bad = text.match(BAD); if (bad) throw new Error(what + ', but the page shows "' + bad[0] + '"');
      if (text.trim().length < 40) throw new Error(what + ', but the page is almost empty');
      said.push(what);
    };
    try { await steps(p, check); console.log('ok   ' + name + '\n       ' + said.join(' → ')); }
    catch (e) { failed++; console.log('FAIL ' + name + '\n       ' + said.join(' → ') + (said.length ? ' → ' : '') + String(e.message || e).slice(0, 300)); }
    await ctx.close();
  }
  await b.close();
  return failed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const n = await run(); if (n) { console.log(n + ' handoff journey(s) failed'); process.exit(1); } }
