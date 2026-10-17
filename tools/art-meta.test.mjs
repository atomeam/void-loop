// Card art follows the item's real metadata (lib/art-meta.js, lib/card-art.js ink, lib/card-frame.js). node --test tools/art-meta.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { genreHue, decadeOf, inkOfDecade, artLook, GENRE_HUES } from '../void-live-deploy/lib/art-meta.js';
import { artSvg, RARITY_LOOK } from '../void-live-deploy/lib/card-art.js';
import { cardOf, chromeHtml } from '../void-live-deploy/lib/card-frame.js';
const esc = (s) => String(s);

test('genre words and years map to a hue and an ink, and nothing else', () => {
  assert.equal(genreHue('Horror, Thriller'), 350); assert.equal(genreHue('Science Fiction'), 190); assert.equal(genreHue('Hip-Hop/Rap'), 280); assert.equal(genreHue('Jazz'), 215);
  assert.equal(genreHue(''), null); assert.equal(genreHue(undefined), null); assert.equal(genreHue('Zydeco polka'), null);
  assert.ok(GENRE_HUES.every(([, h]) => h >= 0 && h < 360));
  assert.deepEqual([decadeOf('1994'), decadeOf(1972), decadeOf('99'), decadeOf('abcd'), decadeOf('3000'), decadeOf(null)], [1990, 1970, null, null, null, null]);
  assert.deepEqual([1950, 1970, 1980, 1990, 2000, 2010, 2020].map(inkOfDecade), ['mythic', 'rare', 'rare', 'uncommon', 'uncommon', 'common', 'common']);
  assert.equal(inkOfDecade(null), null);
  for (const k of ['mythic', 'rare', 'uncommon', 'common']) assert.ok(RARITY_LOOK[k], 'ink keys are the existing looks');
});
test('a look is deterministic and says only what drove it', () => {
  const a = artLook({ genre: 'Horror', year: '1982' }), b = artLook({ genre: 'Horror', year: '1982' });
  assert.deepEqual(a, b); assert.deepEqual(a, { hue: 350, ink: 'rare', decade: 1980, why: 'genre Horror, 1980s' });
  assert.deepEqual(artLook({}), { hue: null, ink: null, decade: null, why: '' }); assert.deepEqual(artLook({ genre: 'Pop' }), { hue: 315, ink: null, decade: null, why: 'genre Pop' });
});
test('the art differs with the metadata, is identical for the same item, and ink leaves the foil to the rating', () => {
  const base = { key: 'film:x', kind: 'Film', rarity: 'checked' };
  const plain = artSvg(base), horror80 = artSvg({ ...base, ...pick(artLook({ genre: 'Horror', year: '1982' })) }), comedy10 = artSvg({ ...base, ...pick(artLook({ genre: 'Comedy', year: '2015' })) });
  assert.equal(horror80, artSvg({ ...base, ...pick(artLook({ genre: 'Horror', year: '1982' })) }), 'same item, same art');
  assert.notEqual(plain, horror80); assert.notEqual(horror80, comedy10);
  assert.equal(artSvg({ ...base, ink: 'nonsense' }), plain, 'an unknown ink changes nothing');
  assert.ok(artSvg({ ...base, ink: 'mythic' }).includes('stroke="#000000"') && artSvg({ ...base, ink: 'common' }).includes('stroke="#44444f"'));
  assert.ok(artSvg({ ...base, ink: 'common' }).includes('stop-color="' + RARITY_LOOK.rare.foil[0] + '"'), 'the rare foil stays');
  function pick(l) { return { hue: l.hue ?? undefined, ink: l.ink || undefined }; }
});
test('the frame passes a film or song\'s genre and year to its art, and a card without them is unchanged', () => {
  const song = cardOf({ artKind: 'Song', artMeta: { genre: 'Jazz', year: '1959' } });
  assert.equal(song.artHue, 215); assert.equal(song.artInk, 'mythic'); assert.equal(song.hue, cardOf({ artKind: 'Song' }).hue, 'the frame\'s own hue is untouched');
  assert.notEqual(chromeHtml({ ...song, key: 'k', typeLine: 'Song' }, esc).art, chromeHtml({ ...cardOf({ artKind: 'Song' }), key: 'k', typeLine: 'Song' }, esc).art);
  const none = cardOf({ artKind: 'Film', artMeta: { genre: '', year: '' } }); assert.ok(none.artHue == null && none.artInk == null);
  assert.equal(cardOf({ artMeta: { genre: 'Jazz', year: '1959' } }).artHue, undefined, 'no kind of its own: no change');
});
