import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateLetters, parseTracks, weigh, putText } from '../void-live-deploy/lib/versus.js';

test('letters move, other marks stay, and 13 undoes itself', () => {
  assert.equal(rotateLetters('Ab! z', 1), 'Bc! a');
  assert.equal(rotateLetters(rotateLetters('Hello, Verse', 13), 13), 'Hello, Verse');
  assert.equal(rotateLetters('A', 26), 'A');
  assert.equal(rotateLetters('A', 0), 'A');
});

test('a track list gets start times, lengths and a total', () => {
  const p = parseTracks('0:00 First 7:24\n7:24 Second 6:05');
  assert.equal(p.rows.length, 2);
  assert.equal(p.clock(p.total), '13:29');
  const lengths = parseTracks('One 1:00\nTwo 2:00');
  assert.equal(lengths.rows[1].start, 60);
  assert.equal(lengths.clock(lengths.total), '3:00');
});

test('weigh counts bytes, pictures, fonts and scripts', () => {
  const w = weigh('<p>Hi</p><img src="a.png"><script src="x"></script>@font-face');
  assert.equal(w.images, 1); assert.equal(w.scripts, 1); assert.equal(w.fonts, 1); assert.ok(w.bytes > 10);
});

test('putText writes into an element and escapes', () => {
  assert.equal(putText('<output id="out"></output>', 'out', 'A<B'), '<output id="out">A&lt;B</output>');
});
