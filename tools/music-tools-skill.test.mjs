// music-tools (skills/music-tools.js): which asks open a music tool page and the address each one opens on (the tempo and time signature, the
// tuning, the chord, the scale), the card's heading and link, the six pages listed beside it, and the /music/ card for an ask it does not know.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/music-tools.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const m = (t) => sk.match(t.toLowerCase(), t);
const card = (ask) => { const el = { innerHTML: '', dataset: {} }; assert.equal(sk.run(ask, { showPage: (f) => f(el), esc }), 'music-tools'); return el; };
const open = (ask) => { const el = card(ask), a = /<p><a href="([^"]*)" style="font-weight:600">Open (.*?) →<\/a><\/p>/.exec(el.innerHTML); return [a[1].replace(/&amp;/g, '&'), a[2], /<h2>(.*?)<\/h2>/.exec(el.innerHTML)[1], el.dataset.page]; };

test('examples in, near misses out, and the asks the rules name', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['metronome 90 bpm 3/4', '140 bpm metronome', 'metronome at 60', 'tune my ukulele', 'bass tuner', 'violin tuner online', 'C#m7 chord', 'Dm9 chord', 'd minor 9 chord', 'play am7 chord', 'play a d minor 9 chord at 432 hz', 'f# minor scale', 'Bb blues scale', 'chord finder', 'my setlist', 'bpm finder', 'virtual keyboard', 'Online piano?']) assert.ok(m(a), a);
  for (const a of ['h major scale', 'metronome 5 bpm', 'piano lessons', 'who invented the metronome', 'tuner car', 'chord progression ideas', 'c major', 'play the chord', 'guitar chord']) assert.ok(!m(a), a);
});
test('each ask opens its page on the thing asked', () => {
  assert.deepEqual(open('metronome 120 bpm'), ['/metronome/?bpm=120', 'Metronome at 120 BPM', 'Metronome at 120 BPM', '/metronome/']);
  assert.deepEqual(open('metronome 90 bpm 3/4'), ['/metronome/?bpm=90&sig=3%2F4', 'Metronome at 90 BPM in 3/4', 'Metronome at 90 BPM in 3/4', '/metronome/']);
  assert.deepEqual(open('140 bpm 6/8 metronome').slice(0, 2), ['/metronome/?bpm=140&sig=6%2F8', 'Metronome at 140 BPM in 6/8']);
  assert.deepEqual(open('tune my ukulele').slice(0, 2), ['/tuner/?tun=ukulele', 'Tuner']);
  assert.equal(open('bass tuner')[0], '/tuner/?tun=bass4'); assert.equal(open('violin tuner')[0], '/tuner/?tun=violin'); assert.equal(open('cello tuner')[0], '/tuner/?tun=cello'); assert.equal(open('guitar tuner')[0], '/tuner/');
  assert.deepEqual(open('am7 chord').slice(0, 3), ['/chords/?chord=Am7', 'Am7 chord', 'Am7 chord']);
  assert.deepEqual(open('c#m7 chord').slice(0, 2), ['/chords/?chord=C%23m7', 'C#m7 chord']);
  assert.deepEqual(open('bb blues scale').slice(0, 2), ['/chords/?scale=Bb%20blues', 'Bb blues scale']);
  assert.deepEqual(open('c major scale').slice(0, 2), ['/chords/?scale=C%20major', 'C major scale']);
  assert.deepEqual(open('circle of fifths'), ['/chords/', 'Chords and scales', 'Chords and scales', '/chords/']);
  assert.deepEqual(open('tap tempo').slice(0, 2), ['/bpm/', 'BPM counter']);
  assert.deepEqual(open('online piano').slice(0, 2), ['/piano/', 'Online piano']);
  assert.deepEqual(open('music tools?').slice(0, 2), ['/music/', 'Music tools']);
  assert.deepEqual(open('dm9 chord').slice(0, 3), ['/chords/?chord=Dm9', 'Dm9 chord', 'Dm9 chord']);
  assert.deepEqual(open('d minor 9 chord').slice(0, 2), ['/chords/?chord=Dm9', 'Dm9 chord']);
});
test('playing a chord at a custom pitch deals a synth card with its true frequencies', async () => {
  const { chordToken } = await import('../void-live-deploy/lib/music-tools.js');
  const lib = await import('../void-live-deploy/skills/music-tools.js');
  assert.deepEqual(chordToken('D minor 9'), { root: 'D', type: 'm9', symbol: 'Dm9', name: 'D minor 9th', notes: ['D', 'F', 'A', 'C', 'E'] });
  assert.equal(chordToken('guitar'), null);
  assert.equal(chordToken('the'), null);
  // D minor 9 at A4 = 432 Hz: A itself lands on 432, everything else scales by 432/440
  assert.deepEqual(lib.chordFreqs('D', 'm9', 432), [288.3, 342.9, 432, 513.7, 647.3]);
  assert.deepEqual(lib.chordFreqs('D', 'm9', 440), [293.7, 349.2, 440, 523.3, 659.3]);
  const el = card('play a D minor 9 chord at 432 Hz');
  assert.equal(el.dataset.page, '/chords/');
  assert.match(el.innerHTML, /<h2>Dm9 chord at 432 Hz<\/h2>/);
  assert.match(el.innerHTML, /D minor 9th · A4 = 432 Hz/);
  assert.match(el.innerHTML, /D 288\.3 Hz · F 342\.9 Hz · A 432 Hz · C 513\.7 Hz · E 647\.3 Hz/);
  assert.match(el.innerHTML, /<button type="button" class="ms-play"[^>]*>Play<\/button>/);
  assert.match(el.innerHTML, /\/chords\/\?chord=Dm9/);
  const plain = card('play am7 chord');
  assert.match(plain.innerHTML, /<h2>Am7 chord<\/h2>/);
  assert.match(plain.innerHTML, /A 440 Hz/);
});
test('the card lists the six pages, and an unknown ask falls back to /music/', () => {
  const el = card('tap tempo');
  for (const h of ['/metronome/', '/piano/', '/tuner/', '/bpm/', '/chords/', '/music/']) assert.ok(el.innerHTML.includes('<li><a href="' + h + '">'), h);
  assert.equal((el.innerHTML.match(/<li>/g) || []).length, 6);
  assert.match(el.innerHTML, /every sound is made in your browser, nothing is sent/);
  assert.deepEqual(open('make me a song'), ['/music/', 'Music tools', 'Music tools', '/music/']);
});
test('the metronome page gives its card the tempo on it, and the stage opens the metronome at that tempo', async () => {
  const fs = await import('node:fs'), page = fs.readFileSync(new URL('../void-live-deploy/metronome/app.js', import.meta.url), 'utf8');
  const ask = /\{ card: \(\) => ('metronome ' \+ Math\.round\(st\.bpm\) \+ ' bpm' \+ \(st\.sig === '4\/4' \? '' : ' ' \+ st\.sig\)) \}/.exec(page);
  assert.ok(ask, 'the metronome page passes a card ask');
  const of = (st) => new Function('st', 'return ' + ask[1])(st); // eslint-disable-line no-new-func
  assert.deepEqual(open(of({ bpm: 93, sig: '4/4' })).slice(0, 2), ['/metronome/?bpm=93', 'Metronome at 93 BPM']);
  assert.deepEqual(open(of({ bpm: 92.6, sig: '6/8' })).slice(0, 2), ['/metronome/?bpm=93&sig=6%2F8', 'Metronome at 93 BPM in 6/8']);
});
