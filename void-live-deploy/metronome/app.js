// /metronome/ (Versus' metronomeonline.com lane site): the beat clock. The page is whole before this loads; this wires its controls to a look-ahead
// scheduler on the audio clock (the click is placed 25 to 120 ms ahead of time, so the beat does not wobble when the page is busy).
import { barTicks, defaultAccents, TIME_SIGS, clampBpm, tempoName, tapTempo, rampPlan, silentBar, practiceLadder, beatSeconds, cleanEntry, polyTicks } from '/lib/music-tools.js';
import { audio, click, say, setVolume, keepAwake } from '/lib/music-audio.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, mem, keep, setlist, saveSetlist, drawSetlist, setlistLink, shareLink, t, wire, num, isDe } from '/lib/music-ui.js';

const q = new URLSearchParams(location.search), m = mem();
const st = { bpm: clampBpm(q.get('bpm') || m.bpm || 120), sig: TIME_SIGS[q.get('sig')] ? q.get('sig') : (TIME_SIGS[m.sig] ? m.sig : '4/4'), sub: q.get('sub') || m.sub || 'none', snd: q.get('snd') || m.snd || 'click', accents: null, playing: false };
st.accents = defaultAccents(st.sig);
let list = setlist(), taps = [], timers = [], release = () => {};
const say_ = (s) => { $('status').textContent = s; };

function dots() {
  const box = $('dots'); box.textContent = '';
  st.accents.forEach((lv, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dot'; b.dataset.lv = lv; b.textContent = i + 1; b.setAttribute('aria-label', t('Beat') + ' ' + (i + 1) + ', ' + ['silent', 'soft', 'medium', 'strong'][lv]);
    b.onclick = () => { st.accents[i] = (st.accents[i] + 3) % 4; dots(); }; box.append(b); });
}
function show() {
  $('bpmOut').textContent = st.bpm % 1 ? st.bpm.toFixed(1) : st.bpm; $('bpm').value = Math.min(400, Math.max(20, Math.round(st.bpm))); $('bpmIn').value = Math.round(st.bpm);
  $('tempoWord').textContent = tempoName(st.bpm) + ' · ' + Math.round(beatSeconds(st.bpm) * 1000) + ' ms ' + t('per beat'); $('sig').value = st.sig; $('sub').value = st.sub; $('snd').value = st.snd;
  $('ladder').textContent = t('Practice ladder for this tempo:') + ' ' + practiceLadder(st.bpm).join(', ') + ' BPM.';
  keep({ bpm: st.bpm, sig: st.sig, sub: st.sub, snd: st.snd });
  // the tempo handed on (docs/HANDOFF-GAPS.md): the BPM counter shows every note length at it, since it reads ?bpm=
  const go = $('toBpm'); if (go) go.href = '/bpm/?bpm=' + st.bpm;
  const u = new URLSearchParams({ bpm: st.bpm, sig: st.sig, sub: st.sub, snd: st.snd }); try { history.replaceState(null, '', '?' + u); } catch (_) { /* a sandboxed frame */ }
}
const setBpm = (v) => { st.bpm = clampBpm(v); show(); };

// ---- the scheduler ----
let nextBeatAt = 0, beat = 0, bar = 0, timerId = 0, queue = [], raf = 0, endAt = 0, stopAt = 0;
function scheduleBeat(at) {
  const bpm = st.bpm, bs = beatSeconds(bpm), ticks = barTicks(bpm, st.sig, st.sub, st.accents).filter((x) => x.beat === beat), quiet = silentBar(bar, num($('playBars'), 1, 16, 4), num($('restBars'), 0, 16, 0));
  if (beat === 0 && bar > 0) { // a new bar: the speed trainer may step the tempo
    const stepBy = num($('rampStep'), 0, 40, 0), every = num($('rampEvery'), 1, 64, 4), to = num($('rampTo'), 20, 400, 160);
    if (stepBy > 0 && bar % every === 0 && st.bpm !== to) { const plan = rampPlan(st.bpm, to, stepBy, 1); if (plan[1]) { st.bpm = plan[1].bpm; show(); } }
  }
  if (beat === 0 && !quiet) for (const k of polyTicks(bpm, st.sig, +$('poly').value)) click(at + k.at, k.level, 'wood', 0.9);
  for (const k of ticks) { const when = at + (k.at - beat * beatSeconds(bpm)); if (!quiet && !($('voice').checked && k.sub === 0)) click(when, k.level, st.snd, 1); queue.push({ when, beat, level: k.level, sub: k.sub, quiet }); }
  if (!ticks.length) queue.push({ when: at, beat, level: 0, sub: 0, quiet });
  nextBeatAt = at + bs; beat++; if (beat >= TIME_SIGS[st.sig].beats) { beat = 0; bar++; }
}
function pump() { const c = audio(); while (nextBeatAt < c.currentTime + 0.12) scheduleBeat(nextBeatAt); }
function frame() {
  const c = audio(); if (!st.playing) return;
  while (queue.length && queue[0].when <= c.currentTime + 0.01) { const e = queue.shift(); flash(e); }
  raf = requestAnimationFrame(frame);
}
let rodSide = 1;
function flash(e) {
  if (e.sub !== 0) return;
  for (const d of $('dots').children) d.classList.toggle('on', +d.textContent === e.beat + 1 && !e.quiet);
  if ($('vis').checked && !e.quiet) { $('stage').classList.add('on'); setTimeout(() => $('stage').classList.remove('on'), 90); }
  const rod = $('rod'); rodSide = -rodSide; rod.style.transition = 'transform ' + beatSeconds(st.bpm).toFixed(3) + 's ease-in-out'; rod.style.transform = 'translateX(-50%) rotate(' + (rodSide * 22) + 'deg)';
  if ($('voice').checked && !e.quiet) say(e.beat + 1, isDe() ? 'de-DE' : 'en-US');
}
async function start() {
  const c = audio(); if (!c) { say_(t('This browser cannot make sound.')); return; }
  setVolume(+$('vol').value / 100); st.playing = true; beat = 0; bar = 0; queue = []; nextBeatAt = c.currentTime + 0.08;
  pump(); timerId = setInterval(pump, 25); raf = requestAnimationFrame(frame);
  $('play').textContent = t('Stop'); $('play').setAttribute('aria-pressed', 'true'); say_(t('Playing') + ' ' + st.bpm + ' BPM, ' + st.sig + '.');
  const mins = num($('timer'), 0, 180, 0); if (mins > 0) { endAt = Date.now() + mins * 60000; stopAt = setInterval(() => { const left = Math.max(0, endAt - Date.now()); $('timerLeft').textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); if (!left) stop(t('The practice timer is up.')); }, 500); }
  release = await keepAwake();
}
function stop(msg) {
  st.playing = false; clearInterval(timerId); clearInterval(stopAt); cancelAnimationFrame(raf); queue = []; release(); release = () => {};
  $('play').textContent = t('Start'); $('play').setAttribute('aria-pressed', 'false'); for (const d of $('dots').children) d.classList.remove('on'); $('timerLeft').textContent = t('off'); say_(msg || t('Stopped.'));
}
const toggle = () => (st.playing ? stop() : start());

// ---- controls ----
boot('/metronome/', say_); mountRelated($('related'), '/metronome/', [], { card: () => 'metronome ' + Math.round(st.bpm) + ' bpm' + (st.sig === '4/4' ? '' : ' ' + st.sig) }); // the card at the tempo on the page
dots(); show(); $('vol').value = m.vol == null ? 80 : m.vol;
wire($('play'), 'click', toggle);
for (const [id, d] of [['m10', -10], ['m1', -1], ['p1', 1], ['p10', 10]]) wire($(id), 'click', () => setBpm(st.bpm + d));
wire($('bpm'), 'input', (e) => setBpm(e.target.value)); wire($('bpmIn'), 'change', (e) => setBpm(e.target.value));
wire($('sig'), 'change', (e) => { st.sig = e.target.value; st.accents = $('stress').checked ? defaultAccents(st.sig) : Array(TIME_SIGS[st.sig].beats).fill(1); beat = 0; dots(); show(); });
wire($('sub'), 'change', (e) => { st.sub = e.target.value; show(); }); wire($('snd'), 'change', (e) => { st.snd = e.target.value; show(); click(audio().currentTime + 0.02, 3, st.snd, 1); });
wire($('vol'), 'input', (e) => { setVolume(e.target.value / 100); keep({ vol: +e.target.value }); });
wire($('stress'), 'change', (e) => { st.accents = e.target.checked ? defaultAccents(st.sig) : Array(TIME_SIGS[st.sig].beats).fill(1); dots(); });
for (const b of $('presets').children) wire(b, 'click', () => setBpm(+b.dataset.bpm));
function tap() {
  taps.push(performance.now()); taps = taps.slice(-16); const r = tapTempo(taps); if (r.bpm) { setBpm(r.bpm); say_(t('Tap tempo:') + ' ' + r.bpm + ' BPM (' + r.taps + ' ' + t('taps') + ').'); } else say_(t('Keep tapping the beat.'));
}
wire($('tap'), 'click', tap);
wire($('timer'), 'change', () => { $('timerLeft').textContent = num($('timer'), 0, 180, 0) ? num($('timer'), 0, 180, 0) + ':00' : t('off'); });
wire($('saveEntry'), 'click', () => { const e = cleanEntry({ name: $('entryName').value, bpm: st.bpm, sig: st.sig, sub: st.sub }); list.push(e); saveSetlist(list); $('entryName').value = ''; draw(); say_(t('Saved') + ': ' + e.name + '.'); });
const draw = () => drawSetlist($('setlist'), list, (e) => { st.bpm = e.bpm; st.sig = e.sig; st.sub = e.sub; st.accents = defaultAccents(e.sig); dots(); show(); say_(t('Loaded') + ' ' + e.name + '.'); });
draw();
wire($('copyLink'), 'click', () => shareLink(setlistLink(list.length ? list : [cleanEntry({ name: tempoName(st.bpm), bpm: st.bpm, sig: st.sig, sub: st.sub })]), 'Metronome', say_));
addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space' && tag !== 'button') { e.preventDefault(); toggle(); } else if (e.key === 't' || e.key === 'T') tap(); else if (e.key === 'ArrowUp') { e.preventDefault(); setBpm(st.bpm + 1); } else if (e.key === 'ArrowDown') { e.preventDefault(); setBpm(st.bpm - 1); } else if (e.key === 'ArrowRight') setBpm(st.bpm + 5); else if (e.key === 'ArrowLeft') setBpm(st.bpm - 5);
});
if (q.get('go') === '1') say_(t('Press Start to begin (a browser needs a press before it will play sound).'));
