// The rap on screen and out loud (lib/rap.js has the rules): one place draws a rap and performs it, so the stage's rap card (skills/rap.js) and the
// /rap/ page show and play the same thing. A rap is drawn bar by bar with its rhyme letter, its rhyming end word marked, and its sections; Perform
// plays the style's beat (lib/compose.js, Web Audio) and says each bar on its measure with the browser's own voice (speechSynthesis), lighting the
// bar being said. "Rap it yourself" plays the beat and lights the bars with no voice, so a visitor can take the mic. Everything typed or read goes
// in with textContent, never as markup. Nothing is sent anywhere: the beat and the voice are made in this browser.
import { schedule, renderWav } from './compose.js';
import { schemeOf, endWordOf, statsOf, beatFor, timingOf, lengthOf, rapText, STYLES, MOODS } from './rap.js';

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

/** a performer for one rap: { play(mode), stop(), playing, wav() }. mode 'voice' says the bars, 'self' lights them with no voice.
 *  onBar(i) is called as each bar starts (-1 for the count-in, null at the end); onSay(text) for a status line. */
export function performer(r, s, { win = window, onBar = () => {}, onSay = () => {}, voice = () => null, volume = () => 0.8 } = {}) {
  const beat = beatFor(s), timing = timingOf(r, beat, s.flow), total = lengthOf(timing, beat), loop = beat.steps * 60 / beat.bpm / 4;
  let ac = null, timers = [], master = null;
  const synth = win.speechSynthesis || null;
  const end = () => { for (const t of timers) clearTimeout(t); timers = []; try { synth && synth.cancel(); } catch (_) {} try { ac && ac.close(); } catch (_) {} ac = null; master = null; onBar(null); };
  const api = {
    beat, timing, total,
    get playing() { return !!ac; },
    stop: end,
    setVolume(v) { if (master) master.gain.value = v; },
    play(mode = 'voice') {
      end();
      const AC = win.AudioContext || win.webkitAudioContext; if (!AC) { onSay('This browser has no Web Audio, so I cannot play the beat.'); return false; }
      try { ac = new AC(); if (ac.resume) ac.resume(); } catch (_) { onSay('Could not start sound.'); ac = null; return false; }
      master = ac.createGain(); master.gain.value = volume(); master.connect(ac.destination);
      // the beat's own schedule() writes to ctx.destination: it is handed a context whose destination is the beat's volume
      const ctx = { sampleRate: ac.sampleRate, destination: master, createGain: () => ac.createGain(), createOscillator: () => ac.createOscillator(), createBiquadFilter: () => ac.createBiquadFilter(), createBuffer: (...a) => ac.createBuffer(...a), createBufferSource: () => ac.createBufferSource() };
      const t0 = ac.currentTime + 0.15;
      for (let k = 0; k * loop < total; k++) schedule(ctx, beat, t0 + k * loop);
      const speak = mode === 'voice' && synth && typeof win.SpeechSynthesisUtterance === 'function';
      if (mode === 'voice' && !speak) onSay('This browser has no voice to rap with, so the beat plays and the bars light up: rap it yourself.');
      else onSay(mode === 'voice' ? 'One measure to count in, then I rap.' : 'Your turn: one measure to count in, then each bar lights up on its measure.');
      onBar(-1);
      const at = (sec, fn) => timers.push(setTimeout(fn, Math.max(0, (t0 + sec - ac.currentTime) * 1000)));
      for (const b of timing) at(b.at, () => {
        if (!ac) return; onBar(b.bar);
        if (speak) { try { synth.cancel(); const u = new win.SpeechSynthesisUtterance(b.text); u.rate = b.rate; u.pitch = 0.85; u.lang = 'en-US'; const v = voice(); if (v) u.voice = v; synth.speak(u); } catch (_) { /* a voice that failed: the beat goes on */ } }
      });
      at(total, () => { end(); onSay('That was the whole rap. Perform it again, or take another.'); });
      return true;
    },
    async wav() { return renderWav(beat); },
  };
  return api;
}

/** the rap, drawn and playable, inside `box`: the bars, a meta line, and the controls (Perform, Rap it yourself, voice, beat volume, Copy the
 *  lyrics, Save the beat, and the page's own extra buttons). Returns { perf, stop() }. */
export function mountRap(box, r, s, { doc = document, win = window, extra = [] } = {}) {
  box.textContent = '';
  const perf0 = beatFor(s), meta = el(doc, 'p', 'rp-meta', metaLine(r, s, perf0)), lyr = el(doc, 'div', 'rp-lyrics'), ctl = el(doc, 'div', 'rp-ctl'), msg = el(doc, 'p', 'rp-msg');
  msg.setAttribute('role', 'status'); lyr.setAttribute('aria-live', 'off');
  // a copied or saved card keeps the meta line and the bars, never the buttons, the voice list or a status line (lib/card-share.js data-share-skip)
  ctl.setAttribute('data-share-skip', '1'); msg.setAttribute('data-share-skip', '1');
  const bars = drawBars(lyr, r, doc);
  const play = el(doc, 'button', 'rp-btn go', 'Perform it'), self = el(doc, 'button', 'rp-btn', 'Rap it yourself'), copy = el(doc, 'button', 'rp-btn', 'Copy the lyrics'), wavB = el(doc, 'button', 'rp-btn', 'Save the beat');
  for (const b of [play, self, copy, wavB]) { b.type = 'button'; b.addEventListener('pointerdown', stop); b.addEventListener('keydown', stop); }
  const vsel = el(doc, 'select', 'rp-voice'); vsel.setAttribute('aria-label', 'Voice'); vsel.addEventListener('pointerdown', stop); vsel.addEventListener('keydown', stop);
  const vol = el(doc, 'input', 'rp-vol'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = '0.7'; vol.setAttribute('aria-label', 'Beat volume'); vol.addEventListener('pointerdown', stop); vol.addEventListener('keydown', stop);
  const synth = win.speechSynthesis || null; let voices = [];
  const fill = () => { voices = voicesOf(synth); vsel.textContent = ''; const d = el(doc, 'option', '', voices.length ? 'Voice: ' + voices[0].name : 'Voice: the browser\'s own'); d.value = ''; vsel.append(d); voices.slice(1, 12).forEach((v, k) => { const o = el(doc, 'option', '', 'Voice: ' + v.name); o.value = String(k + 1); vsel.append(o); }); };
  fill(); if (synth && 'onvoiceschanged' in synth) synth.addEventListener('voiceschanged', fill);
  const say = (t) => { msg.textContent = t || ''; };
  const perf = performer(r, s, { win, onSay: say, voice: () => voices[+vsel.value || 0] || null, volume: () => +vol.value,
    onBar: (i) => { for (const b of bars) b.classList.toggle('on', +b.dataset.i === i); if (i == null) { play.textContent = 'Perform it'; self.textContent = 'Rap it yourself'; } } });
  vol.addEventListener('input', () => perf.setVolume(+vol.value));
  play.addEventListener('click', () => { if (perf.playing) { perf.stop(); say(''); return; } if (perf.play('voice')) { play.textContent = 'Stop'; self.textContent = 'Rap it yourself'; } });
  self.addEventListener('click', () => { if (perf.playing) { perf.stop(); say(''); return; } if (perf.play('self')) { self.textContent = 'Stop'; play.textContent = 'Perform it'; } });
  copy.addEventListener('click', async () => { try { await win.navigator.clipboard.writeText(rapText(r)); say('Copied the lyrics.'); } catch (_) { say('Select the lyrics and copy them.'); } });
  wavB.addEventListener('click', async () => {
    say('Rendering the beat.');
    try { const bytes = await perf.wav(); if (!bytes) { say('This browser cannot render audio offline.'); return; } const u = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), a = doc.createElement('a'); a.href = u; a.download = ((r.title || s.topic || 'verse') + ' beat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.wav'; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); say('Saved the beat: 8 bars that loop, ' + perf0.bpm + ' BPM.'); } catch (_) { say('Could not render the beat.'); }
  });
  const row = el(doc, 'div', 'rp-row'); row.append(play, self, vsel); const row2 = el(doc, 'div', 'rp-row'); row2.append(el(doc, 'span', 'rp-vl', 'Beat'), vol, copy, wavB, ...extra);
  for (const b of extra) { b.addEventListener('pointerdown', stop); b.addEventListener('keydown', stop); }
  ctl.append(row, row2);
  box.append(meta, ctl, msg, lyr);
  return { perf, stop: () => perf.stop(), say };
}
export { MOODS, STYLES };
