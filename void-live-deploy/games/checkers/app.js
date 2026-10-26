// /games/checkers/ (Versus' games lane, a checkers site): American checkers against the computer or a friend. The rules and the search are
// skills/checkers-rules.js (the stage's checkers card uses the same); this wires the board the page painted. Your record stays on this device.
import { create, legalMoves, apply, status, bestMove, playable } from '/skills/checkers-rules.js';
import { $, lang, store, german, shareButton } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Level: 'Stufe', Easy: 'Leicht', Normal: 'Mittel', Hard: 'Schwer', Opponent: 'Gegner', 'The computer': 'Der Computer', 'A friend on this device': 'Jemand an diesem Gerät', 'Your move.': 'Sie sind am Zug.', 'The computer is thinking…': 'Der Computer denkt nach…', 'You win!': 'Sie haben gewonnen!', 'The computer wins.': 'Der Computer gewinnt.', 'A draw.': 'Unentschieden.', 'Red to move.': 'Rot ist am Zug.', 'White to move.': 'Weiß ist am Zug.', 'A capture must be taken.': 'Schlagen ist Pflicht.' },
  'Dame (amerikanische Regeln) gegen den Computer auf drei Stufen oder zu zweit an diesem Gerät: Schlagpflicht, Mehrfachsprünge, Damen, Rückgängig und Tipps. Auf Ihrem Gerät, ohne Konto.');
const db = store('checkers', { level: 'normal', mode: 'ai', w: 0, l: 0, d: 0 }); const mem = db.get();
const cells = [...$('cb').children], sqOf = (i) => (7 - (i >> 3)) * 8 + (i & 7), cellOf = (sq) => (7 - (sq >> 3)) * 8 + (sq & 7);
let s = create(), hist = [], sel = null, over = false, last = null, busy = false;
const DEPTH = { easy: [2, 150, 0.35], normal: [5, 400, 0.08], hard: [9, 900, 0] };
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
function paint() {
  const ms = sel !== null ? legalMoves(s).filter((m) => m.from === sel) : [];
  cells.forEach((b, i) => { const sq = sqOf(i), p = s.board[sq];
    b.className = (playable(sq) ? 'd' : 'l') + (sel === sq ? ' sel' : '') + (ms.some((m) => m.path[m.path.length - 1] === sq) ? ' tgt' : '') + (last && (last.from === sq || last.path.includes(sq)) ? ' last' : '');
    b.innerHTML = p ? `<span class="man ${p.toLowerCase() === 'd' ? 'me' : 'cpu'}">${p === 'D' || p === 'L' ? '♛' : ''}</span>` : '';
    b.setAttribute('aria-label', 'abcdefgh'[sq & 7] + ((sq >> 3) + 1) + (p ? ' ' + ({ d: 'red man', D: 'red king', l: 'white man', L: 'white king' })[p] : '')); });
  $('stats').textContent = (lang === 'de' ? `Ihre Siege auf diesem Gerät: ${mem.w} · Niederlagen: ${mem.l} · Unentschieden: ${mem.d}` : `Your wins on this device: ${mem.w} · losses: ${mem.l} · draws: ${mem.d}`);
  $('undo').disabled = !hist.length || busy;
}
function after() {
  const st = status(s);
  if (st !== 'playing') { over = true; const ai = mem.mode === 'ai'; if (ai) { if (st === 'dark-wins') mem.w++; else if (st === 'light-wins') mem.l++; else mem.d++; db.put(mem); }
    say(st === 'draw' ? t('A draw.') : ai ? (st === 'dark-wins' ? t('You win!') : t('The computer wins.')) : (st === 'dark-wins' ? (lang === 'de' ? 'Rot gewinnt.' : 'Red wins.') : (lang === 'de' ? 'Weiß gewinnt.' : 'White wins.')), 'ok'); paint(); return; }
  const forced = legalMoves(s)[0].captures.length ? ' ' + t('A capture must be taken.') : '';
  if (mem.mode === 'ai' && s.turn === 'l') { say(t('The computer is thinking…')); busy = true; paint(); setTimeout(cpu, 250); }
  else { say((mem.mode === 'ai' ? t('Your move.') : t(s.turn === 'd' ? 'Red to move.' : 'White to move.')) + forced); paint(); }
}
function cpu() {
  const [depth, ms, slip] = DEPTH[mem.level] || DEPTH.normal, all = legalMoves(s);
  const m = Math.random() < slip ? all[Math.floor(Math.random() * all.length)] : bestMove(s, { depth, ms });
  busy = false; last = m; s = apply(s, m); after();
}
function playMove(m) { hist.push(s); last = m; s = apply(s, m); sel = null; after(); }
$('cb').onclick = (e) => {
  const b = e.target.closest('button'); if (!b || over || busy) return; const sq = sqOf(cells.indexOf(b));
  if (mem.mode === 'ai' && s.turn !== 'd') return;
  const ms = legalMoves(s);
  if (sel !== null) { const m = ms.find((x) => x.from === sel && x.path[x.path.length - 1] === sq); if (m) return playMove(m); }
  sel = ms.some((x) => x.from === sq) ? (sel === sq ? null : sq) : null;
  if (sel === null && s.board[sq] && s.board[sq].toLowerCase() === s.turn && ms.length && !ms.some((x) => x.from === sq)) say(ms[0].captures.length ? t('A capture must be taken.') : (lang === 'de' ? 'Dieser Stein kann nicht ziehen.' : 'That man cannot move.'), 'bad');
  paint();
};
$('new').onclick = () => { s = create(); hist = []; sel = null; over = false; last = null; busy = false; after(); };
$('undo').onclick = () => { if (!hist.length || busy) return; s = hist.pop(); if (mem.mode === 'ai' && s.turn === 'l' && hist.length) s = hist.pop(); over = false; sel = null; last = null; after(); };
$('hint').onclick = () => { if (over || busy || (mem.mode === 'ai' && s.turn !== 'd')) return; const m = bestMove(s, { depth: 7, ms: 500 }); if (!m) return; sel = m.from; paint(); const to = m.path[m.path.length - 1]; cells[cellOf(to)].classList.add('tgt'); say((lang === 'de' ? 'Tipp: von ' : 'Hint: from ') + 'abcdefgh'[m.from & 7] + ((m.from >> 3) + 1) + (lang === 'de' ? ' nach ' : ' to ') + 'abcdefgh'[to & 7] + ((to >> 3) + 1) + (m.captures.length ? (lang === 'de' ? ', schlägt ' : ', taking ') + m.captures.length : '') + '.'); };
const q = new URLSearchParams(location.search); if (q.get('level') && DEPTH[q.get('level')]) mem.level = q.get('level'); if (q.get('mode') === 'two' || q.get('mode') === 'ai') mem.mode = q.get('mode');
$('level').value = mem.level; $('mode').value = mem.mode;
$('level').onchange = () => { mem.level = $('level').value; db.put(mem); }; $('mode').onchange = () => { mem.mode = $('mode').value; db.put(mem); $('new').onclick(); };
shareButton($('share'), () => '?mode=' + mem.mode + '&level=' + mem.level, say, t);
after(); mountRelated($('related'), '/games/checkers/');
