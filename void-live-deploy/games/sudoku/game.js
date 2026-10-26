// /games/sudoku/ (Versus' games lane, a sudoku site): a puzzle made on the device with exactly one solution (lib/sudoku.js), on the grid the page
// painted: numbers, pencil notes, undo and redo, a hint with its reason, mistakes shown or not, the same number lit up, a timer, print, best times.
import { generate, hint, conflicts, PEERS } from '/lib/sudoku.js';
import { $, lang, store, german, timer, shareButton, mmss } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Level: 'Stufe', Easy: 'Leicht', Medium: 'Mittel', Hard: 'Schwer', Evil: 'Teuflisch', Time: 'Zeit', Notes: 'Notizen', Erase: 'Löschen', Redo: 'Wiederholen', 'Show mistakes': 'Fehler zeigen', Print: 'Drucken', 'Best: none yet': 'Bestzeit: noch keine' },
  'Füllen Sie das Gitter so, dass jede Zeile, jede Spalte und jedes 3x3-Feld 1 bis 9 genau einmal enthält. Vier Stufen von leicht bis teuflisch, jedes Rätsel mit genau einer Lösung. Notizen, Rückgängig, Tipps mit Begründung, Zeit und Drucken.');
const db = store('sudoku', { level: 'medium', best: {}, saved: null }); const mem = db.get();
const cells = [...$('grid').children], clock = timer($('clock'));
let pz, g, notes, cur = -1, noteMode = false, undo = [], redo = [], done = false, hinted = -1;
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
function start(seed, level, saved = null) {
  mem.level = level; pz = generate(seed, level); g = saved ? saved.g.slice() : pz.puzzle.slice(); notes = saved ? saved.notes.map((n) => n.slice()) : Array.from({ length: 81 }, () => []);
  undo = []; redo = []; done = false; cur = -1; hinted = -1; clock.reset(); clock.start(saved ? saved.secs || 0 : 0);
  $('level').value = level; $('num').textContent = (lang === 'de' ? 'Rätsel ' : 'Puzzle ') + seed + ' · ' + pz.clues + (lang === 'de' ? ' Vorgaben' : ' clues');
  $('best').textContent = mem.best[level] ? (lang === 'de' ? 'Bestzeit: ' : 'Best: ') + mmss(mem.best[level]) : t('Best: none yet');
  say(lang === 'de' ? 'Wählen Sie ein Feld, dann eine Zahl.' : 'Pick a square, then a number. Notes mode writes small pencil marks.'); paint(); keep();
}
const keep = () => { mem.saved = done ? null : { seed: pz.seed, level: pz.level, g, notes, secs: clock.seconds() }; db.put(mem); };
function paint() {
  const bad = $('showerr').checked ? new Set([...conflicts(g), ...g.map((v, i) => (v && v !== pz.solution[i] && !pz.puzzle[i] ? i : -1)).filter((i) => i >= 0)]) : new Set(), v = cur >= 0 ? g[cur] : 0;
  cells.forEach((b, i) => {
    const given = !!pz.puzzle[i]; b.className = (given ? 'giv' : '') + (cur >= 0 && PEERS[cur].includes(i) ? ' peer' : '') + (v && g[i] === v ? ' same' : '') + (i === cur ? ' cur' : '') + (bad.has(i) && !given ? ' err' : '') + (i === hinted ? ' hint' : '');
    if (g[i]) b.textContent = g[i]; else if (notes[i].length) b.innerHTML = '<span class="notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<span>' + (notes[i].includes(n) ? n : '') + '</span>').join('') + '</span>'; else b.textContent = '';
    b.setAttribute('aria-label', 'row ' + (Math.floor(i / 9) + 1) + ' column ' + (i % 9 + 1) + ', ' + (g[i] ? g[i] + (given ? ' given' : '') : 'empty'));
  });
  for (const b of $('pad').children) { const n = +b.dataset.n; b.disabled = g.filter((x) => x === n).length >= 9; }
  $('undo').disabled = !undo.length; $('redo').disabled = !redo.length;
}
function setVal(i, n, note = noteMode) {
  if (done || i < 0 || pz.puzzle[i]) return; undo.push({ i, v: g[i], n: notes[i].slice() }); redo = []; hinted = -1;
  if (note && n) { if (g[i]) return; notes[i] = notes[i].includes(n) ? notes[i].filter((x) => x !== n) : [...notes[i], n].sort(); }
  else { g[i] = g[i] === n ? 0 : n; if (g[i]) { notes[i] = []; for (const j of PEERS[i]) notes[j] = notes[j].filter((x) => x !== n); } }
  paint(); keep(); check();
}
function check() {
  if (g.every((v, i) => v === pz.solution[i])) { done = true; const secs = clock.stop(), old = mem.best[pz.level]; if (!old || secs < old) mem.best[pz.level] = Math.round(secs); keep(); db.put(mem);
    say((lang === 'de' ? 'Gelöst in ' : 'Solved in ') + mmss(secs) + (!old || secs < old ? (lang === 'de' ? ' – neue Bestzeit!' : ' – a new best time!') : '.'), 'ok'); $('best').textContent = (lang === 'de' ? 'Bestzeit: ' : 'Best: ') + mmss(mem.best[pz.level]); }
  else if (g.every(Boolean)) say(lang === 'de' ? 'Alles gefüllt, aber etwas stimmt nicht.' : 'Every square is filled, but something is wrong.', 'bad');
}
$('grid').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; cur = cells.indexOf(b); paint(); };
$('pad').onclick = (e) => { const b = e.target.closest('button'); if (b) setVal(cur, +b.dataset.n); };
addEventListener('keydown', (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (/^[1-9]$/.test(e.key)) { setVal(cur, +e.key, noteMode !== e.shiftKey); e.preventDefault(); }
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { if (cur >= 0 && !pz.puzzle[cur]) { undo.push({ i: cur, v: g[cur], n: notes[cur].slice() }); g[cur] = 0; notes[cur] = []; paint(); keep(); } }
  else if (/^Arrow/.test(e.key)) { if (cur < 0) cur = 0; else { const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; cur = Math.max(0, Math.min(80, cur + d)); } cells[cur].focus(); paint(); e.preventDefault(); }
  else if (e.key === 'n') $('notes').onclick();
});
$('notes').onclick = () => { noteMode = !noteMode; $('notes').setAttribute('aria-pressed', String(noteMode)); };
$('erase').onclick = () => { if (cur < 0 || pz.puzzle[cur]) return; undo.push({ i: cur, v: g[cur], n: notes[cur].slice() }); g[cur] = 0; notes[cur] = []; paint(); keep(); };
const step = (from, to) => { const x = from.pop(); if (!x) return; to.push({ i: x.i, v: g[x.i], n: notes[x.i].slice() }); g[x.i] = x.v; notes[x.i] = x.n; cur = x.i; paint(); keep(); };
$('undo').onclick = () => step(undo, redo); $('redo').onclick = () => step(redo, undo);
$('hint').onclick = () => { if (done) return; const h = hint(g, pz.solution); if (!h) return; cur = h.i; hinted = h.i; paint(); say((lang === 'de' ? 'Tipp: ' : 'Hint: ') + h.why + '.'); };
$('showerr').onchange = paint;
$('level').onchange = () => start(Math.floor(Math.random() * 1e5) + 1, $('level').value);
$('new').onclick = () => start(Math.floor(Math.random() * 1e5) + 1, $('level').value);
$('print').onclick = () => print();
shareButton($('share'), () => '?level=' + pz.level + '&puzzle=' + pz.seed, say, t);
const qs = new URLSearchParams(location.search), lv = ['easy', 'medium', 'hard', 'evil'].includes(qs.get('level')) ? qs.get('level') : null;
if (qs.get('puzzle')) start(+qs.get('puzzle') || 1, lv || 'medium');
else if (!lv && mem.saved) start(mem.saved.seed, mem.saved.level, mem.saved);
else start(Math.floor(Math.random() * 1e5) + 1, lv || mem.level);
mountRelated($('related'), '/games/sudoku/');
