// Tools pack 5 (owner, 2026-10-18; numbers 91 to 120): search and history, export and share, media light. Pure logic only; the browser
// section "tools pack 5" in test_void.mjs plays them on the stage.
// Run: node --test tools/tools-pack-5.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { findIntent, searchThings, byKind, kindWord, KIND_ALIAS, BASIC_KINDS, jumpTarget, thingText, thingLabel, sigOf, diffStage, logChanges, todaysChanges, changeLine, recentlyKept, pileIntent, pushPile, takeFromPile, bookmarkIntent, addBookmark, PILE_MAX, CHANGES_MAX, BOOKMARKS_MAX, dayStart } from '../void-live-deploy/lib/stage-find.js';
import { exportIntent, exportStage, parseStageImport, stageTextDump, historyAdd, historyLine, printCss, printCards, pushCopy, looksSecret, copyIntent, HISTORY_MAX, COPIES_MAX } from '../void-live-deploy/lib/stage-port.js';
import { imageIntent, unionBox, pixelSize, foreignSvg, plainLayout } from '../void-live-deploy/lib/stage-image.js';
import { listPage, goTo } from '../void-live-deploy/lib/pack5-ui.js';
import { lookNow, _reset, readJson, PILE_KEY, CHANGES_KEY } from '../void-live-deploy/lib/stage-watch.js';
import stageFind, { resolve as resolveFind } from '../void-live-deploy/skills/stage-find.js';
import dismissedPile, { putBack } from '../void-live-deploy/skills/dismissed-pile.js';
import bookmarks from '../void-live-deploy/skills/bookmarks.js';
import stageExport from '../void-live-deploy/skills/stage-export.js';
import copyStack from '../void-live-deploy/skills/copy-stack.js';
import stageImage from '../void-live-deploy/skills/stage-image.js';
import mediaObject from '../void-live-deploy/skills/media-object.js';
import { fileKind, pickItems, modeOf, stepIndex, srtToVtt, turn, rotatedSize, cropBox, clampVol, mediaIntent } from '../void-live-deploy/lib/media-local.js';

const stage = {
  a: { id: 'a', kind: 'sticky', x: 10, y: 20, text: 'buy milk and eggs' },
  b: { id: 'b', kind: 'timer', x: 200, y: 20, duration: 60000, title: 'tea' },
  c: { id: 'c', kind: 'kept', x: 40, y: 300, name: 'Pizza dough', ask: 'pizza dough recipe', html: '<h2>Pizza dough</h2><p>flour, water, <b>yeast</b></p><script>x()</script><button>keep</button>' },
  d: { id: 'd', kind: 'list', x: 300, y: 300, title: 'Groceries', items: [{ text: 'milk', done: false }, 'bread'] },
};

test('search: words in a thing, a kind, the best first', () => {
  assert.equal(thingText(stage.a), 'buy milk and eggs');
  assert.match(thingText(stage.c), /flour, water, yeast/);
  assert.doesNotMatch(thingText(stage.c), /x\(\)|keep$/);
  assert.deepEqual(searchThings(stage, 'milk').map((h) => h.id).sort(), ['a', 'd']);
  assert.deepEqual(searchThings(stage, 'pizza', { kind: 'kept' }).map((h) => h.id), ['c']);
  assert.deepEqual(searchThings(stage, 'milk', { kind: 'kept' }), []);
  assert.deepEqual(searchThings(stage, 'milk eggs').map((h) => h.id), ['a']); // every word must be there
  assert.deepEqual(searchThings(stage, '   '), []);
  assert.deepEqual(byKind(stage, 'timer').map((h) => h.id), ['b']);
  assert.equal(thingLabel(stage.d), 'Groceries');
  assert.equal(thingLabel(stage.a), 'buy milk and eggs');
  assert.equal(thingLabel({ kind: 'clock' }), 'clock');
});

test('search asks: what they take and what they leave', () => {
  assert.deepEqual(findIntent('search kept items for pizza'), { op: 'search', q: 'pizza', kept: true });
  assert.deepEqual(findIntent('find milk on the stage'), { op: 'search', q: 'milk', kept: false });
  assert.deepEqual(findIntent('search the stage for tea'), { op: 'search', q: 'tea', kept: false });
  assert.deepEqual(findIntent('show all timers on the stage'), { op: 'kind', word: 'timers' });
  assert.deepEqual(findIntent('search the stage by kind: sticky'), { op: 'kind', word: 'sticky' });
  assert.deepEqual(findIntent('jump to the milk note'), { op: 'jump', phrase: 'milk note' });
  assert.deepEqual(findIntent('recently kept'), { op: 'recent-kept' });
  assert.deepEqual(findIntent('What changed today?'), { op: 'changed' });
  for (const a of ['search vimeo for big buck bunny', 'find a rumble video about bitcoin', 'show only clocks', 'what changed in the news today', 'where is the moon tonight', 'add milk to my list']) assert.equal(findIntent(a), null, a);
  assert.equal(kindWord('timers', BASIC_KINDS, KIND_ALIAS), 'timer');
  assert.equal(kindWord('notes', BASIC_KINDS, KIND_ALIAS), 'sticky');
  assert.equal(kindWord('the lists', BASIC_KINDS, KIND_ALIAS), 'list');
  assert.equal(kindWord('pizza places', BASIC_KINDS, KIND_ALIAS), '');
});

test('jump: a kind word, a name or the words of a thing', () => {
  assert.equal(jumpTarget(stage, 'the milk note').id, 'a'); // milk + note -> a sticky about milk
  assert.equal(jumpTarget(stage, 'timer').id, 'b');
  assert.equal(jumpTarget(stage, 'groceries').id, 'd');
  assert.equal(jumpTarget(stage, 'pizza dough').id, 'c');
  assert.equal(jumpTarget(stage, 'conclusions'), null);
  assert.equal(jumpTarget({}, 'timer'), null);
});

test('what changed: adds, edits and removals between two looks; moves are not changes', () => {
  const prev = new Map(Object.entries(stage).map(([id, t]) => [id, sigOf(t)]));
  assert.equal(sigOf({ id: 'z', kind: 'x', x: 1, y: 2, text: 't' }), sigOf({ id: 'z', kind: 'x', x: 99, y: 5, text: 't' }));
  const next = { ...stage, a: { ...stage.a, x: 500 }, b: { ...stage.b, title: 'coffee' }, e: { id: 'e', kind: 'clock', x: 0, y: 0 } };
  delete next.d;
  const d = diffStage(prev, next);
  assert.deepEqual([d.added, d.changed, d.removed], [['e'], ['b'], ['d']]);
  assert.deepEqual(diffStage(d.now, next), { added: [], removed: [], changed: [], now: d.now });
  let log = logChanges([], [{ op: 'add', id: 'e', kind: 'clock', label: 'clock' }, { op: 'remove', id: 'd', kind: 'list', label: 'Groceries' }], 1000);
  log = logChanges(log, [{ op: 'change', id: 'b', kind: 'timer', label: 'coffee' }], 2000);
  assert.equal(log[0].op, 'change');
  assert.equal(logChanges(Array.from({ length: CHANGES_MAX }, () => ({ at: 1 })), [{ op: 'add', id: 'q', kind: 'k' }], 2).length, CHANGES_MAX);
  const now = new Date(2026, 9, 18, 15, 0).getTime();
  const rows = todaysChanges([{ at: now - 1000, op: 'change', id: 'b', kind: 'timer', label: 'coffee' }, { at: now - 5000, op: 'change', id: 'b', kind: 'timer', label: 'tea' }, { at: dayStart(now) - 1, op: 'add', id: 'old', kind: 'x', label: '' }], now);
  assert.deepEqual(rows.map((r) => r.label), ['coffee']); // one line per thing and op, yesterday left out
  assert.equal(changeLine({ op: 'remove', kind: 'list', label: 'Groceries' }), 'dismissed list: Groceries');
  assert.equal(changeLine({ op: 'add', kind: 'clock', label: 'clock' }), 'added clock');
  assert.deepEqual(recentlyKept({ ...stage, k2: { id: 'k2', kind: 'kept', name: 'Newer' } }, [{ op: 'add', id: 'k2', kind: 'kept' }, { op: 'add', id: 'c', kind: 'kept' }]).map((r) => r.id), ['k2', 'c']);
});

test('the undo pile: asks, the last 20, putting one back', () => {
  assert.deepEqual(pileIntent('show the undo pile'), { op: 'show' });
  assert.deepEqual(pileIntent('what did I dismiss'), { op: 'show' });
  assert.deepEqual(pileIntent('last 20 dismissed'), { op: 'show' });
  assert.deepEqual(pileIntent('restore the last dismissed'), { op: 'restore', n: 1 });
  assert.deepEqual(pileIntent('restore dismissed 3'), { op: 'restore', n: 3 });
  assert.deepEqual(pileIntent('undismiss'), { op: 'restore', n: 1 });
  assert.deepEqual(pileIntent('restore the timer I dismissed'), { op: 'restore-name', name: 'timer' });
  for (const a of ['undo', 'dismiss this', 'what is a dismissal', 'bring back the 90s']) assert.ok(!pileIntent(a) || pileIntent(a).op === 'restore-name', a);
  assert.equal(pileIntent('undo'), null);
  assert.equal(pileIntent('restore dismissed 99'), null); // 99 is no pile number
  let pile = [];
  for (let i = 0; i < 25; i++) pile = pushPile(pile, { id: 't' + i, kind: 'sticky', text: 'n' + i }, i);
  assert.equal(pile.length, PILE_MAX);
  assert.equal(pile[0].thing.id, 't24');
  pile = pushPile(pile, { id: 't24', kind: 'sticky', text: 'again' }, 99); // the same id moves to the top, never twice
  assert.equal(pile.filter((e) => e.thing.id === 't24').length, 1);
  assert.equal(pile[0].thing.text, 'again');
  const taken = takeFromPile(pile, 2);
  assert.equal(taken.entry.thing.id, 't23');
  assert.equal(taken.pile.length, PILE_MAX - 1);
  assert.equal(takeFromPile(pile, { name: 'sticky' }).entry.thing.id, 't24');
  assert.equal(takeFromPile(pile, { name: 'timer' }).entry, null);
  assert.equal(takeFromPile([], 1).entry, null);
  assert.deepEqual(pushPile([], null, 1), []);
  const loop = {}; loop.self = loop;
  assert.deepEqual(pushPile([], { id: 'x', kind: 'k', loop }, 1), []); // a thing that will not serialize is not kept
});

test('favorites and bookmarked asks', () => {
  assert.deepEqual(bookmarkIntent('favorite this'), { op: 'favorite' });
  assert.deepEqual(bookmarkIntent('unfavorite this'), { op: 'unfavorite' });
  assert.deepEqual(bookmarkIntent('bookmark this ask'), { op: 'add-ask', ask: '' });
  assert.deepEqual(bookmarkIntent('Bookmark: make a clock'), { op: 'add-ask', ask: 'make a clock' });
  assert.deepEqual(bookmarkIntent('bookmark this ask: sticky note hello'), { op: 'add-ask', ask: 'sticky note hello' });
  assert.deepEqual(bookmarkIntent('my bookmarks'), { op: 'show' });
  assert.deepEqual(bookmarkIntent('my favorites'), { op: 'show' });
  assert.deepEqual(bookmarkIntent('run my second bookmark'), { op: 'run', n: 2 });
  assert.deepEqual(bookmarkIntent('remove bookmark 2'), { op: 'remove', n: 2 });
  for (const a of ['bookmark this page in chrome', 'what is a bookmark', 'my favorite color is blue', 'favorite songs of the 80s', 'add milk to my list']) assert.equal(bookmarkIntent(a), null, a);
  let l = addBookmark([], 'make a clock');
  l = addBookmark(l, 'Make a Clock'); // no repeats, whatever the case
  l = addBookmark(l, 'sticky note hi');
  assert.deepEqual(l, ['sticky note hi', 'Make a Clock']);
  assert.deepEqual(addBookmark(['a'], '   '), ['a']);
  assert.deepEqual(addBookmark(['a'], 'unlock ' + 'k'.repeat(20)), ['a']); // an unlock phrase is a key, never kept
  let many = [];
  for (let i = 0; i < 40; i++) many = addBookmark(many, 'ask ' + i);
  assert.equal(many.length, BOOKMARKS_MAX);
});

test('export: the file, the asks, and what an import lets in', () => {
  const body = JSON.parse(exportStage(stage, Date.UTC(2026, 9, 18)));
  assert.equal(body.app, 'void'); assert.equal(body.version, 1); assert.equal(body.count, 4); assert.equal(body.exportedAt, '2026-10-18T00:00:00.000Z');
  assert.equal(JSON.parse(exportStage({}, 0)).count, 0);
  assert.deepEqual(exportIntent('export my stage as json'), { op: 'json' });
  assert.deepEqual(exportIntent('back up my stage'), { op: 'json' });
  assert.deepEqual(exportIntent('import a stage from json'), { op: 'import' });
  assert.deepEqual(exportIntent('email-ready text of my stage'), { op: 'text' });
  assert.deepEqual(exportIntent('print view of the stage'), { op: 'print', paper: null });
  assert.deepEqual(exportIntent('print the stage on A4'), { op: 'print', paper: 'A4' });
  assert.deepEqual(exportIntent('print view of the stage on US letter'), { op: 'print', paper: 'Letter' });
  assert.deepEqual(exportIntent('use letter paper for printing'), { op: 'paper', paper: 'Letter' });
  assert.deepEqual(exportIntent('export history'), { op: 'history' });
  for (const a of ['export a print file', 'export the stage as 3mf', 'download motelet', 'what is json', 'print my boarding pass', 'save my stage', 'import export tax rules']) assert.equal(exportIntent(a), null, a);
  // an import: known kinds only, a kept card comes back as words, an unsafe link is dropped, a taken id is renamed
  const evil = JSON.stringify({ app: 'void', version: 1, things: [
    { id: 'a', kind: 'sticky', x: 5, y: 5, text: 'hello', __proto__: { polluted: true } },
    { id: 'k', kind: 'kept', x: 1, y: 1, name: 'n', html: '<img src=x onerror=alert(1)><p>safe words</p><script>bad()</script>' },
    { id: 'l', kind: 'link', x: 1, y: 1, url: 'javascript:alert(1)', title: 'bad' },
    { id: 'l2', kind: 'link', x: 1, y: 1, url: 'https://example.org/x', title: 'ok' },
    { id: 'z', kind: 'bogus', x: 1, y: 1 }, { kind: 5 }, null, 'text',
    { id: 'far', kind: 'sticky', x: 1e9, y: -50, text: 'far' },
  ] });
  const r = parseStageImport(evil, ['sticky', 'kept', 'link'], new Set(['a']));
  assert.equal(r.ok, true);
  assert.equal(r.things.length, 5); assert.equal(r.skipped, 4);
  assert.notEqual(r.things[0].id, 'a'); // taken
  assert.equal(({}).polluted, undefined);
  const kept = r.things.find((t) => t.kind === 'kept');
  assert.equal(kept.html, '<p>safe words</p>');
  assert.equal(r.things.find((t) => t.title === 'bad').url, undefined);
  assert.equal(r.things.find((t) => t.title === 'ok').url, 'https://example.org/x');
  const far = r.things.find((t) => t.text === 'far'); assert.equal(far.x, 20000); assert.equal(far.y, 0);
  assert.equal(parseStageImport('not json', null).ok, false);
  assert.equal(parseStageImport('', null).why, 'the file is empty');
  assert.equal(parseStageImport('{"a":1}', null).ok, false);
  assert.equal(parseStageImport('x'.repeat(2000001), null).ok, false);
  assert.equal(parseStageImport(JSON.stringify([{ kind: 'nope' }]), ['sticky']).ok, false);
  const round = parseStageImport(exportStage({ s: stage.a, t: stage.b }), ['sticky', 'timer']);
  assert.equal(round.ok, true); assert.deepEqual(round.things.map((t) => t.kind).sort(), ['sticky', 'timer']);
});

test('export: plain text for an email, the print sheet, the history', () => {
  const txt = stageTextDump(stage, Date.UTC(2026, 9, 18));
  assert.match(txt, /^My Verse stage, 2026-10-18 \(4 things\)/);
  assert.match(txt, /- list: Groceries\n    \* \[ \] milk\n    \* bread/);
  assert.match(txt, /- sticky: buy milk and eggs/);
  assert.ok(!/[<>]|&nbsp;/.test(txt) && txt.split('\n').every((l) => l.length <= 80), 'plain text, wrapped');
  assert.match(stageTextDump({}), /nothing on the stage/);
  assert.match(printCss('Letter'), /size:letter/); assert.match(printCss('A4'), /size:A4/); assert.match(printCss('nope'), /size:A4/);
  assert.match(printCss('A4'), /body>\*:not\(#p5-print-sheet\)\{display:none/);
  const cards = printCards(stage);
  assert.deepEqual(cards.map((c) => c.kind), ['sticky', 'timer', 'kept', 'list']); // top to bottom, left to right
  assert.deepEqual(cards[3].lines, ['[ ] milk', 'bread']);
  let h = [];
  for (let i = 0; i < 25; i++) h = historyAdd(h, { at: i, kind: 'json', count: i, bytes: 2048 });
  assert.equal(h.length, HISTORY_MAX); assert.equal(h[0].at, 24);
  assert.equal(historyLine({ kind: 'json', count: 1, bytes: 2048 }), 'json · 1 thing · 2 kB');
  assert.equal(historyLine({ kind: 'print A4', count: 3, bytes: 0 }), 'print A4 · 3 things');
});

test('the clipboard stack: five copies, no repeats, no secrets', () => {
  let s = [];
  for (let i = 1; i <= 7; i++) s = pushCopy(s, 'copy ' + i);
  assert.equal(s.length, COPIES_MAX); assert.equal(s[0], 'copy 7');
  s = pushCopy(s, 'copy 5'); assert.deepEqual(s.slice(0, 2), ['copy 5', 'copy 7']); assert.equal(s.length, COPIES_MAX);
  assert.deepEqual(pushCopy(['a'], '  '), ['a']);
  assert.equal(pushCopy([], 'word '.repeat(2000))[0].length, 4000);
  assert.deepEqual(pushCopy([], 'x'.repeat(9000)), []); // one long unbroken run looks like a key
  // a made-up key in a test says so: secret-scan: ok
  for (const k of ['password: hunter2hunter2', 'Bearer abcdefghijklmnopqrstuvwxyz0123', '-----BEGIN RSA PRIVATE KEY-----\nabc', 'ghp_' + 'a'.repeat(30), 'A'.repeat(48)]) assert.equal(looksSecret(k), true, k.slice(0, 20)); // secret-scan: ok
  assert.deepEqual(pushCopy(['a'], 'api_key = abcdef123456'), ['a']); // secret-scan: ok
  assert.equal(looksSecret('buy milk and eggs'), false);
  assert.deepEqual(copyIntent('show my clipboard stack'), { op: 'show' });
  assert.deepEqual(copyIntent('last 5 copies'), { op: 'show' });
  assert.deepEqual(copyIntent('copy item 2 from the clipboard stack'), { op: 'copy', n: 2 });
  assert.deepEqual(copyIntent('clear the clipboard stack'), { op: 'clear' });
  for (const a of ['ask clipboard', 'recent asks', 'copy this to the clipboard', 'what is a clipboard', 'copy item 9 from the clipboard stack']) assert.equal(copyIntent(a), null, a);
});

// the QR encoder itself is tested in tools/qr.test.mjs (decoded with ZXing across every size and level)

test('image asks, the box round some cards, the size', () => {
  assert.deepEqual(imageIntent('copy the stage as an image'), { op: 'stage' });
  assert.deepEqual(imageIntent('screenshot the stage'), { op: 'stage' });
  assert.deepEqual(imageIntent('copy this card as a png'), { op: 'card' });
  assert.deepEqual(imageIntent('qr code for this stage view'), { op: 'qr' });
  assert.deepEqual(imageIntent('make a qr code for this page'), { op: 'qr' });
  for (const a of ['qr code for my wifi', 'copy the card', 'what is a png', 'make an image of a cat', 'copy the list to the notepad']) assert.equal(imageIntent(a), null, a);
  assert.deepEqual(unionBox([{ left: 100, top: 50, width: 200, height: 100 }, { left: 400, top: 300, width: 50, height: 50 }], 10), { x: 90, y: 40, w: 370, h: 320 });
  assert.equal(unionBox([], 10), null); assert.equal(unionBox([{ left: 0, top: 0, width: 0, height: 5 }]), null);
  assert.deepEqual(pixelSize(400, 300, 2), { w: 800, h: 600, scale: 2 });
  const big = pixelSize(6000, 5000, 2); assert.ok(big.w <= 4096 && big.h <= 4096 && big.w * big.h <= 12000000);
  assert.match(foreignSvg('<div xmlns="http://www.w3.org/1999/xhtml">x</div>', 10, 20), /^<svg [^>]*width="10" height="20"[^>]*><foreignObject [^>]*>.*<\/foreignObject><\/svg>$/);
  assert.deepEqual(plainLayout([{ left: 120, top: 80, width: 50, height: 40, kind: 'sticky', label: 'hi' }], { x: 100, y: 60, w: 200, h: 200 }), [{ x: 20, y: 20, w: 50, h: 40, title: 'sticky', text: 'hi' }]);
});

test('media: file kinds, playlist steps, subtitles, turn and crop, the asks', () => {
  assert.equal(fileKind({ type: 'audio/mpeg', name: 'a.mp3' }), 'audio'); assert.equal(fileKind({ type: '', name: 'song.FLAC' }), 'audio');
  assert.equal(fileKind({ type: 'video/mp4', name: 'v.mp4' }), 'video'); assert.equal(fileKind({ type: 'image/gif', name: 'x.gif' }), 'gif');
  assert.equal(fileKind({ type: 'image/png', name: 'x.png' }), 'image'); assert.equal(fileKind({ type: 'image/svg+xml', name: 'x.svg' }), null);
  assert.equal(fileKind({ type: '', name: 'subs.srt' }), 'sub'); assert.equal(fileKind({ type: 'application/pdf', name: 'a.pdf' }), null);
  const p = pickItems([{ type: 'audio/mpeg', name: 'a.mp3', size: 5 }, { type: 'application/pdf', name: 'a.pdf' }, { type: 'text/vtt', name: 's.vtt' }]);
  assert.equal(p.items.length, 1); assert.equal(p.left, 2);
  assert.equal(pickItems(Array.from({ length: 60 }, () => ({ type: 'image/png', name: 'i.png' }))).items.length, 40);
  assert.equal(modeOf(p.items), 'player'); assert.equal(modeOf([{ kind: 'gif' }]), 'images');
  assert.equal(stepIndex(0, 3, 1, false), 1); assert.equal(stepIndex(2, 3, 1, false), -1); assert.equal(stepIndex(2, 3, 1, true), 0); assert.equal(stepIndex(0, 3, -1, true), 2); assert.equal(stepIndex(0, 0, 1, true), -1);
  assert.equal(srtToVtt('1\r\n00:00:01,000 --> 00:00:02,500\r\nHello <i>there</i>\r\n\r\n2\r\n00:01:00,5 --> 00:01:02,000\r\nBye'),
    'WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello <i>there</i>\n\n00:01:00.500 --> 00:01:02.000\nBye\n');
  assert.equal(srtToVtt('﻿1\n01:02,003 --> 01:03,004\n{\\an8}Up top'), 'WEBVTT\n\n00:01:02.003 --> 00:01:03.004\nUp top\n');
  assert.equal(srtToVtt('just words'), null); assert.equal(srtToVtt(''), null); assert.equal(srtToVtt('x'.repeat(700000)), null);
  assert.equal(turn(0, 1), 90); assert.equal(turn(270, 1), 0); assert.equal(turn(0, -1), 270); assert.equal(turn(90, -1), 0);
  assert.deepEqual(rotatedSize(400, 300, 90), { w: 300, h: 400 }); assert.deepEqual(rotatedSize(400, 300, 180), { w: 400, h: 300 });
  assert.deepEqual(cropBox(1000, 500, [1, 1]), { x: 250, y: 0, w: 500, h: 500 });
  assert.deepEqual(cropBox(300, 600, [16, 9]), { x: 0, y: 215, w: 300, h: 169 });
  assert.deepEqual(cropBox(400, 300, null), { x: 0, y: 0, w: 400, h: 300 });
  assert.equal(clampVol(2), 1); assert.equal(clampVol(-1), 0); assert.equal(clampVol('x'), 1); assert.equal(clampVol(0.456), 0.46);
  assert.deepEqual(mediaIntent('play a local audio file'), { op: 'new', hint: 'audio' });
  assert.deepEqual(mediaIntent('local video player'), { op: 'new', hint: 'video' });
  assert.deepEqual(mediaIntent('playlist of local files'), { op: 'new', hint: 'any' });
  assert.deepEqual(mediaIntent('image viewer for local files'), { op: 'new', hint: 'images' });
  assert.deepEqual(mediaIntent('pause a local gif'), { op: 'new', hint: 'images' });
  assert.deepEqual(mediaIntent('mute all media'), { op: 'mute', on: true });
  assert.deepEqual(mediaIntent('unmute all media'), { op: 'mute', on: false });
  assert.deepEqual(mediaIntent('set the media volume to 40%'), { op: 'volume', value: 0.4 });
  for (const a of ['play lofi beats', 'play a song', 'play music', 'show this image https://example.org/cat.png', 'mute the music', 'what is a gif', 'play despacito', 'crop the image', 'image viewer', 'play a local game']) assert.equal(mediaIntent(a), null, a);
});

// the skill files themselves: each answers its own examples and none of its near misses (tools/skills-check.mjs runs the same over the whole routing order)
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
test('skills: examples answered, near misses left alone, and the stage-dependent asks need the stage', () => {
  globalThis.localStorage = memory();
  for (const sk of [stageFind, dismissedPile, bookmarks, stageExport, copyStack, stageImage, mediaObject]) {
    assert.ok(sk.name && typeof sk.run === 'function', sk.name);
    for (const e of sk.examples) assert.equal(sk.match(e.toLowerCase(), e), true, sk.name + ': ' + e);
    for (const n of sk.nearMisses) assert.equal(sk.match(n.toLowerCase(), n), false, sk.name + ' took ' + n);
  }
  // "jump to X" and "restore the X" are the stage's only when the saved stage or the pile holds an X
  assert.equal(stageFind.match('jump to the milk note', 'jump to the milk note'), false);
  localStorage.setItem('a2m.void.state.v1', JSON.stringify(stage));
  assert.equal(stageFind.match('jump to the milk note', 'jump to the milk note'), true);
  assert.equal(stageFind.match('jump to conclusions', 'jump to conclusions'), false);
  assert.equal(dismissedPile.match('restore the timer', 'restore the timer'), false);
  localStorage.setItem(PILE_KEY, JSON.stringify(pushPile([], stage.b, 1)));
  assert.equal(dismissedPile.match('restore the timer', 'restore the timer'), true);
  assert.deepEqual(resolveFind('find all timers on the stage', stage), { op: 'kind', kind: 'timer' });
  assert.deepEqual(resolveFind('show all gizmos on the stage', stage), null);
  delete globalThis.localStorage;
});

test('the list card draws rows with escaped words and calls back on a tap (a fake page)', () => {
  const taps = [], clicks = [];
  const btn = (i) => ({ dataset: { i: String(i) }, addEventListener: (_, f) => clicks.push(f) });
  const el = { innerHTML: '', querySelectorAll: () => [btn(0), btn(1)] };
  const api = { esc: (x) => String(x).replace(/</g, '&lt;'), showPage: (f) => { f({ innerHTML: '' }); return el; } };
  listPage(api, 'T <b>', [{ text: 'a <i>', sub: 's' }, { text: 'b', action: 'run' }], { onPick: (r) => taps.push(r.text) });
  assert.match(el.innerHTML, /<h2>T &lt;b>/); assert.match(el.innerHTML, /a &lt;i>/); assert.match(el.innerHTML, />run</);
  clicks.forEach((f) => f());
  assert.deepEqual(taps, ['a <i>', 'b']);
  listPage(api, 'E', [], { empty: 'nothing here' });
  assert.match(el.innerHTML, /nothing here/);
  assert.equal(typeof goTo, 'function');
});

test('the stage watch: a baseline, then adds, edits and dismissals go to the log and the pile; a thing that comes back leaves the pile', () => {
  globalThis.localStorage = memory(); _reset(null);
  const things = { a: { id: 'a', kind: 'sticky', x: 1, y: 1, text: 'one' } };
  const api = { things: () => things };
  assert.deepEqual(lookNow(api).added, []); // no saved stage to compare with: the first look is a baseline and logs nothing
  _reset({ a: { id: 'a', kind: 'sticky', x: 1, y: 1, text: 'one' } }); // the page started with this stage saved: a thing made before the first look is an add
  things.first = { id: 'first', kind: 'clock', x: 2, y: 2 };
  assert.deepEqual(lookNow(api).added, ['first']);
  delete things.first; lookNow(api); localStorage.removeItem(PILE_KEY); localStorage.removeItem(CHANGES_KEY);
  _reset(null); lookNow(api);
  things.b = { id: 'b', kind: 'timer', x: 5, y: 5, title: 'tea' };
  things.a.text = 'one!';
  let r = lookNow(api);
  assert.deepEqual([r.added, r.changed], [['b'], ['a']]);
  delete things.b;
  r = lookNow(api);
  assert.deepEqual(r.removed, ['b']);
  assert.equal(readJson(PILE_KEY, []).length, 1); assert.equal(readJson(PILE_KEY, [])[0].thing.title, 'tea');
  assert.deepEqual(readJson(CHANGES_KEY, []).map((e) => e.op + ':' + e.id), ['remove:b', 'add:b', 'change:a']);
  // putting it back (the restore): same place, out of the pile
  const fake = { things: () => things, snapshot() { this.snapped = true; }, select() {}, save() {}, render() {} };
  const id = putBack(fake, readJson(PILE_KEY, [])[0]);
  assert.equal(id, 'b'); assert.equal(things.b.title, 'tea'); assert.ok(fake.snapped);
  // putBack records the restore itself (a quick second dismissal used to cancel it out before the watcher looked)
  assert.equal(readJson(CHANGES_KEY, [])[0].op + ':' + readJson(CHANGES_KEY, [])[0].id, 'add:b'); assert.equal(readJson(PILE_KEY, []).length, 0);
  assert.deepEqual(lookNow(api).added, [], 'already recorded');
  // a taken id gets a new one
  const id2 = putBack(fake, { thing: { id: 'a', kind: 'sticky', text: 'dup' } });
  assert.notEqual(id2, 'a'); assert.equal(things.a.text, 'one!');
  delete globalThis.localStorage;
});
