import { GAMES, TITLES, ASKS } from '/lib/ladder.js';
import { drive } from '/lib/studio-play.js';
import * as glide from '/skills/gap-glide-rules.js';
import * as bus from '/skills/cross-bus-rules.js';

const HOST = { 'gap-glide': glide, 'cross-bus': bus };
const MORE = [
  ['Chess', 'play chess', 'You play white. Verse plays black.'],
  ['Checkers', 'play checkers', 'You take the light pieces. Verse takes the dark ones.'],
  ['Go', 'play go', 'You and Verse place stones in turn.'],
  ['Reversi', 'play othello', 'You and Verse flip discs. The arena record stays on the card.'],
  ['Four in a Row', 'play connect 4', 'You drop a disc. Verse answers.'],
  ['Tic-tac-toe', 'play tic tac toe', 'You take a square. Verse takes the next.'],
  ['Mancala', 'play mancala', 'You sow one side. Verse sows the other.'],
  ['Sea Battle', 'play battleship', 'You place a fleet and fire. Verse fires back.'],
  ['The Landlord’s Game', 'play monopoly', 'You roll and buy. Verse plays the other seat.'],
  ['VoidQuest', 'play voidquest', 'A property game on Verse’s own board.'],
  ['Poker', 'play poker', 'A hand against Verse.'],
  ['Fireworks', 'play fireworks', 'A card game you play with Verse.'],
  ['Star Marbles', 'play aggravation', 'You race one set of marbles. Verse races the other.'],
  ['Ringer', 'play marbles', 'Flick a marble on the ring.'],
  ['Back to Start', 'play sorry', 'A race that can send a piece home. Verse plays the other set.'],
  ['Quiz', 'quiz me', 'Questions from a card already on the stage.'],
  ['Math quiz', 'math quiz', 'Ten sums, checked as you answer.'],
  ['Rock paper scissors', 'rock paper scissors', 'You pick one. Verse picks one.'],
  ['Reaction time', 'reaction time test', 'Wait for the signal, then tap. Five tries.'],
  ['Typing', 'typing speed test', 'Type the passage. The card gives words a minute and accuracy.'],
  ['Zorbleflux', 'zorbleflux', 'Steer a glowing zorb and collect motes.'],
  ['Verse Pong', 'play pong', 'You are the left paddle. First to 7.'],
  ['Verse Snake', 'play snake', 'You are the green snake. Verse is the violet one.'],
  ['Null Sweep', 'null sweep', 'Find the bad commits. Verse clears the same board.'],
  ['Merge Verse', 'merge verse', 'Slide and fuse tiles. Verse plays the same seed.'],
  ['Dim the Verse', 'dim the verse', 'Turn the lamps off. Verse shows how few presses it takes.'],
  ['Verse Breaker', 'verse breaker', 'You hold the bottom paddle. Verse holds the top.'],
  ['Game box', 'game box', 'Dice, a coin, a deck, an answer orb, a timer and every game.'],
  ['Learn to draw', '/learn-to-draw/', 'Eight drawing drills, scored from what you draw.'],
  ['Random', '/random/', 'A number, a coin, a wheel of names, or made-up people.'],
  ['Fantasy tools', '/fantasy/', 'Compare players from a sheet you paste.'],
  ['Paint', '/paint/', 'A colouring book that keeps your progress on this device.'],
];

const $ = (id) => document.getElementById(id);
const games = $('games'), play = $('play'), how = $('how');
let round = 0;

function paint(id) {
  const game = HOST[id];
  play.textContent = '';
  const mine = ++round;
  const el = document.createElement('div');
  el.tabIndex = 0;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = game.W * dpr; cv.height = game.H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const status = document.createElement('p'); status.id = 'status';
  const why = document.createElement('p');
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  const note = document.createElement('p'); note.textContent = game.how;
  el.append(cv, status, why, again, note);
  play.append(el);
  let raf = 0;
  const card = {
    el, cv, ctx, status, why, again,
    start(fn) { const loop = () => { if (mine !== round) return; raf = requestAnimationFrame(loop); fn(); }; raf = requestAnimationFrame(loop); },
    local(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * game.W / Math.max(1, r.width), y: (e.clientY - r.top) * game.H / Math.max(1, r.height) }; },
  };
  drive(card, game, {});
  el.focus({ preventScroll: true });
}

function mark(id) {
  for (const b of games.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false');
}

for (const id of GAMES) {
  const title = HOST[id] ? HOST[id].how : 'Opens on the stage, where this game already lives.';
  if (!HOST[id]) {
    const a = document.createElement('a');
    a.className = 'chip'; a.href = '/?q=' + encodeURIComponent(ASKS[id]); a.textContent = TITLES[id]; a.title = title; a.dataset.id = id;
    games.append(a);
    continue;
  }
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.id = id; b.textContent = TITLES[id]; b.title = title;
  b.addEventListener('click', () => {
    how.textContent = title; mark(id);
    const q = new URLSearchParams(location.search);
    if (q.get('play') !== id) history.replaceState(null, '', '/arcade/?play=' + encodeURIComponent(id));
    paint(id);
  });
  games.append(b);
}

for (const [label, ask, line] of MORE) {
  const a = document.createElement('a');
  a.className = 'chip'; a.textContent = label; a.title = line;
  a.href = ask.startsWith('/') ? ask : '/?q=' + encodeURIComponent(ask);
  moreAppend(a);
}
function moreAppend(a) { $('more').append(a); }

const open = new URLSearchParams(location.search).get('play');
if (HOST[open]) { how.textContent = HOST[open].how; mark(open); paint(open); }
else if (GAMES[0]) how.textContent = 'Pick a game. Gap Glide and Cross the Bus play on this page. The others open on the stage, with every rule they already have.';
