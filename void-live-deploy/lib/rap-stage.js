// The rap on screen and out loud (lib/rap.js has the rules): one place draws a rap and performs it, so the stage's rap card (skills/rap.js) and the
// /rap/ page show and play the same thing. A rap is drawn bar by bar with its rhyme letter, its rhyming end word marked, and its sections. Perform
// plays the style's produced beat (lib/rap-beat.js: drums with swing, 808 or sub bass, chords, a mix bus) and raps over it in Verse's own voice
// (2026-10-30: each bar said by the site's text-to-speech route and put syllable by syllable on the beat's grid, lib/rap-voice.js and
// lib/rap-song.js), lighting the bar being said. The voice list also offers the browser's own voices, which say each bar on its measure. "Rap it
// yourself" plays the beat and lights the bars with no voice, so a visitor can take the mic. Save the beat and Save the song write stereo WAVs;
// Make the video writes an MP4 music video (lib/rap-video.js). Everything typed or read goes in with textContent, never as markup. Only the
// rap's own bars are sent, to the voice route; the beat, the mix and the video are made in this browser.
import { schemeOf, endWordOf, statsOf, beatFor, timingOf, lengthOf, rapText, STYLES, MOODS } from './rap.js';
import { produce } from './rap-beat.js';
import { songOf, RATE, drumsFor } from './rap-song.js';
import { makeVideo, canMakeVideo } from './rap-video.js';

const el = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const stop = (e) => e.stopPropagation();

/** the bars of a rap drawn into `box` (sections, rhyme letters, the end word marked). Returns the bar elements in order. */
export function drawBars(box, r, doc = document) {
  box.textContent = '';
  const bars = r.sections.flatMap((s) => s.bars), sc = schemeOf(bars), out = []; let i = 0;
  for (const s of r.sections) {
    const sec = el(doc, 'section', 'rp-sec'); sec.append(el(doc, 'h3', 'rp-name', s.name));
    const ol = el(doc, 'ol', 'rp-bars');
    for (const b of s.bars) {
      const li = el(doc, 'li', 'rp-bar'); li.dataset.i = String(i);
      const letter = sc.letters[i], tag = el(doc, 'span', 'rp-l' + (letter ? ' rp-' + letter : ''), letter || '·'); tag.setAttribute('data-share-skip', '1'); li.append(tag); // the scheme letter is shown, not saved: a shared bar reads as the bar
      const end = endWordOf(b), at = end ? b.toLowerCase().lastIndexOf(end) : -1, text = el(doc, 'span', 'rp-t');
      if (letter && at >= 0) { text.append(doc.createTextNode(b.slice(0, at))); text.append(el(doc, 'mark', 'rp-r rp-' + letter, b.slice(at, at + end.length))); text.append(doc.createTextNode(b.slice(at + end.length))); } else text.textContent = b;
      li.append(text); ol.append(li); out.push(li); i++;
    }
    sec.append(ol); box.append(sec);
  }
  return out;
}

/** the one line that says what the rap is, from its own counts. Pure. */
export function metaLine(r, s, beat) {
  const st = statsOf(r);
  return (STYLES[s.style] || STYLES['boom bap']).label + ' · ' + s.mood + ' · ' + beat.bpm + ' BPM · ' + st.bars + ' bars in ' + st.sections + ' parts · ' + st.rhymed + ' of ' + st.bars + ' bars end on a rhyme · about ' + st.avgSyllables + ' syllables a bar';
}

/** the English voices this browser has, best first (a local voice before a network one). */
export function voicesOf(synth) {
  const all = synth && synth.getVoices ? synth.getVoices() : [];
  return all.filter((v) => /^en\b|^en-/i.test(v.lang || '')).sort((a, b) => (b.localService ? 1 : 0) - (a.localService ? 1 : 0));
}

/** a performer for one rap: { play(mode), stop(), playing, wav(withVoice), song }. mode 'voice' raps the bars (Verse's own voice when voice()
 *  is 'verse', else the browser voice it returns), 'self' lights them with no voice. onBar(i) is called as each bar starts (-1 for the
 *  count-in, null at the end); onSay(text) for a status line. */
export function performer(r, s, { win = window, onBar = () => {}, onSay = () => {}, voice = () => 'verse', volume = () => 0.8, song = null } = {}) {
  let the = song || songOf(r, s, { win }), beat = the.plan.beat, timing = the.plan.timing, total = lengthOf(timing, beat);
  let ac = null, timers = [], beatGain = null, token = 0;
  const synth = win.speechSynthesis || null;
  const end = () => { token++; for (const t of timers) clearTimeout(t); timers = []; try { synth && synth.cancel(); } catch (_) {} try { ac && ac.close(); } catch (_) {} ac = null; beatGain = null; onBar(null); };
  const api = {
    get beat() { return beat; }, get timing() { return timing; }, get total() { return total; }, get song() { return the; },
    /** play another take of the same rap from now on (a take Verse retuned from what it heard, lib/rap-listen.js) */
    setSong(next) { end(); the = next; beat = the.plan.beat; timing = the.plan.timing; total = lengthOf(timing, beat); },
    get playing() { return !!ac; },
    stop: end,
    setVolume(v) { if (beatGain) beatGain.gain.value = v; },
    play(mode = 'voice') {
      end(); const my = token;
      const AC = win.AudioContext || win.webkitAudioContext; if (!AC) { onSay('This browser has no Web Audio, so I cannot play the beat.'); return false; }
      // the context is made inside the click, so the browser lets it sound; the voice is fetched after
      try { ac = new AC(); if (ac.resume) ac.resume(); } catch (_) { onSay('Could not start sound.'); ac = null; return false; }
      const pick = mode === 'voice' ? voice() : null, own = pick === 'verse';
      (async () => {
        let vox = null, note = '', whole = null;
        // a retuned take is mastered as a whole, so it plays as the rendered mix (the Beat slider sets its level)
        if (own && the.tune) { onSay('Getting my new take ready.'); const m = await the.mix(true); if (my !== token) return; whole = m; note = (await the.voice()).note; }
        else if (own) {
          onSay('Getting my voice ready.');
          const v = await the.voice((d, n) => { if (my === token) onSay('Getting my voice ready: ' + d + ' of ' + n + ' bars.'); });
          if (my !== token) return;
          if (v.stem) vox = v.stem; note = v.note;
        }
        if (my !== token || !ac) return;
        // the recorded drums: decoded once per page, so a second play starts at once
        const kit = whole ? null : await drumsFor(beat, ac, { win });
        if (my !== token || !ac) return;
        // say which drums play, so a kit that did not load is never passed off as the real one
        const drums = whole ? '' : kit ? (kit.name === '808' ? ' Real TR-808 drums.' : ' A real recorded drum kit.') : ' The recorded drums did not load, so my synth drums play.';
        const out = ac.createGain(); out.gain.value = 1; out.connect(ac.destination);
        beatGain = ac.createGain(); beatGain.gain.value = volume(); beatGain.connect(out);
        const t0 = ac.currentTime + 0.2;
        if (whole) { const b = ac.createBuffer(2, whole[0].length, RATE); b.getChannelData(0).set(whole[0]); b.getChannelData(1).set(whole[1]); const src = ac.createBufferSource(); src.buffer = b; src.connect(beatGain); beatGain.gain.value = 1; src.start(t0); vox = whole; }
        else produce(ac, beat, { measures: the.plan.measures, t0, dest: beatGain, kit });
        if (vox && !whole) { const b = ac.createBuffer(2, vox[0].length, RATE); b.getChannelData(0).set(vox[0]); b.getChannelData(1).set(vox[1]); const src = ac.createBufferSource(); src.buffer = b; src.connect(out); src.start(t0); }
        const speak = !vox && mode === 'voice' && synth && typeof win.SpeechSynthesisUtterance === 'function';
        if (mode === 'voice' && !vox && !speak) onSay('This browser has no voice to rap with, so the beat plays and the bars light up: rap it yourself.');
        else if (own && !vox) onSay('My own voice is not answering right now (' + (note || 'no bars came back') + '), so this browser\'s voice raps it.');
        else if (own && note) onSay('One measure to count in, then I rap.' + drums + ' Some bars have no voice: ' + note + '.');
        else onSay((mode === 'voice' ? 'One measure to count in, then I rap.' : 'Your turn: one measure to count in, then each bar lights up on its measure.') + drums);
        onBar(-1);
        const at = (sec, fn) => timers.push(setTimeout(fn, Math.max(0, (t0 + sec - ac.currentTime) * 1000)));
        const bv = own ? null : pick;
        timing.forEach((b, k) => at(b.at, () => {
          if (!ac) return; onBar(b.bar);
          // the status line follows the performance, so it never still says "count in" once the rap is under way
          onSay((mode === 'voice' ? 'Bar ' : 'Your bar: ') + (k + 1) + ' of ' + timing.length + (b.section ? ', the ' + String(b.section).toLowerCase() : '') + '.' + (own && note && vox ? ' Some bars have no voice: ' + note + '.' : ''));
          if (speak) { try { synth.cancel(); const u = new win.SpeechSynthesisUtterance(b.text); u.rate = b.rate; u.pitch = 0.85; u.lang = 'en-US'; if (bv) u.voice = bv; synth.speak(u); } catch (_) { /* a voice that failed: the beat goes on */ } }
        }));
        at(the.plan.measures * the.plan.measure + 0.6, () => { end(); onSay('That was the whole rap. Perform it again, save the song, or make the video.'); });
      })().catch(() => { if (my === token) { end(); onSay('Could not start the sound.'); } });
      return true;
    },
    async wav(withVoice = false) { return the.wav(withVoice); },
  };
  return api;
}

const fileName = (r, s, what) => ((r.title || s.topic || 'verse') + ' ' + what).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
function download(doc, bytes, type, name) { const u = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes], { type })), a = doc.createElement('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

/** the rap, drawn and playable, inside `box`: the bars, a meta line, and the controls (Perform, Rap it yourself, voice, beat volume, Copy the
 *  lyrics, Save the beat, Save the song, Make the video, and the page's own extra buttons). Returns { perf, stop(), say, song, useSong(next) }. */
export function mountRap(box, r, s, { doc = document, win = window, extra = [] } = {}) {
  box.textContent = '';
  const perf0 = beatFor(s), meta = el(doc, 'p', 'rp-meta', metaLine(r, s, perf0)), lyr = el(doc, 'div', 'rp-lyrics'), ctl = el(doc, 'div', 'rp-ctl'), msg = el(doc, 'p', 'rp-msg'), vid = el(doc, 'div', 'rp-video');
  msg.setAttribute('role', 'status'); lyr.setAttribute('aria-live', 'off');
  // a copied or saved card keeps the meta line and the bars, never the buttons, the voice list or a status line (lib/card-share.js data-share-skip)
  ctl.setAttribute('data-share-skip', '1'); msg.setAttribute('data-share-skip', '1'); vid.setAttribute('data-share-skip', '1'); vid.hidden = true;
  const bars = drawBars(lyr, r, doc);
  const play = el(doc, 'button', 'rp-btn go', 'Perform it'), self = el(doc, 'button', 'rp-btn', 'Rap it yourself'), copy = el(doc, 'button', 'rp-btn', 'Copy the lyrics'), wavB = el(doc, 'button', 'rp-btn', 'Save the beat'), songB = el(doc, 'button', 'rp-btn', 'Save the song'), vidB = el(doc, 'button', 'rp-btn', 'Make the video');
  for (const b of [play, self, copy, wavB, songB, vidB]) { b.type = 'button'; b.addEventListener('pointerdown', stop); b.addEventListener('keydown', stop); }
  const vsel = el(doc, 'select', 'rp-voice'); vsel.setAttribute('aria-label', 'Voice'); vsel.addEventListener('pointerdown', stop); vsel.addEventListener('keydown', stop);
  const vol = el(doc, 'input', 'rp-vol'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = '0.8'; vol.setAttribute('aria-label', 'Beat volume'); vol.addEventListener('pointerdown', stop); vol.addEventListener('keydown', stop);
  const synth = win.speechSynthesis || null; let voices = [];
  // Verse's own voice first (on the beat's grid), then this browser's English voices
  const fill = () => { const was = vsel.value; voices = voicesOf(synth); vsel.textContent = ''; const d = el(doc, 'option', '', 'Voice: Verse'); d.value = 'verse'; vsel.append(d); voices.slice(0, 12).forEach((v, k) => { const o = el(doc, 'option', '', 'Voice: ' + v.name + ' (this browser)'); o.value = 'b' + k; vsel.append(o); }); if (was && [...vsel.options].some((o) => o.value === was)) vsel.value = was; };
  fill(); if (synth && 'onvoiceschanged' in synth) synth.addEventListener('voiceschanged', fill);
  const say = (t) => { msg.textContent = t || ''; };
  let song = songOf(r, s, { win });
  const perf = performer(r, s, { win, song, onSay: say, voice: () => (vsel.value === 'verse' || !vsel.value ? 'verse' : voices[+vsel.value.slice(1)] || null), volume: () => +vol.value,
    onBar: (i) => { for (const b of bars) b.classList.toggle('on', +b.dataset.i === i); if (i == null) { play.textContent = 'Perform it'; self.textContent = 'Rap it yourself'; } } });
  vol.addEventListener('input', () => perf.setVolume(+vol.value));
  play.addEventListener('click', () => { if (perf.playing) { perf.stop(); say(''); return; } if (perf.play('voice')) { play.textContent = 'Stop'; self.textContent = 'Rap it yourself'; } });
  self.addEventListener('click', () => { if (perf.playing) { perf.stop(); say(''); return; } if (perf.play('self')) { self.textContent = 'Stop'; play.textContent = 'Perform it'; } });
  copy.addEventListener('click', async () => { try { await win.navigator.clipboard.writeText(rapText(r)); say('Copied the lyrics.'); } catch (_) { say('Select the lyrics and copy them.'); } });
  wavB.addEventListener('click', async () => {
    say('Rendering the beat.');
    try { const bytes = await perf.wav(false); if (!bytes) { say('This browser cannot render audio offline.'); return; } download(doc, bytes, 'audio/wav', fileName(r, s, 'beat') + '.wav'); say('Saved the beat: ' + song.plan.measures + ' measures at ' + song.plan.beat.bpm + ' BPM, with its intro and outro, in stereo.'); } catch (_) { say('Could not render the beat.'); }
  });
  songB.addEventListener('click', async () => {
    say('Rendering the song: the beat, then my voice.');
    try {
      const v = await song.voice((d, n) => say('Getting my voice ready: ' + d + ' of ' + n + ' bars.')), bytes = await song.wav(true);
      if (!bytes) { say('This browser cannot render audio offline.'); return; }
      download(doc, bytes, 'audio/wav', fileName(r, s, 'song') + '.wav');
      say(v.stem ? 'Saved the song: my voice over the beat, ' + Math.round(song.plan.seconds) + ' seconds in stereo.' + (v.note ? ' Some bars have no voice: ' + v.note + '.' : '') : 'My voice is not answering right now (' + (v.note || 'no bars came back') + '), so I saved the beat alone.');
    } catch (_) { say('Could not render the song.'); }
  });
  vidB.addEventListener('click', async () => {
    if (!canMakeVideo(win)) { say('This browser cannot code video. Chrome, Edge and Safari 17 or later can make the music video.'); return; }
    vidB.disabled = true; say('Making the music video.');
    try {
      const got = await makeVideo(r, s, song, { doc, g: win, onProgress: (p, what) => say('Making the music video: ' + what + ', ' + Math.round(p * 100) + '%.') });
      const u = URL.createObjectURL(got.blob); vid.textContent = ''; vid.hidden = false;
      const v = el(doc, 'video', 'rp-vplayer'); v.controls = true; v.playsInline = true; v.src = u; v.setAttribute('aria-label', 'The music video'); v.style.cssText = 'display:block;width:100%;max-width:960px;aspect-ratio:16/9;border-radius:12px;background:#03040a;margin:8px 0';
      const a = el(doc, 'a', 'rp-btn go', 'Download the video (MP4)'); a.href = u; a.download = got.name;
      vid.append(v, a);
      say('The music video is ready: ' + Math.round(got.seconds) + ' seconds, 1280 x 720. Play it here or download it.' + (got.voiced ? '' : ' My voice was not answering, so it has the beat and the words on screen.'));
    } catch (e) { say('Could not make the video: ' + ((e && e.message) || 'the encoder stopped') + '.'); }
    vidB.disabled = false;
  });
  const row = el(doc, 'div', 'rp-row'); row.append(play, self, vsel); const row2 = el(doc, 'div', 'rp-row'); row2.append(el(doc, 'span', 'rp-vl', 'Beat'), vol, copy, wavB, songB, vidB, ...extra);
  for (const b of extra) { b.addEventListener('pointerdown', stop); b.addEventListener('keydown', stop); }
  ctl.append(row, row2);
  box.append(meta, ctl, msg, vid, lyr);
  /** the take the page plays, saves and films from now on: the same rap, retuned (lib/rap-listen.js "Keep this take") */
  const useSong = (next) => { song = next; perf.setSong(next); meta.textContent = metaLine(r, s, next.plan.beat) + (next.tune ? ' · Retuned by ear' : ''); };
  return { perf, stop: () => perf.stop(), say, get song() { return song; }, useSong };
}
export { MOODS, STYLES };
