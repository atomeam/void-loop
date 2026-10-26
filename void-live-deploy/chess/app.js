// /chess/ (Versus' games floor, Lichess): the board, the modes and the engine. The rules are skills/chess-rules.js, the game around them lib/chess-play.js,
// the computer lib/chess-engine.js in a worker (lib/chess-worker.js). The board and its words are in the HTML before this runs (tools/game-pages.mjs).
// Kept on this device (a2m.void.chess.v1): the level, colour and clock chosen, the game in progress, your ratings and the puzzles you solved.
import { legalMoves, status, sqName, sqIndex } from '/skills/chess-rules.js';
import { START, newGame, push, positionAt, cut, toPGN, fromPGN, checkFEN, fullFEN, linkOf, gameFromLink, lichessAnalysis, stateWords, resultOf,
  makeClock, pressClock, stopClock, flagged, clockLeft, clockText, TIME_CONTROLS, eloAfter, checkPuzzleMove } from '/lib/chess-play.js';
import { toFEN } from '/skills/chess-rules.js';
import { mountRelated } from '/lib/toolkit.js';
import { openingOf } from '/lib/chess-openings.js';

const $ = (id) => document.getElementById(id);
const KEY = 'a2m.void.chess.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (_) { /* private mode: this visit only */ } };
const mem = { level: 4, color: 'w', tc: 'none', rating: { r: 1200, n: 0 }, prating: { r: 1200, n: 0 }, solved: [], ...load() };
const LEVEL_ELO = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

// ---- German for a German browser (or ?lang=de); English otherwise ----
const DE = {
  'Play the computer': 'Gegen den Computer', Chess: 'Schach', 'All games': 'Alle Spiele', Checkers: 'Dame', Solitaire: 'Patience', Mines: 'Minen', 'Word guess': 'Worträtsel', 'Slide and merge': 'Schieben und Verschmelzen', 'Two players': 'Zwei Spieler', Puzzles: 'Aufgaben', Analysis: 'Analyse', 'Computer level': 'Computerstufe', 'You play': 'Sie spielen', White: 'Weiß', Black: 'Schwarz', Random: 'Zufällig', Clock: 'Uhr',
  'New game': 'Neue Partie', 'Next puzzle': 'Nächste Aufgabe', 'Show the solution': 'Lösung zeigen', 'Lichess daily puzzle': 'Tagesaufgabe von Lichess', Takeback: 'Zurücknehmen', 'Flip board': 'Brett drehen', Hint: 'Tipp', 'Engine analysis': 'Engine-Analyse',
  'Draw arrows': 'Pfeile zeichnen', 'Clear arrows': 'Pfeile löschen', Resign: 'Aufgeben', 'Share link': 'Link teilen', Moves: 'Züge', 'PGN and FEN: import, export, copy': 'PGN und FEN: laden, speichern, kopieren', 'Copy FEN': 'FEN kopieren', 'Copy PGN': 'PGN kopieren',
  'Download .pgn': '.pgn herunterladen', 'Open this position on Lichess': 'Stellung auf Lichess öffnen', 'Lichess cloud analysis': 'Lichess-Cloud-Analyse', Load: 'Laden', 'Promote to': 'Umwandeln in', You: 'Sie', 'No clock': 'Ohne Uhr',
  'White to move.': 'Weiß am Zug.', 'Black to move.': 'Schwarz am Zug.', 'Your move.': 'Sie sind am Zug.', 'Verse is thinking…': 'Verse denkt nach…', 'Check.': 'Schach.', 'Copied.': 'Kopiert.', 'Find the best move.': 'Finden Sie den besten Zug.',
  'Correct!': 'Richtig!', 'Not that one. Try again.': 'Nicht dieser. Noch einmal.', 'Solved.': 'Gelöst.', 'Link copied: send it to your friend.': 'Link kopiert: senden Sie ihn Ihrem Gegenüber.',
};
const lang = /^de\b/i.test(new URLSearchParams(location.search).get('lang') || navigator.language || '') ? 'de' : 'en';
const t = (s) => (lang === 'de' && DE[s]) || s;
if (lang === 'de') {
  document.documentElement.lang = 'de';
  for (const el of document.querySelectorAll('.tabs button, .row button, #setup label, summary, #promo p, .row a.btn, #name-bot, #gnav a, h1, section h2')) for (const n of el.childNodes) if (n.nodeType === 3 && DE[n.textContent.trim()]) n.textContent = DE[n.textContent.trim()];
  for (const o of document.querySelectorAll('#color option, #tc option')) if (DE[o.textContent]) o.textContent = DE[o.textContent];
  for (const o of document.querySelectorAll('#level option')) o.textContent = o.textContent.replace('Level', 'Stufe').replace('about', 'etwa');
  $('lede').textContent = 'Spielen Sie gegen den Computer auf acht Stufen, zu zweit an diesem Gerät oder per Link, lösen Sie Aufgaben und analysieren Sie mit Pfeilen. Uhren, Zurücknehmen, PGN und FEN. Kein Konto, keine Werbung, auch offline.';
  $('lacks').textContent = 'Was Verse nicht hat: keine Online-Partien gegen Fremde und keine geteilten Wertungen, denn Verse führt keine Konten. Spielen Sie stattdessen per Link: nach Ihrem Zug „Link teilen“ drücken und senden; die andere Person öffnet ihn, zieht und schickt ihren zurück. Noch keine Varianten, Turniere oder Eröffnungsdatenbank. Der Computer ist Verses eigene Engine; ihre Stufen sind grobe Schätzungen.';
}

// ---- state ----
let mode = 'ai', game = newGame(), view = 0, orient = 'w', human = 'w', sel = null, arrows = [], engineArrow = null, drawMode = false, drawFrom = null;
let clock = null, tickTimer = 0, over = '', rated = false, analysing = false, puzzles = null, puzzle = null, pstep = 0, pfailed = false;
let worker = null, jobId = 0, thinking = false;
const cells = [...$('board').children];
const sqOfCell = (i) => { const r = i >> 3, f = i & 7; return orient === 'w' ? (7 - r) * 8 + f : r * 8 + (7 - f); };
const cellOfSq = (sq) => cells.findIndex((_, i) => sqOfCell(i) === sq);
const atEnd = () => view === game.moves.length;
const pos = () => positionAt(game, view);
const say = (s, cls = '') => { const el = $('status'); el.textContent = s; el.className = 'status ' + cls; };

// ---- the engine in a worker; one search at a time, a newer one cancels the older ----
function engine(fen, opts, onInfo) {
  if (thinking && worker) { worker.terminate(); worker = null; }
  if (!worker) worker = new Worker('/lib/chess-worker.js', { type: 'module' });
  const id = ++jobId; thinking = true;
  const before = game.pos.slice(0, view).map((p) => toFEN(p)).slice(-100);
  return new Promise((resolve) => {
    worker.onmessage = (e) => { const d = e.data; if (d.id !== id) return; if (d.info && onInfo) onInfo(d.info); if (d.result) { thinking = false; resolve(d.result); } };
    worker.onerror = () => { thinking = false; resolve(null); };
    worker.postMessage({ id, fen, opts, before });
  });
}
const stopEngine = () => { if (thinking && worker) { worker.terminate(); worker = null; thinking = false; } jobId++; };

// ---- drawing ----
function paint() {
  const p = pos(), last = view ? game.moves[view - 1] : null, st = status(p), kingSq = /check|mate/.test(st) ? p.board.indexOf(p.turn === 'w' ? 'K' : 'k') : -1;
  const targets = sel !== null ? legalMoves(p).filter((m) => m.from === sel) : [];
  cells.forEach((b, i) => {
    const sq = sqOfCell(i), r = sq >> 3, f = sq & 7, piece = p.board[sq];
    b.className = ((r + f) % 2 ? 'l' : 'd') + (last && (last.from === sq || last.to === sq) ? ' last' : '') + (sel === sq ? ' sel' : '') + (sq === kingSq ? ' chk' : '') + (targets.some((m) => m.to === sq) ? ' tgt' + (piece || targets.find((m) => m.to === sq).ep ? ' cap' : '') : '');
    const row = (i >> 3) === 7, col = (i & 7) === 0;
    b.innerHTML = (col ? `<span class="crd rk">${r + 1}</span>` : '') + (row ? `<span class="crd fl">${'abcdefgh'[f]}</span>` : '') + (piece ? `<svg class="${piece === piece.toUpperCase() ? 'pw' : 'pb'}" viewBox="0 0 45 45" aria-hidden="true"><use href="#p-${piece.toLowerCase()}"/></svg>` : '');
    b.setAttribute('aria-label', sqName(sq) + (piece ? ' ' + (piece === piece.toUpperCase() ? 'white ' : 'black ') + NAMES[piece.toLowerCase()] : ''));
  });
  drawArrows(); moves(); clocksPaint();
  const fen = toFEN(p); $('fenout').value = fen; $('lichess').href = lichessAnalysis(fen);
  $('undo').disabled = mode === 'puzzle' || !game.moves.length; $('resign').disabled = mode !== 'ai' || !!over || !game.moves.length;
  $('first').disabled = $('prev').disabled = view === 0; $('next').disabled = $('last').disabled = atEnd();
  if (!over && atEnd()) { const w = stateWords(game); if (/mate|Draw|Stalemate/.test(w)) finish(w); }
  if (analysing) analyse();
}
function drawArrows() {
  const g = $('arrowg'); const c = (sq) => { const i = cellOfSq(sq); return [(i & 7) * 100 + 50, (i >> 3) * 100 + 50]; };
  const all = [...arrows, ...(engineArrow ? [engineArrow] : [])];
  g.innerHTML = all.map((a) => { const [x1, y1] = c(a.from), [x2, y2] = c(a.to), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ex = x2 - dx / len * 28, ey = y2 - dy / len * 28;
    return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${a.color || '#15a34a'}" stroke-width="16" stroke-linecap="round" opacity=".75" marker-end="url(#ah)"/>`; }).join('');
}
function moves() {
  const ol = $('moves'), p0 = game.pos[0], blackFirst = p0.turn === 'b'; let html = '', num = p0.full;
  const btn = (i) => `<button type="button" data-ply="${i + 1}" class="${view === i + 1 ? 'cur' : ''}">${game.moves[i].san}</button>`;
  let i = 0; if (blackFirst && game.moves.length) { html += `<li><span>${num}…</span><button type="button" disabled>…</button>${btn(0)}</li>`; i = 1; num++; }
  for (; i < game.moves.length; i += 2, num++) html += `<li><span>${num}.</span>${btn(i)}${i + 1 < game.moves.length ? btn(i + 1) : '<button type="button" disabled></button>'}</li>`;
  ol.innerHTML = html; const cur = ol.querySelector('.cur'); if (cur) ol.scrollTop = Math.max(0, cur.offsetTop - ol.offsetTop - 60); // the list scrolls, never the page
  const op = game.start === START ? openingOf(game.moves.slice(0, view).map((m) => m.san)) : null; $('opening').textContent = op ? (lang === 'de' ? 'Eröffnung: ' : 'Opening: ') + op.name + ' (' + op.eco + ')' : '';
}
// ---- the clock ----
function clocksPaint() {
  const top = orient === 'w' ? 'b' : 'w', bot = top === 'w' ? 'b' : 'w', now = Date.now();
  for (const [side, el] of [[top, $('t-top')], [bot, $('t-bot')]]) { el.hidden = !clock; if (!clock) continue; const ms = clockLeft(clock, side, now); el.textContent = clockText(ms); el.className = (clock.running === side ? 'run' : '') + (ms < 20000 ? ' low' : ''); }
  const who = (side) => (mode === 'ai' ? (side === human ? t('You') : 'Verse, ' + (lang === 'de' ? 'Stufe ' : 'level ') + mem.level) : side === 'w' ? t('White') : t('Black'));
  $('name-top').textContent = who(top); $('name-bot').textContent = who(bot);
}
function tick() { if (!clock || over) return; const f = flagged(clock, Date.now()); if (f) finish((f === 'w' ? t('White') : t('Black')) + (lang === 'de' ? ': Zeit abgelaufen.' : '’s time ran out.'), f === 'w' ? 0 : 1); clocksPaint(); }

// ---- the game ----
function finish(words, whiteScore) {
  over = words; stopClock(clock || makeClock(0), Date.now()); say(words, 'ok');
  if (mode === 'ai' && !rated && game.moves.length >= 2) {
    rated = true; const res = whiteScore !== undefined ? whiteScore : { '1-0': 1, '0-1': 0, '1/2-1/2': 0.5 }[resultOf(game)];
    if (res !== undefined) { const mine = human === 'w' ? res : 1 - res; mem.rating = { r: eloAfter(mem.rating.r, LEVEL_ELO[mem.level - 1], mine, mem.rating.n < 10 ? 48 : 24), n: mem.rating.n + 1 }; save(); ratingLine(); }
  }
  mem.game = null; save();
}
const ratingLine = () => { $('rating').textContent = (lang === 'de' ? 'Ihre Wertung gegen Verse auf diesem Gerät: ' : 'Your rating against Verse on this device: ') + mem.rating.r + ' (' + (mem.rating.n ? mem.rating.n + (lang === 'de' ? ' Partien' : ' games') : (lang === 'de' ? 'noch keine Partie' : 'no games yet')) + ')'; $('prating').textContent = (lang === 'de' ? 'Ihre Aufgabenwertung auf diesem Gerät: ' : 'Your puzzle rating on this device: ') + mem.prating.r + (mem.prating.n ? ' (' + mem.prating.n + ')' : ''); };
function turnLine() {
  if (over) return;
  const p = pos(), w = stateWords(game);
  if (mode === 'puzzle') return;
  if (mode === 'ai' && atEnd() && p.turn !== human) return say(t('Verse is thinking…'));
  say((w ? t(w) + ' ' : '') + (mode === 'ai' && atEnd() ? t('Your move.') : t(p.turn === 'w' ? 'White to move.' : 'Black to move.')));
}
function play(move) {
  if (over || !atEnd()) { if (mode === 'analysis' && !atEnd()) cut(game, view); else return false; }
  const side = positionAt(game).turn;
  if (!push(game, move)) return false;
  view = game.moves.length; sel = null; engineArrow = null;
  if (clock && mode !== 'analysis' && mode !== 'puzzle') pressClock(clock, side, Date.now());
  if (mode !== 'puzzle') { mem.game = { link: linkOf(game), mode, human, tc: mem.tc }; save(); }
  paint(); turnLine();
  if (mode === 'ai' && !over && positionAt(game).turn !== human) computerMove();
  return true;
}
async function computerMove() {
  const L = mem.level, l = { 1: [1, 200, 300, 0.25], 2: [1, 200, 150, 0.1], 3: [2, 300, 80, 0.04], 4: [2, 400, 35, 0], 5: [3, 500, 0, 0], 6: [5, 1000, 0, 0], 7: [8, 2000, 0, 0], 8: [30, 4000, 0, 0] }[L];
  say(t('Verse is thinking…')); const at = game.moves.length, t0 = Date.now();
  const r = await engine(toFEN(positionAt(game)), { depth: l[0], ms: l[1], noise: l[2], slip: l[3] });
  if (!r || !r.move || over || game.moves.length !== at || mode !== 'ai') return;
  const wait = Math.max(0, 350 - (Date.now() - t0)); setTimeout(() => { if (game.moves.length === at && !over) play(r.move); }, wait);
}
function startGame({ link = '', keepMode = false } = {}) {
  stopEngine(); over = ''; rated = false; arrows = []; engineArrow = null; sel = null;
  const got = link ? gameFromLink(link) : { game: newGame(), error: '' }; game = got.game; view = game.moves.length;
  human = mem.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : mem.color; orient = mode === 'ai' ? human : orient;
  const tc = TIME_CONTROLS.find((x) => x[0] === mem.tc) || TIME_CONTROLS[0]; clock = mode === 'puzzle' || mode === 'analysis' || !tc[1] ? null : makeClock(tc[1] * 1000, tc[2] * 1000);
  clearInterval(tickTimer); if (clock) tickTimer = setInterval(tick, 200);
  paint(); turnLine(); if (got.error) say(got.error, 'bad');
  if (mode === 'ai' && positionAt(game).turn !== human && !over) computerMove();
  if (!keepMode) { mem.game = { link: linkOf(game), mode, human, tc: mem.tc }; save(); }
}
function setMode(m) {
  mode = m; for (const id of ['ai', 'two', 'puzzle', 'analysis']) $('m-' + id).setAttribute('aria-selected', String(id === m));
  $('setup').hidden = m === 'puzzle'; $('puz').hidden = m !== 'puzzle';
  $('lv-l').hidden = m !== 'ai'; $('col-l').hidden = m !== 'ai'; $('tc').parentElement.hidden = m === 'analysis';
  $('hint').hidden = m === 'two'; $('resign').hidden = m !== 'ai';
  if (m === 'puzzle') nextPuzzle(); else startGame({ link: m === 'analysis' ? linkOf(game) : '' });
}
// ---- input: tap a piece then a square, or drag ----
function tryMove(from, to) {
  const p = pos(), ms = legalMoves(p).filter((m) => m.from === from && m.to === to); if (!ms.length) return false;
  if (mode === 'ai' && p.turn !== human) return false;
  if (ms.length > 1 || ms[0].promo) { choosePromo(p.turn, (pr) => human_(from, to, pr)); return true; }
  human_(from, to, null); return true;
}
function human_(from, to, promo) { const u = sqName(from) + sqName(to) + (promo || ''); if (mode === 'puzzle') return puzzleMove(u); play(u); }
function choosePromo(side, done) {
  const d = $('promo'), box = $('promobtns'); box.innerHTML = '';
  for (const k of ['q', 'r', 'b', 'n']) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', NAMES[k]); b.innerHTML = `<svg class="${side === 'w' ? 'pw' : 'pb'}" viewBox="0 0 45 45"><use href="#p-${k}"/></svg>`; b.onclick = () => { d.close(); done(k); }; box.append(b); }
  d.showModal();
}
const canTouch = () => !over && (mode === 'analysis' || atEnd()) && !(mode === 'ai' && pos().turn !== human);
function tap(sq) {
  if (drawMode) { if (drawFrom === null) { drawFrom = sq; cells[cellOfSq(sq)].classList.add('sel'); } else { toggleArrow(drawFrom, sq); drawFrom = null; paint(); } return; }
  const p = pos(), piece = p.board[sq], mine = piece && (piece === piece.toUpperCase() ? 'w' : 'b') === p.turn;
  if (sel !== null && sel !== sq && tryMove(sel, sq)) return;
  sel = mine && canTouch() && sel !== sq ? sq : null; paint();
}
function toggleArrow(from, to) { if (from === to) return; const i = arrows.findIndex((a) => a.from === from && a.to === to); if (i >= 0) arrows.splice(i, 1); else arrows.push({ from, to }); }
let drag = null;
$('board').addEventListener('contextmenu', (e) => e.preventDefault());
$('board').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return; const sq = sqOfCell(cells.indexOf(b));
  if (e.button === 2) { drag = { arrow: sq }; return; }
  const p = pos(), piece = p.board[sq], mine = !drawMode && piece && (piece === piece.toUpperCase() ? 'w' : 'b') === p.turn && canTouch();
  drag = { from: sq, x: e.clientX, y: e.clientY, moved: false, piece: mine ? piece : null }; // a press on any square is a tap unless a piece of yours is dragged
});
addEventListener('pointermove', (e) => {
  if (!drag || drag.arrow !== undefined || !drag.piece) return; if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  const gh = $('ghost'); if (!drag.moved) { drag.moved = true; const size = cells[0].getBoundingClientRect().width; gh.style.width = gh.style.height = size + 'px'; gh.innerHTML = `<svg class="${drag.piece === drag.piece.toUpperCase() ? 'pw' : 'pb'}" viewBox="0 0 45 45"><use href="#p-${drag.piece.toLowerCase()}"/></svg>`; gh.style.display = 'block'; sel = drag.from; paint(); cells[cellOfSq(drag.from)].classList.add('drag'); }
  const s = gh.getBoundingClientRect().width / 2; gh.style.left = e.clientX - s + 'px'; gh.style.top = e.clientY - s + 'px';
});
addEventListener('pointerup', (e) => {
  if (!drag) return; const d = drag; drag = null; const el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest && el.closest('#board button'), sq = b ? sqOfCell(cells.indexOf(b)) : null;
  if (d.arrow !== undefined) { if (sq !== null) { if (sq === d.arrow) arrows = []; else toggleArrow(d.arrow, sq); paint(); } return; }
  $('ghost').style.display = 'none';
  if (!d.moved) { if (sq !== null && sq === d.from) tap(sq); return; }
  if (sq === null || sq === d.from || !tryMove(d.from, sq)) { sel = null; paint(); }
});
$('board').addEventListener('click', (e) => { if (e.detail === 0) { const b = e.target.closest('button'); if (b) tap(sqOfCell(cells.indexOf(b))); } }); // the keyboard: Enter or Space on a square
$('board').addEventListener('keydown', (e) => { const i = cells.indexOf(document.activeElement); if (i < 0) return; const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key]; if (step === undefined) return; e.preventDefault(); const j = i + step; if (j >= 0 && j < 64) cells[j].focus(); });

// ---- buttons ----
const go = (v) => { view = Math.max(0, Math.min(game.moves.length, v)); sel = null; engineArrow = null; paint(); turnLine(); };
$('first').onclick = () => go(0); $('prev').onclick = () => go(view - 1); $('next').onclick = () => go(view + 1); $('last').onclick = () => go(game.moves.length);
addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || cells.includes(document.activeElement)) return; if (e.key === 'ArrowLeft') go(view - 1); else if (e.key === 'ArrowRight') go(view + 1); else if (e.key === 'f') $('flip').onclick(); });
$('moves').onclick = (e) => { const b = e.target.closest('button[data-ply]'); if (b) go(+b.dataset.ply); };
$('flip').onclick = () => { orient = orient === 'w' ? 'b' : 'w'; paint(); };
$('undo').onclick = () => {
  if (!game.moves.length) return; stopEngine(); const back = mode === 'ai' ? (positionAt(game).turn === human ? 2 : 1) : 1;
  cut(game, Math.max(0, game.moves.length - back)); view = game.moves.length; over = ''; sel = null; engineArrow = null; if (clock && clock.flag) clock.flag = null;
  mem.game = { link: linkOf(game), mode, human, tc: mem.tc }; save(); paint(); turnLine();
};
$('resign').onclick = () => { if (mode !== 'ai' || over) return; finish(lang === 'de' ? 'Sie haben aufgegeben.' : 'You resigned.', human === 'w' ? 0 : 1); paint(); };
$('new').onclick = () => { mem.level = +$('level').value; mem.color = $('color').value; mem.tc = $('tc').value; save(); startGame(); };
for (const id of ['level', 'color', 'tc']) $(id).onchange = () => { mem.level = +$('level').value; mem.color = $('color').value; mem.tc = $('tc').value; save(); clocksPaint(); };
for (const id of ['ai', 'two', 'puzzle', 'analysis']) $('m-' + id).onclick = () => setMode(id);
$('draw').onclick = () => { drawMode = !drawMode; drawFrom = null; $('draw').setAttribute('aria-pressed', String(drawMode)); };
$('clear').onclick = () => { arrows = []; engineArrow = null; paint(); };
$('hint').onclick = async () => {
  if (over) return; say(t('Verse is thinking…'));
  const r = await engine(toFEN(pos()), { depth: 30, ms: 1500 }); if (!r || !r.move) return turnLine();
  engineArrow = { from: sqIndex(r.move.slice(0, 2)), to: sqIndex(r.move.slice(2, 4)), color: '#2f6fd6' }; drawArrows(); turnLine();
  $('eval').textContent = (lang === 'de' ? 'Tipp: ' : 'Hint: ') + sanOf(r.move) + ' (' + scoreWords(r, pos().turn) + ')';
};
const sanOf = (u) => { const g = newGame(toFEN(pos())); return push(g, u) ? g.moves[0].san : u; };
const scoreWords = (r, turn) => { const s = turn === 'w' ? 1 : -1; if (r.mate) return (r.mate * s > 0 ? (lang === 'de' ? 'Weiß setzt matt in ' : 'White mates in ') : (lang === 'de' ? 'Schwarz setzt matt in ' : 'Black mates in ')) + Math.abs(r.mate); const v = (r.score * s) / 100; return (v > 0 ? '+' : '') + v.toFixed(2); };
function lineSan(fen, pv) { const g = newGame(fen); for (const u of pv) if (!push(g, u)) break; return g.moves.map((m) => m.san).join(' '); }
async function analyse() {
  const fen = toFEN(pos()); if (/mate|draw|stalemate/.test(status(pos()))) { $('eval').textContent = stateWords(game) || ''; return; }
  const p0 = pos();
  const r = await engine(fen, { depth: 30, ms: 3000 }, (info) => {
    if (pos() !== p0) return; const turn = p0.turn;
    $('eval').textContent = (lang === 'de' ? 'Tiefe ' : 'Depth ') + info.depth + ': ' + scoreWords(info, turn) + ' · ' + lineSan(fen, info.pv.slice(0, 8));
    const white = info.mate ? (info.mate * (turn === 'w' ? 1 : -1) > 0 ? 100 : 0) : 50 + 50 * Math.tanh((info.score * (turn === 'w' ? 1 : -1)) / 400);
    $('evalfill').style.width = white + '%';
    if (info.pv[0]) { engineArrow = { from: sqIndex(info.pv[0].slice(0, 2)), to: sqIndex(info.pv[0].slice(2, 4)), color: '#2f6fd6' }; drawArrows(); }
  });
  void r;
}
$('analyse').onclick = () => { analysing = !analysing; $('analyse').setAttribute('aria-pressed', String(analysing)); if (analysing) analyse(); else { stopEngine(); engineArrow = null; drawArrows(); $('eval').textContent = ''; } };
const copy = async (text, ok = t('Copied.')) => { try { await navigator.clipboard.writeText(text); $('ioerr').textContent = ok; } catch (_) { $('pgnin').value = text; $('ioerr').textContent = lang === 'de' ? 'Unten zum Kopieren.' : 'Below, to copy.'; } };
const pgnText = () => toPGN(game, { Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), White: mode === 'ai' ? (human === 'w' ? 'You' : 'Verse level ' + mem.level) : 'White', Black: mode === 'ai' ? (human === 'b' ? 'You' : 'Verse level ' + mem.level) : 'Black', ...(over && /resigned|time/.test(over) ? { Result: /White.s time|You resigned/.test(over) === (human === 'w' || /White.s time/.test(over)) ? '0-1' : '1-0' } : {}) });
$('copyfen').onclick = () => copy($('fenout').value);
$('copypgn').onclick = () => copy(pgnText());
$('dlpgn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pgnText()], { type: 'application/x-chess-pgn' })); a.download = 'verse-chess-' + new Date().toISOString().slice(0, 10) + '.pgn'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
$('load').onclick = () => {
  const text = $('pgnin').value.trim(); if (!text) return;
  const looksFen = /^[pnbrqkPNBRQK1-8]+(\/[pnbrqkPNBRQK1-8]+){7}(\s|$)/.test(text);
  if (looksFen) { const f = fullFEN(text), why = checkFEN(f); if (why) { $('ioerr').textContent = why; return; } game = newGame(f); }
  else { const r = fromPGN(text); game = r.game; $('ioerr').textContent = r.error || ''; }
  if (mode !== 'analysis') { mode = 'analysis'; for (const id of ['ai', 'two', 'puzzle', 'analysis']) $('m-' + id).setAttribute('aria-selected', String(id === 'analysis')); $('setup').hidden = false; $('puz').hidden = true; $('lv-l').hidden = $('col-l').hidden = true; $('tc').parentElement.hidden = true; $('resign').hidden = true; }
  over = ''; clock = null; view = game.moves.length; paint(); turnLine(); if (!looksFen && !$('ioerr').textContent) $('ioerr').textContent = (lang === 'de' ? 'Geladen: ' : 'Loaded: ') + game.moves.length + (lang === 'de' ? ' Halbzüge.' : ' half-moves.');
};
$('share').onclick = async () => {
  const url = location.origin + '/chess/' + linkOf(game, mode === 'puzzle' && puzzle ? { mode: 'puzzle', p: puzzle.id } : { mode: mode === 'ai' ? '' : mode, level: mode === 'ai' ? mem.level : '' });
  history.replaceState(null, '', url);
  if (navigator.share) { try { await navigator.share({ title: 'Chess · Verse', url }); return; } catch (_) { /* closed: copy instead */ } }
  try { await navigator.clipboard.writeText(url); say(t('Link copied: send it to your friend.'), 'ok'); } catch (_) { say(url); }
};
// Lichess's public cloud evaluation: only when pressed, one request at a time; a position nobody has analysed there gets Verse's own engine instead
let cloudBusy = false;
$('cloud').onclick = async () => {
  if (cloudBusy) return; cloudBusy = true; const fen = toFEN(pos()); $('ioerr').textContent = lang === 'de' ? 'Frage Lichess…' : 'Asking Lichess…';
  try {
    const res = await fetch('https://lichess.org/api/cloud-eval?fen=' + encodeURIComponent(fen));
    if (res.status === 429) $('ioerr').textContent = lang === 'de' ? 'Lichess bittet um eine Minute Pause.' : 'Lichess asks for a minute’s pause; try again then.';
    else if (!res.ok) $('ioerr').textContent = lang === 'de' ? 'Diese Stellung ist bei Lichess nicht analysiert; Verses Engine-Analyse geht immer.' : 'Lichess has no cloud analysis of this position; Verse’s Engine analysis always works.';
    else { const j = await res.json(), pv = (j.pvs && j.pvs[0]) || {}, ms = String(pv.moves || '').split(' ').filter(Boolean); const r = { score: (pv.cp || 0) * (pos().turn === 'w' ? 1 : -1), mate: pv.mate ? pv.mate * (pos().turn === 'w' ? 1 : -1) : null };
      $('ioerr').textContent = 'Lichess cloud, ' + (lang === 'de' ? 'Tiefe ' : 'depth ') + j.depth + ': ' + scoreWords(r, pos().turn) + ' · ' + lineSan(fen, ms.slice(0, 8));
      if (ms[0]) { engineArrow = { from: sqIndex(ms[0].slice(0, 2)), to: sqIndex(ms[0].slice(2, 4)), color: '#c2410c' }; drawArrows(); } }
  } catch (_) { $('ioerr').textContent = lang === 'de' ? 'Offline: Lichess ist nicht erreichbar; Verses Engine-Analyse geht trotzdem.' : 'Offline: Lichess cannot be reached; Verse’s Engine analysis still works.'; }
  cloudBusy = false;
};

// ---- puzzles: Verse's own (chess/puzzles.json), picked near your rating; Lichess's daily puzzle on request ----
async function loadPuzzles() { if (puzzles) return puzzles; try { puzzles = (await (await fetch('/chess/puzzles.json')).json()).puzzles || []; } catch (_) { puzzles = []; } return puzzles; }
async function nextPuzzle(id) {
  stopEngine(); const list = await loadPuzzles(); if (mode !== 'puzzle') return;
  if (!list.length) { say(lang === 'de' ? 'Die Aufgaben konnten nicht geladen werden.' : 'The puzzles could not be loaded.', 'bad'); return; }
  const open = list.filter((p) => !mem.solved.includes(p.id)), pool = open.length ? open : list;
  const pick = (id && list.find((p) => p.id === id)) || pool.slice().sort((a, b) => Math.abs(a.rating - mem.prating.r) - Math.abs(b.rating - mem.prating.r)).slice(0, 8)[Math.floor(Math.random() * Math.min(8, pool.length))];
  setPuzzle({ ...pick, source: 'Verse' });
}
function setPuzzle(pz) {
  puzzle = pz; pstep = 0; pfailed = false; over = ''; clock = null; arrows = []; engineArrow = null; sel = null;
  game = newGame(pz.fen); if (pz.pre) for (const u of pz.pre) push(game, u); view = game.moves.length; orient = positionAt(game).turn;
  const theme = { 'mate in 1': lang === 'de' ? 'Matt in 1' : 'mate in 1', 'mate in 2': lang === 'de' ? 'Matt in 2' : 'mate in 2', 'mate in 3': lang === 'de' ? 'Matt in 3' : 'mate in 3', 'win material': lang === 'de' ? 'Material gewinnen' : 'win material', 'the one good move': lang === 'de' ? 'der eine gute Zug' : 'the one good move' }[pz.theme] || pz.theme;
  $('puzinfo').innerHTML = '';
  $('puzinfo').append((pz.source === 'Lichess' ? 'Lichess daily puzzle' : (lang === 'de' ? 'Aufgabe ' : 'Puzzle ') + pz.id) + ' · ' + theme + ' · ' + (lang === 'de' ? 'Wertung etwa ' : 'rated about ') + pz.rating + (pz.source === 'Lichess' ? ' · ' : ''));
  if (pz.source === 'Lichess') { const a = document.createElement('a'); a.href = 'https://lichess.org/training/' + pz.id; a.rel = 'noopener'; a.target = '_blank'; a.textContent = lang === 'de' ? 'auf Lichess (CC0)' : 'on Lichess (CC0)'; $('puzinfo').append(a); }
  paint(); say(t('Find the best move.') + ' ' + (positionAt(game).turn === 'w' ? t('White to move.') : t('Black to move.')));
}
function puzzleMove(u) {
  if (!puzzle || over) return; const p = positionAt(game), r = checkPuzzleMove(p, puzzle.line, pstep, u);
  if (!r.ok) { if (!pfailed) { pfailed = true; mem.prating = { r: eloAfter(mem.prating.r, puzzle.rating, 0, 24), n: mem.prating.n + 1 }; save(); ratingLine(); } push(game, u); view = game.moves.length; sel = null; paint(); say(t('Not that one. Try again.'), 'bad'); setTimeout(() => { cut(game, game.moves.length - 1); view = game.moves.length; paint(); }, 700); return; }
  push(game, u); view = game.moves.length; sel = null; paint();
  if (r.done) { over = 'solved'; say(t('Solved.') + (pfailed ? '' : ' +'), 'ok'); if (!pfailed) { mem.prating = { r: eloAfter(mem.prating.r, puzzle.rating, 1, 24), n: mem.prating.n + 1 }; } if (!mem.solved.includes(puzzle.id)) mem.solved.push(puzzle.id); save(); ratingLine(); return; }
  say(t('Correct!'), 'ok'); pstep += 2;
  setTimeout(() => { if (r.reply) { push(game, r.reply); view = game.moves.length; paint(); say(t('Find the best move.')); } }, 450);
}
$('pnext').onclick = () => nextPuzzle();
$('psol').onclick = () => { if (!puzzle) return; pfailed = true; const steps = puzzle.line.slice(pstep); let i = 0; const stepOn = () => { if (i >= steps.length) { over = 'shown'; say(lang === 'de' ? 'Das war die Lösung.' : 'That was the solution.'); return; } push(game, steps[i++]); view = game.moves.length; paint(); setTimeout(stepOn, 600); }; stepOn(); };
$('pdaily').onclick = async () => {
  say(lang === 'de' ? 'Frage Lichess…' : 'Asking Lichess…');
  try { const j = await (await fetch('https://lichess.org/api/puzzle/daily')).json(); const r = fromPGN(j.game.pgn); if (r.error) throw new Error(r.error);
    setPuzzle({ id: j.puzzle.id, fen: r.game.start, pre: r.game.moves.map((m) => m.uci), line: j.puzzle.solution, rating: j.puzzle.rating, theme: (j.puzzle.themes || []).slice(0, 2).join(', '), source: 'Lichess' });
  } catch (_) { say(lang === 'de' ? 'Lichess ist gerade nicht erreichbar (offline?). Verses eigene Aufgaben gehen immer.' : 'Lichess cannot be reached right now (offline?). Verse’s own puzzles always work.', 'bad'); }
};

// ---- start: a link's game, else the game you left, else a new one ----
$('level').value = mem.level; $('color').value = mem.color; $('tc').value = mem.tc; ratingLine();
const q = new URLSearchParams(location.search);
if (q.get('level')) { mem.level = Math.max(1, Math.min(8, +q.get('level') || 4)); $('level').value = mem.level; }
if (q.get('tc') && TIME_CONTROLS.some((x) => x[0] === q.get('tc'))) { mem.tc = q.get('tc'); $('tc').value = mem.tc; }
const qm = q.get('mode'), hasGame = q.get('m') || q.get('fen') || q.get('pgn');
if (qm === 'puzzle') { mode = 'puzzle'; setModeUi('puzzle'); nextPuzzle(q.get('p') || undefined); }
else if (hasGame) { mode = ['two', 'analysis', 'ai'].includes(qm) ? qm : (q.get('m') ? 'two' : 'analysis'); setModeUi(mode); startGame({ link: location.search, keepMode: true }); }
else if (qm && ['two', 'analysis'].includes(qm)) { mode = qm; setModeUi(mode); startGame(); }
else if (mem.game && mem.game.link) { mode = mem.game.mode || 'ai'; if (mem.game.human) mem.color = mem.color === 'r' ? 'r' : mem.game.human; setModeUi(mode); startGame({ link: mem.game.link, keepMode: true }); if (mem.game.human) { human = mem.game.human; orient = mode === 'ai' ? human : orient; paint(); turnLine(); if (mode === 'ai' && positionAt(game).turn !== human && !over) computerMove(); } }
else startGame();
function setModeUi(m) { for (const id of ['ai', 'two', 'puzzle', 'analysis']) $('m-' + id).setAttribute('aria-selected', String(id === m)); $('setup').hidden = m === 'puzzle'; $('puz').hidden = m !== 'puzzle'; $('lv-l').hidden = m !== 'ai'; $('col-l').hidden = m !== 'ai'; $('tc').parentElement.hidden = m === 'analysis'; $('hint').hidden = m === 'two'; $('resign').hidden = m !== 'ai'; }
mountRelated($('related'), '/chess/');
