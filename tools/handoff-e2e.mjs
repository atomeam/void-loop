// The handoffs built from docs/HANDOFF-GAPS.md, tested end to end in a real browser (owner, 2026-10-28: build the top few each lap and
// test them end to end). The pages are served from the files in void-live-deploy (the browser's requests are answered from disk; every
// outside host is cut off), a person's steps are played, and after every step the page must hold no error, stub or placeholder.
//   node tools/handoff-e2e.mjs        (VOID_TEST_BROWSER: the browser, default /usr/bin/google-chrome)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import zlib from 'node:zlib';

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

/** a one-page PDF with lines of text in Helvetica, built by hand with its byte offsets, so pdf.js can read the words back */
function textPdf(lines) {
  const body = 'BT /F1 18 Tf 72 720 Td 24 TL ' + lines.map((l) => '(' + l.replace(/[()\\]/g, '') + ') Tj T*').join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const at = [];
  objs.forEach((o, i) => { at.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + at.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}

/** one file's text out of a zip (a .docx), read from its local headers; stored or deflated */
function zipText(buf, name) {
  for (let i = 0; i + 30 < buf.length; i++) if (buf.readUInt32LE(i) === 0x04034b50) {
    const m = buf.readUInt16LE(i + 8), size = buf.readUInt32LE(i + 18), nl = buf.readUInt16LE(i + 26), xl = buf.readUInt16LE(i + 28), at = i + 30 + nl + xl;
    if (buf.toString('latin1', i + 30, i + 30 + nl) === name) return (m === 8 ? zlib.inflateRawSync(buf.subarray(at, at + size)) : buf.subarray(at, at + size)).toString('utf8');
  }
  return '';
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
  'add an invited event to the calendar, see its moment in other cities on the time page, then the weather, the flights and the matches that day, and the weather at a game\'s ground': async (p, check) => {
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
    // the same day's matches: the scores page opens on it, in the visitor's own league
    await p.goto(ORIGIN + '/calendar/?d=' + soon + '&view=day', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    if ((await rel('Matches that day')) !== '/scores/?date=' + soon) throw new Error('"Matches that day" goes to "' + (await rel('Matches that day')) + '", not /scores/?date=' + soon);
    await Promise.all([p.waitForURL(/\/scores\//), p.locator('#related a', { hasText: 'Matches that day' }).click()]); await p.waitForSelector('#date');
    await p.waitForFunction((d) => document.getElementById('date').value === d, soon, { timeout: 10000 }).catch(() => {});
    if ((await p.locator('#date').inputValue()) !== soon) throw new Error('the scores page opened on "' + (await p.locator('#date').inputValue()) + '", not ' + soon);
    await check('the scores page opened on the matches of ' + soon);
    // and back: a game that has not started goes on Verse's own calendar at its kick-off in this device's zone
    await p.route('**/api/scores?**', (r) => r.fulfill({ json: { ok: true, game: { id: 'g1', state: 'pre', start: soon + 'T15:00:00Z', venue: 'Emirates Stadium', city: 'London', home: { name: 'Arsenal', short: 'ARS', score: '' }, away: { name: 'Chelsea', short: 'CHE', score: '' } }, events: [], last5: [], h2h: [], plays: [], stats: [], lineups: [], players: [] } }));
    await p.goto(ORIGIN + '/scores/?league=epl&game=g1', { waitUntil: 'load' }); await p.waitForSelector('#vtime');
    await Promise.all([p.waitForURL(/\/time\/\?at=/), p.locator('#vtime').click()]); await p.waitForSelector('#event:not([hidden])');
    if (!(await p.locator('#evwhen').textContent()).includes('3:00 PM UTC')) throw new Error('the time page showed "' + (await p.locator('#evwhen').textContent()) + '", not the kick-off at 15:00 UTC');
    await check('the time page opened on the kick-off of Arsenal vs Chelsea');
    await p.goto(ORIGIN + '/scores/?league=epl&game=g1', { waitUntil: 'load' }); await p.waitForSelector('#vcal');
    await Promise.all([p.waitForURL(/\/calendar\/\?e=/), p.locator('#vcal').click()]); await p.waitForSelector('#invAdd', { state: 'visible' });
    await p.locator('#invAdd').click(); await p.waitForSelector('#detTime');
    if (!(await p.evaluate(() => document.body.innerText.includes('Arsenal vs Chelsea')))) throw new Error('the calendar does not show the added game');
    await check('the scores page put "Arsenal vs Chelsea" on the calendar');
    // the forecast at the ground: the weather page opens on the venue's town
    await p.goto(ORIGIN + '/scores/?league=epl&game=g1', { waitUntil: 'load' }); await p.waitForSelector('#vwx');
    await Promise.all([p.waitForURL(/\/weather\/\?place=London$/), p.locator('#vwx').click()]); await p.waitForSelector('#q');
    if ((await p.locator('#q').inputValue()) !== 'London') throw new Error('the weather page opened on "' + (await p.locator('#q').inputValue()) + '", not London');
    await check('the weather page opened on London, the town of the Emirates Stadium');
  },
  'work out a flight, see its landing in both cities on the time page, the weather, the local radio and TV and the remote jobs where it lands (and fly back there from it), and add it to the calendar': async (p, check) => {
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
    // the remote jobs open to people in the arrival country: /jobs/ reads GB as its UK region and writes the region into its own link
    await open(); if ((await p.locator('#fa-jobs').getAttribute('href')) !== '/jobs/?cc=GB') throw new Error('the jobs link is "' + (await p.locator('#fa-jobs').getAttribute('href')) + '", not /jobs/?cc=GB');
    await Promise.all([p.waitForURL(/\/jobs\//), p.locator('#fa-jobs').click()]); await p.waitForSelector('#jb-region');
    await p.waitForFunction(() => document.getElementById('jb-region').value === 'uk', null, { timeout: 10000 }).catch(() => {});
    if ((await p.locator('#jb-region').inputValue()) !== 'uk') throw new Error('the jobs page opened with the region "' + (await p.locator('#jb-region').inputValue()) + '", not uk');
    await check('the jobs page opened on the remote jobs open in the UK (' + new URL(p.url()).search + ')');
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
  'search the sports database for a match still to come and put it on the calendar (a past match gets no link)': async (p, check) => {
    const d = new Date(Date.now() + 9 * 86400000), soon = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ev = (id, name, date, hs, as) => ({ id, name, date, league: 'English Premier League', sport: 'Soccer', home: 'Arsenal', away: 'Chelsea', hs, as, src: 'TheSportsDB' });
    await p.route('**/api/sportsearch?**', (r) => r.fulfill({ json: { ok: true, teams: [], events: [ev('1', 'Arsenal vs Chelsea', '2019-05-01', '3', '1'), ev('2', 'Arsenal vs Chelsea', soon, '', '')], venues: [], players: [], source: 'TheSportsDB' } }));
    await p.goto(ORIGIN + '/sports/?q=Arsenal%20vs%20Chelsea', { waitUntil: 'load' }); await p.waitForSelector('ul.ev li a[href^="/calendar/?e="]');
    const links = await p.locator('ul.ev li', { hasText: 'Arsenal vs Chelsea' }).evaluateAll((ls) => ls.map((l) => !!l.querySelector('a[href^="/calendar/"]')));
    if (links.join() !== 'false,true') throw new Error('the calendar links on the two matches are ' + links.join() + ', not only on the one still to come');
    await check('the search shows the match on ' + soon + ' with a link to the calendar, and the 2019 match without one');
    await Promise.all([p.waitForURL(/\/calendar\/\?e=/), p.locator('ul.ev li a', { hasText: 'Add to my calendar' }).click()]); await p.waitForSelector('#invAdd', { state: 'visible' });
    await Promise.all([p.waitForURL(/\/calendar\/\?d=/), p.locator('#invAdd').click()]);
    if (!(await p.evaluate(() => document.body.innerText.includes('Arsenal vs Chelsea')))) throw new Error('the calendar does not show the added match');
    if ((await p.evaluate(() => location.search)) !== '?d=' + soon + '&view=day') throw new Error('the calendar opened on ' + (await p.evaluate(() => location.search)) + ', not the day of the match');
    await check('the sports page put "Arsenal vs Chelsea" on ' + soon + ' in the calendar');
  },
  'show an event in every city on the time page, put it on the calendar, and see the matches that day': async (p, check) => {
    const d = new Date(Date.now() + 9 * 86400000), soon = d.toISOString().slice(0, 10), rel = (t) => p.locator('#related a', { hasText: t }).getAttribute('href');
    const at = '/time/?at=' + soon + 'T15:00:00Z&cities=Kyoto@Asia/Tokyo,London';
    await p.goto(ORIGIN + '/time/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    if ((await p.locator('#related a', { hasText: 'Put the event on my calendar' }).getAttribute('aria-disabled')) !== 'true') throw new Error('with no event shown, "Put the event on my calendar" is not off');
    await check('with no event shown, the calendar link reads as off');
    await p.goto(ORIGIN + at, { waitUntil: 'load' }); await p.waitForSelector('#event:not([hidden])');
    if ((await rel('Matches that day')) !== '/scores/?date=' + soon) throw new Error('"Matches that day" goes to "' + (await rel('Matches that day')) + '", not /scores/?date=' + soon);
    await Promise.all([p.waitForURL(/\/calendar\/\?e=/), p.locator('#related a', { hasText: 'Put the event on my calendar' }).click()]); await p.waitForSelector('#invAdd', { state: 'visible' });
    const card = await p.locator('#invBody').innerText();
    if (!card.includes('Event in Kyoto, London') || !card.includes('3:00')) throw new Error('the invite reads "' + card.replace(/\s+/g, ' ').slice(0, 160) + '", not the event in Kyoto and London at 3:00 PM');
    await check('the calendar opened on "Event in Kyoto, London" at 3:00 PM on ' + soon);
    await Promise.all([p.waitForURL(/\/calendar\/\?d=/), p.locator('#invAdd').click()]);
    if ((await p.evaluate(() => location.search)) !== '?d=' + soon + '&view=day') throw new Error('the calendar opened on ' + (await p.evaluate(() => location.search)) + ', not ' + soon);
    await check('the event is on the calendar on ' + soon);
  },
  'open the time in Kyoto, then see the weather and the local radio and TV in Kyoto and the remote jobs open in Japan (none offered for UTC)': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/time/?c=Kyoto@Asia/Tokyo', { waitUntil: 'load' }).then(() => p.waitForSelector('#related a.tk-hand'));
    await open(); await check('the time page opened on Kyoto');
    await Promise.all([p.waitForURL(/\/weather\/\?place=/), p.locator('#related a', { hasText: 'The weather in this city' }).click()]); await p.waitForSelector('#q');
    if ((await p.locator('#q').inputValue()) !== 'Kyoto') throw new Error('the weather page opened on "' + (await p.locator('#q').inputValue()) + '", not Kyoto');
    await check('the weather page opened on Kyoto');
    await open(); await Promise.all([p.waitForURL(/\/local\/\?place=/), p.locator('#related a', { hasText: 'Radio and TV in this city' }).click()]); await p.waitForSelector('#q');
    if ((await p.locator('#q').inputValue()) !== 'Kyoto') throw new Error('the local page opened on "' + (await p.locator('#q').inputValue()) + '", not Kyoto');
    await check('the local radio and TV page opened on Kyoto');
    // the remote jobs open to people in Japan: the zone Asia/Tokyo is in JP, and /jobs/ reads JP as its Asia and Pacific region
    await open(); if ((await p.locator('#related a', { hasText: 'Remote jobs open in this country' }).getAttribute('href')) !== '/jobs/?cc=JP') throw new Error('the jobs link is "' + (await p.locator('#related a', { hasText: 'Remote jobs open in this country' }).getAttribute('href')) + '", not /jobs/?cc=JP');
    await Promise.all([p.waitForURL(/\/jobs\//), p.locator('#related a', { hasText: 'Remote jobs open in this country' }).click()]); await p.waitForSelector('#jb-region');
    await p.waitForFunction(() => document.getElementById('jb-region').value === 'asia', null, { timeout: 10000 }).catch(() => {});
    if ((await p.locator('#jb-region').inputValue()) !== 'asia') throw new Error('the jobs page opened with the region "' + (await p.locator('#jb-region').inputValue()) + '", not asia');
    await check('the jobs page opened on the remote jobs open in Asia and Pacific (' + new URL(p.url()).search + ')');
    await p.goto(ORIGIN + '/time/?c=UTC@UTC', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    if ((await p.locator('#related a', { hasText: 'Remote jobs open in this country' }).getAttribute('aria-disabled')) !== 'true') throw new Error('UTC, which is no country, still offers remote jobs');
    await check('UTC is no country, so the jobs link reads as off');
  },
  'make random people, then pick one of their names at random and see the prize odds for them': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/random-user/?n=5&seed=handoff', { waitUntil: 'load' }).then(() => p.waitForSelector('#related a.tk-hand'));
    await open(); const sent = (new URL(await p.locator('#related a', { hasText: 'Pick one of these names at random' }).getAttribute('href'), ORIGIN).searchParams.get('list') || '').split('\n');
    if (sent.length !== 5 || sent.some((n) => !/\S \S/.test(n))) throw new Error('the random people page sends "' + sent.join(', ') + '", not 5 full names');
    await check('the random people page made 5 people (' + sent.join(', ') + ')');
    await Promise.all([p.waitForURL(/\/random\/\?list=/), p.locator('#related a', { hasText: 'Pick one of these names at random' }).click()]); await p.waitForSelector('#list');
    if ((await p.locator('#list').inputValue()) !== sent.join('\n')) throw new Error('the random page opened with "' + (await p.locator('#list').inputValue()) + '", not the 5 names');
    await check('the random page opened with the 5 names to pick from');
    await open(); await Promise.all([p.waitForURL(/\/prizes\/\?s=/), p.locator('#related a', { hasText: 'Prize odds for these names' }).click()]); await p.waitForSelector('#slices');
    if ((await p.locator('#slices').inputValue()).trim() !== sent.join('\n')) throw new Error('the prizes page opened with the slices "' + (await p.locator('#slices').inputValue()) + '", not the 5 names');
    await check('the prizes page opened with a slice for each of the 5 names');
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
  'paint a picture, resize it, edit the resized copy, edit it in the photo tools, and paint a kept picture as a new sheet': async (p, check) => {
    const open = () => p.goto(ORIGIN + '/paint/', { waitUntil: 'load' }).then(() => p.waitForSelector('#related a.tk-hand'));
    await open(); await check('the paint page opened with its picture');
    await Promise.all([p.waitForURL(/\/resize-image\//), p.locator('#related a', { hasText: 'Resize your painting' }).click()]);
    await p.waitForFunction(() => !document.getElementById('result').hidden && document.getElementById('result').dataset.bytes, null, { timeout: 15000 });
    if (new URL(p.url()).searchParams.has('img')) throw new Error('the resize page kept ?img=handoff in its address, so a reload opens the picture again');
    await check('the resize page opened the painting and made a ' + (await p.locator('#result').getAttribute('data-bytes')) + '-byte copy');
    await Promise.all([p.waitForURL(/\/photos\//), p.locator('#related a', { hasText: 'Edit the resized photo' }).click()]);
    await p.waitForFunction(() => !document.getElementById('work').hidden && /→/.test(document.getElementById('line').textContent), null, { timeout: 15000 });
    if (new URL(p.url()).searchParams.has('img')) throw new Error('the photo tools kept ?img=handoff in their address, so a reload opens the resized copy again');
    const got = await p.locator('#dl').getAttribute('download');
    if (!/-resized/.test(got || '')) throw new Error('the photo tools did not open the resized copy, they would save "' + got + '"');
    await check('the photo tools opened the resized copy as ' + got + ': ' + (await p.locator('#line').textContent()));
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
    // an unpainted sheet is all paper: the gradient has to come from the picture's own colours, not from near-white paper
    const hexes = new URL(p.url()).hash.split('-').slice(1).map((s) => s.slice(0, 6)), pale = (x) => [0, 2, 4].every((i) => parseInt(x.slice(i, i + 2), 16) > 0xe8);
    if (hexes.every(pale)) throw new Error('the gradient page read only paper white from the painting: ' + hexes.join(', '));
    await check('the gradient page read the painting into ' + stops + ' colour stops (' + new URL(p.url()).hash + ')');
    // its own links follow at once, with no hover or press first: the colour page link opens the first stop read from the painting
    const first = new URL(p.url()).hash.split('-')[1].slice(0, 6), link = await p.locator('#related a', { hasText: 'Open its first colour' }).getAttribute('href');
    if (link !== '/color/?c=' + first) throw new Error('the gradient page read the painting, but its colour link still opens ' + link + ', not /color/?c=' + first);
    await check('the gradient page links its first colour #' + first + ' right away');
  },
  'save a painting and a gradient as a PDF: the PDF page opens its images-to-PDF tool with the picture in the list': async (p, check) => {
    await p.goto(ORIGIN + '/paint/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand'); await check('the paint page opened with its picture');
    await Promise.all([p.waitForURL(/\/pdf\//), p.locator('#related a', { hasText: 'Save your painting as a PDF' }).click()]);
    await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
    const tab = await p.locator('[role=tab][aria-selected=true]').textContent(), u = new URL(p.url());
    if (tab !== 'Images to PDF') throw new Error('the PDF page opened the "' + tab + '" tool, not Images to PDF');
    if (u.searchParams.has('img') || u.searchParams.get('tool') !== 'img2pdf') throw new Error('the PDF page left its address as ' + u.search + ', not ?tool=img2pdf');
    await check('the PDF page opened Images to PDF with ' + (await p.locator('ol.files li .fname').textContent()) + ' in the list');
    await p.locator('button.go', { hasText: 'Images to PDF' }).click();
    await p.waitForSelector('a.dl', { timeout: 20000 });
    const head = await p.evaluate(async () => { const b = new Uint8Array(await (await fetch(document.querySelector('a.dl').href)).arrayBuffer()); return String.fromCharCode(...b.slice(0, 5)) + ' ' + b.length; });
    if (!head.startsWith('%PDF-')) throw new Error('the download is not a PDF: it starts "' + head + '"');
    await check('the PDF page made a ' + head.split(' ')[1] + '-byte PDF of the painting');
    // a gradient goes the same way, as a picture of the gradient
    await p.goto(ORIGIN + '/gradient/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    await Promise.all([p.waitForURL(/\/pdf\//), p.locator('#related a', { hasText: 'Save it as a PDF' }).click()]);
    await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
    await check('the PDF page opened Images to PDF with the gradient ' + (await p.locator('ol.files li .fname').textContent()) + ' in the list');
  },
  'edit a photo in the photo tools, then save the edit as a PDF, paint it by number, take its colours as a gradient, resize it and look up its main colour': async (p, check) => {
    const toPhotos = async () => {
      await p.goto(ORIGIN + '/gradient/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
      await Promise.all([p.waitForURL(/\/photos\//), p.locator('#related a', { hasText: 'Edit it in photo tools' }).click()]);
      // the send links stay off until the edit is ready, then carry their page at once, with no hover or press first
      await p.waitForFunction(() => [...document.querySelectorAll('#related a.tk-hand')].some((a) => a.textContent === 'Save your edit as a PDF' && a.getAttribute('aria-disabled') === 'false'), null, { timeout: 15000 });
    };
    await toPhotos(); await check('the photo tools opened the gradient and its send links turned on');
    await Promise.all([p.waitForURL(/\/pdf\//), p.locator('#related a', { hasText: 'Save your edit as a PDF' }).click()]);
    await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
    await check('the PDF page opened Images to PDF with the edit ' + (await p.locator('ol.files li .fname').textContent()) + ' in the list');
    await toPhotos();
    await Promise.all([p.waitForURL(/\/paint\//), p.locator('#related a', { hasText: 'Paint your edit by number' }).click()]);
    await p.waitForFunction(() => document.body.innerText.includes('Your photo is now a colouring sheet'), null, { timeout: 15000 });
    await check('the paint page cut the edit into a new colouring sheet');
    await toPhotos(); const was = new URL(p.url()).hash;
    await Promise.all([p.waitForURL(/\/gradient\//), p.locator('#related a', { hasText: 'Take its colours as a gradient' }).click()]);
    await p.waitForFunction(() => location.hash.split('-').length > 2 && !location.search, null, { timeout: 15000 });
    await check('the gradient page read the edit into ' + (await p.locator('#stops .stop').count()) + ' colour stops (' + new URL(p.url()).hash + ')');
    await toPhotos();
    await Promise.all([p.waitForURL(/\/resize-image\//), p.locator('#related a', { hasText: 'Resize your edit' }).click()]);
    await p.waitForFunction(() => !document.getElementById('result').hidden && document.getElementById('result').dataset.bytes, null, { timeout: 15000 });
    if (new URL(p.url()).searchParams.has('img')) throw new Error('the resize page kept ?img=handoff in its address, so a reload opens the edit again');
    await check('the resize page opened the edit and made a ' + (await p.locator('#result').getAttribute('data-bytes')) + '-byte copy');
    // the main colour: the link carries it from the start, and the colour page opens on it
    await toPhotos(); const href = await p.locator('#related a', { hasText: 'Look up its main colour' }).getAttribute('href');
    if (!/^\/color\/\?c=[0-9a-f]{6}$/.test(href || '')) throw new Error('the main colour link is ' + href);
    await Promise.all([p.waitForURL(/\/color\//), p.locator('#related a', { hasText: 'Look up its main colour' }).click()]);
    await p.waitForFunction((c) => document.getElementById('in').value.toLowerCase() === '#' + c, href.split('=')[1], { timeout: 15000 });
    await check('the colour page opened on the edit\u2019s main colour ' + (await p.locator('#in').inputValue()));
  },
  'turn a PDF page into a picture, then paint it by number, edit it in the photo tools, take its colours as a gradient and resize it': async (p, check) => {
    // a one-page PDF of the gradient, made on the PDF page itself
    await p.goto(ORIGIN + '/gradient/', { waitUntil: 'load' }); await p.waitForSelector('#related a.tk-hand');
    await Promise.all([p.waitForURL(/\/pdf\//), p.locator('#related a', { hasText: 'Save it as a PDF' }).click()]);
    await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
    await p.locator('button.go', { hasText: 'Images to PDF' }).click(); await p.waitForSelector('a.dl[download="images.pdf"]', { timeout: 20000 });
    const pdf = Buffer.from(await p.evaluate(async () => { const b = new Uint8Array(await (await fetch(document.querySelector('a.dl[download="images.pdf"]').href)).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }), 'base64');
    const toPicture = async () => {
      await p.goto(ORIGIN + '/pdf/?tool=pdf2img', { waitUntil: 'load' }); await p.waitForSelector('input.pick');
      await p.locator('input.pick').setInputFiles({ name: 'gradient.pdf', mimeType: 'application/pdf', buffer: pdf });
      await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
      await p.locator('button.go', { hasText: 'PDF to images' }).click();
      await p.waitForSelector('p.send a', { timeout: 30000 });
    };
    await toPicture(); await check('PDF to images made ' + (await p.locator('a.dl[download$=".png"]').count()) + ' picture and offered it to ' + (await p.locator('p.send a').count()) + ' pages');
    await Promise.all([p.waitForURL(/\/paint\//), p.locator('p.send a', { hasText: 'Paint it by number' }).click()]);
    await p.waitForFunction(() => document.body.innerText.includes('Your photo is now a colouring sheet'), null, { timeout: 15000 });
    await check('the paint page cut the PDF page into a new colouring sheet');
    await toPicture();
    await Promise.all([p.waitForURL(/\/photos\//), p.locator('p.send a', { hasText: 'Edit it in photo tools' }).click()]);
    await p.waitForFunction(() => [...document.querySelectorAll('#related a.tk-hand')].some((a) => a.textContent === 'Save your edit as a PDF' && a.getAttribute('aria-disabled') === 'false'), null, { timeout: 15000 });
    await check('the photo tools opened the PDF page: ' + (await p.evaluate(() => (document.body.innerText.match(/\d+ × \d+ px[^\n]*/) || [''])[0])));
    await toPicture();
    await Promise.all([p.waitForURL(/\/gradient\//), p.locator('p.send a', { hasText: 'Take its colours as a gradient' }).click()]);
    await p.waitForFunction(() => location.hash.split('-').length > 2 && !location.search, null, { timeout: 15000 });
    await check('the gradient page read the PDF page into ' + (await p.locator('#stops .stop').count()) + ' colour stops (' + new URL(p.url()).hash + ')');
    await toPicture();
    await Promise.all([p.waitForURL(/\/resize-image\//), p.locator('p.send a', { hasText: 'Resize it' }).click()]);
    await p.waitForFunction(() => /\d+\s*[×x]\s*\d+/.test(document.body.innerText) && !location.search, null, { timeout: 15000 });
    await check('the resize page opened the PDF page');
  },
  'rotate a PDF, then translate it: the translate page waits for the language and one press': async (p, check) => {
    await p.goto(ORIGIN + '/pdf/?tool=rotate', { waitUntil: 'load' }); await p.waitForSelector('input.pick');
    await p.locator('input.pick').setInputFiles({ name: 'hello.pdf', mimeType: 'application/pdf', buffer: textPdf(['Good morning', 'The shop opens at nine']) });
    await p.waitForFunction(() => document.querySelectorAll('ol.files li').length === 1, null, { timeout: 20000 });
    await p.locator('button.go').click(); await p.waitForSelector('p.result a', { hasText: 'Translate it', timeout: 20000 });
    await check('the PDF page rotated hello.pdf and offered to translate it');
    await Promise.all([p.waitForURL(/\/translate\//), p.locator('p.result a', { hasText: 'Translate it' }).click()]);
    await p.waitForSelector('#handed', { timeout: 15000 });
    if (/doc=handoff/.test(p.url())) throw new Error('the address still asks for the PDF: ' + p.url());
    await check('the translate page holds ' + (await p.locator('#handed').textContent()) + ' and waits for a press');
    // a stand-in translator: each paragraph back in capitals, so the one-for-one split holds
    let asked = 0; await p.route('**/api/translate', async (r) => { asked++; const b = JSON.parse(r.request().postData() || '{}'); await r.fulfill({ json: { text: String(b.text).toUpperCase() } }); });
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.locator('#handed').click()]);
    if (!/^hello-rotated\.[a-z-]+\.docx$/.test(dl.suggestedFilename())) throw new Error('the translation downloaded as ' + dl.suggestedFilename());
    const doc = zipText(fs.readFileSync(await dl.path()), 'word/document.xml');
    if (!doc.includes('GOOD MORNING') || !doc.includes('THE SHOP OPENS AT NINE')) throw new Error('the translated document does not hold the translated words: ' + doc.slice(0, 200));
    await check('one press translated it (' + asked + ' request) into ' + dl.suggestedFilename() + ', which holds GOOD MORNING and THE SHOP OPENS AT NINE');
  },
  'pick a palette for a colour, then paint a picture by number in it, and go back to the picture’s own colours': async (p, check) => {
    await p.goto(ORIGIN + '/color/?c=e4572e', { waitUntil: 'load' }); await p.waitForSelector('#pals a');
    const href = await p.locator('#pals a').first().getAttribute('href'), given = href.split('colours=')[1].split(',');
    await check('the colour page offers ' + (await p.locator('#pals a').count()) + ' palettes to paint with (' + given.join(' ') + ')');
    await Promise.all([p.waitForURL(/\/paint\/\?p=.*colours=/), p.locator('#pals a').first().click()]);
    await p.waitForSelector('#palette i');
    const shown = await p.$$eval('#palette i', (is) => is.map((i) => getComputedStyle(i).backgroundColor));
    const hex = (c) => '#' + c.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
    // the picture's darkest and lightest colours become the palette's darkest and lightest, so at least those two show exactly
    if (shown.map(hex).filter((h) => given.includes(h.slice(1))).length < 2) throw new Error('the paint palette shows none of the handed colours: ' + shown.map(hex).join(' '));
    if (await p.locator('#restyle').isHidden()) throw new Error('the paint page does not say it is painted in the link’s colours');
    await check('the paint page shows its ' + shown.length + ' colours in the handed palette (' + shown.map(hex).slice(0, 3).join(' ') + ' ...)');
    await p.locator('#owncol').click(); await p.waitForFunction(() => !/colours=/.test(location.search) && document.getElementById('restyle').hidden, null, { timeout: 10000 });
    await check('one press put back the picture’s own colours');
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
