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
