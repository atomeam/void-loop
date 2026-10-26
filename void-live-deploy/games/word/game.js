// /games/word/ ("Hidden word", Versus' games lane, an unlimited word-guess site): guess the five-letter word in six tries. The rules are lib/wordguess.js;
// the answers are Verse's own list and the accepted guesses a list of English words (games/word/words.json, loaded after the page). Unlimited games and
// a word of the day, hard mode, colour-blind colours, your streak and the spread of your guesses on this device, a share line that gives nothing away.
import { mark, hardOk, dayIndex, keyStates, shareLine, inList } from '/lib/wordguess.js';
import { $, lang, store, german } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';

const t = german({ Unlimited: 'Unbegrenzt', 'Word of the day': 'Wort des Tages', 'New word': 'Neues Wort', 'Hard mode': 'Schwerer Modus', 'Colour-blind colours': 'Farben für Farbenblinde', 'Share result': 'Ergebnis teilen', 'Your record on this device': 'Ihre Bilanz auf diesem Gerät', Enter: 'Eingabe' },
  'Erraten Sie das englische Wort mit fünf Buchstaben in sechs Versuchen. Nach jedem Versuch wird ein Buchstabe grün, wenn er an der richtigen Stelle steht, gold, wenn er woanders im Wort vorkommt, und grau, wenn nicht. So oft Sie mögen, oder das Wort des Tages.');
const db = store('word', { hard: false, cb: false, played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], daily: {}, game: null }); const mem = db.get();
const tiles = [...$('tiles').children];
let words = null, answer = '', rows = [], typing = '', over = false, mode = 'unl', label = '';
const say = (x, cls = '') => { $('status').textContent = x; $('status').className = 'status ' + cls; };
async function loadWords() { if (words) return words; try { words = await (await fetch('/games/word/words.json')).json(); } catch (_) { say(lang === 'de' ? 'Die Wortliste lädt nicht (offline beim ersten Besuch?).' : 'The word list did not load (offline on a first visit?).', 'bad'); } return words; }
function paint() {
  tiles.forEach((d, i) => { const r = Math.floor(i / 5), c = i % 5, row = rows[r]; d.textContent = row ? row.word[c] : r === rows.length ? typing[c] || '' : ''; d.className = row ? row.marks[c] : ''; });
  const ks = keyStates(rows); for (const b of $('kbd').querySelectorAll('[data-k]')) { const k = b.dataset.k; b.className = (k.length > 1 ? 'wide ' : '') + (ks[k] || ''); }
  $('stats').textContent = (lang === 'de' ? 'Gespielt ' : 'Played ') + mem.played + ' · ' + (lang === 'de' ? 'Gewonnen ' : 'Won ') + (mem.played ? Math.round((mem.won / mem.played) * 100) : 0) + '% · ' + (lang === 'de' ? 'Serie ' : 'Streak ') + mem.streak + ' · ' + (lang === 'de' ? 'Beste Serie ' : 'Best streak ') + mem.best;
  const max = Math.max(1, ...mem.dist); $('dist').innerHTML = mem.dist.map((n, i) => `<li>${i + 1} <i style="width:${Math.max(6, ((+n || 0) / max) * 70)}%">${+n || 0}</i></li>`).join('');
  document.body.classList.toggle('cb', !!mem.cb);
}
function keepGame() { mem.game = mode === 'unl' && !over ? { answer, rows } : null; if (mode === 'daily') mem.daily = { day: label, rows, over }; db.put(mem); }
async function start(m = 'unl', resume = null) {
  const w = await loadWords(); if (!w) return; mode = m; over = false; typing = '';
  for (const [id, v] of [['unl', 'unl'], ['daily', 'daily']]) $(id).setAttribute('aria-selected', String(mode === v));
  if (mode === 'daily') { const d = dayIndex(); answer = w.answers[((d % w.answers.length) + w.answers.length) % w.answers.length]; label = '#' + d; rows = mem.daily && mem.daily.day === label ? mem.daily.rows : []; over = !!(mem.daily && mem.daily.day === label && mem.daily.over); }
  else if (resume) { answer = resume.answer; rows = resume.rows; label = ''; }
  else { answer = w.answers[Math.floor(Math.random() * w.answers.length)]; rows = []; label = ''; }
  paint(); keepGame();
  say((mode === 'daily' ? (lang === 'de' ? 'Wort des Tages ' : 'Word of the day ') + label + '. ' : '') + (over ? (lang === 'de' ? 'Das Wort von heute ist gelöst. Morgen gibt es ein neues; oder spielen Sie unbegrenzt.' : 'Today’s word is done. A new one comes tomorrow; or play Unlimited.') : (lang === 'de' ? 'Tippen Sie ein Wort mit fünf Buchstaben und drücken Sie Eingabe.' : 'Type a five-letter word and press Enter.')));
}
function finish(win) {
  over = true; mem.played++; if (win) { mem.won++; mem.streak++; mem.best = Math.max(mem.best, mem.streak); mem.dist[rows.length - 1]++; } else mem.streak = 0;
  keepGame(); paint();
  say(win ? (lang === 'de' ? 'Gelöst in ' + rows.length + ' von 6.' : ['First try!', 'Two tries: sharp.', 'Three tries: well found.', 'Four tries: solid.', 'Five tries: got there.', 'Six tries: just in time.'][rows.length - 1]) : (lang === 'de' ? 'Das Wort war ' : 'The word was ') + answer.toUpperCase() + '.', win ? 'ok' : 'bad');
}
function key(k) {
  if (over || !words) return;
  if (k === 'back') typing = typing.slice(0, -1);
  else if (k === 'enter') {
    if (typing.length < 5) return say(lang === 'de' ? 'Zu wenige Buchstaben.' : 'Not enough letters.', 'bad');
    if (!inList(typing, words.valid) && !words.answers.includes(typing)) return say(lang === 'de' ? 'Dieses Wort kennt die Liste nicht.' : 'That word is not in the list.', 'bad');
    if (mem.hard) { const why = hardOk(typing, rows); if (why) return say(why, 'bad'); }
    rows.push({ word: typing, marks: mark(typing, answer) }); typing = '';
    if (rows[rows.length - 1].marks === 'ggggg') return finish(true);
    if (rows.length === 6) return finish(false);
    say(''); keepGame();
  } else if (/^[a-z]$/.test(k) && typing.length < 5) typing += k;
  paint();
}
$('kbd').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) key(b.dataset.k); };
addEventListener('keydown', (e) => { if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT/.test(e.target.tagName)) return; const k = e.key === 'Enter' ? 'enter' : e.key === 'Backspace' ? 'back' : e.key.toLowerCase(); if (k === 'enter' || k === 'back' || /^[a-z]$/.test(k)) { e.preventDefault(); key(k); } });
$('new').onclick = () => start('unl'); $('unl').onclick = () => start('unl'); $('daily').onclick = () => start('daily');
$('hard').checked = !!mem.hard; $('cbm').checked = !!mem.cb;
$('hard').onchange = () => { if (rows.length && !over) { $('hard').checked = mem.hard; return say(lang === 'de' ? 'Der schwere Modus wechselt nur vor dem ersten Versuch.' : 'Hard mode can change only before the first guess.', 'bad'); } mem.hard = $('hard').checked; db.put(mem); };
$('cbm').onchange = () => { mem.cb = $('cbm').checked; db.put(mem); paint(); };
$('share').onclick = async () => {
  const text = over ? shareLine(rows, label || (lang === 'de' ? 'unbegrenzt' : 'unlimited'), rows.length && rows[rows.length - 1].marks === 'ggggg', mem.hard) : location.origin + '/games/word/' + (mode === 'daily' ? '?daily=1' : '');
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) { /* closed */ } }
  try { await navigator.clipboard.writeText(text); say(lang === 'de' ? 'Kopiert.' : 'Copied.'); } catch (_) { say(text); }
};
const qs = new URLSearchParams(location.search); if (qs.get('hard') === '1') { mem.hard = true; $('hard').checked = true; }
start(qs.get('daily') ? 'daily' : 'unl', !qs.get('daily') && mem.game && mem.game.answer ? mem.game : null);
mountRelated($('related'), '/games/word/');
void t;
