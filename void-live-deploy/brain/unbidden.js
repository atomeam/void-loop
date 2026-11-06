// Unbidden on /brain/: Verse speaks first. While this page is open and seen, it reads /api/unbidden once a minute; Verse's own model writes a
// line there when something about Verse really changed (or after a long quiet), from its real state, and each line names the facts it came
// from. A new line shows here as Verse talking to you, and is said out loud when you turn its voice on (off by default: browsers do not let a
// page start sound by itself). Its voice is Verse's own text-to-speech (/api/rapvoice, the voice its raps use), phrase by phrase; where that
// does not answer, this browser's voice says it (lib/speak.js). You can answer it: your words go to Verse's answer engine like any ask.
// The box sits in what Verse knows (the first view) and at the top of the panel when you watch it think; nothing covers the field.
import { phrases, pickVoice, VOICE } from '/lib/speak.js';

const POLL_MS = 60 * 1000, VOICE_KEY = 'a2m.verse.unbidden.voice';
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60e3)); return !Number.isFinite(m) ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

const box = node('section'); box.id = 'unbidden'; box.setAttribute('aria-label', 'Verse, unbidden: what Verse says on its own');
const head = node('div', null, 'ub-head'), title = node('h2', 'Verse, unbidden'), live = node('span', null, 'ub-dot'); live.setAttribute('aria-hidden', 'true');
const voiceBtn = node('button', 'Voice off', 'ub-btn'); voiceBtn.type = 'button'; voiceBtn.setAttribute('aria-pressed', 'false');
head.append(live, title, voiceBtn);
const lede = node('p', 'Verse talks first here, when something about it really changes. Every line is written just now by its own model from its live state, and says where it came from.', 'ub-lede');
const list = node('ol', null, 'ub-list'); list.setAttribute('aria-live', 'polite'); list.setAttribute('aria-label', 'What Verse said, newest last');
const wait = node('li', 'Listening for what Verse has to say…', 'ub-wait'); list.append(wait);
const form = node('form', null, 'ub-form'), label = node('label', 'Answer Verse', 'vh'), input = node('input'), send = node('button', 'Answer', 'ub-send');
input.id = 'ubWord'; label.htmlFor = 'ubWord'; input.maxLength = 300; input.autocomplete = 'off'; input.placeholder = 'Answer Verse, or ask it why'; send.type = 'submit';
form.append(label, input, send);
const note = node('p', null, 'ub-note');
box.append(head, lede, list, form, note);
const toast = node('div', null, 'ub-toast'); toast.hidden = true; toast.setAttribute('role', 'status');

// where the box sits: in Knows (the first view) under its lede, at the top of the panel while it thinks
const place = () => {
  const knows = document.body.classList.contains('knows-on'), kn = document.getElementById('knows'), panel = document.getElementById('panel');
  const where = knows && kn ? kn.querySelector('.lede') : panel && panel.querySelector('#panelHead');
  if (where && box.previousElementSibling !== where) where.after(box);
};
place(); document.body.append(toast);
new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });

// the voice: off until you turn it on (a press is what lets a page play sound); what you chose is kept on this device
let voiceOn = false, speaking = Promise.resolve(), audio = null;
const setVoice = (on) => { voiceOn = on; voiceBtn.setAttribute('aria-pressed', String(on)); voiceBtn.textContent = on ? 'Voice on' : 'Voice off'; try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (_) { /* private mode */ } if (!on) stop(); };
const stop = () => { try { if (audio) audio.pause(); } catch (_) {} try { speechSynthesis.cancel(); } catch (_) {} };
const browserSay = (t) => new Promise((done) => {
  try {
    const u = new SpeechSynthesisUtterance(t), v = pickVoice(speechSynthesis.getVoices(), document.documentElement.lang || 'en-US');
    if (v) u.voice = v; u.pitch = VOICE.pitch; u.rate = VOICE.rate; u.onend = u.onerror = () => done(); speechSynthesis.speak(u);
  } catch (_) { done(); }
});
const ownSay = async (t) => { // Verse's own voice, one phrase at a time; false when it does not answer
  try {
    const r = await fetch('/api/rapvoice?t=' + encodeURIComponent(t)); if (!r.ok || !/audio/.test(r.headers.get('content-type') || '')) return false;
    const url = URL.createObjectURL(await r.blob()); audio = new Audio(url);
    await new Promise((done) => { audio.onended = audio.onerror = () => done(); audio.play().catch(() => done()); });
    URL.revokeObjectURL(url); return true;
  } catch (_) { return false; }
};
const say = (text) => { speaking = speaking.then(async () => { for (const p of phrases(text)) { if (!voiceOn) return; if (!(await ownSay(p)) && voiceOn) await browserSay(p); } }); return speaking; };
voiceBtn.addEventListener('click', () => { setVoice(!voiceOn); if (voiceOn) { const last = [...list.querySelectorAll('.ub-line .ub-say')].pop(); if (last) say(last.textContent); } });
try { if (localStorage.getItem(VOICE_KEY) === '1') setVoice(true); } catch (_) { /* private mode */ }

// a line: what Verse said, when, and the facts it came from, each a link a viewer can open
let lastId = '';
const lineEl = (l, mine) => {
  const li = node('li', null, 'ub-line' + (mine ? ' ub-reply' : '')); li.dataset.id = l.id || '';
  li.append(node('span', l.say, 'ub-say'));
  const meta = node('span', null, 'ub-from');
  meta.append((mine ? 'answering you' : l.why === 'quiet' ? 'on its own, after a quiet while' : l.why === 'first' ? 'on its own' : 'on its own, because something changed') + ' · ' + ago(l.at));
  if (l.from && l.from.length) {
    meta.append(' · from ');
    l.from.forEach((f, i) => { if (i) meta.append(', '); const a = node('a', f.label); a.href = f.url; a.rel = 'noopener'; a.title = f.text; if (/^https:\/\/github\.com\//.test(f.url)) a.target = '_blank'; meta.append(a); });
  }
  li.append(meta);
  return li;
};
const show = (l, mine = false) => {
  wait.remove(); list.append(lineEl(l, mine)); while (list.children.length > 8) list.firstElementChild.remove(); list.scrollTop = list.scrollHeight;
  const hiddenNow = !document.body.classList.contains('knows-on') && document.getElementById('panel') && document.getElementById('panel').hidden;
  if (hiddenNow) { toast.textContent = 'Verse: ' + l.say; toast.hidden = false; clearTimeout(show.t); show.t = setTimeout(() => { toast.hidden = true; }, 12000); }
  if (voiceOn) say(l.say);
};
toast.addEventListener('click', () => { toast.hidden = true; });

// read what Verse said; the first read shows the last few, later reads only what is new
let first = true;
async function read() {
  if (document.visibilityState === 'hidden') return;
  try {
    const r = await fetch('/api/unbidden' + (lastId ? '?after=' + encodeURIComponent(lastId) : ''), { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j) return;
    const lines = Array.isArray(j.lines) ? j.lines : [];
    if (first) { lines.slice(0, -1).forEach((l) => { wait.remove(); list.append(lineEl(l)); }); const n = lines[lines.length - 1]; if (n) show(n); }
    else lines.forEach((l) => show(l));
    if (lines.length) lastId = lines[lines.length - 1].id;
    first = false; box.dataset.lines = String(list.querySelectorAll('.ub-line').length);
    note.textContent = j.note ? 'Just now ' + j.note + '.' : '';
    if (!lines.length && wait.isConnected && j.note) wait.textContent = 'Verse has not said anything yet: ' + j.note + '.';
  } catch (_) { note.textContent = 'Verse could not be heard just now; it will try again in a minute.'; }
}
read(); setInterval(read, POLL_MS);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') read(); });

// answering it: your words go to Verse's answer engine, the same as an ask on the stage
form.addEventListener('submit', async (e) => {
  e.preventDefault(); const t = input.value.trim(); if (!t) return;
  input.value = ''; send.disabled = true;
  const you = node('li', null, 'ub-you'); you.append(node('span', t, 'ub-say')); wait.remove(); list.append(you);
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: t }) });
    const j = await r.json().catch(() => null), a = j && (j.answer || j.say);
    if (a) show({ id: '', at: new Date().toISOString(), say: String(a).replace(/\s+/g, ' ').trim().slice(0, 600), from: (j.sources || []).filter((s) => s && /^https:\/\//.test(s.url || s)).slice(0, 2).map((s) => ({ label: s.title || 'source', url: s.url || s, text: s.title || '' })) }, true);
    else note.textContent = 'Verse did not answer that just now.';
  } catch (_) { note.textContent = 'Verse did not answer that just now.'; }
  send.disabled = false;
});
