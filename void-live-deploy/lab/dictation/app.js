// /lab/dictation/: talk, and it types; spoken punctuation becomes marks; the text is kept on this device and goes on to the word counter or translate.
import { joinOf, wordsOf, LANGS } from './dictate.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.lab.dictation.v1', LKEY = 'a2m.lab.dictation.lang.v1';
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
let rec = null, on = false;
const box = $('text');
try { box.value = localStorage.getItem(KEY) || ''; } catch (_) { /* private mode */ }
const save = () => { try { localStorage.setItem(KEY, box.value); } catch (_) { /* private mode: the text lasts this visit */ } $('count').textContent = wordsOf(box.value) + ' words'; };

const mine = navigator.language || 'en-US', list = LANGS.some(([c]) => c === mine) ? LANGS : [[mine, mine], ...LANGS];
for (const [code, name] of list) { const o = document.createElement('option'); o.value = code; o.textContent = name; $('lang').append(o); }
try { $('lang').value = localStorage.getItem(LKEY) || mine; } catch (_) { $('lang').value = mine; }
if (!$('lang').value) $('lang').value = 'en-US';
$('lang').addEventListener('change', () => { try { localStorage.setItem(LKEY, $('lang').value); } catch (_) { /* private mode */ } if (on) { stop(); start(); } });

function start() {
  if (!SR) return;
  rec = new SR(); rec.lang = $('lang').value; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    let live = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { box.value = joinOf(box.value, r[0].transcript); save(); box.scrollTop = box.scrollHeight; } else live += r[0].transcript;
    }
    $('live').textContent = live;
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { $('state').textContent = 'The microphone was not allowed. The address bar\'s site settings turn it on.'; stop(); }
    else if (e.error === 'network') { $('state').textContent = 'This browser\'s speech service could not be reached. It needs a connection in Chrome and Edge.'; stop(); }
  };
  // browsers end a session after a pause; while the button says Stop, pick straight back up
  rec.onend = () => { if (on) { try { rec.start(); } catch (_) { stop(); } } };
  try { rec.start(); on = true; $('go').textContent = 'Stop'; $('go').setAttribute('aria-pressed', 'true'); $('state').textContent = 'Listening. Say "comma", "full stop", "question mark" or "new paragraph" for the marks.'; }
  catch (err) { $('state').textContent = 'Could not start listening: ' + (err && err.message || err); }
}
function stop() { on = false; if (rec) { rec.onend = null; try { rec.stop(); } catch (_) { /* already stopped */ } } $('live').textContent = ''; $('go').textContent = 'Start talking'; $('go').setAttribute('aria-pressed', 'false'); if (!/not allowed|could not/.test($('state').textContent)) $('state').textContent = 'Stopped. The text is kept on this device.'; }

if (!SR) { $('go').disabled = true; $('nosr').hidden = false; $('state').textContent = ''; }
$('go').addEventListener('click', () => (on ? stop() : start()));
box.addEventListener('input', save);
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(box.value); $('copy').textContent = 'Copied'; setTimeout(() => { $('copy').textContent = 'Copy text'; }, 1400); } catch (_) { box.select(); } });
$('txt').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([box.value], { type: 'text/plain' })); a.download = 'dictation-' + new Date().toISOString().slice(0, 10) + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
$('clear').addEventListener('click', () => { if (!box.value || confirm('Clear the text? It is not kept anywhere else.')) { box.value = ''; save(); } });
save();
mountRelated($('related'), '/lab/dictation/', [
  { label: 'Count the words and speaking time', href: () => '/word-count/?t=' + encodeURIComponent(box.value.slice(0, 1800)) },
  { label: 'Translate it', href: () => '/translate/?q=' + encodeURIComponent(box.value.slice(0, 1800)) },
]);
