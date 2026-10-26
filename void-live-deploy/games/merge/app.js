// /games/merge/ (Versus' games lane, a sliding-tile site): the slide and merge rules from skills/merge-void-rules.js (the stage's Merge Verse card plays
// the same) on the page's 4x4 board. This page's goal is 2048, and play goes on after it. Swipe, arrow keys or W A S D; undo one move; best score kept here.
import { create, slide, canMove, DIRS } from '/skills/merge-void-rules.js';
import { $, lang, store, german, shareButton } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Score: 'Punkte', Best: 'Bestwert', Moves: 'Züge' }, 'Schieben Sie alle Kacheln in eine Richtung, mit den Pfeiltasten oder einem Wisch; zwei gleiche Kacheln verschmelzen zu einer mit doppeltem Wert. Erreichen Sie 2048 und spielen Sie weiter. Ein Zug rückgängig, Ihr Bestwert bleibt auf diesem Gerät.');
const db = store('merge', { best: 0, saved: null }); const mem = db.get();
const tiles = [...$('board').children];
let s, seed, prev = null, won = false;
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
const rand = () => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };
function spawn() { const free = s.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); if (!free.length) return -1; const i = free[Math.floor(rand() * free.length)]; s.grid[i] = rand() < 0.9 ? 2 : 4; return i; }
function start(sd = Math.floor(Math.random() * 1e6) + 1, saved = null) { seed = sd; s = saved ? saved.s : create(seed); prev = null; won = saved ? saved.won : false; paint(); say(t('Swipe, or use the arrow keys or W A S D. Equal tiles that meet join and double.')); keep(); }
const keep = () => { mem.saved = { s, won, seed }; mem.best = Math.max(mem.best, s.score); db.put(mem); };
function paint(pop = -1) {
  tiles.forEach((d, i) => { const v = s.grid[i]; d.textContent = v || ''; d.className = v ? (v > 2048 ? 'big' : 'v' + v) + (i === pop ? ' pop' : '') : ''; });
  $('score').textContent = s.score; $('best').textContent = Math.max(mem.best, s.score); $('moves').textContent = s.moves; $('undo').disabled = !prev;
  $('board').setAttribute('aria-label', 'The tiles, row by row: ' + [0, 1, 2, 3].map((r) => s.grid.slice(r * 4, r * 4 + 4).map((v) => v || 'empty').join(' ')).join('; '));
}
function go(dir) {
  if (!DIRS.includes(dir)) return; const r = slide(s.grid, dir); if (!r.moved) return;
  prev = JSON.parse(JSON.stringify(s)); s.grid = r.grid; s.score += r.gained; s.moves++; const at = spawn(); s.over = null; paint(at); keep();
  if (!won && Math.max(...s.grid) >= 2048) { won = true; say(lang === 'de' ? '2048! Spielen Sie weiter, so weit Sie kommen.' : '2048! Keep going as far as you can.', 'ok'); }
  else if (!canMove(s)) say((lang === 'de' ? 'Kein Zug mehr. Punkte: ' : 'No move left. Score: ') + s.score + '.', 'bad');
}
addEventListener('keydown', (e) => { const d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }[e.key]; if (d && !/INPUT|SELECT/.test(e.target.tagName)) { e.preventDefault(); go(d); } });
let sx = 0, sy = 0;
$('board').addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
$('board').addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
for (const b of document.querySelectorAll('[data-d]')) b.onclick = () => go(b.dataset.d);
$('undo').onclick = () => { if (!prev) return; s = prev; prev = null; paint(); keep(); };
$('new').onclick = () => start();
shareButton($('share'), () => '?seed=' + seed, say, t);
const qs = new URLSearchParams(location.search);
if (qs.get('seed')) start(+qs.get('seed') || 7); else if (mem.saved && mem.saved.s) start(mem.saved.seed, mem.saved); else start();
mountRelated($('related'), '/games/merge/');
