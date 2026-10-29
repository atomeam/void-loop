// is-it (skills/is-it.js, functions/is-it/[what].js): the one-word day answer, read from the device's clock, held to the real calendar on fixed
// dates; the word in the visitor's own language; the page that works with scripts off; the daily feed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import isItSkill, { isIt, easter, wordFor, flagOf, countdown, regionName, wave, waveLine, offsetMin } from '../void-live-deploy/skills/is-it.js';
import { onRequestGet, wallClock, langsOf, feed, lastDays, answerJson } from '../void-live-deploy/functions/is-it/[what].js';
import { clean } from '../void-live-deploy/lib/share.js';

const FRI = new Date(2026, 9, 23, 12); // Friday, October 23, 2026
test('is it christmas: NO with the days left and the date on a normal day, YES on the day', () => {
  const a = isIt('is it christmas?', FRI);
  assert.equal(a.yes, false); assert.equal(a.note, 'Christmas is in 63 days: Friday, December 25, 2026.'); assert.equal(a.today, 'Today is Friday, October 23, 2026.');
  assert.equal(isIt('is it christmas yet', new Date(2026, 11, 25, 9)).yes, true);
  assert.match(isIt('is it christmas', new Date(2026, 11, 26)).note, /in 364 days: Saturday, December 25, 2027/);
});
test('weekdays, the weekend, a leap year and the moving holidays', () => {
  assert.equal(isIt('is it friday', FRI).yes, true);
  assert.match(isIt('is it Monday?', FRI).note, /Monday is in 3 days/);
  assert.equal(isIt('is it the weekend', FRI).yes, false);
  assert.match(isIt('is it a leap year', FRI).note, /next leap year is 2028/);
  assert.match(isIt('is it thanksgiving', FRI).note, /Thursday, November 26, 2026/);
  assert.equal(easter(2027).toDateString(), 'Sun Mar 28 2027');
  assert.equal(easter(2024).toDateString(), 'Sun Mar 31 2024');
});
test('the word in the visitor\'s language, the flag of their region, the live countdown', () => {
  assert.equal(isIt('is it christmas in french', FRI).lang, 'fr');
  assert.deepEqual(wordFor(false, ['fr-CA', 'en']), { word: 'NON', lang: 'fr' });
  assert.equal(wordFor(true, ['de']).word, 'JA'); assert.equal(wordFor(false, ['pl']).word, 'NIE'); assert.equal(wordFor(false, ['tr']).word, 'HAYIR'); assert.equal(wordFor(false, ['id']).word, 'TIDAK');
  assert.equal(wordFor(false, ['xx']).word, 'NO');
  assert.equal(flagOf('en-CA'), '🇨🇦'); assert.equal(flagOf('fr'), '');
  assert.equal(countdown(new Date(2026, 11, 25), FRI), '62 days 12 hours'); assert.equal(countdown(FRI, FRI), '');
});
test('questions that are not about the day are left alone', () => {
  for (const a of ['is it going to rain', 'is it safe to eat raw eggs', 'is it cold in london', 'is it open', 'what is christmas', 'is it christmas in narnia']) assert.equal(isIt(a, FRI), null, a);
  for (const e of isItSkill.examples) assert.ok(isItSkill.match(e.toLowerCase(), e), e);
  for (const n of isItSkill.nearMisses) assert.ok(!isItSkill.match(n.toLowerCase(), n), n);
  for (const q of ['is it new years day', 'is it the weekend', 'is it thanksgiving']) assert.ok(isIt('is it ' + isIt(q, FRI).slug.replace(/-/g, ' '), FRI), 'the card\'s link for "' + q + '" resolves');
});
test('/is-it/<day>: a page that answers with scripts off, in the browser\'s language, and a daily feed', async () => {
  const get = (path, lang = 'fr-CA,fr;q=0.9') => onRequestGet({ request: new Request('https://a-to-mind.com' + path, { headers: { 'accept-language': lang } }), params: { what: new URL('https://x' + path).pathname.split('/').pop() } });
  const page = await (await get('/is-it/christmas')).text();
  assert.match(page, /<h1 id="w" style="--n:3">(?:NON|OUI)<\/h1>/); assert.match(page, /og:title" content="Is it Christmas\? (?:NON|OUI)"/); assert.match(page, /id="s">Share</); assert.match(page, /<html lang="fr">/);
  const rss = await get('/is-it/christmas.rss', 'en'); assert.match(rss.headers.get('content-type'), /rss/); assert.match(await rss.text(), /<item><title>(?:NO|YES)<\/title>/);
  assert.equal((await get('/is-it/narnia')).status, 404);
  assert.equal(wallClock(new Date('2026-12-24T23:30:00Z'), 'Asia/Tokyo').getDate(), 25, 'Tokyo is already on the 25th');
  assert.deepEqual(langsOf('fr-CA,fr;q=0.9,en;q=0.8'), ['fr-CA', 'fr', 'en']);
});
test('as isitchristmas.com: the feed carries the last ten days, the "on the day only" feed only YES days, and a JSON answer', async () => {
  const xmas = new Date(2026, 11, 27, 12), a = isIt('is it christmas', xmas), w = wordFor(a.yes, ['en']);
  const all = feed('christmas', a, w, 'https://a-to-mind.com', xmas), only = feed('christmas', a, w, 'https://a-to-mind.com', xmas, true);
  assert.equal(all.match(/<item>/g).length, 10); assert.match(all, /<item><title>YES<\/title><description>Today is Christmas\.<\/description><link>https:\/\/a-to-mind\.com\/is-it\/christmas#2026-12-25<\/link>/);
  assert.equal(only.match(/<item>/g).length, 1); assert.match(only, /christmas#2026-12-25/); assert.match(only, /\(Christmas only\)/);
  assert.equal(feed('christmas', a, w, 'https://x', FRI, true).match(/<item>/g), null, 'no YES day in the last ten: an empty feed, nothing to notify');
  assert.deepEqual(lastDays('christmas', xmas).map((x) => x.day).slice(0, 3), ['2026-12-27', '2026-12-26', '2026-12-25']);
  const j = answerJson('christmas', isIt('is it christmas', FRI), wordFor(false, ['de']), 'Europe/Berlin');
  assert.deepEqual([j.yes, j.word, j.next, j.zone, j.feed], [false, 'NEIN', '2026-12-25', 'Europe/Berlin', '/is-it/christmas.rss']);
  const get = (path) => onRequestGet({ request: new Request('https://a-to-mind.com' + path, { headers: { 'accept-language': 'en' } }), params: { what: new URL('https://x' + path).pathname.split('/').pop() } });
  const r = await get('/is-it/christmas.json'); assert.match(r.headers.get('content-type'), /json/); assert.equal(r.headers.get('access-control-allow-origin'), '*'); assert.equal(typeof (await r.json()).yes, 'boolean');
});
test('the flag turns, as on the old site: a cursor carries a whole number of 15° turns, never anything else; a region has its name', () => {
  assert.deepEqual(clean(JSON.stringify({ t: 'cursor', x: 0.5, y: 0.5, flag: 'FR', a: 45 })), { t: 'cursor', x: 0.5, y: 0.5, flag: 'FR', a: 45 });
  for (const a of [7, 400, '45', 1.5, null]) assert.equal('a' in clean(JSON.stringify({ t: 'cursor', x: 0.1, y: 0.1, a })), false, String(a));
  assert.equal(regionName('FR'), 'France'); assert.equal(regionName('CA'), 'Canada');
});
test('the midnight wave: Christmas reaches Kiritimati first and sweeps west, place by place, for two days', () => {
  assert.equal(wave(new Date('2026-10-24T12:00:00Z')).on, false);
  assert.equal(waveLine(wave(new Date('2026-12-24T09:30:00Z'))), 'Christmas reaches Kiritimati first, in 30 min, then sweeps west around the world.');
  const w = wave(new Date('2026-12-24T23:30:00Z'));
  assert.equal(waveLine(w), 'It is Christmas in 20 of 36 places right now. Next: London in 30 min.');
  assert.equal(w.places.find((p) => p.name === 'Auckland').state, 'now'); assert.equal(w.places.find((p) => p.name === 'New York').state, 'before');
  assert.equal(waveLine(wave(new Date('2026-12-26T10:30:00Z'))), 'It is Christmas in 1 of 36 places right now. It has reached everywhere.');
  assert.equal(wave(new Date('2026-12-26T12:00:00Z')).on, false);
  assert.equal(offsetMin('Asia/Tokyo', new Date('2026-12-25T00:00:00Z')), 540); assert.equal(offsetMin('Pacific/Auckland', new Date('2026-12-25T00:00:00Z')), 780, 'summer time in December');
});
