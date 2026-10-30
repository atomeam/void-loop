// The handoffs built from docs/HANDOFF-GAPS.md, tested end to end in a real browser (owner, 2026-10-28: build the top few each lap and
// test them end to end). The pages are served from the files in void-live-deploy (the browser's requests are answered from disk; every
// outside host is cut off), a person's steps are played, and after every step the page must hold no error, stub or placeholder.
//   node tools/handoff-e2e.mjs        (VOID_TEST_BROWSER: the browser, default /usr/bin/google-chrome)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy'), ORIGIN = 'https://verse.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
/** the negative control: what a page must never show after a step */
// whole words only, and NaN as written: "dominant" in a scale name is not a broken number (2026-10-30)
const BAD = /\b(?:coming soon|placeholder|lorem ipsum|something went wrong|not implemented|undefined)\b|\bNaN\b/i;

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
  'add an invited event to the calendar, see its moment in other cities on the time page, then the weather where it happens': async (p, check) => {
    const ev = { title: 'Team lunch', start: '2026-11-03T12:30', end: '2026-11-03T13:30', allDay: false, location: 'Berlin' };
    await p.goto(ORIGIN + '/calendar/?e=' + Buffer.from(JSON.stringify(ev)).toString('base64url'), { waitUntil: 'load' }); await p.waitForSelector('#invAdd', { state: 'visible' });
    await check('the calendar opened on the invite'); await p.locator('#invAdd').click(); await p.waitForSelector('#detTime');
    const timeHref = await p.locator('#detTime').getAttribute('href'), want = await p.evaluate(() => new Date('2026-11-03T12:30').toISOString().replace(/\.000Z$/, 'Z'));
    if (new URL(timeHref, ORIGIN).searchParams.get('at') !== want) throw new Error('the time link carries "' + timeHref + '", not the event at ' + want);
    if (new URL(await p.locator('#detWeather').getAttribute('href'), ORIGIN).searchParams.get('place') !== 'Berlin') throw new Error('the weather link does not carry the event place Berlin');
    await check('the event details link to the time page at ' + want + ' and the weather in Berlin');
    await Promise.all([p.waitForURL(/\/time\/\?at=/), p.locator('#detTime').click()]); await p.waitForSelector('#event:not([hidden])');
    const when = await p.locator('#evwhen').textContent(), utc = await p.evaluate((w) => new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }).format(Date.parse(w)), want);
    if (!when.startsWith(utc)) throw new Error('the time page showed "' + when + '", not ' + utc + ' UTC');
    if (!(await p.locator('#evlist li').count())) throw new Error('the time page lists no city for the event');
    await check('the time page opened on the event moment (' + utc + ' UTC) in every city');
    await p.goto(ORIGIN + '/calendar/?d=2026-11-03&view=day', { waitUntil: 'load' }); await p.locator('#view button', { hasText: 'Team lunch' }).first().click();
    await Promise.all([p.waitForURL(/\/weather\/\?place=/), p.locator('#detWeather').click()]); await p.waitForSelector('#q');
    if ((await p.locator('#q').inputValue()) !== 'Berlin') throw new Error('the weather page opened on "' + (await p.locator('#q').inputValue()) + '", not Berlin');
    await check('the weather page opened on Berlin');
    // the day's own links: "Weather that day" carries the place of an event on a day the forecast reaches, and the countdown counts to it
    const soon = await p.evaluate(() => { const d = new Date(Date.now() + 864e5), z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); });
    await p.goto(ORIGIN + '/calendar/?e=' + Buffer.from(JSON.stringify({ ...ev, title: 'Lunch in Lisbon', start: soon + 'T12:30', end: soon + 'T13:30', location: 'Lisbon' })).toString('base64url'), { waitUntil: 'load' });
    await p.locator('#invAdd').click(); await p.waitForSelector('#detWeather');
    const rel = (label) => p.locator('#related a', { hasText: label }).first().getAttribute('href');
    const wx = await rel('Weather that day'), cd = await rel('Countdown to the next event');
    if (new URL(wx, ORIGIN).searchParams.get('place') !== 'Lisbon') throw new Error('"Weather that day" on ' + soon + ' goes to "' + wx + '", not the weather in Lisbon');
    if (!/^\/stopwatch\/\?t=\d+%20minutes$/.test(cd)) throw new Error('"Countdown to the next event" goes to "' + cd + '"');
    await check('"Weather that day" on ' + soon + ' carries Lisbon and the countdown counts to the event');
    if ((await rel('Flights that day')) !== '/flights/?d=' + soon || (await p.locator('#detFlights').getAttribute('href')) !== '/flights/?d=' + soon) throw new Error('"Flights that day" or the event\'s flights link does not carry ' + soon);
    await Promise.all([p.waitForURL(/\/flights\/\?d=/), p.locator('#detFlights').click()]); await p.waitForSelector('#f-d');
    if ((await p.locator('#f-d').inputValue()) !== soon) throw new Error('the flights page opened with the date "' + (await p.locator('#f-d').inputValue()) + '", not ' + soon);
    await check('the flights page opened on the event day ' + soon);
  },
  'work out a flight, see its landing in both cities on the time page, the weather and the local radio and TV where it lands (and fly back there from it), and add it to the calendar': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/flights/?from=JFK&to=LHR&d=2026-11-20&t=19:00', { waitUntil: 'load' }).then(() => p.waitForSelector('#fa-time'));
    await open(); await check('the flights page worked out JFK to LHR');
    const at = new URL(await p.locator('#fa-time').getAttribute('href'), ORIGIN).searchParams.get('at'), want = await p.evaluate(() => import('/lib/flights-core.js').then((C) => new Date(C.legFacts({ lat: 40.6413, lon: -73.7781, tz: 'America/New_York' }, { lat: 51.47, lon: -0.4543, tz: 'Europe/London' }, '2026-11-20T19:00').arrUtc).toISOString().replace(/\.000Z$/, 'Z')));
    if (Math.abs(Date.parse(at) - Date.parse(want)) > 5 * 60000) throw new Error('the time link carries the landing at ' + at + ', not about ' + want);
    await Promise.all([p.waitForURL(/\/time\/\?at=/), p.locator('#fa-time').click()]); await p.waitForSelector('#event:not([hidden])');
    const cities = await p.locator('#evlist li b').allTextContents();
    if (!cities.includes('New York') || !cities.includes('London')) throw new Error('the time page lists ' + cities.join(', ') + ' for the landing, not New York and London');
    await check('the time page opened on the landing moment in New York and London');
    await open(); await Promise.all([p.waitForURL(/\/weather\/\?place=/), p.locator('#fa-weather').click()]); await p.waitForSelector('#q');
    if (!/^London\b/.test(await p.locator('#q').inputValue())) throw new Error('the weather page opened on "' + (await p.locator('#q').inputValue()) + '", not London');
    await check('the weather page opened on London');
    await open(); await Promise.all([p.waitForURL(/\/local\/\?place=/), p.locator('#fa-local').click()]); await p.waitForSelector('#q');
    const here = new URL(p.url()).searchParams;
    if (!/^London\b/.test(await p.locator('#q').inputValue()) || here.get('cc') !== 'GB' || !/^51\.4\d*,-0\.4\d*$/.test(here.get('ll') || '')) throw new Error('the local page opened on "' + (await p.locator('#q').inputValue()) + '" at ' + p.url() + ', not London at Heathrow');
    await check('the local radio and TV page opened at Heathrow, London');
    // and back: flights to the place a local page shows pick the airport near it, over the London the flights page remembers
    await p.goto(ORIGIN + '/local/?place=Lisbon&ll=38.72,-9.14&cc=PT', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    await Promise.all([p.waitForURL(/\/flights\/\?tonear=/), p.locator('#related a', { hasText: 'Flights to here' }).click()]); await p.waitForFunction(() => document.documentElement.dataset.flightsReady === '1' && new URLSearchParams(location.search).get('to'));
    const back = new URL(p.url()).searchParams;
    if (back.get('to') !== 'LIS' || back.get('from') !== 'JFK') throw new Error('flights to Lisbon from the local page opened ' + back.get('from') + ' to ' + back.get('to') + ', not JFK to LIS');
    await check('from the local page at Lisbon, the flights page picked Lisbon airport and kept JFK');
    await open(); await Promise.all([p.waitForURL(/\/calendar\/\?e=/), p.locator('#fa-cal').click()]); await p.waitForSelector('#invAdd', { state: 'visible' });
    await p.locator('#invAdd').click(); await p.waitForSelector('#detTime');
    if (!(await p.evaluate(() => document.body.innerText.includes('Flight JFK → LHR')))) throw new Error('the calendar does not show the added flight');
    await check('the calendar added "Flight JFK → LHR"');
  },
  'pick two players on the fantasy page, spin them on the wheel, and pick one of the draft board at random': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/fantasy/', { waitUntil: 'load' }).then(() => p.waitForSelector('#related a.tk-hand'));
    await open(); await p.locator('#example').click(); await p.waitForSelector('.pick button'); await check('the fantasy page opened the example sheet');
    for (const n of ['Cy Dee', 'Ann Lee']) await p.locator('.pick button', { hasText: n }).first().click();
    await Promise.all([p.waitForURL(/\/wheel\/#/), p.locator('#related a', { hasText: 'Spin these players on the wheel' }).click()]); await p.waitForSelector('#entries');
    const wheel = (await p.locator('#entries').inputValue()).split('\n').map((x) => x.trim()).filter(Boolean);
    if (wheel.join('|') !== 'Cy Dee|Ann Lee') throw new Error('the wheel opened with "' + wheel.join(', ') + '", not the two picked players');
    await check('the wheel opened with Cy Dee and Ann Lee');
    await open(); await p.locator('#example').click(); await p.waitForSelector('.pick button');
    await Promise.all([p.waitForURL(/\/random\/\?list=/), p.locator('#related a', { hasText: 'Pick one of these players at random' }).click()]); await p.waitForSelector('#list');
    const list = (await p.locator('#list').inputValue()).split('\n');
    if (list.length !== 8 || list[0] !== 'Cy Dee') throw new Error('the random page opened with ' + list.length + ' names starting "' + list[0] + '", not the 8 players of the board best first');
    if ((new URL(p.url()).searchParams.get('list') || '').split('\n').length !== 8) throw new Error('the random page dropped the list from its address (' + p.url() + '), so a reload or a copied link loses it');
    await check('the random page opened with the 8 players of the draft board, Cy Dee first, and keeps them in its link');
  },
  'paint a picture, resize it, edit it in the photo tools, and paint a kept picture as a new sheet': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/paint/', { waitUntil: 'load' }).then(() => p.waitForSelector('#related a.tk-hand'));
    await open(); await check('the paint page opened with its picture');
    await Promise.all([p.waitForURL(/\/resize-image\//), p.locator('#related a', { hasText: 'Resize your painting' }).click()]);
    await p.waitForFunction(() => !document.getElementById('result').hidden && document.getElementById('result').dataset.bytes, null, { timeout: 15000 });
    if (new URL(p.url()).searchParams.has('img')) throw new Error('the resize page kept ?img=handoff in its address, so a reload opens the picture again');
    await check('the resize page opened the painting and made a ' + (await p.locator('#result').getAttribute('data-bytes')) + '-byte copy');
    await open();
    await Promise.all([p.waitForURL(/\/photos\//), p.locator('#related a', { hasText: 'Edit your painting in photo tools' }).click()]);
    await p.waitForFunction(() => !document.getElementById('work').hidden && /→/.test(document.getElementById('line').textContent), null, { timeout: 15000 });
    await check('the photo tools opened the painting: ' + (await p.locator('#line').textContent()));
    // the picture kept a moment ago is what a press on the picture page keeps too: opening paint with ?img=handoff cuts it into a sheet
    await p.goto(ORIGIN + '/paint/?img=handoff', { waitUntil: 'load' });
    await p.waitForFunction(() => document.body.innerText.includes('Your photo is now a colouring sheet'), null, { timeout: 15000 });
    await check('the paint page cut the kept picture into a new colouring sheet');
  },
  "send a gradient to the photo tools as a picture, and take a painting's colours as a gradient": async (p, check) => {
    await p.goto(ORIGIN + '/gradient/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand'); await check('the gradient page opened');
    const before = new URL(p.url()).hash;
    await Promise.all([p.waitForURL(/\/photos\//), p.locator('#related a', { hasText: 'Edit it in photo tools' }).click()]);
    await p.waitForFunction(() => !document.getElementById('work').hidden && /→/.test(document.getElementById('line').textContent), null, { timeout: 15000 });
    const size = await p.locator('#note').textContent();
    if (!/^1200 × 675 px/.test(size)) throw new Error('the photo tools opened a picture of "' + size + '", not the 1200 × 675 gradient');
    await check('the photo tools opened the gradient as a ' + size.split(' · ')[0] + ' picture');
    await p.goto(ORIGIN + '/paint/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    await Promise.all([p.waitForURL(/\/gradient\//), p.locator('#related a', { hasText: 'Take its colours as a gradient' }).click()]);
    await p.waitForFunction((was) => location.hash && location.hash !== was && !location.search, before, { timeout: 15000 });
    const stops = await p.locator('#stops .stop').count();
    if (stops < 2) throw new Error('the gradient page took the painting but shows ' + stops + ' stops');
    await check('the gradient page read the painting into ' + stops + ' colour stops (' + new URL(p.url()).hash + ')');
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
