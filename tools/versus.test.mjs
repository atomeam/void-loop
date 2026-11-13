import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateLetters, reverseShift, shiftPlaces, parseTracks, weigh, putText, fillVersus } from '../void-live-deploy/lib/versus.js';

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

test('the page shift stays on the menu, and the reverse shift reads the text back', () => {
  assert.equal(shiftPlaces('5'), 5);
  assert.equal(shiftPlaces('0'), 13);
  assert.equal(shiftPlaces('26'), 25);
  assert.equal(reverseShift(13), 13);
  assert.equal(reverseShift(5), 21);
  assert.equal(rotateLetters(rotateLetters('Hello, world!', 5), reverseShift(5)), 'Hello, world!');
});

test('a letter query fills the result, the menu, and the next tool', async () => {
  const html = '<textarea id="text" name="text"></textarea><select id="shift"><option value="1">ROT1</option><option value="13" selected>ROT13</option></select><output id="out"></output><p id="map">old</p><span id="wordbit">old</span><nav class="with"><a href="/text-diff/?changed=old" data-base="/text-diff/" data-param="changed" data-from="#out">Text Compare</a><a href="/meanings/?word=old" data-base="/meanings/" data-param="word" data-from="#wordbit">Dictionary</a></nav>';
  const context = { request: new Request('https://example.test/rotate-letters/?text=' + encodeURIComponent('Hello, world!') + '&shift=13'), next: async () => new Response(html) };
  const body = await (await fillVersus(context, 'rotate')).text();
  assert.match(body, /Hello, world!/);
  assert.match(body, /<output id="out">Uryyb, jbeyq!<\/output>/);
  assert.match(body, /value="13" selected/);
  assert.match(body, /A goes to N, and Z goes to M\./);
  assert.match(body, /id="wordbit"[^>]*>Uryyb</);
  assert.match(body, /href="\/text-diff\/\?changed=Uryyb%2C%20jbeyq!"/);
  assert.match(body, /href="\/meanings\/\?word=Uryyb"/);
});

test('putText writes into an element and escapes', () => {
  assert.equal(putText('<output id="out"></output>', 'out', 'A<B'), '<output id="out">A&lt;B</output>');
});

test('the album list uses the printed start times and totals 43:53', () => {
  const raw = '0:00 21st Century Schizoid Man, including Mirrors 7:24\n7:24 I Talk to the Wind 6:05\n13:29 Epitaph, including March for No Reason and Tomorrow and Tomorrow 8:47\n22:16 Moonchild, including The Dream and The Illusion 12:12\n34:28 The Court of the Crimson King, including The Return of the Fire Witch and The Dance of the Puppets 9:25';
  const p = parseTracks(raw);
  assert.equal(p.rows.length, 5);
  assert.equal(p.clock(p.rows[4].start), '34:28');
  assert.equal(p.clock(p.total), '43:53');
});

test('a markup query fills the weight and the next tool', async () => {
  const html = '<textarea id="html" name="html"></textarea><output id="out"></output><a href="/text-diff/?changed=old" data-base="/text-diff/" data-param="changed" data-from="#out">Text Compare</a>';
  const context = { request: new Request('https://example.test/our-motherfucking-version/?html=' + encodeURIComponent('<p>Hi</p><img alt="" src="a.png">')), next: async () => new Response(html) };
  const body = await (await fillVersus(context, 'weigh')).text();
  assert.match(body, /33 bytes · 1 pictures/);
  assert.match(body, /href="\/text-diff\/\?changed=33%20bytes/);
});

test('a track query fills the share link', async () => {
  const html = '<textarea id="list">old</textarea><pre id="out">old</pre><p id="total">old</p><a id="share" href="/track-times/">/track-times/</a>';
  const context = { request: new Request('https://example.test/track-times/?list=' + encodeURIComponent('One 1:00')), next: async () => new Response(html) };
  const body = await (await fillVersus(context, 'tracks')).text();
  assert.match(body, /1:00/);
  assert.match(body, /id="share" href="\/track-times\/\?list=/);
});
