// /bpm/ (Versus' BPM counter lane site): tap tempo, note lengths and the tempo of a file. A file is decoded by the browser and measured here (lib/music-tools.js
// bpmOfSamples); it is never uploaded.
import { tapTempo, noteLengths, songLength, halfDouble, tempoName, bpmOfSamples, TIME_SIGS } from '/lib/music-tools.js';
import { audio, click } from '/lib/music-audio.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, t, wire, num } from '/lib/music-ui.js';

let taps = [], bpm = null, clickOn = false;
const say_ = (s) => { $('info').textContent = s; };
const whole = () => $('whole').checked;
function show(v) {
  bpm = v == null ? null : (whole() ? Math.round(v) : Math.round(v * 10) / 10);
  $('bpmOut').textContent = bpm == null ? '–' : bpm; if (bpm != null) $('tempoWord').textContent = tempoName(bpm) + ' · ' + Math.round(60000 / bpm) + ' ms ' + t('per beat'); lens(); length();
  // the tempo handed on (docs/HANDOFF-GAPS.md): the metronome opens at it, since it reads ?bpm=
  const go = $('toMetro'); if (go) { go.hidden = bpm == null; if (bpm != null) go.href = '/metronome/?bpm=' + bpm; }
}
function lens() {
  const tb = $('lens').tBodies[0]; tb.textContent = ''; $('lensFor').textContent = bpm == null ? t('At 120 BPM until you tap a tempo (ms per note; Hz is how often it falls each second):') : t('At') + ' ' + bpm + ' BPM (ms ' + t('per note') + '; Hz ' + t('is how often it falls each second') + '):';
  for (const n of noteLengths(bpm == null ? 120 : bpm)) { const r = tb.insertRow(); for (const v of [n.note, n.ms, n.dotted, n.triplet, n.hz]) r.insertCell().textContent = v; }
}
function length() { $('songLen').textContent = bpm == null ? '–' : songLength(bpm, $('sig').value, num($('bars'), 1, 999, 32)); }
function tap() {
  const now = performance.now(); if (clickOn) { audio(); click(audio().currentTime + 0.005, 2, 'wood', 1); }
  taps.push(now); const r = tapTempo(taps, { resetMs: +$('gap').value * 1000, keep: +$('keep').value }); taps = taps.slice(-48);
  if (r.bpm) { show(r.bpm); say_(r.taps + ' ' + t('taps') + ' · ±' + r.spread + ' ms ' + t('between the shortest and longest gap') + (r.taps < 8 ? ' · ' + t('keep going for a steadier number') : '')); } else say_(t('Keep tapping the beat.'));
}
boot('/bpm/', say_); mountRelated($('related'), '/bpm/'); lens();
{ const w = parseFloat(new URLSearchParams(location.search).get('bpm')); if (w >= 20 && w <= 400) { show(w); say_(t('Note lengths for') + ' ' + w + ' BPM. ' + t('Tap to measure your own.')); } }
wire($('tap'), 'pointerdown', (e) => { e.preventDefault(); tap(); }); wire($('tap'), 'keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
addEventListener('keydown', (e) => { const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key === 'Tab' || e.key === 'Shift') return; if (e.target === $('tap') && (e.code === 'Space' || e.code === 'Enter')) { tap(); return; } if (tag !== 'button') { e.preventDefault(); tap(); } });
const noTempo = () => { $('tempoWord').textContent = t('Tap a tempo first, then halve or double it.'); }; // never a silent button
wire($('half'), 'click', () => { if (bpm != null) show(halfDouble(bpm).half); else noTempo(); }); wire($('dbl'), 'click', () => { if (bpm != null) show(halfDouble(bpm).double); else noTempo(); });
wire($('rst'), 'click', () => { taps = []; show(null); $('tempoWord').textContent = t('10 to 15 taps give the most reliable tempo.'); say_(t('Tap the button, or any key, to the beat.')); });
wire($('click'), 'click', () => { clickOn = !clickOn; $('click').setAttribute('aria-pressed', String(clickOn)); }); wire($('whole'), 'change', () => bpm != null && show(bpm));
wire($('sig'), 'change', length); wire($('bars'), 'change', length);
wire($('file'), 'change', async () => {
  const f = $('file').files[0]; if (!f) return; const note = $('fileNote'); note.textContent = t('Measuring…');
  try {
    const c = audio(); if (!c) throw new Error('no audio'); const buf = await c.decodeAudioData(await f.arrayBuffer()), ch = buf.getChannelData(0), n = Math.min(ch.length, buf.sampleRate * 120), start = Math.max(0, Math.floor((ch.length - n) / 2));
    const r = bpmOfSamples(ch.subarray(start, start + n), buf.sampleRate);
    if (!r) { note.textContent = t('No clear beat found in that file.'); return; } show(r.bpm); note.textContent = f.name + ': ' + r.bpm + ' BPM (' + Math.round(r.confidence * 100) + '% ' + t('sure') + '). ' + t('If it sounds twice or half as fast as the song, press Half time or Double time.');
  } catch (_) { note.textContent = t('That file could not be read as audio.'); }
});
