// /games/mines/ (Versus' games lane, a mine-clearing site): the classic rules from skills/null-sweep-rules.js (the stage's Null Sweep card plays the
// same), on the page's own grid: flags by long-press, right-click or Flag mode, question marks, chording, a timer, best times on this device.
import { create, open, flag, around, count, flagsLeft } from '/skills/null-sweep-rules.js';
import { $, lang, store, german, timer, shareButton, mmss } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Level: 'Stufe', 'Beginner 9x9, 10 mines': 'Anfänger 9x9, 10 Minen', 'Intermediate 16x16, 40': 'Fortgeschritten 16x16, 40', 'Expert 30x16, 99': 'Experte 30x16, 99', Custom: 'Eigene', 'Mines left': 'Minen übrig', Time: 'Zeit', Field: 'Feld', 'Flag mode': 'Flaggenmodus', 'Question marks': 'Fragezeichen', 'Best: none yet': 'Bestzeit: noch keine' },
  'Öffnen Sie jedes sichere Feld: eine Zahl sagt, wie viele der acht Nachbarn eine Mine verbergen. Anfänger, Fortgeschritten, Experte oder eigene Größe; Flagge per langem Druck oder Rechtsklick. Das erste Feld ist immer sicher.');
const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
const db = store('mines', { level: 'beginner', best: {}, custom: [20, 12, 40] }); const mem = db.get();
let s, seed, dims, q = [], flagMode = false; const clock = timer($('clock'));
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
function newGame(sd = Math.floor(Math.random() * 1e6) + 1) {
  seed = sd; dims = mem.level === 'custom' ? mem.custom : LEVELS[mem.level]; const [w, h, m] = dims; $('size').textContent = w + ' × ' + h; s = create(seed, w, h, Math.min(m, w * h - 10)); q = new Array(w * h).fill(0); clock.reset();
  const g = $('grid'), size = w > 16 && innerWidth < 700 ? 24 : 34; g.className = 'mines' + (size === 24 ? ' small' : ''); g.style.gridTemplateColumns = `repeat(${w}, ${size}px)`;
  if (g.children.length !== w * h) g.innerHTML = Array.from({ length: w * h }, (_, i) => `<button type="button" aria-label="square ${(i % w) + 1}, ${Math.floor(i / w) + 1}"></button>`).join('');
  $('best').textContent = mem.best[key()] ? (lang === 'de' ? 'Bestzeit: ' : 'Best: ') + mmss(mem.best[key()]) : t('Best: none yet');
  say(lang === 'de' ? 'Öffnen Sie ein Feld.' : 'Open a square. The first one is always safe.'); paint();
}
const key = () => (mem.level === 'custom' ? 'custom ' + dims.join('x') : mem.level);
function paint() {
  const cells = $('grid').children;
  for (let i = 0; i < cells.length; i++) { const b = cells[i], o = s.open[i], n = o && !s.mine[i] ? count(s, i) : 0, x = i % s.w + 1, y = Math.floor(i / s.w) + 1;
    b.className = (o ? 'o' : '') + (n ? ' n' + n : '') + (s.over === 'boom' && i === s.hit ? ' boom' : '');
    b.textContent = o ? (s.mine[i] ? '✹' : n || '') : s.flag[i] ? '⚑' : q[i] ? '?' : s.over && s.mine[i] ? '✹' : '';
    b.setAttribute('aria-label', x + ', ' + y + ': ' + (o ? (s.mine[i] ? 'mine' : n ? n + ' around' : 'clear') : s.flag[i] ? 'flagged' : 'closed')); }
  $('left').textContent = flagsLeft(s);
}
function finish() {
  const secs = clock.stop();
  if (s.over === 'win') { const k = key(), old = mem.best[k]; if (!old || secs < old) { mem.best[k] = Math.round(secs * 10) / 10; db.put(mem); } for (let i = 0; i < s.mine.length; i++) if (s.mine[i]) s.flag[i] = 1;
    say((lang === 'de' ? 'Geschafft in ' : 'Cleared in ') + mmss(secs) + (!old || secs < old ? (lang === 'de' ? ' – neue Bestzeit!' : ' – a new best time!') : '.'), 'ok'); $('best').textContent = (lang === 'de' ? 'Bestzeit: ' : 'Best: ') + mmss(mem.best[k]); }
  else say(lang === 'de' ? 'Eine Mine. Neues Spiel?' : 'A mine. Try a new game.', 'bad');
}
function act(i, flagIt) {
  if (s.over) return;
  if (flagIt) { if (s.open[i]) return; if (s.flag[i] && $('marks').checked) { flag(s, i); q[i] = 1; } else if (q[i]) q[i] = 0; else flag(s, i); paint(); return; }
  if (s.open[i]) { // chording: a number whose flags are all placed opens the rest around it
    const n = count(s, i), around_ = around(s, i); if (n && around_.filter((j) => s.flag[j]).length === n) for (const j of around_) if (!s.open[j] && !s.flag[j]) open(s, j);
  } else { if (s.flag[i]) return; q[i] = 0; open(s, i); }
  if (!clock.running() && !s.over) clock.start(); paint(); if (s.over) finish();
}
let press = 0, longDone = false;
const idx = (e) => { const b = e.target.closest('#grid button'); return b ? [...$('grid').children].indexOf(b) : -1; };
$('grid').addEventListener('contextmenu', (e) => { e.preventDefault(); const i = idx(e); if (i >= 0) act(i, true); });
$('grid').addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.pointerType === 'mouse') return; const i = idx(e); longDone = false; clearTimeout(press); press = setTimeout(() => { if (i >= 0) { longDone = true; act(i, true); if (navigator.vibrate) navigator.vibrate(20); } }, 420); });
addEventListener('pointerup', () => clearTimeout(press)); addEventListener('pointercancel', () => clearTimeout(press));
$('grid').addEventListener('click', (e) => { const i = idx(e); if (i < 0) return; if (longDone) { longDone = false; return; } act(i, flagMode); });
$('flagmode').onclick = () => { flagMode = !flagMode; $('flagmode').setAttribute('aria-pressed', String(flagMode)); };
$('level').onchange = () => { mem.level = $('level').value; $('custom').hidden = mem.level !== 'custom'; db.put(mem); newGame(); };
for (const id of ['cw', 'ch', 'cm']) $(id).onchange = () => { const w = Math.max(5, Math.min(40, +$('cw').value || 20)), h = Math.max(5, Math.min(30, +$('ch').value || 12)), m = Math.max(1, Math.min(w * h - 10, +$('cm').value || 40)); mem.custom = [w, h, m]; db.put(mem); newGame(); };
$('new').onclick = () => newGame();
shareButton($('share'), () => '?level=' + mem.level + '&board=' + seed + (mem.level === 'custom' ? '&w=' + dims[0] + '&h=' + dims[1] + '&m=' + dims[2] : ''), say, t);
const qs = new URLSearchParams(location.search);
if (LEVELS[qs.get('level')] || qs.get('level') === 'custom') mem.level = qs.get('level');
if (qs.get('w')) mem.custom = [Math.max(5, Math.min(40, +qs.get('w'))), Math.max(5, Math.min(30, +qs.get('h') || 12)), Math.max(1, +qs.get('m') || 40)];
$('level').value = mem.level; $('custom').hidden = mem.level !== 'custom'; [$('cw').value, $('ch').value, $('cm').value] = mem.custom;
newGame(+qs.get('board') || undefined); mountRelated($('related'), '/games/mines/');
