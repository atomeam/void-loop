// /games/ (Versus' games floor hub): each game's card shows your own record from this device under its name; nothing else to wire.
import { $, lang, german } from '/lib/games-ui.js';
import { mountRelated } from '/lib/toolkit.js';
german({ 'More games on the stage, in 3D': 'Weitere Spiele auf der Bühne, in 3D' }, 'Schach, Sudoku, Minen, Patience, ein Worträtsel, Schieben und Verschmelzen und Dame: jedes auf einer eigenen Seite, kostenlos, ohne Konto und ohne Werbung, auf Ihrem Gerät und offline.');
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const de = lang === 'de';
const LINES = {
  '/chess/': () => { const c = read('a2m.void.chess.v1'); return c && c.rating && c.rating.n ? (de ? 'Ihre Wertung: ' : 'Your rating: ') + c.rating.r : ''; },
  '/games/checkers/': () => { const c = read('a2m.void.games.checkers.v1'); return c && (c.w || c.l) ? (de ? 'Siege: ' : 'Wins: ') + c.w : ''; },
  '/games/solitaire/': () => { const c = read('a2m.void.games.solitaire.v1'); return c && c.played ? (de ? 'Siege: ' : 'Wins: ') + c.wins + ' / ' + c.played : ''; },
  '/games/mines/': () => { const c = read('a2m.void.games.mines.v1'); return c && c.best && c.best.beginner ? (de ? 'Bestzeit Anfänger: ' : 'Best beginner: ') + mmss(c.best.beginner) : ''; },
  '/games/word/': () => { const c = read('a2m.void.games.word.v1'); return c && c.played ? (de ? 'Serie: ' : 'Streak: ') + c.streak : ''; },
  '/games/sudoku/': () => { const c = read('a2m.void.games.sudoku.v1'); return c && c.best && Object.keys(c.best).length ? (de ? 'Bestzeiten: ' : 'Best: ') + Object.entries(c.best).map(([k, v]) => k + ' ' + mmss(v)).join(', ') : ''; },
  '/games/merge/': () => { const c = read('a2m.void.games.merge.v1'); return c && c.best ? (de ? 'Bestwert: ' : 'Best score: ') + c.best : ''; },
};
for (const a of $('list').querySelectorAll('a[data-key]')) { const f = LINES[a.dataset.key]; const line = f ? f() : ''; if (line) a.querySelector('em').textContent = line; }
mountRelated($('related'), '/games/');
