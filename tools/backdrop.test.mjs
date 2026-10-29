// node --test tools/backdrop.test.mjs: the painted backdrop (owner, 2026-10-25: "a static, beautifully lit 2D painted scene with fixed camera angles ...
// swap pre-rendered backdrops depending on the rung or theme"): the forge's rules for the kind (lib/art-rules.js, the way the poster has its own key,
// size and prompt), the asks, the record this browser keeps and where a card's shadow falls (lib/backdrop.js, skills/backdrop.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, kindWordOf, keyOfKind, sizeOfKind, artPrompt, backdropKey, backdropPrompt, BACKDROP_W, BACKDROP_H, BACKDROP_STYLE, FRAMING, undirected, refusal, POSTER_W, ART_W, ART_H, subjectKey } from '../void-live-deploy/lib/art-rules.js';
import { backdropOf, sceneRecord, parseScene, shadowRect, SHADOW, STORE_KEY } from '../void-live-deploy/lib/backdrop.js';
import backdrop, { whyLine } from '../void-live-deploy/skills/backdrop.js';

test('the forge knows the kind: backdrop (and scene, stage) is its own kind with its own row, a wide 16:9 size on the models\' grid of 16, and no Art Director scene', () => {
  assert.equal(KINDS.backdrop, 'a backdrop');
  for (const k of ['backdrop', 'Backdrop', 'scene', 'stage']) assert.equal(kindWordOf(k), 'backdrop', k);
  const key = subjectKey('Retro server room');
  assert.equal(keyOfKind(key, 'backdrop'), 'backdrop1 retro server room');
  assert.equal(backdropKey(''), '');
  assert.notEqual(keyOfKind(key, 'backdrop'), keyOfKind(key, 'poster'), 'a backdrop never replaces a poster of the same words');
  assert.notEqual(keyOfKind(key, 'backdrop'), keyOfKind(key, 'answer'), 'nor a card\'s painting');
  assert.deepEqual(sizeOfKind('backdrop'), [BACKDROP_W, BACKDROP_H]);
  assert.deepEqual([BACKDROP_W, BACKDROP_H], [1536, 864]); assert.equal(BACKDROP_W / BACKDROP_H, 16 / 9);
  assert.equal(BACKDROP_W % 16, 0); assert.equal(BACKDROP_H % 16, 0);
  assert.deepEqual(sizeOfKind('poster'), [POSTER_W, 1152], 'the poster keeps its tall size'); assert.deepEqual(sizeOfKind('answer'), [ART_W, ART_H]);
  assert.ok(undirected('backdrop') && undirected('poster') && undirected('cartoon') && !undirected('answer') && !undirected('place'));
});

test('the prompt: the named scene as a late-90s pre-rendered game background, one fixed camera, painted, the floor in the lower quarter, no people, no text; nothing typed but the folded subject', () => {
  const p = backdropPrompt('backdrop1 retro server room');
  assert.ok(p.startsWith('a retro server room as a pre-rendered late-1990s adventure game background'), p);
  assert.match(p, /fixed camera/); assert.match(p, /painted/); assert.match(p, /floor across the lower quarter/); assert.match(p, /no people/); assert.match(p, /no text/);
  assert.ok(p.endsWith(FRAMING)); assert.ok(p.includes(BACKDROP_STYLE));
  assert.equal(artPrompt('backdrop1 retro server room', 'backdrop'), p, 'artPrompt routes the kind');
  assert.equal(backdropPrompt('backdrop1 <b>x</b>; drop table'), 'a bxb drop table ' + BACKDROP_STYLE + ', ' + FRAMING, 'only letters, digits and spaces reach the painter');
  assert.equal(refusal('a pikachu rooftop', 'backdrop'), '', 'brands and characters are drawn (owner, 2026-10-25)');
  assert.equal(refusal('retro server room', 'backdrop'), '');
});

test('the asks: set the stage to / backdrop: / stage: / paint a backdrop of name the scene; clear the backdrop and back to the void clear it; the Draw card\'s "make it my backdrop" and questions are not it', () => {
  assert.deepEqual(backdropOf('set the stage to a retro server room'), { subject: 'retro server room' });
  assert.deepEqual(backdropOf('Backdrop: a cyberpunk rooftop'), { subject: 'cyberpunk rooftop' });
  assert.deepEqual(backdropOf('stage: an atmospheric study'), { subject: 'atmospheric study' });
  assert.deepEqual(backdropOf('paint a backdrop of a rainy harbour at night'), { subject: 'rainy harbour at night' });
  assert.deepEqual(backdropOf('set the scene to a quiet library please'), { subject: 'quiet library' });
  assert.deepEqual(backdropOf('change the scene to a snowy mountain pass'), { subject: 'snowy mountain pass' });
  assert.equal(backdropOf('set the background to #112233'), null, 'the background (a colour) is the stage-style skill\'s');
  for (const a of ['clear the backdrop', 'remove the backdrop', 'back to the void', 'plain void', 'backdrop: none', 'take off the scene']) assert.deepEqual(backdropOf(a), { clear: true }, a);
  for (const a of ['make it my backdrop', 'remove my backdrop', 'what is a backdrop', 'set the stage to', 'set the stage to it', 'stage a play', 'the stage', 'set a timer for 5 minutes', 'backdrop', 'use this drawing as my background'])
    assert.equal(backdropOf(a), null, a);
  assert.equal(backdropOf('set the stage to ' + 'x'.repeat(70)), null, 'a scene is a few words');
  for (const e of backdrop.examples) assert.ok(backdrop.match(e.toLowerCase(), e), e);
  for (const n of backdrop.nearMisses) assert.ok(!backdrop.match(n.toLowerCase(), n), n);
  assert.ok(backdrop.suite().ok);
});

test('the record kept in this browser: the forge\'s picture (a data URL only), the scene and the ask; one without a picture is nothing', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal(STORE_KEY, 'a2m.void.backdrop.v1');
  const r = sceneRecord({ src: png, subject: 'retro server room', ask: 'set the stage to a retro server room', extra: 1 });
  assert.deepEqual(r, { v: 1, src: png, subject: 'retro server room', ask: 'set the stage to a retro server room' });
  assert.deepEqual(parseScene(JSON.stringify(r)), r);
  assert.equal(sceneRecord({ src: 'https://x/y.png' }).src, '', 'never a web address');
  assert.equal(parseScene(JSON.stringify({ v: 1, src: '', subject: 'x' })), null, 'no picture: nothing to show');
  assert.equal(parseScene('{"v":2,"src":"' + png + '"}'), null); assert.equal(parseScene(''), null); assert.equal(parseScene('nope'), null);
});

test('a card\'s cast shadow: the same box, 18 px lower, never a negative size; the lines said when no scene comes are plain', () => {
  assert.equal(SHADOW.dy, 18);
  assert.deepEqual(shadowRect({ x: 40.4, y: 60, w: 300, h: 200.6 }), { x: 40, y: 78, w: 300, h: 201 });
  assert.deepEqual(shadowRect({}), { x: 0, y: 18, w: 0, h: 0 });
  assert.match(whyLine('cap'), /used up/); assert.match(whyLine('nope'), /No scene this time/);
});
