// /piano/ (Versus' virtualpiano.net lane site): a playable keyboard. Computer keys, mouse, touch and a MIDI keyboard play instruments made from oscillators
// (lib/music-audio.js startNote); sheets are plain letters (lib/music-tools.js parseSheet). Nothing is loaded and nothing is sent.
import { midiForKey, keyForMidi, isBlack, noteName, parseSheet, SHEETS, recordingToSheet } from '/lib/music-tools.js';
import { audio, startNote, setReverb } from '/lib/music-audio.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, mem, keep, t, wire, num } from '/lib/music-ui.js';

const LOW = 36, HIGH = 96, W = 44; // C2 to C7: the 36 white keys the computer keys map onto
const say_ = (s) => { $('status').textContent = s; };
const held = new Map(), sustained = new Set(); // id -> {note, midi}
let sus = false, recording = false, recStart = 0, rec = [], sheetTimers = [], sheetNotes = [];
const shift = () => num($('trans'), -12, 12, 0) + +$('oct').value;
const keyEls = new Map();
// the notes held down together in the latest press (a new press after every key is up starts a new group); two or more go to /chords/ to be named
const group = new Set();
function chordsLink(notes) {
  const pcs = [...new Set([...notes].sort((a, b) => a - b).map((m) => noteName(m, false).replace(/-?\d+$/, '')))];
  if (pcs.length < 2) return; const a = $('toChords'); a.href = '/chords/?notes=' + encodeURIComponent(pcs.join(',')); a.hidden = false;
}

function build() {
  const kbi = $('kbi'); kbi.textContent = ''; let wi = 0;
  for (let m = LOW; m <= HIGH; m++) {
    if (isBlack(m)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bk'; b.style.left = wi * W + 'px'; b.dataset.m = m; b.setAttribute('aria-label', noteName(m, true)); kbi.append(b); keyEls.set(m, b); }
    else { const k = document.createElement('button'); k.type = 'button'; k.className = 'wk'; k.dataset.m = m; k.setAttribute('aria-label', noteName(m)); kbi.append(k); keyEls.set(m, k); wi++; }
  }
  labels();
}
function labels() {
  const on = $('lab').checked;
  for (const [m, el] of keyEls) { const k = keyForMidi(m), name = noteName(m + shift(), true); el.textContent = ''; if (!on) continue; const a = document.createElement('span'); a.textContent = (k || '').toUpperCase().replace('⇧', '⇧'); el.append(a); if (m % 12 === 0 && !isBlack(m)) { const b = document.createElement('span'); b.textContent = name; b.style.cssText = 'display:block;font-size:10px;opacity:.7'; el.append(b); } }
}
function down(id, midi, vel = 0.8) {
  if (held.has(id)) return; const el = keyEls.get(midi); if (el) el.classList.add('on');
  const p = shift(), note = startNote(midi + p, $('ins').value, vel); held.set(id, { note, midi });
  if (held.size === 1) group.clear(); group.add(midi + p); if (group.size > 1) chordsLink(group);
  if (recording) rec.push({ t: performance.now() - recStart, midi: midi + p, down: true });
}
function up(id) {
  const h = held.get(id); if (!h) return; held.delete(id); const el = keyEls.get(h.midi); if (el) el.classList.remove('on');
  if (recording) rec.push({ t: performance.now() - recStart, midi: h.midi + shift(), down: false });
  if (sus) sustained.add(h); else h.note.release();
}
function setSus(on) { sus = on; $('sus').setAttribute('aria-pressed', String(on)); if (!on) { for (const h of sustained) h.note.release(); sustained.clear(); } }

boot('/piano/', say_); mountRelated($('related'), '/piano/');
build(); $('kb').scrollLeft = (60 - LOW) * 7 / 12 * W - 60;
for (const [id, s] of SHEETS.map((x) => [x.id, x]).concat([])) { const o = new Option(s.name, id); $('song').append(o); }
$('song').append(new Option(t('My recording'), 'mine')); $('song').append(new Option(t('Write my own'), 'own'));
$('ins').value = mem().ins || 'piano'; wire($('ins'), 'change', () => keep({ ins: $('ins').value }));
// pointer: mouse and touch, with a slide from key to key while pressed
let ptr = null;
$('kbi').addEventListener('pointerdown', (e) => { const k = e.target.closest('[data-m]'); if (!k) return; audio(); ptr = { id: 'p' + e.pointerId, cur: +k.dataset.m }; down(ptr.id, ptr.cur, 0.6 + 0.4 * Math.min(1, (e.offsetY || 60) / 120)); });
$('kbi').addEventListener('pointerover', (e) => { if (!ptr || !(e.buttons & 1) || e.pointerType === 'touch') return; const k = e.target.closest('[data-m]'); if (!k || +k.dataset.m === ptr.cur) return; up(ptr.id); ptr.cur = +k.dataset.m; down(ptr.id, ptr.cur); });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { if (ptr) { up(ptr.id); ptr = null; } });
$('kbi').addEventListener('contextmenu', (e) => e.preventDefault());
// computer keys: 1 to 0, q to p, a to l, z to m; Shift for a sharp; the space bar is the sustain pedal
const codes = new Map();
addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setSus(true); return; }
  if (e.repeat) return; const m = midiForKey(e.code, e.shiftKey); if (m === null || m + shift() < 21) return; audio(); e.preventDefault(); codes.set(e.code, m); down('k' + e.code, m);
});
addEventListener('keyup', (e) => { if (e.code === 'Space') { setSus(false); return; } if (codes.has(e.code)) { codes.delete(e.code); up('k' + e.code); } });
wire($('sus'), 'click', () => setSus(!sus)); wire($('lab'), 'change', labels); wire($('oct'), 'change', labels); wire($('trans'), 'change', labels); wire($('rev'), 'change', () => setReverb($('rev').checked));
// a MIDI keyboard
wire($('midi'), 'change', async () => {
  if (!$('midi').checked) return;
  try { const acc = await navigator.requestMIDIAccess(); let n = 0; for (const inp of acc.inputs.values()) { n++; inp.onmidimessage = (ev) => { const [s, d1, d2] = ev.data, cmd = s & 0xf0; const m = d1; if (m < LOW || m > HIGH) return; if (cmd === 0x90 && d2 > 0) down('m' + m, m, d2 / 127); else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) up('m' + m); else if (cmd === 0xb0 && d1 === 64) setSus(d2 >= 64); }; }
    say_(n ? n + ' ' + t('MIDI keyboard connected.') : t('No MIDI keyboard found. Plug one in and tick the box again.')); }
  catch (_) { $('midi').checked = false; say_(t('This browser does not give web pages MIDI access.')); }
});
// record and replay
const sheetBpm = () => num($('songBpm'), 30, 300, 100);
wire($('rec'), 'click', () => {
  if (!recording) { recording = true; rec = []; recStart = performance.now(); $('rec').setAttribute('aria-pressed', 'true'); $('rec').textContent = t('Stop recording'); $('recNote').textContent = t('Recording… play something.'); return; }
  recording = false; $('rec').setAttribute('aria-pressed', 'false'); $('rec').textContent = t('Record'); const sh = recordingToSheet(rec, sheetBpm());
  if (!sh) { $('recNote').textContent = t('Nothing was played.'); return; }
  mem(); keep({ rec: sh }); for (const b of ['replay', 'copyRec', 'clearRec']) $(b).disabled = false; $('recNote').textContent = t('Recorded as a sheet at') + ' ' + sheetBpm() + ' BPM: ' + sh.slice(0, 160) + (sh.length > 160 ? '…' : '');
  $('song').value = 'mine'; $('sheet').value = sh;
});
wire($('replay'), 'click', () => { $('sheet').value = mem().rec || ''; playSheet(); });
wire($('copyRec'), 'click', async () => { try { await navigator.clipboard.writeText(mem().rec || ''); say_(t('Copied the sheet.')); } catch (_) { say_(mem().rec || ''); } });
wire($('clearRec'), 'click', () => { keep({ rec: '' }); for (const b of ['replay', 'copyRec', 'clearRec']) $(b).disabled = true; $('recNote').textContent = t('Nothing recorded yet. Your playing is turned into a sheet in plain letters you can copy, edit and play again.'); });
if (mem().rec) for (const b of ['replay', 'copyRec', 'clearRec']) $(b).disabled = false;
// sheets
wire($('song'), 'change', () => { const v = $('song').value, s = SHEETS.find((x) => x.id === v); if (s) { $('sheet').value = s.sheet; $('songBpm').value = s.bpm; } else if (v === 'mine') $('sheet').value = mem().rec || ''; else $('sheet').value = ''; });
{ const want = SHEETS.find((x) => x.id === new URLSearchParams(location.search).get('song')) || SHEETS[0]; $('song').value = want.id; $('sheet').value = want.sheet; $('songBpm').value = want.bpm; }
// a sheet another page sends in the link (/chords/ sends a chord or a scale): ?sheet= in the plain letters, ?bpm= its tempo
{ const q = new URLSearchParams(location.search), sh = (q.get('sheet') || '').slice(0, 4000).trim(), p = sh ? parseSheet(sh) : null;
  if (p && p.events.length && !p.bad.length) { $('song').value = 'own'; $('sheet').value = sh; const b = +q.get('bpm'); if (b >= 30 && b <= 300) $('songBpm').value = Math.round(b);
    $('sheetNote').textContent = t('This sheet came in the link:') + ' ' + p.events.length + ' ' + t('notes') + '. ' + t('Press Play the sheet to hear it.'); $('sheet').scrollIntoView({ block: 'center' }); } }
function stopSheet() { for (const x of sheetTimers) clearTimeout(x); sheetTimers = []; for (const n of sheetNotes) n.release(); sheetNotes = []; for (const el of keyEls.values()) el.classList.remove('on'); }
function playSheet() {
  stopSheet(); const p = parseSheet($('sheet').value), c = audio(); if (!c) { say_(t('This browser cannot make sound.')); return; }
  if (p.bad.length) { $('sheetNote').textContent = t('Not music:') + ' ' + p.bad.slice(0, 5).join(' '); return; } if (!p.events.length) { $('sheetNote').textContent = t('The sheet is empty.'); return; }
  const spb = 60 / sheetBpm(), t0 = c.currentTime + 0.1;
  for (const ev of p.events) { for (const m of ev.notes) { sheetNotes.push(startNote(m + shift(), $('ins').value, 0.7, t0 + ev.at * spb, ev.dur * spb * 0.97)); const el = keyEls.get(m); if (el) { sheetTimers.push(setTimeout(() => el.classList.add('on'), 100 + ev.at * spb * 1000)); sheetTimers.push(setTimeout(() => el.classList.remove('on'), 100 + (ev.at + ev.dur) * spb * 1000 * 0.97)); } } }
  sheetTimers.push(setTimeout(() => { $('sheetNote').textContent = t('Done.'); }, 200 + p.beats * spb * 1000)); $('sheetNote').textContent = t('Playing') + ' ' + p.events.length + ' ' + t('notes') + '…';
}
wire($('playSheet'), 'click', playSheet); wire($('stopSheet'), 'click', () => { stopSheet(); $('sheetNote').textContent = t('Stopped.'); });
