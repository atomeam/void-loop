// Watch with Verse on /local/ (lib/watch-along.js has the why). While a station plays, this panel lets the person talk with Verse about what
// is on, and lets Verse learn from it: the TV player's closed captions (CEA-608, read by the full hls.js build in app.js) are kept here as a
// running transcript, a still of the screen is taken only when there are no captions or the person asks Verse to look, and radio is heard by
// Verse's server itself for a few seconds (functions/api/watchalong.js). Nothing of the stream is stored anywhere: Verse keeps only the short
// notes it writes. Everything shown comes from textContent, never markup.
import { addCue } from '/lib/watch-along.js';

const $ = (id) => document.getElementById(id);
const panel = $('watch'), log = $('watch-log'), form = $('watch-form'), input = $('watch-q'), learnBox = $('watch-learn'), hears = $('watch-hears'), learnedList = $('watch-learned');
const video = $('video');
const LEARN_MS = 180000, FRAME_LEARN_MS = 360000, RADIO_LEARN_MS = 300000, LEARN_KEY = 'a2m.void.local.learn';
let now = null, captions = '', learnedAt = 0, learnedLen = 0, turns = [], busy = false, timer = 0, frameOk = true;

try { learnBox.checked = localStorage.getItem(LEARN_KEY) !== 'off'; } catch (_) {}
learnBox.addEventListener('change', () => { try { localStorage.setItem(LEARN_KEY, learnBox.checked ? 'on' : 'off'); } catch (_) {} });

const line = (who, text, cls = '') => { const p = document.createElement('p'); p.className = 'w-' + who + (cls ? ' ' + cls : ''); const b = document.createElement('b'); b.textContent = who === 'you' ? 'You' : 'Verse'; p.append(b, ' ', text); log.append(p); log.scrollTop = log.scrollHeight; return p; };
const isTv = () => now && now.station && now.station.kind === 'tv';

function senseLine() {
  if (!now || !now.station) { hears.textContent = ''; return; }
  if (!isTv()) { hears.textContent = 'Verse cannot hear this page\'s audio. When you ask, it listens to a few seconds of the station itself and turns the speech into text. Music has no words to catch.'; return; }
  hears.textContent = captions ? 'Verse reads this station\'s closed captions as they come.' :
    'No captions from this station yet. Verse sees what is on only when it looks at a still of the screen' + (frameOk ? ' (it does that when you ask).' : ', and this stream does not allow that here.');
}

// ---- captions: every text track the player gets (hls.js adds one per caption channel); hidden, so the page shows no captions it did not before
function watchTracks() {
  const tracks = video.textTracks; if (!tracks) return;
  const hook = (t) => {
    if (!t || t._verse || !/captions|subtitles/.test(t.kind)) return; t._verse = true;
    if (t.mode === 'disabled') t.mode = 'hidden';
    t.addEventListener('cuechange', () => { for (const c of t.activeCues || []) captions = addCue(captions, c.text || ''); senseLine(); });
  };
  for (const t of tracks) hook(t);
  tracks.addEventListener('addtrack', (e) => hook(e.track));
}
watchTracks();

/** a still of the TV screen as a small JPEG data URL, or '' when the stream does not allow it (a cross-site video taints the canvas). */
function frame() {
  if (!isTv() || video.readyState < 2 || !video.videoWidth) return '';
  try {
    const w = Math.min(512, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(video, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.7);
  } catch (_) { frameOk = false; senseLine(); return ''; }
}

async function post(body) {
  const r = await fetch('/api/watchalong', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null); if (!r.ok || !j) throw new Error((j && j.error) || 'status ' + r.status); return j;
}

async function ask(q, look) {
  if (!now || !now.station || busy) return;
  busy = true; line('you', q); const wait = line('verse', 'Watching…', 'wait');
  const tv = isTv(), shot = tv && (look || !captions) ? frame() : '';
  try {
    const j = await post({ mode: 'ask', station: now.station, captions: tv ? captions.slice(-2500) : '', frame: shot, ask: q, turns, listen: !tv });
    wait.remove(); line('verse', j.text);
    if (j.couldNot) line('verse', j.couldNot, 'note');
    turns.push({ role: 'you', text: q }, { role: 'verse', text: j.text }); turns = turns.slice(-6);
  } catch (e) { wait.remove(); line('verse', 'I could not answer just now: ' + e.message, 'note'); }
  busy = false;
}
form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; ask(q, /\b(look|see|screen|showing|picture|wearing)\b/i.test(q)); });
$('watch-whats-on').addEventListener('click', () => ask('What is on right now?', true));

function showLearned(notes) {
  for (const n of notes) {
    const li = document.createElement('li'); li.textContent = n.note;
    const k = document.createElement('small'); k.textContent = ' ' + ({ appraisal: 'for appraisals', fact: 'a fact', idea: 'an app idea' }[n.kind] || n.kind); li.append(k);
    learnedList.prepend(li);
  }
  while (learnedList.children.length > 12) learnedList.lastChild.remove();
  $('watch-learned-box').hidden = !learnedList.children.length;
}

async function learn() {
  if (!learnBox.checked || !now || !now.station || now.state !== 'playing' || document.hidden) return;
  const tv = isTv(), t = Date.now(), fresh = captions.length - learnedLen;
  let body = null;
  if (tv && captions && fresh >= 300 && t - learnedAt >= LEARN_MS) body = { captions: captions.slice(-3000) };
  else if (tv && !captions && t - learnedAt >= FRAME_LEARN_MS) { const f = frame(); if (f) body = { frame: f }; }
  else if (!tv && t - learnedAt >= RADIO_LEARN_MS) body = { listen: true };
  if (!body) return;
  learnedAt = t; learnedLen = captions.length;
  try { const j = await post({ mode: 'learn', station: now.station, ...body }); if (j.notes && j.notes.length) showLearned(j.notes); } catch (_) {}
}

let loaded = false;
async function lately() { // the notes Verse wrote most recently, from anyone's watching and its own
  if (loaded) return; loaded = true;
  try { const r = await fetch('/api/watchalong?limit=6'); const j = await r.json(); if (Array.isArray(j.notes)) showLearned(j.notes.slice().reverse()); } catch (_) {}
}

document.addEventListener('local:now', (e) => {
  const d = e.detail || {}, same = now && now.station && d.station && now.station.kind === d.station.kind && now.station.id === d.station.id;
  if (!same) { captions = ''; turns = []; log.textContent = ''; learnedAt = Date.now() - LEARN_MS + 60000; learnedLen = 0; frameOk = true; } // first learn about a minute in
  now = d; panel.hidden = !d.station || d.state === 'failed'; $('watch-name').textContent = d.name || '';
  senseLine(); if (!panel.hidden) lately();
  clearInterval(timer); if (d.state === 'playing') timer = setInterval(learn, 20000);
});
