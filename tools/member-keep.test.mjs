// The five busy pages hand /members/ what the visitor is looking at, and /members/ shows and saves exactly that (lib/member-keep.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextOf, keepHref, parseKeep, recordOf } from '../void-live-deploy/lib/member-keep.js';
import { cleanRecord } from '../void-live-deploy/lib/memory-core.js';
const round = (from, loc, extra) => parseKeep(keepHref(from, contextOf(from, loc, extra)).split('?')[1]);

test('chords carries the chord sheet or scale', () => {
  assert.deepEqual(round('chords', { search: '?chord=Am7' }), { from: 'chords', what: 'chord sheet', keep: 'Am7 chord sheet', go: '/chords/?chord=Am7' });
  assert.equal(round('chords', { search: '?scale=E%20blues' }).keep, 'E blues scale');
});
test('music carries the setlist', () => {
  const r = round('music', { search: '' }, { setlist: [{ name: 'Intro', bpm: 92 }, { bpm: 120 }], go: '/music/?list=x' });
  assert.equal(r.keep, 'setlist: Intro 92 BPM, 120 BPM'); assert.equal(r.go, '/music/?list=x');
});
test('news carries the section', () => { assert.equal(round('news', { search: '?sec=tech' }).keep, 'tech news section'); });
test('brain carries the topic', () => { const r = round('brain', { search: '?t=ocean' }); assert.equal(r.keep, 'brain topic: ocean'); assert.equal(r.go, '/brain/?t=ocean'); });
test('team carries the channel', () => { const r = round('team', { search: '', hash: '#c=design' }); assert.equal(r.keep, '#design team channel'); assert.equal(r.go, '/team/#c=design'); });
test('members drops foreign hand-offs and off-page returns', () => {
  assert.equal(parseKeep('from=evil&keep=x'), null);
  assert.equal(parseKeep('from=chords&keep=x&go=https://evil.example/').go, '/chords/');
  assert.equal(parseKeep('from=chords&keep=x&go=//evil.example/chords/').go, '/chords/');
});
test('the kept item is a valid Verse memory record', () => {
  const rec = cleanRecord(recordOf(parseKeep('from=chords&keep=Am7%20chord%20sheet&go=/chords/?chord=Am7')));
  assert.ok(rec); assert.equal(rec.kind, 'note'); assert.equal(rec.name, 'Am7 chord sheet'); assert.match(rec.summary, /\/chords\/\?chord=Am7/);
});
for (const p of ['team', 'brain', 'news', 'music', 'chords']) test(p + ' wires its live context into the offer', () => {
  assert.match(readFileSync(new URL('../void-live-deploy/' + p + '/index.html', import.meta.url), 'utf8'), new RegExp("wireOffer\\('" + p + "'"));
});
test('/members/ shows and saves the kept item', () => {
  const js = readFileSync(new URL('../void-live-deploy/members/members.js', import.meta.url), 'utf8'), html = readFileSync(new URL('../void-live-deploy/members/index.html', import.meta.url), 'utf8');
  assert.match(js, /parseKeep\(location\.search\)/); assert.match(js, /\/api\/memory/); assert.match(html, /id="keeping"/);
});
