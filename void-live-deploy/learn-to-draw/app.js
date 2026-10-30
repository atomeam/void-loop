// /learn-to-draw/ (2026-10-29, assimilates wheelroot.com): the course its page only announces. 8 drills in 4 units, drawn with a finger, pen or
// mouse on a paper sheet and scored from the strokes (lib/drawing-drills.js); first and best try kept per drill, the drill of the day and the
// streak, all in this browser (localStorage, no cookie, no account). A drawing travels in its link and is scored again when the link opens.
import { SIZE, UNITS, DRILLS, drillOf, dailyDrill, score, encode, decode, streak } from '/lib/drawing-drills.js';

const $ = (id) => document.getElementById(id);
const KEY = 'verse.learn-to-draw.v1';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { days: Array.isArray(s.days) ? s.days : [], drills: s.drills && typeof s.drills === 'object' ? s.drills : {} }; } catch (_) { return { days: [], drills: {} }; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }; // void-review: ok (private mode: the scores still show, they are not kept)
let store = load(), cur = DRILLS[0], strokes = [], live = null, shared = false;

const PAPER = '#ece8dd', GUIDE = 'rgba(70, 110, 190, .45)', INK = '#1d1c22';
function paint(cv, d, ss, withGuide = true) {
  const g = cv.getContext('2d'), k = cv.width / SIZE;
  g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, SIZE, SIZE);
  if (withGuide) guide(g, d);
  const shade = d.unit === 'Shading';
  for (const s of ss) {
    g.save(); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = shade ? 12 : 3; g.globalAlpha = shade ? 0.25 : 1;
    g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (s.length === 1) { g.arc(s[0][0], s[0][1], 3, 0, 7); g.fillStyle = INK; g.fill(); } g.stroke(); g.restore();
  }
}
function guide(g, d, show = false) {
  g.save(); g.strokeStyle = GUIDE; g.fillStyle = GUIDE; g.lineWidth = 2; g.setLineDash(d.guide === 'path' || d.guide === 'ring' ? [6, 6] : []);
  const dot = (p) => { g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); };
  if (d.dots) d.dots.forEach(dot);
  if (d.guide === 'path' || (d.guide === 'flash' && show)) { g.beginPath(); d.path.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (d.guide === 'flash' || d.id === 'square') g.closePath(); g.stroke(); }
  if (d.ring) { g.beginPath(); g.arc(d.ring[0], d.ring[1], d.ring[2], 0, 7); g.stroke(); }
  if (d.line) { g.beginPath(); g.moveTo(...d.line[0]); g.lineTo(...d.line[1]); g.strokeStyle = INK; g.stroke(); }
  if (d.boxes) d.boxes.forEach((b) => g.strokeRect(...b));
  if (d.bar) { g.strokeRect(...d.bar); g.font = '12px system-ui'; g.fillText('white', d.bar[0], d.bar[1] - 6); g.fillText('dark', d.bar[0] + d.bar[2] - 26, d.bar[1] - 6); }
  g.restore();
}

const sheet = $('sheet');
function fit() { const w = Math.min(420, sheet.parentElement.clientWidth || 300), r = window.devicePixelRatio || 1; sheet.style.width = sheet.style.height = w + 'px'; sheet.width = sheet.height = Math.round(w * r); redraw(); }
function redraw() { paint(sheet, cur, live ? strokes.concat([live]) : strokes); }
// points are kept in whole sheet pixels, 3 px apart at least: exactly what a link carries (lib/drawing-drills.js encode), so a shared drawing scores the same
const at = (e) => { const b = sheet.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(SIZE, (e.clientX - b.left) / b.width * SIZE))), Math.round(Math.max(0, Math.min(SIZE, (e.clientY - b.top) / b.height * SIZE)))]; };
sheet.addEventListener('pointerdown', (e) => { e.preventDefault(); sheet.setPointerCapture(e.pointerId); if (shared) { strokes = []; shared = false; } live = [at(e)]; redraw(); });
sheet.addEventListener('pointermove', (e) => { if (!live) return; const p = at(e), q = live[live.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 3) { live.push(p); redraw(); } });
const end = () => { if (!live) return; strokes.push(live); live = null; redraw(); soFar(); };
sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);

function soFar() { const r = score(cur.id, strokes); $('result').textContent = strokes.length ? 'So far: ' + r.score + ' of 100. Press Done to keep this try.' : 'Draw on the sheet.'; }
function show(r, lead) {
  const rec = store.drills[cur.id];
  $('result').textContent = '';
  const h = document.createElement('strong'); h.textContent = (lead ? lead + ' ' : '') + 'Score: ' + r.score + ' of 100'; $('result').append(h);
  const ul = document.createElement('ul'); r.notes.forEach((n) => { const li = document.createElement('li'); li.textContent = n; ul.append(li); }); $('result').append(ul);
  if (rec && !lead) { const p = document.createElement('p'); p.textContent = 'First try: ' + rec.first.score + ' · Best: ' + rec.best.score + ' · Tries: ' + rec.tries + (rec.best.score > rec.first.score ? ' · up ' + (rec.best.score - rec.first.score) + ' since your first try' : ''); $('result').append(p); }
}
function done() {
  if (!strokes.length) { $('result').textContent = 'Draw on the sheet first.'; return; }
  strokes = decode(encode(strokes));
  const r = score(cur.id, strokes), s = encode(strokes), now = new Date().toISOString(), rec = store.drills[cur.id];
  const t = { score: r.score, s, at: now };
  store.drills[cur.id] = rec ? { first: rec.first, best: r.score > rec.best.score ? t : rec.best, tries: rec.tries + 1 } : { first: t, best: t, tries: 1 };
  if (!store.days.includes(today())) store.days.push(today());
  store.days = store.days.slice(-400); save(store); show(r); course(); progress(); head();
}
function open(d, ss = [], sharedLink = false) {
  cur = d; strokes = ss; live = null; shared = sharedLink;
  $('dUnit').textContent = d.unit + ' · drill ' + (DRILLS.indexOf(d) + 1) + ' of 8'; $('dName').textContent = d.name; $('dHow').textContent = d.how;
  $('flash').hidden = d.guide !== 'flash'; redraw();
  if (sharedLink && ss.length) show(score(d.id, ss), 'Scored again from the link.'); else soFar();
  document.querySelectorAll('#course button[data-d]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === d.id)));
}
function course() {
  const box = $('course'); box.textContent = '';
  for (const u of UNITS) {
    const sec = document.createElement('section'), h = document.createElement('h3'); h.textContent = u; sec.append(h);
    for (const d of DRILLS.filter((x) => x.unit === u)) {
      const b = document.createElement('button'), rec = store.drills[d.id]; b.type = 'button'; b.dataset.d = d.id;
      b.textContent = d.name + (rec ? ' · best ' + rec.best.score : ' · not tried yet'); b.onclick = () => { history.replaceState(null, '', '/learn-to-draw/?d=' + d.id); open(d); $('drill').scrollIntoView({ block: 'start' }); };
      sec.append(b);
    }
    box.append(sec);
  }
}
function progress() {
  const box = $('progress'); box.textContent = '';
  const tried = DRILLS.filter((d) => store.drills[d.id]);
  if (!tried.length) { box.textContent = 'Your first and best try at each drill show here, side by side, once you press Done on a drill.'; return; }
  for (const d of tried) {
    const rec = store.drills[d.id], fig = document.createElement('figure'), pair = document.createElement('div'); pair.className = 'pair';
    for (const [label, t] of [['First try', rec.first], ['Best', rec.best]]) { const c = document.createElement('canvas'); c.width = c.height = 150; c.setAttribute('role', 'img'); c.setAttribute('aria-label', d.name + ', ' + label.toLowerCase() + ': ' + t.score + ' of 100'); paint(c, d, decode(t.s)); const w = document.createElement('div'); w.append(c, Object.assign(document.createElement('span'), { textContent: label + ': ' + t.score })); pair.append(w); }
    const cap = document.createElement('figcaption'); cap.textContent = d.name + ' (' + d.unit + '), ' + rec.tries + (rec.tries === 1 ? ' try' : ' tries'); fig.append(cap, pair); box.append(fig);
  }
}
function head() {
  const dd = dailyDrill(), n = streak(store.days, today()), tried = DRILLS.filter((d) => store.drills[d.id]).length;
  $('today').textContent = "Today's drill: " + dd.name + ' (' + dd.unit + ')'; $('today').onclick = () => { history.replaceState(null, '', '/learn-to-draw/?d=' + dd.id); open(dd); $('drill').scrollIntoView({ block: 'start' }); };
  $('streak').textContent = 'Streak: ' + n + (n === 1 ? ' day' : ' days') + ' · ' + tried + ' of 8 drills tried' + (store.days.includes(today()) ? ' · done today' : '');
}

$('done').onclick = done;
$('clear').onclick = () => { strokes = []; live = null; shared = false; redraw(); soFar(); };
$('undo').onclick = () => { strokes.pop(); redraw(); soFar(); };
$('flash').onclick = () => { const g = sheet.getContext('2d'); guide(g, cur, true); $('flash').disabled = true; setTimeout(() => { $('flash').disabled = false; redraw(); }, 4000); };
$('begin').onclick = () => { const d = DRILLS.find((x) => !store.drills[x.id]) || dailyDrill(); history.replaceState(null, '', '/learn-to-draw/?d=' + d.id); open(d); $('drill').scrollIntoView({ block: 'start' }); };
async function share() {
  const u = location.origin + '/learn-to-draw/?d=' + cur.id + (strokes.length ? '&s=' + encode(strokes) : '');
  history.replaceState(null, '', u);
  let ok = false; try { await navigator.clipboard.writeText(u); ok = true; } catch (_) {} // void-review: ok (the link is also in the address bar)
  $('shareNote').textContent = ok ? 'Link copied: it opens this drawing and scores it again.' : 'The link to this drawing is in the address bar.';
}
$('share').onclick = share;

const q = new URLSearchParams(location.search), qd = drillOf(q.get('d') || ''), qs = decode(q.get('s') || '');
course(); progress(); head();
open(qd || dailyDrill(), qs, !!(qd && qs.length));
if (qd) requestAnimationFrame(() => $('drill').scrollIntoView({ block: 'start' }));
addEventListener('resize', fit); fit();
addEventListener('load', () => { import('/lib/toolkit.js').then((m) => m.mountRelated($('related'), '/learn-to-draw/', [{ label: 'Share this drawing', run: share }, { label: 'Paint a picture by numbers', href: () => '/paint/' }])).catch(() => {}); });
