// The sky card, its chips and the six skills behind them, with fixed inputs: what each says is checked against numbers worked out by the almanac
// (tools/astro.test.mjs holds that to an independent one), and each chip's ask is followed through the real routing order to the skill it names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as A from '../void-live-deploy/lib/astro.js';
import { splitPlace, moonSvg } from '../void-live-deploy/lib/skyask.js';
import { agoWords, inWords, dayWord, compass, compassWord, lightName } from '../void-live-deploy/lib/skyfacts.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const mods = {}; for (const n of names) mods[n] = (await import(pathToFileURL(resolve(dir, n + '.js')).href)).default;
const route = (ask) => { const k = names.find((n) => mods[n].match(ask.toLowerCase(), ask)); return k || null; };
const LONDON = { lat: 51.5, lon: -0.1, tz: 'Europe/London', name: 'London, GB' }, TROMSO = { lat: 69.65, lon: 18.96, tz: 'Europe/Oslo', name: 'Tromsø, NO' }, CHCH = { lat: -43.5, lon: 172.6, tz: 'Pacific/Auckland', name: 'Christchurch, NZ' };
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('"sky" and its phrasings reach the sky skill; the lookalikes do not', () => {
  const sky = mods.sky;
  for (const t of sky.examples) assert.equal(route(t), 'sky', t);
  for (const t of sky.nearMisses) assert.notEqual(route(t), 'sky', t);
  assert.deepEqual(sky.skyOf('sky over Tokyo'), { place: 'tokyo' });
  assert.equal(sky.skyOf('sky over the morning'), null);
  assert.equal(sky.skyOf('stars'), null, 'the stars alone could be anything');
});

test('every chip on the sky card asks something a skill answers, and the skill is the one meant', async () => {
  const { chips } = await import(pathToFileURL(resolve(dir, 'sky.js')).href);
  const want = { 'moon tonight': 'moontonight', 'next full moon': 'moontonight', 'sunrise and sunset': 'suntimes', 'aurora forecast': 'aurora', 'what\'s that constellation': 'constellation', 'meteor showers this month': 'meteors', 'next eclipse': 'eclipse' };
  assert.equal(chips().length, 7);
  for (const [label, ask] of chips()) { assert.ok(label); assert.equal(route(ask), want[ask], `${label}: "${ask}"`); }
});

test('the card carries a definition, a take with a checkable fact, the live row and the chips', async () => {
  const sky = await import(pathToFileURL(resolve(dir, 'sky.js')).href);
  const date = new Date('2026-01-15T21:30:00Z'), rows = sky.nowLines(date, LONDON);
  const html = sky.cardHtml(esc, { place: LONDON, date, rows: rows.lines });
  assert.match(html, /<h2>Sky<\/h2>/); assert.match(html, /a simulation/);
  assert.ok(html.includes(esc(sky.DEFINITION)));
  assert.match(html, /Right now, where you are/);
  assert.equal((html.match(/data-ask="/g) || []).length, 7);
  assert.match(html, /<form class="skyplace"/); assert.match(html, /data-look="left"/);
  const take = sky.takeFor(51.5);
  assert.equal(take.siderealGain, 236, 'the stars gain 3 min 56 s a night'); assert.match(take.html, /3 minutes 56 seconds earlier/);
  assert.match(take.html, /stands 52° above your north horizon/);
  assert.match(sky.takeFor(-43.5).html, /44° above your south horizon/);
  // the fact in the take, checked against the almanac: a sidereal day is 236 seconds shorter than a solar day
  const day = (A.gmst(new Date(Date.UTC(2026, 0, 2))) - A.gmst(new Date(Date.UTC(2026, 0, 1)))) % 360;
  near(day / 360 * 86400, 236, 1);
  assert.ok(rows.lines.length >= 4 && rows.lines.every((l) => typeof l === 'string' && l.length > 10));
  assert.match(rows.lines[0], /^The sun is \d+° below the horizon \(night\)\.$/);
  assert.match(rows.lines[1], /^The moon is [a-z ]+, \d+% lit, /);
});
function near(got, want, tol) { assert.ok(Math.abs(got - want) <= tol, `${got} vs ${want}`); }

test('the live row at noon says the sun is up and names no planets to look for', async () => {
  const sky = await import(pathToFileURL(resolve(dir, 'sky.js')).href);
  const r = sky.nowLines(new Date('2026-06-21T12:00:00Z'), LONDON).lines;
  assert.match(r[0], /^The sun is 6\d° up, to the south \(day\)\.$/);
  assert.match(r[2], /sky is still too bright/);
  assert.match(r[3], /^Sunset today at 9:2\d PM, in \d+ hours\.$/);
});

test('a place is found inside an ask, and Unicode names survive', () => {
  assert.deepEqual(splitPlace('Aurora forecast for Tromsø'), { core: 'aurora forecast', place: 'Tromsø' });
  assert.deepEqual(splitPlace('moon tonight'), { core: 'moon tonight', place: null });
  assert.deepEqual(splitPlace('sunset in Oslo'), { core: 'sunset', place: 'Oslo' });
  assert.equal(splitPlace('what is in the sky').place, null);
  assert.equal(splitPlace('moon phase for tonight').place, null, 'a time is not a place');
});

test('the moon: tonight and the next phases agree with the almanac, and the picture lights the right side', async () => {
  const m = await import(pathToFileURL(resolve(dir, 'moontonight.js')).href), date = new Date('2025-10-10T15:00:00Z');
  for (const t of m.default.examples) assert.equal(route(t), 'moontonight', t);
  for (const t of m.default.nearMisses) assert.notEqual(route(t), 'moontonight', t);
  assert.equal(route('explain moon phases'), 'moon', 'the lesson skill keeps its own asks');
  assert.deepEqual(m.moonAsk('when is the next full moon'), { kind: 'next', phase: 'full', place: null });
  assert.deepEqual(m.moonAsk('next new moon in Oslo'), { kind: 'next', phase: 'new', place: 'Oslo' });
  const a = m.moonAnswer(date, LONDON);
  assert.match(a.lines[0], /^Waning gibbous: 8\d% of the moon is lit, 1\d days into the cycle\.$/);
  near(+a.full, Date.parse('2025-11-05T13:19:46Z'), 3 * 60000);                    // the almanac's full moon
  near(+a.neu, Date.parse('2025-10-21T12:25:00Z'), 3 * 60000);
  const next = m.nextPhaseAnswer(date, LONDON, 'full');
  assert.match(next.lines[0], /^The next full moon is Wednesday, November 5, 2025, at 1:\d\d PM \(in 26 days\)\.$/);
  // the lit side: waxing is on the right in the north, on the left in the south; full and new are a disc and a dark disc
  const wax = moonSvg(0.3, true), wane = moonSvg(0.3, false), south = moonSvg(0.3, true, true);
  assert.notEqual(wax, wane); assert.equal(wax.replace(/A30 30 0 0 1/, ''), wax.replace(/A30 30 0 0 1/, '')); assert.match(wax, /A30 30 0 0 1 /); assert.match(wane, /A30 30 0 0 0 /); assert.match(south, /A30 30 0 0 0 /);
  assert.match(moonSvg(1, true), /<circle cx="36" cy="36" r="30" fill="#f2efe3"\/>/); assert.doesNotMatch(moonSvg(0, true), /f2efe3/);
});

test('sunrise and sunset: London in October and the polar day', async () => {
  const s = await import(pathToFileURL(resolve(dir, 'suntimes.js')).href), date = new Date('2025-10-10T15:00:00Z');
  for (const t of s.default.examples) assert.equal(route(t), 'suntimes', t);
  for (const t of s.default.nearMisses) assert.notEqual(route(t), 'suntimes', t);
  assert.equal(route('sunset in Paris'), 'worldtime', 'a named place stays with the world clock');
  const a = s.sunAnswer(date, LONDON);
  assert.match(a.lines[0], /^Sunrise: tomorrow, 7:17 AM \(in 15 hours\)\.$/);       // the almanac: 06:17:54 UTC on 11 Oct, 07:17 BST
  assert.match(a.lines[1], /^Sunset: today, 6:17 PM \(in 2 hours\)\.$/);              // 17:17:33 UTC
  assert.match(a.lines[2], /^The day is 11 hours \d+ minutes? long\.$/);
  assert.match(s.sunAnswer(new Date('2024-06-21T10:00:00Z'), TROMSO).lines[0], /polar day/);
  assert.match(s.sunAnswer(new Date('2024-12-21T10:00:00Z'), TROMSO).lines[0], /polar night/);
});

test('aurora: NOAA\'s two feed shapes, how far the oval reaches, and a clear verdict', async () => {
  const au = await import(pathToFileURL(resolve(dir, 'aurora.js')).href);
  for (const t of au.default.examples) assert.equal(route(t), 'aurora', t);
  for (const t of au.default.nearMisses) assert.notEqual(route(t), 'aurora', t);
  const rows = au.parseKp([['time_tag', 'Kp', 'a_running', 'station_count'], ['2025-10-10 12:00:00.000', '3.00', '15', '8'], ['2025-10-10 15:00:00.000', '5.33', '56', '8']]);
  assert.deepEqual(rows.map((r) => r.kp), [3, 5.33]); assert.equal(+rows[1].t, Date.parse('2025-10-10T15:00:00Z'));
  assert.deepEqual(au.parseKp([{ time_tag: '2025-10-10T18:00:00', kp: 6, observed: 'predicted' }]).map((r) => [r.kp, r.predicted]), [[6, true]]);
  assert.deepEqual(au.parseKp(null), []); assert.deepEqual(au.parseKp([['x']]), []); assert.deepEqual(au.parseKp('nope'), []);
  const date = new Date('2025-10-10T20:00:00Z'), fc = au.parseKp([['time_tag', 'kp', 'observed', 'noaa_scale'], ['2025-10-10 21:00:00', '6.00', 'predicted', 'G2']]);
  assert.equal(au.reach(69.65, 18.96).overhead, 0, 'Tromsø is under the oval at any Kp');
  assert.equal(au.reach(51.5, -0.1).overhead, 7); assert.equal(au.reach(51.5, -0.1).horizon, 4);
  assert.equal(au.reach(-43.5, 172.6).overhead, null);
  const l = au.auroraAnswer(date, LONDON, rows, fc).lines.join(' ');
  assert.match(l, /Kp measured 5 hours ago: 5\.3/); assert.match(l, /peaks at Kp 6\.0/); assert.match(l, /Possibly: low on the north horizon/);
  assert.match(au.auroraAnswer(date, TROMSO, rows, fc).lines.join(' '), /Yes: overhead/);
  assert.match(au.auroraAnswer(date, CHCH, rows, fc).lines.join(' '), /Unlikely from here/);
  assert.match(au.auroraAnswer(date, LONDON, [], []).lines[0], /could not read NOAA/, 'no feed: it says so and does not invent a Kp');
});

test('constellations: what is up, where Orion is and when it is best, and the name table matches the star table', async () => {
  const c = await import(pathToFileURL(resolve(dir, 'constellation.js')).href), { CONSTELLATIONS } = await import('../void-live-deploy/lib/stars.js');
  assert.deepEqual(c.NAMES, CONSTELLATIONS);
  for (const t of c.default.examples) assert.equal(route(t), 'constellation', t);
  for (const t of c.default.nearMisses) assert.notEqual(route(t), 'constellation', t);
  assert.deepEqual(c.constAsk('where is Orion'), { kind: 'one', abbr: 'Ori', place: null });
  assert.deepEqual(c.constAsk('find the southern cross'), { kind: 'one', abbr: 'Cru', place: null });
  assert.equal(c.constAsk('where is Boötes').abbr, 'Boo');
  assert.equal(c.reachOf(51.5, 5).valueOf(), 'rises'); assert.equal(c.reachOf(51.5, -60), 'never'); assert.equal(c.reachOf(51.5, 80), 'circumpolar'); assert.equal(c.reachOf(-35, -80), 'circumpolar');
  // Orion's middle (right ascension 82.5 degrees): the sun stands at 262.5 degrees on 15 December (the almanac: 261.84 on the 14th at noon, 262.94 on the 15th) and at 307.5 on 25 January (307.63)
  const s = c.seasonOf(82.5, 2026);
  assert.equal(s.midnight.toISOString().slice(5, 10), '12-15'); assert.equal(s.nine.toISOString().slice(5, 10), '01-25');
  const date = new Date('2026-01-15T21:00:00Z'), one = await c.oneAnswer(date, LONDON, 'Ori');
  assert.match(one.lines.join(' '), /look for Rigel, Betelgeuse, Bellatrix/); assert.match(one.lines.join(' '), /Right now it is 4\d° up, to the south/);
  assert.match((await c.oneAnswer(date, LONDON, 'Cru')).lines.join(' '), /never rises above the horizon from here/);
  assert.match((await c.oneAnswer(date, CHCH, 'Cru')).lines.join(' '), /never sets/);
  const list = await c.listAnswer(date, LONDON); assert.ok(list.lines.some((l) => /^Orion: Rigel is 3\d° up, to the south\.$/.test(l)));
  assert.match((await c.listAnswer(new Date('2026-01-15T12:00:00Z'), LONDON)).lines[0], /no constellation is showing yet/);
});

test('meteor showers: the right ones on the right days, the moon at the peak, and the radiant', async () => {
  const m = await import(pathToFileURL(resolve(dir, 'meteors.js')).href);
  for (const t of m.default.examples) assert.equal(route(t), 'meteors', t);
  for (const t of m.default.nearMisses) assert.notEqual(route(t), 'meteors', t);
  assert.deepEqual(m.meteorAsk('when are the perseids'), { kind: 'one', shower: 'perseids', place: null });
  assert.deepEqual(m.meteorAsk('geminids meteor shower'), { kind: 'one', shower: 'geminids', place: null });
  const a = m.meteorAnswer(new Date('2025-08-10T20:00:00Z'), LONDON, { kind: 'month' }).lines.join('\n');
  assert.match(a, /Perseids: peak in 2 days, up to about 100 an hour/);
  const g = m.meteorAnswer(new Date('2025-12-10T20:00:00Z'), LONDON, { kind: 'one', shower: 'geminids' }).lines.join('\n');
  assert.match(g, /Geminids peak around December 14, up to about 150/); assert.match(g, /The moon at the peak: \d+% lit/); assert.match(g, /The radiant is \d+° up/);
  assert.match(m.meteorAnswer(new Date('2025-03-01T20:00:00Z'), null, { kind: 'month' }).lines.join('\n'), /No major meteor shower is active right now\.\nNext peak: Lyrids on April 22/);
});

test('eclipses: the next total solar eclipse is 12 August 2026, and the lunar one is visible or missed by the moon\'s height', async () => {
  const e = await import(pathToFileURL(resolve(dir, 'eclipse.js')).href), date = new Date('2026-01-10T12:00:00Z');
  for (const t of e.default.examples) assert.equal(route(t), 'eclipse', t);
  for (const t of e.default.nearMisses) assert.notEqual(route(t), 'eclipse', t);
  assert.deepEqual(e.eclipseAsk('next total solar eclipse'), { which: 'solar', kind: 'total', place: null, year: null });
  const solar = e.nextEclipses(date, e.eclipseAsk('next total solar eclipse'));
  assert.equal(solar[0].at.toISOString().slice(0, 10), '2026-08-12'); assert.equal(solar[1].at.toISOString().slice(0, 10), '2027-08-02');
  const lunar = e.nextEclipses(date, e.eclipseAsk('next lunar eclipse'));
  assert.equal(lunar[0].at.toISOString().slice(0, 10), '2026-03-03');
  assert.match(e.eclipseLine(lunar[0], date, LONDON), /below your horizon, so you will miss the peak/);                // 11:33 UTC: the moon has set in London
  assert.match(e.eclipseLine(lunar[0], date, { lat: -33.9, lon: 151.2, tz: 'Australia/Sydney', name: 'Sydney' }), /moon is \d+° up/);   // 22:33 in Sydney: up
  assert.match(e.eclipseLine(solar[0], date, LONDON), /about 2100 km from where it is greatest.*may see a partial eclipse/);
  assert.match(e.eclipseLine(solar[0], date, { lat: -33.9, lon: 151.2, tz: 'Australia/Sydney', name: 'Sydney' }), /too far to expect to see it|below your horizon/);
  near(e.greatCircleKm(51.5, -0.1, 40.7, -74), 5570, 30);
});

test('small helpers say what they mean', () => {
  assert.equal(agoWords(30 * 60000), '30 minutes ago'); assert.equal(agoWords(5 * 3600000), '5 hours ago'); assert.equal(agoWords(1000), 'just now');
  assert.equal(inWords(40 * 60000), 'in 40 minutes'); assert.equal(inWords(3 * 86400000), 'in 3 days');
  assert.equal(compass(0), 'N'); assert.equal(compass(225), 'SW'); assert.equal(compassWord(112.5), 'east-southeast');
  assert.equal(lightName(10), 'day'); assert.equal(lightName(-3), 'civil twilight'); assert.equal(lightName(-9), 'nautical twilight'); assert.equal(lightName(-15), 'astronomical twilight'); assert.equal(lightName(-30), 'night');
  assert.equal(dayWord(new Date('2025-10-10T20:00:00Z'), new Date('2025-10-10T09:00:00Z'), 'Europe/London'), 'today');
});
