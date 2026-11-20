// The visitor's video maker on /video/ (lib/video-maker.js pure parts; video/maker.js and video/voice-worker.js in the browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sentencesOf, worth, scriptFrom, scriptOwn, isScript, chunks, chunkAt, timeline, keywords, photoOk, creditOf } from '../void-live-deploy/lib/video-maker.js';

const WOW = 'The Wow! signal was a strong narrowband radio signal detected on August 15, 1977, by the Big Ear radio telescope in Ohio. It lasted for the full 72-second window. Astronomer Jerry R. Ehman circled the reading on a printout and wrote "Wow!" beside it. Despite more than 50 later searches, the signal was never detected again. The telescope was built on a golf course. The signal came from the constellation Sagittarius.';

test('a topic becomes what it is, the best lines in order, and the most surprising line last', () => {
  const s = scriptFrom('Wow! signal', WOW);
  assert.match(s.lines[0], /^The Wow! signal was/);
  assert.match(s.lines[s.lines.length - 1], /^And the best part\? /);
  assert.ok(s.lines.length >= 4 && s.lines.length <= 6);
  assert.equal(scriptFrom('x', 'Too short.'), null);
  assert.ok(worth('It lasted for the full 72-second window.') > worth('The telescope was built on a golf course.'));
  assert.deepEqual(sentencesOf('Mercury (planet) is the smallest planet in the Solar System [1]. Yes.'), ['Mercury is the smallest planet in the Solar System.']);
});

test('the visitor\'s own script keeps a scene per sentence; a short phrase is a topic, not a script', () => {
  const s = scriptOwn('In 1977 a telescope in Ohio heard a signal for 72 seconds. An astronomer circled it in red pen and wrote Wow. Nobody has heard it again since.');
  assert.equal(s.lines.length, 3);
  assert.equal(isScript('Wow! signal'), false); assert.equal(isScript('the moon landing'), false);
  assert.equal(isScript('The cat sat on the mat. Then it left the room.'), true);
});

test('captions are a few words at a time, timed by characters; scenes leave a breath and an end card', () => {
  const c = chunks('Despite more than 50 later searches, the signal was never detected again.');
  assert.ok(c.every((x) => x.length <= 22)); assert.equal(c.join(' '), 'Despite more than 50 later searches, the signal was never detected again.');
  assert.equal(chunkAt(c, 0, 4), c[0]); assert.equal(chunkAt(c, 3.99, 4), c[c.length - 1]);
  const t = timeline([2, 3]);
  assert.deepEqual(t.scenes.map((s) => [s.start, s.end]), [[0.7, 2.7], [3.05, 6.05]]);
  assert.equal(t.total, 9.05);
});

test('photos: real pictures from the article, credited; no icons, logos, flags or maps', () => {
  assert.equal(photoOk({ url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Wow_signal.jpg?utm_source=x', width: 1024 }), true);
  assert.equal(photoOk({ url: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Commons-logo.svg', width: 1024 }), false);
  assert.equal(photoOk({ url: 'https://upload.wikimedia.org/x/Flag_of_Ohio.png', width: 900 }), false);
  assert.equal(photoOk({ url: 'https://upload.wikimedia.org/x/tiny.jpg', width: 180 }), false);
  assert.equal(creditOf({ Artist: { value: '<a href="x">Big Ear</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } }), 'Photo: Big Ear, CC BY-SA 4.0');
  assert.deepEqual(keywords('Astronomer Jerry Ehman circled the reading'), ['astronomer', 'circled']);
});

test('the page: the maker first, a clean end card, no false claim, the voice off the page thread', () => {
  const page = readFileSync(new URL('../void-live-deploy/video/index.html', import.meta.url), 'utf8');
  const maker = readFileSync(new URL('../void-live-deploy/video/maker.js', import.meta.url), 'utf8');
  assert.ok(page.indexOf('id="maker"') < page.indexOf('id="prompt"'));
  assert.match(page, /<script type="module" src="\/video\/maker\.js"><\/script>/);
  assert.doesNotMatch(page + maker, /make any video|any video free/i);
  assert.match(maker, /'Verse'/); assert.match(maker, /'a-to-mind\.com'/);
  assert.match(maker, /new Worker\('\/video\/voice-worker\.js'/);
});

test('the maker is on the Videos page too, which strangers can open (the other full pages are behind UniVerse)', () => {
  const films = readFileSync(new URL('../void-live-deploy/films/index.html', import.meta.url), 'utf8');
  assert.ok(films.indexOf('id="maker"') < films.indexOf('id="films"'));
  for (const id of ['mkText', 'mkVoice', 'mkGo', 'mkNote', 'mkCanvas', 'mkOut', 'mkVideo', 'mkDl', 'mkShare', 'mkCredits']) assert.match(films, new RegExp('id="' + id + '"'));
  assert.match(films, /<script type="module" src="\/video\/maker\.js"><\/script>/);
  assert.doesNotMatch(films, /make any video|any video free/i);
});
