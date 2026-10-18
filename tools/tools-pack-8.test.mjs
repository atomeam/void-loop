// Tools pack 8 (owner, 2026-10-18): safety and trust (unverified badge, hide numbers, redact, panic, casual PIN lock, auto-lock,
// clipboard, photo scrub, ephemeral, confirm mass delete) and small delights (confetti, tick, dust, undo toast, tour, flip,
// stamp, tape, rubber band). Pure logic only; the browser section "tools pack 8" plays them on the stage.
// Run: node --test tools/tools-pack-8.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { safetyIntent, maskDigits, redactText, claimState, pinOk, makeSalt, hashPin, checkPin, idleDue, needsConfirm, stripMeta, scrubReport, scrubSentence } from '../void-live-deploy/lib/safety.js';
import { fxIntent, playIntent, completeIds, stageDiff, seasonOf, dustSpecks, seeded, confettiPieces, confettiStep, rectBetween, overlaps, pickedBy, stampStyle, TOUR } from '../void-live-deploy/lib/fx.js';
import { scrubIntent } from '../void-live-deploy/skills/photo-scrub.js';
import safetyKit from '../void-live-deploy/skills/safety-kit.js';
import stageFx from '../void-live-deploy/skills/stage-fx.js';
import cardPlay from '../void-live-deploy/skills/card-play.js';
import photoScrub from '../void-live-deploy/skills/photo-scrub.js';

test('safety asks: what each takes and the look-alikes left alone', () => {
  const take = {
    'hide numbers': { op: 'numbers', on: true }, 'Hide the numbers.': { op: 'numbers', on: true }, 'privacy mode': { op: 'numbers', on: true },
    'show numbers': { op: 'numbers', on: false }, 'privacy mode off': { op: 'numbers', on: false },
    'redact selection': { op: 'redact' }, 'black out the selection': { op: 'redact' }, 'unredact': { op: 'unredact' },
    'panic': { op: 'panic' }, 'hide the stage': { op: 'panic' }, 'panic hide': { op: 'panic' },
    'lock now': { op: 'lock' }, 'lock the stage': { op: 'lock' }, 'set a pin': { op: 'pincard' }, 'pin lock': { op: 'pincard' },
    'auto lock after 5 minutes': { op: 'autolock', minutes: 5 }, 'auto-lock off': { op: 'autolock', minutes: 0 },
    'clear my clipboard': { op: 'clipboard' }, 'ephemeral mode': { op: 'ephemeral', on: true }, 'turn off ephemeral mode': { op: 'ephemeral', on: false },
    'confirm before mass delete': { op: 'confirm', on: true }, 'unverified: the moon is cheese': { op: 'claim', text: 'the moon is cheese' },
  };
  for (const [a, want] of Object.entries(take)) assert.deepEqual(safetyIntent(a), want, a);
  for (const a of ['hide the numbers in my taxes', 'how do I lock a door', 'what is a pin number', 'show me how a key opens a lock', 'clear the stage', 'undo', 'lock the door', 'is this claim unverified', 'auto lock after 0 minutes']) assert.equal(safetyIntent(a), null, a);
});

test('hide numbers masks digits and redact keeps the shape of a line', () => {
  assert.equal(maskDigits('Total 1,204.50 on 3 Jan'), 'Total •,•••.•• on • Jan');
  assert.equal(maskDigits(null), '');
  assert.equal(redactText('call me on 555'), '████ ██ ██ ███');
});

test('claim badge: unverified until checked', () => {
  assert.deepEqual(claimState({ text: 'x' }), { label: 'Unverified', checked: false, note: '' });
  assert.equal(claimState({ checked: true, note: 'saw the source' }).label, 'Checked');
  assert.equal(claimState({ note: 'n'.repeat(500) }).note.length, 200);
});

test('PIN lock: hashed with a salt, never the PIN itself; right PIN passes, wrong fails', async () => {
  assert.ok(pinOk('1234') && pinOk('abcd1234abcd') && !pinOk('123') && !pinOk('1234567890123') && !pinOk(''));
  const salt = makeSalt(webcrypto), hash = await hashPin('4821', salt, webcrypto);
  assert.match(salt, /^[0-9a-f]{32}$/); assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes('4821'));
  const rec = { salt, hash };
  assert.equal(await checkPin('4821', rec, webcrypto), true);
  assert.equal(await checkPin('4822', rec, webcrypto), false);
  assert.equal(await checkPin('4821', null, webcrypto), false);
  assert.notEqual(await hashPin('4821', makeSalt(webcrypto), webcrypto), hash); // a new salt gives a new hash
});

test('auto-lock and mass-delete thresholds', () => {
  assert.equal(idleDue(0, 5 * 60000, 5), true);
  assert.equal(idleDue(0, 5 * 60000 - 1, 5), false);
  assert.equal(idleDue(0, 1e9, 0), false);
  assert.equal(needsConfirm(1, true), false); assert.equal(needsConfirm(2, true), true); assert.equal(needsConfirm(9, false), false);
});

// a tiny JPEG: SOI, an EXIF APP1 with a GPS IFD pointer, an XMP APP1, a comment, then a scan and EOI
function jpeg() {
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, /* TIFF big-endian */ 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, /* IFD0: 1 entry */ 0, 1, 0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0x1a, 0, 0, 0, 0, 0, 0];
  const seg = (m, body) => [0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255, ...body];
  const xmp = [...Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>')];
  return Uint8Array.from([0xff, 0xd8, ...seg(0xe1, exif), ...seg(0xe1, xmp), ...seg(0xfe, [...Buffer.from('hello')]), ...seg(0xdb, [0, 1, 2, 3]), 0xff, 0xda, 0, 4, 1, 2, 9, 9, 9, 0xff, 0xd9]);
}

test('photo scrub: JPEG EXIF, XMP and comments cut out, the quantisation table and the pixels kept, GPS noticed', () => {
  const src = jpeg(), r = stripMeta(src);
  assert.equal(r.type, 'jpeg'); assert.deepEqual(r.removed, ['EXIF', 'XMP', 'comment']); assert.equal(r.gps, true);
  assert.equal(r.bytes.length, src.length - r.bytesRemoved);
  assert.deepEqual([...r.bytes.slice(0, 2)], [0xff, 0xd8]);
  assert.ok(r.bytes.includes(0xdb) && r.bytes.at(-1) === 0xd9 && r.bytes.at(-3) === 9, 'table and scan data kept');
  assert.ok(!Buffer.from(r.bytes).includes(Buffer.from('Exif')) && !Buffer.from(r.bytes).includes(Buffer.from('hello')));
  assert.equal(stripMeta(r.bytes).removed.length, 0, 'a second pass finds nothing');
  assert.match(scrubSentence(scrubReport(src)), /Removed EXIF, XMP, comment .* including where it was taken/);
});

test('photo scrub: PNG text, time and exif chunks dropped; other files left alone', () => {
  const chunk = (t, d) => [0, 0, 0, d.length, ...Buffer.from(t), ...d, 0, 0, 0, 0];
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]), ...chunk('tEXt', [...Buffer.from('Author\0me')]), ...chunk('tIME', [7, 234, 1, 1, 0, 0, 0]), ...chunk('eXIf', [1, 2]), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])]);
  const r = stripMeta(png);
  assert.equal(r.type, 'png'); assert.deepEqual(r.removed.sort(), ['EXIF', 'text', 'time stamp'].sort());
  assert.ok(Buffer.from(r.bytes).includes(Buffer.from('IDAT')) && Buffer.from(r.bytes).includes(Buffer.from('IEND')) && !Buffer.from(r.bytes).includes(Buffer.from('tEXt')));
  const other = stripMeta(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  assert.equal(other.type, ''); assert.match(scrubSentence(other), /not a JPEG or PNG/);
  assert.match(scrubSentence({ type: 'jpeg', removed: [], bytesRemoved: 0, gps: false }), /Nothing hidden/);
});

test('photo scrub asks and the look-alikes', () => {
  for (const a of ['strip the exif from a photo', 'remove the location from a picture', 'photo scrubber', 'scrub a photo', 'Remove metadata from my image.']) assert.equal(scrubIntent(a), true, a);
  for (const a of ['what is exif data', 'show me a photo of paris', 'remove the image', 'edit my photo', 'photo of the moon']) assert.equal(scrubIntent(a), false, a);
});

test('effects asks: what each takes and the look-alikes left alone', () => {
  const take = {
    'confetti when I finish a goal': { op: 'confetti', on: true }, 'confetti on': { op: 'confetti', on: true }, 'turn on confetti': { op: 'confetti', on: true }, 'confetti off': { op: 'confetti', on: false }, 'throw confetti': { op: 'confetti-now' },
    'soft tick sound on keep': { op: 'tick', on: true }, 'turn off the tick sound': { op: 'tick', on: false },
    'seasonal stage dust': { op: 'dust', on: true, season: 'auto' }, 'winter dust': { op: 'dust', on: true, season: 'winter' }, 'falling leaves': { op: 'dust', on: true, season: 'autumn' }, 'dust off': { op: 'dust', on: false },
    'undo toast': { op: 'toast', on: true }, 'turn off the undo toast': { op: 'toast', on: false }, 'give me the tour': { op: 'tour' }, 'take the tour': { op: 'tour' }, 'first run tour': { op: 'tour' },
  };
  for (const [a, want] of Object.entries(take)) assert.deepEqual(fxIntent(a), want, a);
  for (const a of ['confetti cake recipe', 'what is a tick', 'how do I undo a commit', 'the dust on my shelf', 'tour of paris', 'undo', 'tick off the list', 'give me a tour of rome']) assert.equal(fxIntent(a), null, a);
});

test('card play asks: what each takes and the look-alikes left alone', () => {
  const take = {
    'flip this card': { op: 'flip' }, 'flip it': { op: 'flip' }, 'flip the card': { op: 'flip' },
    'stamp it approved': { op: 'stamp', word: 'approved' }, 'stamp approved': { op: 'stamp', word: 'approved' }, 'stamp this as paid': { op: 'stamp', word: 'paid' }, 'stamp it with "ship it"': { op: 'stamp', word: 'ship it' }, 'remove the stamp': { op: 'unstamp' },
    'put tape on my notes': { op: 'tape', on: true }, 'tape off': { op: 'tape', on: false },
    'rubber band select': { op: 'rubber', on: true }, 'turn off rubber band select': { op: 'rubber', on: false }, 'drag to select': { op: 'rubber', on: true },
  };
  for (const [a, want] of Object.entries(take)) assert.deepEqual(playIntent(a), want, a);
  assert.deepEqual(playIntent('tape on'), { op: 'tape', on: true }, 'tape on');
  for (const a of ['flip a coin', 'stamp collecting for beginners', 'how much is a postage stamp', 'tape measure converter', 'select all', 'sticky note buy milk', 'flip the pancake', 'stamp duty uk']) assert.equal(playIntent(a), null, a);
});

test('goal complete: a list with every item ticked or a ring with every habit marked today, and only the newly finished fire', () => {
  const today = '2026-10-18';
  const things = {
    l1: { id: 'l1', kind: 'list', items: [{ done: true }, { done: true }] }, l2: { id: 'l2', kind: 'list', items: [{ done: true }, { done: false }] }, l3: { id: 'l3', kind: 'list', items: [] },
    h1: { id: 'h1', kind: 'habits', habits: [{ name: 'a', days: [today] }, { name: 'b', days: [today] }] }, h2: { id: 'h2', kind: 'habits', habits: [{ name: 'a', days: ['2026-10-17'] }] },
  };
  assert.deepEqual(completeIds(things, today).sort(), ['h1', 'l1']);
  const kinds = { l1: 'list', l2: 'list' };
  assert.deepEqual(stageDiff(kinds, kinds, [], ['l1']).done, ['l1'], 'finished since the last look');
  assert.deepEqual(stageDiff(kinds, kinds, ['l1'], ['l1']).done, [], 'already finished: no second burst');
  assert.deepEqual(stageDiff(kinds, { ...kinds, k: 'kept' }, [], []).added, ['k']);
  assert.deepEqual(stageDiff(kinds, { l1: 'list' }, [], []).removed, ['l2']);
  assert.deepEqual(stageDiff({}, { n: 'list' }, [], ['n']).done, [], 'a new list is not a goal reached');
});

test('dust and confetti are deterministic and stay inside their boxes', () => {
  assert.equal(seasonOf(0), 'winter'); assert.equal(seasonOf(3), 'spring'); assert.equal(seasonOf(6), 'summer'); assert.equal(seasonOf(9), 'autumn'); assert.equal(seasonOf(11), 'winter');
  const a = dustSpecks('autumn', 20, 800, 600, seeded(7)), b = dustSpecks('autumn', 20, 800, 600, seeded(7));
  assert.deepEqual(a, b); assert.equal(a.length, 20);
  for (const s of a) assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600 && s.r > 0);
  const ps = confettiPieces(50, 400, 300, seeded(3)); assert.equal(ps.length, 50);
  assert.ok(ps.every((p) => p.vy < 0), 'a burst starts upward');
  let p = ps[0]; for (let i = 0; i < 100; i++) p = confettiStep(p, 0.03); assert.ok(p.y > ps[0].y, 'gravity brings it down');
});

test('rubber band: the box between two points, overlap, and a click picks nothing', () => {
  assert.deepEqual(rectBetween({ x: 50, y: 40 }, { x: 10, y: 90 }), { x: 10, y: 40, w: 40, h: 50 });
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }), true);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), false);
  const boxes = [{ id: 'a', x: 20, y: 20, w: 100, h: 60 }, { id: 'b', x: 300, y: 300, w: 100, h: 60 }];
  assert.deepEqual(pickedBy({ x: 0, y: 0, w: 150, h: 150 }, boxes), ['a']);
  assert.deepEqual(pickedBy({ x: 0, y: 0, w: 500, h: 500 }, boxes), ['a', 'b']);
  assert.deepEqual(pickedBy({ x: 30, y: 30, w: 3, h: 3 }, boxes), []);
});

test('stamps and the tour', () => {
  assert.deepEqual(stampStyle('approved'), { text: 'APPROVED', color: '#1f9d55' });
  assert.equal(stampStyle('rejected').color, '#d1332e'); assert.equal(stampStyle('draft').color, '#2b6cb0');
  assert.equal(stampStyle('a very long stamp word indeed').text.length, 16);
  assert.ok(TOUR.length >= 4 && TOUR.length <= 6 && TOUR.every((s) => s.title && s.text.length < 160));
});

test('the four skills: every example is theirs, no near-miss is, and they load without a page', () => {
  for (const sk of [safetyKit, stageFx, cardPlay, photoScrub]) {
    assert.ok(sk.name && typeof sk.run === 'function' && sk.examples.length >= 3 && sk.nearMisses.length >= 3, sk.name);
    for (const e of sk.examples) assert.equal(sk.match(e.toLowerCase(), e), true, sk.name + ': ' + e);
    for (const n of sk.nearMisses) assert.equal(sk.match(n.toLowerCase(), n), false, sk.name + ' must not take: ' + n);
  }
  assert.ok(safetyKit.stageKinds.claim.mount && safetyKit.stageKinds.pinlock.mount && photoScrub.stageKinds.scrub.ephemeral);
});
