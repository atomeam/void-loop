// /music/ (Versus' Spotify floor, the hub of the music tools): the setlists (playlists of saved tempos), a catalogue of tempo words, scales, chords, tunings and songs
// to play, and recommendations for practice. Everything is lists and numbers from lib/music-tools.js; the sound is on the pages it links to.
import { TEMPO_TERMS, SCALE_TYPES, CHORD_TYPES, TUNINGS, SHEETS, practiceLadder, chordsInKey, nextChords, scalesWith, chordOf, scaleOf, pitchClass, NOTE_NAMES } from '/lib/music-tools.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, setlist, drawSetlist, setlistLink, shareLink, t, wire, num, KEY } from '/lib/music-ui.js';

const say_ = (s) => { $('plNote').textContent = s; };
let list = setlist();
const draw = () => drawSetlist($('setlist'), list, (e) => { location.href = '/metronome/?bpm=' + e.bpm + '&sig=' + encodeURIComponent(e.sig) + '&sub=' + e.sub; });
const CATS = {
  tempo: () => TEMPO_TERMS.map(([n, r, d]) => [n, r, d]),
  scale: () => Object.values(SCALE_TYPES).map((s) => [s.name, s.iv.length + ' ' + t('notes'), scaleOf('C', Object.keys(SCALE_TYPES).find((k) => SCALE_TYPES[k] === s)).notes.join(' ') + ' (' + t('from') + ' C)']),
  chord: () => Object.entries(CHORD_TYPES).map(([k, c]) => ['C' + k, c.name, chordOf('C', k).notes.join(' ')]),
  tuning: () => Object.values(TUNINGS).filter((x) => x.notes.length).map((x) => [x.label, x.notes.length + ' ' + t('strings'), x.notes.join(' ')]),
  song: () => SHEETS.map((s) => [s.name, s.bpm + ' BPM', t('Play it on the piano')]),
};
function cat(which) {
  for (const b of document.querySelectorAll('[data-cat]')) b.setAttribute('aria-selected', String(b.dataset.cat === which));
  const tb = $('cat'); tb.tBodies[0].textContent = ''; for (const row of CATS[which]()) { const r = tb.tBodies[0].insertRow(); row.forEach((v, i) => { const c = r.insertCell(); if (which === 'song' && i === 2) { const a = document.createElement('a'); a.href = '/piano/'; a.textContent = v; c.append(a); } else c.textContent = v; }); }
}
function recs() {
  const bpm = num($('target'), 30, 300, 120), root = NOTE_NAMES[pitchClass($('rk').value)], minor = $('rmin').checked, ks = chordsInKey(root, minor), by = Object.fromEntries(ks.map((c) => [c.roman, c.symbol]));
  $('ladder').textContent = t('Start at') + ' ' + practiceLadder(bpm).join(', ') + ' BPM ' + t('and move up when it is clean.');
  const first = minor ? 'i' : 'I', fifth = minor ? 'v' : 'V';
  $('recChords').textContent = t('In') + ' ' + root + (minor ? ' minor' : ' major') + ': ' + first + ' (' + by[first] + ') ' + t('goes to') + ' ' + nextChords(first).map((x) => by[x] || x).join(', ') + '; ' + fifth + ' (' + by[fifth] + ') ' + t('goes to') + ' ' + nextChords(fifth).map((x) => by[x] || x).join(', ') + '.';
  const sc = scalesWith(chordOf(root, minor ? 'm' : '').pcs).slice(0, 6).map((s) => s.name.replace(' (Ionian)', '').replace(' (Aeolian)', ''));
  $('recScales').textContent = t('Scales that hold the') + ' ' + root + (minor ? 'm' : '') + ' ' + t('chord:') + ' ' + sc.join(', ') + '.';
}
boot('/music/', say_); mountRelated($('related'), '/music/'); draw(); cat('tempo'); recs();
for (const b of document.querySelectorAll('[data-cat]')) wire(b, 'click', () => cat(b.dataset.cat));
for (const id of ['target', 'rk', 'rmin']) wire($(id), 'change', recs);
wire($('copyLink'), 'click', () => shareLink(setlistLink(list), 'Setlist', say_));
wire($('playList'), 'click', () => { if (list[0]) location.href = '/metronome/?bpm=' + list[0].bpm + '&sig=' + encodeURIComponent(list[0].sig) + '&sub=' + list[0].sub; else say_(t('Nothing saved yet. Set a tempo in the metronome and press Save to a setlist.')); });
void KEY;
