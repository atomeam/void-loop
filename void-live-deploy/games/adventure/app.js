// Verse Adventure: full-screen illustrated choose-your-own-adventure books. The engine is /lib/adventure.js,
// the books are /data/adventures/*.json so #work can append books without touching this page. Seeded pixel art per
// node, WebAudio page turns with a mute toggle, three save slots plus the stage card's bookmark, keyboard and touch.
import { createRun, getNode, availableChoices, choose, omenFor, runCode, runFromCode, mulberry32 } from '/lib/adventure.js';
const BOOKS = [{ id: 'chrono-signal', title: 'The Chrono-Signal' }, { id: 'obsidian-keep', title: 'The Obsidian Keep' }, { id: 'neon-harbour', title: 'Neon Harbour' }];
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180;
g.imageSmoothingEnabled = false;
const title = document.getElementById('title'), prose = document.getElementById('prose'), omen = document.getElementById('omen'),
  ch = document.getElementById('ch'), meta = document.getElementById('meta'), place = document.getElementById('place'),
  sel = document.getElementById('books'), slotBtn = document.getElementById('slot');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false, slot = 1;
const tick = (f = 660) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.04; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.06); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; tick(); };
const markKey = (id) => 'a2m.adventure.' + id, slotKey = () => 'a2m.adventure.slot.' + slot;
const cache = {};
async function book(id) {
  if (!cache[id]) { const r = await fetch('/data/adventures/' + id + '.json'); if (!r.ok) throw new Error('no book'); cache[id] = await r.json(); }
  return cache[id];
}
const hash = (s) => { let h = 2166136261; for (const ch2 of String(s)) { h ^= ch2.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// one deterministic pixel scene per node: genre palette, seeded stars, a horizon and a motif. Pure positions.
function art(b, nodeId) {
  const pal = b.genre && b.genre.includes('noir') ? ['#04140f', '#0a2e22', '#4ef0a0', '#ff5fa2'] : b.genre && b.genre.includes('fantasy') ? ['#140a24', '#2e1445', '#c98bff', '#ff9a5f'] : ['#050b1c', '#10233f', '#7aa7ff', '#4ef0a0'];
  const rnd = mulberry32(hash(b.id + ':' + nodeId));
  g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
  g.fillStyle = pal[1]; g.fillRect(0, H - 56, W, 56);
  for (let i = 0; i < 70; i++) { g.fillStyle = rnd() > 0.5 ? pal[2] : '#ffffff'; g.globalAlpha = 0.25 + rnd() * 0.6; g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * (H - 60)), 2, 2); }
  g.globalAlpha = 1;
  const mx = 40 + Math.floor(rnd() * 200), mw = 24 + Math.floor(rnd() * 40), mh = 40 + Math.floor(rnd() * 60);
  g.fillStyle = pal[2]; g.globalAlpha = 0.9; g.fillRect(mx, H - 56 - mh, mw, mh);
  g.fillStyle = pal[3]; for (let y = H - 56 - mh + 6; y < H - 62; y += 10) for (let x = mx + 4; x < mx + mw - 4; x += 8) if (rnd() > 0.4) g.fillRect(x, y, 4, 5);
  g.globalAlpha = 1; g.fillStyle = '#05050a'; g.fillRect(0, 0, W, 10);
}
const S = { book: null, run: null };
function paint() {
  const n = getNode(S.book, S.run.node || S.book.start);
  place.textContent = S.book.title;
  title.textContent = (S.book.title + ' · ' + (n.title || 'the end'));
  prose.textContent = n.prose || '';
  omen.textContent = '“' + omenFor(S.run.node || S.book.start, S.run.seed) + '”';
  art(S.book, S.run.node || S.book.start);
  ch.replaceChildren();
  for (const o of availableChoices(S.book, S.run)) {
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = (o.open ? (o.i + 1) + '. ' : '🔒 ') + o.text + (o.open || !o.need ? '' : ' (' + o.need + ')');
    if (!o.open) b.disabled = true;
    else b.onclick = () => { const r = choose(S.book, S.run, o.i); if (r.ok) { S.run = r.run; try { localStorage.setItem(markKey(S.book.id), runCode(S.run)); } catch (_) {} tick(520 + o.i * 90); paint(); } };
    ch.append(b);
  }
  if (n.ending) {
    const e = document.createElement('p'), mark = n.ending.kind === 'triumph' ? '✦ ' : n.ending.kind === 'demise' ? '✖ ' : '◈ ';
    e.append(document.createTextNode(mark + (n.ending.title || 'The end') + ' — '));
    const again = document.createElement('button'); again.type = 'button'; again.textContent = 'Read it again';
    again.onclick = () => start(S.book.id);
    e.append(again); ch.append(e); tick(880);
  }
  const bits = [...S.run.pack.map((p) => '🎒 ' + p), ...Object.entries(S.run.flags).filter(([, v]) => v).map(([k]) => '⚑ ' + k)];
  meta.textContent = (bits.length ? bits.join(' · ') + ' · ' : '') + 'step ' + (S.run.path.length + 1) + ' · run ' + runCode(S.run).slice(0, 12) + '…';
}
async function start(id, run) {
  S.book = await book(id);
  S.run = run && run.book === id ? run : { ...createRun(id), node: S.book.start };
  document.title = 'Verse Adventure · ' + S.book.title;
  paint();
}
function save() { try { localStorage.setItem(slotKey(), JSON.stringify({ book: S.book.id, code: runCode(S.run) })); say('Saved to slot S' + slot + ' on this device.'); tick(880); } catch (_) { say('This browser did not allow saving.'); } }
function say(t) { meta.textContent = t; }
async function load(slotData) {
  try {
    const j = slotData || JSON.parse(localStorage.getItem(slotKey()) || 'null'); // void-review: ok: load() wraps everything in try/catch, so a bad save says so instead of stopping the page
    const mark = !j && localStorage.getItem(markKey(currentId()));
    const use = j || (mark ? { book: currentId(), code: mark } : null);
    if (!use) { say('No save in slot S' + slot + '.'); return; }
    const b = await book(use.book);
    const run = runFromCode(b, use.code);
    if (!run) { say('That save could not be read.'); return; }
    if (use.book !== currentId()) { sel.value = use.book; }
    await start(use.book, run); say('Save loaded — ' + b.title + '.'); tick(720);
  } catch (_) { say('That save could not be read.'); }
}
const currentId = () => (sel.value || BOOKS[0].id);
for (const b of BOOKS) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.title; sel.append(o); }
sel.value = new URLSearchParams(location.search).get('book') || BOOKS[0].id;
if (!BOOKS.some((b) => b.id === sel.value)) sel.value = BOOKS[0].id;
sel.onchange = () => start(sel.value);
slotBtn.onclick = (e) => { slot = slot % 3 + 1; e.target.textContent = 'S' + slot; };
document.getElementById('save').onclick = save;
document.getElementById('load').onclick = () => load();
document.getElementById('export').onclick = async () => { const s = runCode(S.run); try { await navigator.clipboard.writeText(s); say('Run code copied (' + s.length + ' chars) — paste it to share this exact run.'); } catch (_) { say('Run code: ' + s.slice(0, 70) + '…'); } };
addEventListener('keydown', (e) => {
  if (/^[1-6]$/.test(e.key)) { const btns = [...ch.querySelectorAll('button:not([disabled])')]; const b = btns[+e.key - 1]; if (b) b.click(); }
  else if (e.key === 'Enter') { const b = ch.querySelector('button:not([disabled])'); if (b && document.activeElement && document.activeElement.tagName !== 'SELECT') b.click(); }
  else if (e.key.toLowerCase() === 's') save();
});
start(sel.value, null).catch(() => { prose.textContent = 'The book could not be opened. Reload to try again.'; });
