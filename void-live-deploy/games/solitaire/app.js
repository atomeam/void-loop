// /games/solitaire/ (Versus' games lane, a Klondike site): the rules are lib/solitaire.js; this lays the cards out on the page's piles. A tap sends a
// card where it goes best (home first); a tap on a card and then on a pile puts it there; a drag works too. Undo without limit, a hint, auto-finish,
// a timer, moves and score; a numbered deal to replay or share; wins and best times on this device.
import { deal, draw, move, legal, bestFor, hint, won, canFinish, auto, clone, red, RANKS, SUITS, cardName } from '/lib/solitaire.js';
import { $, lang, store, german, timer, shareButton, mmss } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Draw: 'Ziehen', 'One card': 'Eine Karte', 'Three cards': 'Drei Karten', 'Restart this deal': 'Dieses Spiel neu', Finish: 'Fertig spielen' },
  'Klondike-Patience: eine oder drei Karten ziehen, tippen Sie eine Karte an und sie geht dorthin, wo sie passt, oder ziehen Sie sie. Rückgängig, Tipps, Zeit, Züge und Punkte. Jedes Spiel lässt sich neu beginnen.');
const db = store('solitaire', { draw: 1, played: 0, wins: 0, best: 0, saved: null }); const mem = db.get();
const clock = timer($('clock'));
let s, hist = [], sel = null, counted = false, hintMove = null;
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
const cardEl = (c, from, n, top) => `<button type="button" class="cardx${c.up ? (red(c) ? ' rd' : '') : ' back'}${sel && sel.from === from && n <= sel.n ? ' selc' : ''}" style="top:${top}px" data-from="${from}" data-n="${n}" aria-label="${c.up ? cardName(c) : 'face down'}">${c.up ? RANKS[c.r] + SUITS[c.s] + '<span class="big">' + SUITS[c.s] + '</span>' : ''}</button>`;
function paint() {
  const w = $('tab0').getBoundingClientRect().width || 48, hgt = w * 1.4, upGap = Math.max(16, Math.min(26, hgt * 0.32)), downGap = Math.max(6, hgt * 0.12);
  $('stock').innerHTML = s.stock.length ? `<span class="cardx back" style="top:0"></span>` : '<span style="font-size:22px;color:var(--soft)">↻</span>';
  $('stock').setAttribute('aria-label', s.stock.length ? (lang === 'de' ? 'Stapel: ' : 'Stock: ') + s.stock.length + (lang === 'de' ? ' Karten, tippen zum Ziehen' : ' cards, tap to turn') : (lang === 'de' ? 'Ablage zurück auf den Stapel' : 'Turn the waste back over'));
  const wst = s.waste.slice(-(s.drawN === 3 ? 3 : 1)); $('waste').innerHTML = wst.map((c, i) => cardEl(c, 'waste', i === wst.length - 1 ? 1 : 99, 0).replace('style="top:0px"', `style="top:0;left:${i * 12}px;right:${-i * 12}px"`)).join('');
  s.found.forEach((f, i) => { $('found' + i).innerHTML = f.length ? cardEl(f[f.length - 1], 'found' + i, 1, 0) : ''; });
  s.tab.forEach((col, i) => { let top = 0; $('tab' + i).innerHTML = col.map((c, k) => { const h = cardEl(c, 'tab' + i, col.length - k, top); top += c.up ? upGap : downGap; return h; }).join(''); $('tab' + i).style.minHeight = Math.max(260, top + hgt + 8) + 'px'; });
  $('stats').firstChild.textContent = (lang === 'de' ? 'Züge ' : 'Moves ') + s.moves + ' · ' + (lang === 'de' ? 'Punkte ' : 'Score ') + s.score + ' · ';
  $('record').textContent = (lang === 'de' ? 'Siege auf diesem Gerät: ' : 'Wins on this device: ') + mem.wins + (lang === 'de' ? ' von ' : ' of ') + mem.played + (mem.best ? (lang === 'de' ? ' · Bestzeit ' : ' · best time ') + mmss(mem.best) : '');
  $('undo').disabled = !hist.length; $('finish').hidden = !canFinish(s) || won(s);
}
const keep = () => { mem.saved = won(s) ? null : { s, secs: clock.seconds() }; db.put(mem); };
function begin(n = Math.floor(Math.random() * 1e6) + 1, saved = null) {
  s = saved ? saved.s : deal(n, +mem.draw === 3 ? 3 : 1); hist = []; sel = null; counted = false; clock.reset(); if (saved && saved.secs) clock.start(saved.secs);
  $('draw').value = String(s.drawN); paint(); keep(); say(lang === 'de' ? 'Spiel ' + s.n + '. Tippen Sie eine Karte an.' : 'Deal ' + s.n + '. Tap a card to send it where it goes, or tap the stock to turn cards.');
}
function act(fn) { const before = clone(s); if (!fn()) return false; hist.push(before); if (!clock.running()) clock.start(); sel = null; paint(); keep(); after(); return true; }
function after() {
  if (won(s)) { const secs = clock.stop(); if (!counted) { counted = true; mem.played++; mem.wins++; if (!mem.best || secs < mem.best) mem.best = Math.round(secs); db.put(mem); } say((lang === 'de' ? 'Gewonnen in ' : 'Won in ') + mmss(secs) + ', ' + s.moves + (lang === 'de' ? ' Züge, ' : ' moves, ') + s.score + (lang === 'de' ? ' Punkte.' : ' points.'), 'ok'); paint(); }
  else if (canFinish(s)) say(lang === 'de' ? 'Alles aufgedeckt: „Fertig spielen“ legt den Rest ab.' : 'Every card is up: Finish plays the rest home.', 'ok');
}
function tapCard(from, n) {
  if (sel) { if (sel.from === from) { const m = hintMove && hintMove.from === from ? hintMove : bestFor(s, from, sel.n); sel = null; hintMove = null; if (!(m && act(() => move(s, m)))) paint(); return; } if (act(() => move(s, { from: sel.from, n: sel.n, to: from.startsWith('found') ? from : from }))) return; }
  const m = bestFor(s, from, n);
  if (m && act(() => move(s, m))) return;
  sel = { from, n }; paint();
}
$('sol').addEventListener('click', (e) => {
  if (dragged) { dragged = false; return; }
  const c = e.target.closest('.cardx[data-from]'), pile = e.target.closest('.slot, .col');
  if (e.target.closest('#stock')) { act(() => draw(s)); return; }
  if (c) { const from = c.dataset.from, n = +c.dataset.n; if (n > 50) return; if (from.startsWith('found') && !sel) { sel = { from, n: 1 }; paint(); return; } return tapCard(from, n); }
  if (pile && sel && /^(tab|found)/.test(pile.id)) { if (!act(() => move(s, { ...sel, to: pile.id }))) { sel = null; paint(); } }
});
// a drag: the cards picked up follow the pointer and land on the pile under it
let drag = null, dragged = false;
$('sol').addEventListener('pointerdown', (e) => { const c = e.target.closest('.cardx[data-from]'); if (!c || c.classList.contains('back')) return; const n = +c.dataset.n; if (n > 50) return; drag = { from: c.dataset.from, n, x: e.clientX, y: e.clientY, els: null }; });
addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.els && Math.hypot(dx, dy) < 8) return;
  if (!drag.els) { const pileEl = $(drag.from), cs = [...pileEl.querySelectorAll('.cardx[data-from]')]; drag.els = cs.slice(cs.length - drag.n); for (const el of drag.els) { el.style.zIndex = 30; el.style.pointerEvents = 'none'; } }
  for (const el of drag.els) el.style.transform = `translate(${dx}px, ${dy}px)`; });
addEventListener('pointerup', (e) => { if (!drag) return; const d = drag; drag = null; if (!d.els) return; dragged = true; setTimeout(() => { dragged = false; }, 0);
  const el = document.elementFromPoint(e.clientX, e.clientY), pile = el && el.closest && el.closest('.slot, .col'); const to = pile && pile.id;
  if (!(to && /^(tab|found)/.test(to) && legal(s, { from: d.from, n: d.n, to }) && act(() => move(s, { from: d.from, n: d.n, to })))) paint(); });
$('undo').onclick = () => { if (!hist.length) return; s = hist.pop(); sel = null; paint(); keep(); };
$('hint').onclick = () => { const h = hint(s); if (!h) return say(lang === 'de' ? 'Kein Zug mehr: neues Spiel?' : 'No move left: try a new deal.', 'bad'); if (h.draw) return say(lang === 'de' ? 'Tipp: Karten vom Stapel ziehen.' : 'Hint: turn cards from the stock.');
  const src = h.from === 'waste' ? s.waste : s.tab[+h.from.slice(3)], c = src[src.length - h.n]; sel = { from: h.from, n: h.n }; hintMove = h; paint(); say((lang === 'de' ? 'Tipp: ' : 'Hint: ') + cardName(c) + (lang === 'de' ? ' nach ' : ' to ') + (h.to.startsWith('found') ? (lang === 'de' ? 'oben ablegen' : 'its foundation') : (lang === 'de' ? 'Spalte ' : 'column ') + (+h.to.slice(3) + 1)) + '.'); };
$('finish').onclick = () => { const step = () => { if (won(s)) return; if (act(() => auto(s))) setTimeout(step, 90); }; step(); };
$('new').onclick = () => { if (s && s.moves && !won(s) && !counted) { mem.played++; db.put(mem); } begin(); };
$('restart').onclick = () => begin(s.n);
$('draw').onchange = () => { mem.draw = +$('draw').value; db.put(mem); begin(s.n); };
shareButton($('share'), () => '?deal=' + s.n + '&draw=' + s.drawN, say, t);
addEventListener('resize', () => paint());
const qs = new URLSearchParams(location.search); if (qs.get('draw') === '3' || qs.get('draw') === '1') mem.draw = +qs.get('draw');
if (qs.get('deal')) begin(+qs.get('deal') || 1); else if (mem.saved && mem.saved.s) begin(0, mem.saved); else begin();
mountRelated($('related'), '/games/solitaire/');
