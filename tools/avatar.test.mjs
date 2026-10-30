// The battle avatars (void-live-deploy/lib/avatar.js): a site's fighter face from its host, the same every time, and Verse's atom-galaxy mark.
// Run: node --test tools/avatar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { faceSvg, verseFace, hashOf, SKIN, HAIR } from '../void-live-deploy/lib/avatar.js';

const hosts = ['translate.google.com', 'calculator.net', 'isitchristmas.com', 'justflipacoin.com', 'random.org', 'github.com', 'claude.ai', 'perchance.org', 'weather.gov', 'color-hex.com', 'wordcounter.net', 'huggingface.co'];
test('same seed, same face; different seeds, different faces; the picture is a labelled SVG image with no script in it', () => {
  assert.equal(faceSvg('translate.google.com'), faceSvg('translate.google.com'));
  assert.equal(faceSvg('Translate.Google.com '), faceSvg('translate.google.com'), 'case and spacing do not change the face');
  const all = new Set(hosts.map((h) => faceSvg(h))); assert.equal(all.size, hosts.length, 'every host has its own face');
  for (const h of hosts) { const s = faceSvg(h); assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100" width="64" height="64" role="img" aria-label="/); assert.match(s, new RegExp(h.replace(/\./g, '\\.') + "'s fighter")); assert.doesNotMatch(s, /<script|javascript:|on\w+=/i); assert.match(s, /<\/svg>$/); }
  assert.equal(hashOf('a'), hashOf('a')); assert.notEqual(hashOf('a'), hashOf('b'));
});
test('size is respected, facing mirrors the face, and the label is escaped', () => {
  assert.match(faceSvg('x.example', { size: 24 }), /width="24" height="24"/); assert.match(faceSvg('x.example', { size: 56.4 }), /width="56" height="56"/);
  assert.match(faceSvg('x.example', { facing: 'left' }), /<g transform="translate\(100 0\) scale\(-1 1\)">/); assert.doesNotMatch(faceSvg('x.example'), /scale\(-1 1\)/);
  assert.match(faceSvg('<b>"x"</b>'), /aria-label="&lt;b&gt;&quot;x&quot;&lt;\/b&gt;'s fighter"/);
  assert.match(faceSvg('x', { label: 'a fighter' }), /aria-label="a fighter"/);
});
test('every feature the hash can pick exists: no face is ever drawn with an undefined colour or shape (a signed XOR once picked index -3)', () => {
  for (let i = 0; i < 400; i++) { const s = faceSvg('site' + i + '.example'); assert.doesNotMatch(s, /undefined|NaN/, 'site' + i); assert.ok(SKIN.some((c) => s.includes(c)) && HAIR.some((c) => s.includes(c)), 'site' + i + ' has a skin and a hair tone'); }
  // the seeds spread across the sets: at least four skins, four hairs and three mouths among 400 faces
  const skins = new Set(), hairs = new Set(); for (let i = 0; i < 400; i++) { const s = faceSvg('s' + i); skins.add(SKIN.find((c) => s.includes(c))); hairs.add(HAIR.find((c) => s.includes(c))); }
  assert.ok(skins.size >= 4 && hairs.size >= 4, JSON.stringify([[...skins], [...hairs]]));
});
test("Verse's face is its atom galaxy: three orbits in violet, electric blue and gold round a nucleus, labelled Verse, sized as asked", () => {
  const v = verseFace({ size: 56 });
  assert.match(v, /role="img" aria-label="Verse"/); assert.match(v, /width="56" height="56"/);
  for (const hue of [275, 205, 44]) assert.match(v, new RegExp('hsl\\(' + hue + ' 90% 66%\\)'));
  assert.equal((v.match(/<ellipse cx="50" cy="50" rx="41" ry="13"/g) || []).length, 6, 'each orbit drawn twice: a glow under a line');
  assert.doesNotMatch(v, /<script|undefined|NaN/i); assert.equal(verseFace(), verseFace());
  assert.notEqual(v, faceSvg('verse', { size: 56 }), "Verse's mark is not a hashed fighter");
});
