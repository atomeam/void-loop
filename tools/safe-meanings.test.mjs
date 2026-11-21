// Safety and clean-card meanings. Run: node --test tools/safe-meanings.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { flagsOf, isSafe, noPhotoAsk, isShockHost, mayCorrectTypo, adultIntent, entityFromAdultAsk } from '../void-live-deploy/lib/content-safety.js';
import { leadOf, isHijack, plainTitle, stripCites, firstSentence, arrange, meaningsFor } from '../void-live-deploy/lib/safe-meanings.js';
import { mayShowLicensedAdultImage, isVerifiedAdult, isFreeReuseLicense, fromCommonsMeta } from '../void-live-deploy/lib/cos-20.js';

const titles = (rows) => rows.map((r) => r.title);
const row = (title, extract) => ({ title, extract });

test('flagged entries stay off the list; ordinary names and works stay on', () => {
  assert.ok(isShockHost('https://www.rotten.com/x'));
  assert.ok(flagsOf({ title: 'Rotten.com' }).includes('shock'));
  for (const title of ['Dick pic', 'Breast torture', 'Coprophilia', 'Shemale (porn)', 'Boobs on Bikes']) assert.equal(isSafe({ title }), false, title);
  assert.ok(!isSafe({ title: 'X', categories: [{ title: 'Category:Pornography' }] }));
  assert.ok(!isSafe({ title: 'X', text: 'the slur nigger is used here' }));
  for (const title of ['Moby-Dick', 'Dick Van Dyke', 'Philip K. Dick', 'Breast', 'Boobs! The Musical', 'YouTube Poop', 'Poop deck']) {
    assert.equal(isSafe({ title, text: 'A normal encyclopedia sentence.' }), true, title);
  }
});

test('noPhotoAsk is fail-closed for body, nudity and sex asks, but not ordinary names', () => {
  for (const ask of ['nude beach', 'titties', 'boobs', 'dick', 'naked', 'porn', 'breast', 'naked boobs']) assert.equal(noPhotoAsk(ask), true, ask);
  for (const ask of ['pluto', 'baseball', 'the matrix', 'Moby-Dick', 'Dick Van Dyke']) assert.equal(noPhotoAsk(ask), false, ask);
});

test('titties, boobs and naked boobs go to Breast, never an episode or typo-dodge', () => {
  assert.equal(leadOf('titties').title, 'Breast');
  assert.equal(plainTitle('titties', { title: 'Titties and Dragons' }), 'Breast');
  assert.equal(isHijack('titties', { title: 'Titties and Dragons' }), true);
  assert.equal(plainTitle('naked boobs', { title: 'The Books of the Named' }), 'Breast');
  assert.equal(plainTitle('naked boobs', null), 'Breast');
  const list = arrange('boobs', [
    { title: 'Breast torture' }, { title: 'Shemale (porn)' }, { title: 'Rotten.com', url: 'https://rotten.com/' },
    { title: 'Boobs on Bikes' }, row('Breast', 'The breast is an organ. More follows.'),
    row('Boobs! The Musical', 'Boobs! The Musical is a comedy revue.'), { title: 'BDSM text', text: 'BDSM and bondage.' },
  ]);
  assert.deepEqual(titles(list), ['Breast', 'Boobs! The Musical']);
  assert.equal(list[0].note, 'The breast is an organ.');
});

test('dick and poop lists are curated and crude entries are gone', () => {
  const dick = arrange('dick', [
    { title: 'Dick pic' }, row('Dick Cheney', 'Richard Bruce Cheney is an American politician.'),
    row('Moby-Dick', 'Moby-Dick is an 1851 novel by Herman Melville.'), row('Dick Van Dyke', 'Richard Wayne Van Dyke is an American actor.'),
    row('Philip K. Dick', 'Philip Kindred Dick was an American writer.'), row('Dick Grayson', 'Dick Grayson is a fictional character.'),
    row('Dick (nickname)', 'Dick is a nickname for Richard.'), { title: 'Fishing', extract: 'close-range file sharing is common. fishing on the Snake River is nearby.' },
  ]);
  assert.deepEqual(titles(dick), ['Moby-Dick', 'Dick Van Dyke', 'Philip K. Dick', 'Dick Grayson', 'Dick Cheney', 'Dick (nickname)']);
  assert.equal(dick[0].note, 'Moby-Dick is an 1851 novel by Herman Melville.');
  const poop = arrange('poop', [
    { title: 'Coprophilia' }, row('Anus', 'The anus is an opening.'), row('Feces', 'Feces are the solid waste of an animal.'),
    row('Poop deck', 'The poop deck is a stern deck on a sailing ship.'), row('YouTube Poop', 'YouTube Poop is a style of video mashup.'),
    row('Kopi luwak', 'Kopi luwak is coffee made from cherries eaten by civets.'), row('Pooper-scooper', 'A pooper-scooper is a tool for picking up pet feces.'),
    row('Pile of Poo', 'The pile of poo is an emoji.'),
  ]);
  assert.deepEqual(titles(poop), ['Pile of Poo', 'Feces', 'Poop deck', 'YouTube Poop', 'Kopi luwak', 'Pooper-scooper']);
});

test('cites are stripped, notes are a first sentence, typo only fixes misspellings, adult intent is first', () => {
  assert.equal(stripCites('The breast is an organ[1][2][3] on the chest.'), 'The breast is an organ on the chest.');
  assert.equal(firstSentence('A novel.[1] Archived from the original on May 1, 2020. More.'), 'A novel.');
  assert.ok(!/S2CID/.test(firstSentence('A review (S2CID 4343329) of the work. Next.')));
  const note = firstSentence('close-range file sharing between two devices is common. fishing on the Snake River…');
  assert.match(note, /\.$/);
  assert.ok(!note.includes('…') && !note.includes('fishing on the Snake River'));
  for (const [a, b] of [['naked boobs', 'named books'], ['the matrix', 'the matrices'], ['ice cream', 'ice creams'], ['baseball', 'based ball'], ['big boobs', 'big bobs'], ['black boobs', 'Boobs in the Wood']]) assert.equal(mayCorrectTypo(a, b), false, a);
  for (const [a, b] of [['avacado', 'avocado'], ['nxiety', 'anxiety'], ['avacado toast', 'avocado toast'], ['gianna micheals boobs', 'gianna michaels']]) assert.equal(mayCorrectTypo(a, b), true, a);
  for (const ask of ['boobs', 'black boobs', 'big boobs', 'naked boobs', 'naked penis', 'porn magazine']) assert.equal(adultIntent(ask), true, ask);
  assert.equal(adultIntent('the matrix'), false);
  assert.equal(entityFromAdultAsk('black boobs'), '');
  assert.equal(entityFromAdultAsk('gianna micheals boobs'), 'gianna micheals');
  assert.equal(plainTitle('black boobs', { title: 'Boobs in the Wood' }), 'Breast');
  assert.equal(plainTitle('big boobs', { title: "Bob's Big Boy" }), 'Breast');
});

test('meaningsFor prefers a first-sentence extract over a mid-sentence snippet', async () => {
  const get = async () => ({ query: { pages: {
    1: { pageid: 1, title: 'Moby-Dick', extract: 'Moby-Dick is an 1851 novel by Herman Melville.', categories: [] },
    2: { pageid: 2, title: 'Dick pic', extract: 'A sexually explicit photo.', categories: [{ title: 'Category:Pornography' }] },
  } } });
  const list = await meaningsFor('dick', { search: [{ title: 'Moby-Dick', note: 'close-range file sharing…' }, { title: 'Dick pic' }], fetch: get });
  assert.equal(list[0].title, 'Moby-Dick');
  assert.equal(list[0].note, 'Moby-Dick is an 1851 novel by Herman Melville.');
  assert.ok(!titles(list).includes('Dick pic'));
});

test('COS-20 only shows a licensed credited photo of a verified adult; minors stay blocked; licenceOf is the gate', () => {
  assert.equal(isVerifiedAdult({ birthYear: 1985 }), true); assert.equal(isVerifiedAdult({ birthYear: 2015 }), false);
  assert.equal(isFreeReuseLicense('CC BY-SA 4.0'), true); assert.equal(isFreeReuseLicense('CC BY-NC 4.0'), false);
  assert.equal(mayShowLicensedAdultImage({ src: 'https://upload.wikimedia.org/x.jpg', credit: 'Jane, CC BY-SA 4.0', license: 'CC BY-SA 4.0', birthYear: 1985, name: 'Jane' }), true);
  assert.equal(mayShowLicensedAdultImage({ src: 'https://x.com/leak.jpg', credit: 'a leaked set', license: 'CC BY 4.0', birthYear: 1985, name: 'Jane' }), false);
  assert.equal(mayShowLicensedAdultImage({ src: 'https://x.com/x.jpg', credit: 'Jane', license: 'CC BY-NC 4.0', birthYear: 1985, name: 'Jane' }), false);
  assert.equal(mayShowLicensedAdultImage({ src: 'https://x.com/x.jpg', credit: '', license: 'CC0', birthYear: 1985 }), false);
  assert.equal(mayShowLicensedAdultImage({ src: 'https://upload.wikimedia.org/x.jpg', credit: 'Jane', license: 'CC BY-SA 4.0', name: 'Jane', categories: 'Children' }), false);
  const hit = fromCommonsMeta({ url: 'https://upload.wikimedia.org/x.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'Jane' } } }, { birthYear: 1985, name: 'Jane', person: true });
  assert.equal(hit && hit.src, 'https://upload.wikimedia.org/x.jpg');
  assert.equal(fromCommonsMeta({ url: 'https://upload.wikimedia.org/x.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'Jane' }, Categories: { value: 'Children' } } }, { birthYear: 1985, name: 'Jane', person: true }), null);
});
