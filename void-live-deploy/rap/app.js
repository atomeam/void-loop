// /rap/ (owner, 2026-10-29: "Verse should learn to rap for those who hear the name and think thats what it is"): the form's settings go to
// /api/answer mode 'rap' (lib/rap.js), and the rap that comes back is drawn and performed by lib/rap-stage.js, and heard against other tracks by lib/rap-listen.js. A link carries the settings (?t= topic,
// s, m, f, v, w, k) and, once shared, the whole rap (?r=), which opens with no model call. The page hands its rap to the other tools (lib/toolkit.js)
// and tells Verse Brain the topic when one is open in this browser (lib/brain-bridge.js).
import { settingsOf, linkOf, fromLink, rapText, beatFor, cardAsk } from '/lib/rap.js';
import { mountRap } from '/lib/rap-stage.js';
import { mountEars } from '/lib/rap-listen.js';
import { mountRelated } from '/lib/toolkit.js';
import { connectBrain } from '/lib/brain-bridge.js';

const $ = (id) => document.getElementById(id);
const form = $('rapForm'), out = $('out'), note = $('formNote');
let settings = null, rap = null, stage = null, ears = null, busy = false;

const brain = connectBrain();
brain.on((m) => { const p = $('brainSay'); if (!p) return; const t = m.thinking || (m.words && m.words[m.words.length - 1]); p.hidden = !t; if (t) p.textContent = 'Verse Brain, open in another tab, is thinking about "' + t + '"' + (m.related && m.related.length ? ', near ' + m.related.map((r) => r.word).join(', ') : '') + '.'; });

// what this page hands on (owner, 2026-10-29: "all the pages are supposed to be able to work together"): the rap's words to the word counter and the
// translator, its topic to the music tools' song maker on the stage
const LINK_MAX = 12000;
function drawRelated() {
  const text = () => (rap ? rapText(rap) : '');
  mountRelated($('related'), '/rap/', !rap ? [] : [
    { label: 'Count the words', href: () => (text() && encodeURIComponent(text()).length <= LINK_MAX ? '/word-count/?t=' + encodeURIComponent(text()) : null) },
    { label: 'Translate it', href: () => (text() ? '/translate/?q=' + encodeURIComponent(text().slice(0, 5000)) : null) },
    { label: 'Make a song of it', href: () => '/?q=' + encodeURIComponent('make a hip hop song about ' + (settings.topic || rap.title || 'verse')) },
    { label: 'Practise at its tempo', href: () => '/metronome/?bpm=' + beatFor(settings).bpm },
  ], { card: () => cardAsk(settings || readForm()) });
}

function readForm() { return settingsOf({ topic: $('topic').value, style: $('style').value, mood: $('mood').value, flow: $('flow').value, view: $('view').value, words: $('words').value, seed: settings ? settings.seed : 0 }); }
function fillForm(s) { $('topic').value = s.topic; $('style').value = s.style; $('mood').value = s.mood; $('flow').value = s.flow; $('view').value = s.view; $('words').value = s.words; }

function show(r, s, from) {
  rap = r; settings = s; if (stage) stage.stop(); if (ears) ears.stop();
  out.hidden = false; $('title').textContent = r.title || (s.topic ? 'A rap about ' + s.topic : 'A rap from Verse');
  stage = mountRap($('rap'), r, s);
  if (from) stage.say(from);
  // Verse's ears (lib/rap-listen.js): it listens to a track the visitor gives it, scores its own take against it and retunes the take
  try { ears = mountEars($('ears'), { stage: () => stage, settings: () => settings, writeFlow: (f) => { $('flow').value = f; write({ ...readForm(), seed: 0 }, f === 'double' ? 'Writing it again in double time, to match the track.' : 'Writing it again laid back, to match the track.'); } }); } catch (_) { ears = null; }
  document.title = ($('title').textContent) + ' · Verse raps';
  history.replaceState(null, '', linkOf(s, null));
  drawRelated();
}

async function write(s, why) {
  if (busy) return; busy = true; $('write').disabled = true; $('again').disabled = true;
  note.textContent = why || 'Writing it now.';
  if (s.topic) brain.tell(s.topic);
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'rap', ...s }) });
    const j = await r.json().catch(() => ({}));
    if (j && j.rap) { note.textContent = j.cached ? 'Written earlier for these same settings: Another take writes a new one.' : ''; show(j.rap, s); out.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else note.textContent = (j && j.say) || 'I could not write it just now. Try again in a minute.';
  } catch (_) { note.textContent = 'I could not reach my pen: check the connection and try again.'; }
  busy = false; $('write').disabled = false; $('again').disabled = false;
}

form.addEventListener('submit', (e) => { e.preventDefault(); const s = readForm(); s.seed = 0; write(s); });
$('again').addEventListener('click', () => { const s = { ...(settings || readForm()), seed: (settings ? settings.seed : 0) + 1 }; write(s, 'Writing take ' + (s.seed + 1) + ' now.'); });
$('share').addEventListener('click', async () => {
  if (!rap) return; const url = location.origin + linkOf(settings, rap);
  try { if (navigator.share) { await navigator.share({ title: $('title').textContent + ' · Verse raps', url }); $('shareNote').textContent = 'Shared.'; return; } } catch (_) { /* fall back to copying */ }
  try { await navigator.clipboard.writeText(url); $('shareNote').textContent = 'Link copied: it carries the whole rap.'; } catch (_) { $('shareNote').textContent = url; }
});

// a link: a carried rap opens as it was written; settings alone write one (a topic in the link, from a common ask or another page)
const got = fromLink(location.search);
fillForm(got.settings);
if (got.rap) show(got.rap, got.settings, 'Opened from its link, exactly as it was written.');
else if (got.asked) write(got.settings);
drawRelated();
