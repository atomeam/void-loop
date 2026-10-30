// Verse's ears on the rap page (owner, 2026-10-30: "teach it to listen to other rap and compare for itself"). The visitor gives Verse a track
// (a file from their own device: one they made, or one they have the right to use); Verse decodes it here in the browser, nothing is uploaded,
// and measures it with lib/rap-ears.js. It measures its own take the same way, from the rendered song, shows the two side by side with a
// closeness score, then learns: it turns the gaps into a new tempo, swing and master (rap-ears tuneFor), renders the take again with the voice it
// already has (rap-song retune), measures that, and keeps going while the score climbs, up to three takes. The score before and after is on
// the page, with what changed and why. Keep this take hands the best one to the stage (lib/rap-stage.js useSong), so Perform, Save the song and
// Make the video all use it; Write the next one to match writes a new rap in the flow the reference suggests. What Verse has heard is kept in
// this browser only, as numbers (no sound, no file name beyond what the visitor sees), so it can compare against the average of everything it
// has heard. Every word on the panel is set with textContent.
import { listen, windowOf, compare, tuneFor, averageOf, TUNE0, isPlain } from './rap-ears.js';
import { SWING } from './rap-beat.js';
import { RATE } from './rap-song.js';

const KEY = 'verse-ears-heard', KEEP = 12;
const OACof = (win) => (win && (win.OfflineAudioContext || win.webkitOfflineAudioContext)) || null;
const store = (win) => { try { return win.localStorage || null; } catch (_) { return null; } };
const pause = () => new Promise((ok) => setTimeout(ok, 0));

/** what Verse has heard in this browser: [{ name, at, profile }], newest first. */
export function heardOf(win = globalThis) { try { const v = JSON.parse((store(win) && store(win).getItem(KEY)) || '[]'); return Array.isArray(v) ? v.filter((h) => h && h.profile) : []; } catch (_) { return []; } }
function keepHeard(win, list) { try { const s = store(win); if (s) s.setItem(KEY, JSON.stringify(list.slice(0, KEEP))); } catch (_) { /* a full or blocked store: the panel still works for this visit */ } }

/** a profile of the song Verse made (its mastered mix), heard the way it hears any track. null when the browser cannot render it. */
export async function hearSong(song) { const m = await song.mix(true); if (!m) return null; const w = windowOf(m[0].length / RATE); return listen(m[0], m[1], RATE, w); }

/** the take's own tempo and swing, from its plan (what tuneFor moves from). Pure. */
export const baseOf = (song) => ({ bpm: song.plan.beat.bpm, swing: song.plan.beat.swing ?? (SWING[song.plan.beat.rapStyle] ?? 0.5) });

/** the learning loop: measure take0 against ref, then up to `tries` retuned takes, each from the last one's gaps, while the score climbs.
 *  `hear(song)` measures a take (hearSong in the page, a stand-in in the tests). Returns { before, best, takes: [{ song, own, cmp, why }] }. */
export async function learn(take0, ref, { hear = hearSong, tries = 3, onStep = () => {} } = {}) {
  const own0 = await hear(take0); if (!own0) return null;
  const first = { song: take0, own: own0, cmp: compare(own0, ref), why: [] }, takes = [first]; let best = first, last = first;
  for (let i = 0; i < tries; i++) {
    const { tune, why } = tuneFor(last.cmp.rows, last.song.tune || TUNE0, baseOf(last.song));
    if (isPlain(tune) || JSON.stringify(tune) === JSON.stringify({ ...TUNE0, ...(last.song.tune || {}) })) break;
    onStep(i + 1, why);
    const song = take0.retune(tune), own = await hear(song); if (!own) break;
    const t = { song, own, cmp: compare(own, ref), why }; takes.push(t);
    if (t.cmp.score > best.cmp.score) best = t;
    if (t.cmp.score <= last.cmp.score) break; // no better than the last take: stop rather than wander
    last = t;
  }
  return { before: first, best, takes };
}

/** how a value reads in the table. Pure. */
export function shown(v, unit) {
  if (v == null || !Number.isFinite(v)) return 'not heard';
  const n = Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return String(n) + (unit ? ' ' + unit : '');
}

const el = (doc, tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** decode an audio file the visitor chose into [L, R] at its own rate. */
async function decodeFile(file, win) {
  const OAC = OACof(win); if (!OAC) throw new Error('this browser cannot decode sound');
  const buf = await file.arrayBuffer(), a = await new OAC(2, 1, RATE).decodeAudioData(buf);
  return { L: a.getChannelData(0), R: a.numberOfChannels > 1 ? a.getChannelData(1) : a.getChannelData(0), rate: a.sampleRate, seconds: a.duration };
}

/** the ears panel inside `box`. stage() is the rap page's current stage (mountRap's return), settings() the rap's settings, and
 *  writeFlow(flow) writes the next rap in that flow. */
export function mountEars(box, { stage, settings, writeFlow, doc = document, win = window } = {}) {
  box.textContent = '';
  const h = el(doc, 'h3', 'ea-h', 'Verse listens');
  const intro = el(doc, 'p', 'ea-p', 'Give Verse a rap track from your device, one you made or have the right to use. It listens here in your browser (nothing is uploaded), measures the beat, the swing, the flow and the mix, and scores its own take against it. Then it changes its take to get closer and shows the score before and after.');
  const pick = el(doc, 'label', 'ea-file'); const input = el(doc, 'input'); input.type = 'file'; input.accept = 'audio/*'; pick.append(el(doc, 'span', '', 'A track to listen to'), input);
  const which = el(doc, 'select', 'ea-which'); which.setAttribute('aria-label', 'Compare with');
  const own = el(doc, 'button', 'rp-btn', 'Listen to my own take'), go = el(doc, 'button', 'rp-btn go', 'Learn from it and rap again'), forget = el(doc, 'button', 'rp-btn', 'Forget what it heard');
  for (const b of [own, go, forget]) b.type = 'button';
  const msg = el(doc, 'p', 'rp-msg ea-msg'); msg.setAttribute('role', 'status');
  const res = el(doc, 'div', 'ea-res'), acts = el(doc, 'div', 'rp-row'); acts.hidden = true;
  const playB = el(doc, 'button', 'rp-btn', 'Play the new take'), keepB = el(doc, 'button', 'rp-btn go', 'Keep this take'), flowB = el(doc, 'button', 'rp-btn', 'Write the next one to match');
  for (const b of [playB, keepB, flowB]) b.type = 'button';
  acts.append(playB, keepB, flowB);
  const row1 = el(doc, 'div', 'rp-row'); row1.append(pick); const row2 = el(doc, 'div', 'rp-row'); row2.append(which, go, own, forget);
  box.append(h, intro, row1, row2, msg, res, acts);
  box.setAttribute('data-share-skip', '1');

  const say = (t) => { msg.textContent = t || ''; };
  let busy = false, result = null, ac = null, flow = null;
  const fillWhich = () => {
    const hs = heardOf(win), was = which.value; which.textContent = '';
    hs.forEach((x, k) => { const o = el(doc, 'option', '', 'Compare with: ' + x.name); o.value = 'h' + k; which.append(o); });
    if (hs.length > 1) { const o = el(doc, 'option', '', 'Compare with: all ' + hs.length + ' tracks it has heard'); o.value = 'all'; which.append(o); }
    if (!hs.length) { const o = el(doc, 'option', '', 'Nothing heard yet: choose a track'); o.value = ''; which.append(o); }
    if ([...which.options].some((o) => o.value === was)) which.value = was;
    go.disabled = !hs.length; forget.disabled = !hs.length;
  };
  const refOf = () => { const hs = heardOf(win); if (which.value === 'all') return { name: 'the ' + hs.length + ' tracks it has heard', profile: averageOf(hs.map((x) => x.profile)) }; const x = hs[+String(which.value).slice(1)] || hs[0]; return x ? { name: x.name, profile: x.profile } : null; };
  const stopPlay = () => { try { ac && ac.close(); } catch (_) {} ac = null; playB.textContent = 'Play the new take'; };

  const table = (cmp, title) => {
    const t = el(doc, 'table', 'ea-t'), cap = el(doc, 'caption', '', title), hd = el(doc, 'tr');
    for (const c of ['Measure', "Verse's take", 'The track', 'Close']) hd.append(el(doc, 'th', '', c));
    t.append(cap, hd);
    for (const r of cmp.rows) { const tr = el(doc, 'tr'); tr.append(el(doc, 'td', '', r.label), el(doc, 'td', '', shown(r.own, r.unit)), el(doc, 'td', '', shown(r.ref, r.unit)), el(doc, 'td', r.closeness == null ? '' : r.closeness >= 0.8 ? 'ea-ok' : r.closeness < 0.5 ? 'ea-far' : '', r.closeness == null ? 'not scored' : Math.round(r.closeness * 100) + '%')); t.append(tr); }
    const wrap = el(doc, 'div', 'ea-tw'); wrap.append(t); return wrap;
  };

  input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; if (!f || busy) return; busy = true; say('Listening to ' + f.name + '.'); await pause();
    try {
      const a = await decodeFile(f, win); await pause();
      const p = listen(a.L, a.R, a.rate, windowOf(a.seconds));
      if (!p) { say('That track is under 4 seconds, too short to hear a beat in.'); busy = false; return; }
      const name = String(f.name).replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 60) || 'a track';
      keepHeard(win, [{ name, at: Date.now(), profile: p }, ...heardOf(win).filter((x) => x.name !== name)]); fillWhich(); which.value = 'h0';
      res.textContent = ''; res.append(el(doc, 'p', 'ea-p', 'Heard ' + Math.round(p.seconds) + ' seconds of ' + name + ': ' + (p.bpm ? p.bpm + ' BPM' : 'no steady beat') + (p.swing != null ? ', swing ' + p.swing : '') + ', ' + shown(p.lufs, 'LUFS') + ', ' + p.density + ' onsets a second in the voice band.'));
      say('Now Learn from it and rap again: I measure my take against it and change it to get closer.');
    } catch (e) { say('I could not hear that file: ' + ((e && e.message) || 'it did not decode') + '. MP3, WAV, M4A and OGG work in most browsers.'); }
    busy = false;
  });

  own.addEventListener('click', async () => {
    const st = stage && stage(); if (!st || busy) return; busy = true; stopPlay(); say('Listening to my own take.'); await pause();
    try {
      const song = st.song, p = await hearSong(song), b = baseOf(song);
      if (!p) { say('This browser cannot render my take offline, so I cannot hear it.'); busy = false; return; }
      res.textContent = '';
      res.append(el(doc, 'p', 'ea-p', 'My take was made at ' + b.bpm + ' BPM with swing ' + b.swing + '. I heard ' + (p.bpm ? p.bpm + ' BPM' : 'no steady beat') + (p.swing != null ? ' and swing ' + p.swing : '') + ', ' + shown(p.lufs, 'LUFS') + ', punch ' + shown(p.plr, 'dB') + '. ' + (p.bpm && Math.abs(p.bpm - b.bpm) <= 2 ? 'My ears got my own tempo right.' : 'My ears missed my own tempo, so read the tempo row with care.')));
      say('');
    } catch (_) { say('I could not hear my take.'); }
    busy = false;
  });

  go.addEventListener('click', async () => {
    const st = stage && stage(), ref = refOf(); if (!st || !ref || !ref.profile || busy) return; busy = true; stopPlay(); acts.hidden = true; res.textContent = '';
    go.disabled = true; say('Rendering my take with my voice and measuring it.'); await pause();
    try {
      const out = await learn(st.song, ref.profile, { onStep: (i) => say('Take ' + (i + 1) + ': changing it and measuring again.') });
      if (!out) { say('This browser cannot render my take offline, so I cannot compare it.'); busy = false; go.disabled = false; return; }
      result = out; const { before, best } = out, gain = best.cmp.score - before.cmp.score;
      res.append(el(doc, 'p', 'ea-score', 'Closeness to ' + ref.name + ': ' + before.cmp.score + ' of 100 before, ' + best.cmp.score + ' after' + (gain > 0 ? ' (up ' + gain + ').' : '.')));
      if (best !== before) { const ul = el(doc, 'ul', 'ea-why'); for (const w of out.takes.slice(1, out.takes.indexOf(best) + 1).flatMap((t) => t.why)) ul.append(el(doc, 'li', '', w)); res.append(el(doc, 'p', 'ea-p', 'What I changed, in ' + (out.takes.indexOf(best)) + (out.takes.indexOf(best) === 1 ? ' take:' : ' takes:')), ul); }
      else res.append(el(doc, 'p', 'ea-p', 'Nothing I can change in the beat or the mix brings it closer, so my take stays as it is.'));
      res.append(table(before.cmp, 'Before'));
      if (best !== before) res.append(table(best.cmp, 'After'));
      flow = tuneFor(best.cmp.rows, best.song.tune || TUNE0, baseOf(best.song)).flow;
      const s = settings && settings();
      flowB.hidden = !flow || !s || s.flow === flow; flowB.textContent = flow === 'double' ? 'Write the next one in double time' : 'Write the next one laid back';
      playB.hidden = keepB.hidden = best === before; acts.hidden = playB.hidden && flowB.hidden;
      if (!flowB.hidden) res.append(el(doc, 'p', 'ea-p', flow === 'double' ? 'The track packs more into each bar than my take does. Writing in double time gets the words closer too.' : 'The track leaves more space than my take. A laid-back flow gets the words closer too.'));
      say('');
    } catch (_) { say('I could not finish listening. Try again.'); }
    busy = false; go.disabled = false;
  });

  playB.addEventListener('click', async () => {
    if (ac) { stopPlay(); return; }
    const AC = win.AudioContext || win.webkitAudioContext; if (!AC || !result) return;
    try { ac = new AC(); if (ac.resume) ac.resume(); } catch (_) { return; }
    const me = ac; playB.textContent = 'Stop';
    const m = await result.best.song.mix(true); if (!m || ac !== me) return;
    const b = ac.createBuffer(2, m[0].length, RATE); b.getChannelData(0).set(m[0]); b.getChannelData(1).set(m[1]);
    const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.onended = () => { if (ac === me) stopPlay(); }; src.start();
  });
  keepB.addEventListener('click', () => { const st = stage && stage(); if (!st || !result) return; stopPlay(); st.useSong(result.best.song); keepB.hidden = true; say('Kept. Perform it, Save the song and Make the video now use this take.'); });
  flowB.addEventListener('click', () => { if (flow && writeFlow) { stopPlay(); writeFlow(flow); } });
  forget.addEventListener('click', () => { keepHeard(win, []); fillWhich(); res.textContent = ''; acts.hidden = true; say('Forgotten. Nothing Verse heard is kept now.'); });

  fillWhich();
  return { stop: stopPlay };
}
