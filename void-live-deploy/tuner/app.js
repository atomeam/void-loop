// /tuner/ (Versus' online tuner lane site): the microphone's pitch in cents. lib/music-tools.js detectPitch reads 4096 samples about 20 times a second on the
// device; nothing is recorded or sent. Reference tones (a string, any note) come from an oscillator.
import { TUNINGS, detectPitch, steadyFreq, noteOfFreq, nearestString, tuneWord, midiOf, freqOfMidi, pitchClass, strobeStep } from '/lib/music-tools.js';
import { audio, listen, tone } from '/lib/music-audio.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, mem, keep, t, wire, num } from '/lib/music-ui.js';

const say_ = (s) => { $('status').textContent = s; };
let mic = null, recent = [], quiet = 0, playing = null, playingBtn = null, lastCents = 0, strobeOn = false, strobePos = 0, strobeRaf = 0;
const a4 = () => num($('a4'), 410, 470, 440);

function strings() {
  const box = $('strings'); box.textContent = ''; const tn = TUNINGS[$('tun').value];
  if (!tn.notes.length) { const p = document.createElement('span'); p.className = 'note'; p.textContent = t('Chromatic: it names any note you play.'); box.append(p); return; }
  tn.notes.forEach((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = n.replace(/\d/, '') + '' + n.replace(/\D/g, ''); b.dataset.i = i; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', t('Play the note') + ' ' + n); b.onclick = () => hold(b, freqOfMidi(midiOf(n), a4())); box.append(b); });
}
function hold(btn, freq) {
  if (playing) { playing.stop(); playing = null; if (playingBtn) playingBtn.setAttribute('aria-pressed', 'false'); const same = playingBtn === btn; playingBtn = null; if (same) return; }
  audio(); playing = tone(freq); playingBtn = btn; btn.setAttribute('aria-pressed', 'true'); setTimeout(() => { if (playingBtn === btn && playing) { playing.stop(); playing = null; btn.setAttribute('aria-pressed', 'false'); playingBtn = null; } }, 6000);
}
function show(freq) {
  const key = $('tun').value, n = noteOfFreq(freq, a4()), s = nearestString(freq, key, a4());
  const name = s ? s.note.replace(/(\d)/, '$1') : n.name, cents = s ? s.cents : n.cents, c = Math.max(-50, Math.min(50, cents));
  $('note').firstChild.nodeValue = name; $('hz').textContent = freq.toFixed(1) + ' Hz · ' + (cents > 0 ? '+' : '') + cents + ' ' + t('cents');
  lastCents = cents; $('needle').style.left = (50 + c) + '%'; $('strobe').classList.toggle('ok', Math.abs(cents) <= 5); $('meter').classList.toggle('ok', Math.abs(cents) <= 5);
  const w = tuneWord(cents); $('verdict').textContent = t(w) + (Math.abs(cents) > 5 ? (cents < 0 ? ' · ' + t('tighten the string') : ' · ' + t('loosen the string')) : '');
  if (s) for (const b of $('strings').children) b.style.outline = +b.dataset.i === s.index ? '2px solid var(--accent)' : '';
}
function block(buf, sr) {
  const r = detectPitch(buf, sr);
  if (!r) { if (++quiet > 14) { recent = []; lastCents = 0; $('note').firstChild.nodeValue = '–'; $('hz').textContent = t('Play a note'); $('verdict').textContent = t('Waiting for a note.'); } return; }
  quiet = 0; recent.push(r.freq); recent = recent.slice(-5); const f = steadyFreq(recent, 5); if (f) show(f);
}
boot('/tuner/', say_); mountRelated($('related'), '/tuner/');
{ const w = new URLSearchParams(location.search).get('tun'); $('tun').value = TUNINGS[w] ? w : (mem().tun || 'guitar-standard'); } $('a4').value = mem().a4 || 440; strings();
wire($('tun'), 'change', () => { keep({ tun: $('tun').value }); strings(); }); wire($('a4'), 'change', () => { keep({ a4: a4() }); strings(); });
wire($('mic'), 'click', async () => {
  if (mic) { mic.stop(); mic = null; $('mic').setAttribute('aria-pressed', 'false'); $('mic').textContent = t('Turn the microphone on'); say_(t('The microphone is off.')); return; }
  try { mic = await listen(block); $('mic').setAttribute('aria-pressed', 'true'); $('mic').textContent = t('Turn the microphone off'); say_(t('Listening… play one string at a time.')); }
  catch (e) { say_(t('The microphone is not available:') + ' ' + (e && e.name === 'NotAllowedError' ? t('permission was refused. You can still tune by ear with the reference tones below.') : t('this browser or device has none. You can still tune by ear with the reference tones below.'))); }
});
wire($('pipeBtn'), 'click', () => { const pc = pitchClass($('pipe').value), oct = num($('pipeOct'), 0, 8, 4); hold($('pipeBtn'), freqOfMidi((oct + 1) * 12 + pc, a4())); });
addEventListener('pagehide', () => { if (mic) mic.stop(); if (playing) playing.stop(); });

// the strobe: stripes that drift right when the note is sharp and left when it is flat, and stand still when it is in tune
function strobeFrame() { if (!strobeOn) return; strobePos += strobeStep(lastCents); $('strobe').style.backgroundPositionX = strobePos + 'px'; strobeRaf = requestAnimationFrame(strobeFrame); }
function display(strobe) { strobeOn = strobe; $('dispNeedle').setAttribute('aria-pressed', String(!strobe)); $('dispStrobe').setAttribute('aria-pressed', String(strobe)); $('meter').hidden = strobe; $('strobe').hidden = !strobe; cancelAnimationFrame(strobeRaf); if (strobe) strobeFrame(); keep({ strobe }); }
wire($('dispNeedle'), 'click', () => display(false)); wire($('dispStrobe'), 'click', () => display(true)); if (mem().strobe) display(true);
