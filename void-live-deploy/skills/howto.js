/**
 * howto — a short "how to play" for every game on the rack (Adam, 2026-10-09: "i dont know how to play any of these games …
 * needs tutorials … fun and easy to jump into playing"). Not a skill: side-card.js puts it on every game's card.
 * The first time you open a game it opens by itself (once per game, remembered in this browser); after that it is one tap
 * away on the card's "How to play" button. Three or four steps, each one thing you do, then the goal: no rulebook to read.
 *   HOWTO[kind]            { goal, steps: [...], tip }
 *   howTo(card, kind)      adds the button and the panel to a game's side card (does nothing for a kind it doesn't know)
 */
export const HOWTO = {
  chess: { goal: 'Trap Void’s king so it can’t escape: checkmate.',
    steps: ['You are white and move first.', 'Tap one of your pieces: the squares it can go to light up.', 'Tap a lit square to move there. Land on a Void piece to take it.', 'Void answers. The card shows which pieces are under attack on both sides.'],
    tip: 'Start by moving a middle pawn two squares, then bring out a knight.' },
  checkers: { goal: 'Take all of Void’s pieces, or leave it with no move.',
    steps: ['You are dark and move first, diagonally forward.', 'Tap a piece, then the square where it lands.', 'Jump over a Void piece to take it. If you can jump, you must.', 'Reach the far side and your piece is crowned: it can move backward too.'],
    tip: 'Keep your back row full as long as you can: Void can’t crown there.' },
  go: { goal: 'Surround more of the board than the other side.',
    steps: ['Two people share this board: Black plays first, then White.', 'Tap a point where lines cross to place a stone.', 'Surround a group so it has no empty point next to it and it is captured.', 'When neither side wants to play, press Pass, then Count position.'],
    tip: 'Corners first, then sides, then the middle: corners are the easiest to hold.' },
  othello: { goal: 'Have the most discs of your colour when the board is full.',
    steps: ['You are black. The dotted squares are where you can play.', 'Tap a dot: every Void disc in a straight line between yours flips to black.', 'Void plays white the same way.', 'No move? Your turn passes.'],
    tip: 'Corners can never be flipped back. Grab them when you can.' },
  connect4: { goal: 'Get four of your discs in a row: across, down or diagonal.',
    steps: ['You are red.', 'Tap a column: your disc drops to the lowest free space.', 'Void drops yellow and says why.', 'Block Void when it has three in a row.'],
    tip: 'The middle column is in the most possible fours. Start there.' },
  tictactoe: { goal: 'Three of your marks in a row.',
    steps: ['You are X and go first.', 'Tap an empty square.', 'Void plays O.', 'Block any two O’s in a row before you build your own.'],
    tip: 'Take the centre or a corner first.' },
  mancala: { goal: 'Finish with more seeds in your store (the big pit on your right).',
    steps: ['Your pits are the bottom row.', 'Tap a pit: its seeds are sown one by one, counter-clockwise.', 'Last seed in your store: you go again.', 'Last seed in your own empty pit: you take it and the seeds across from it.'],
    tip: 'Look for a pit whose seed count lands exactly in your store.' },
  aggravation: { goal: 'Race all four of your marbles from base to home.',
    steps: ['You are red. Press Roll.', 'A 1 or a 6 brings a marble out of base.', 'Tap a glowing marble, then a glowing hole, to move it.', 'Land on a rival and it goes back to its base.'],
    tip: 'The gold rings are shortcuts: they skip across the board.' },
  sorry: { goal: 'Get all four of your red pawns from Start to Home (it plays like Sorry!).',
    steps: ['Press Draw to turn over a card.', 'A 1 or a 2 moves a pawn out of Start. A 2 also lets you draw again.', 'Tap a glowing pawn, then a glowing square, to move it.', 'Land on someone and they go back to Start. Bumped!'],
    tip: 'Stop on a triangle in another colour and you slide to its end, knocking everyone off.' },
  battleship: { goal: 'Sink all five of Void’s hidden ships first.',
    steps: ['Your fleet is placed for you.', 'Tap a square in Void’s waters to fire.', 'A hit shows red, a miss white. Keep firing around a hit to find the rest of the ship.', 'Void fires back and shows its reasoning.'],
    tip: 'Fire in a checkerboard pattern: every ship covers at least two squares.' },
  poker: { goal: 'Win Void’s chips with Texas Hold’em (play money).',
    steps: ['You get two cards only you can see.', 'Five shared cards come out in three rounds.', 'Each round choose: Fold, Check, Call or Raise.', 'Best five-card hand from your two and the shared five wins the pot.'],
    tip: 'Pairs, high cards and suited connectors are worth playing. Fold the rest early.' },
  fireworks: { goal: 'Build each colour from 1 to 5 together with Void (25 is perfect).',
    steps: ['You see Void’s cards but not your own.', 'Tap one of Void’s cards to give it a hint: a colour or a number.', 'Tap one of yours to Play it (next on its pile) or Discard it (gets a hint back).', 'Three wrong plays and the show is over.'],
    tip: 'When Void hints at one of your cards, it usually means “play this”.' },
  monopoly: { goal: 'Bankrupt Void: buy property, build houses, charge rent.',
    steps: ['Press Roll to move.', 'Land on an unowned property: Buy it or leave it.', 'Own a full colour set and you can Build houses for higher rent.', 'Press End turn when you are done.'],
    tip: 'Orange and red sets are landed on most. Buy them.' },
};

const SEEN = 'void.howto.seen.';
const seen = (k) => { try { return localStorage.getItem(SEEN + k) === '1'; } catch (_) { return true; } }; // no storage: never pop up uninvited
const markSeen = (k) => { try { localStorage.setItem(SEEN + k, '1'); } catch (_) {} };

const CSS = '.howto-btn{margin-left:auto;border:1px solid var(--card-line,rgba(255,255,255,.16));background:rgba(255,255,255,.06);color:var(--ink,#eee);border-radius:999px;padding:3px 10px;font:600 11px/1.6 system-ui,sans-serif;letter-spacing:.02em}'
  + '.howto-btn:hover{background:rgba(255,255,255,.12)}'
  + '.howto{margin:10px 0 12px;padding:12px 12px 10px;border-radius:12px;background:linear-gradient(160deg,rgba(255,236,190,.10),rgba(140,170,255,.06));border:1px solid rgba(255,230,170,.22);animation:howto-in .28s ease}'
  + '.howto[hidden]{display:none}'
  + '.howto-goal{font-weight:650;margin-bottom:8px;color:#ffe9b8}'
  + '.howto ol{margin:0;padding:0;list-style:none;counter-reset:s}'
  + '.howto li{counter-increment:s;position:relative;padding:3px 0 3px 28px;line-height:1.4}'
  + '.howto li::before{content:counter(s);position:absolute;left:0;top:3px;width:19px;height:19px;border-radius:50%;background:#ffe2a1;color:#2a1c06;font:700 11px/19px system-ui,sans-serif;text-align:center}'
  + '.howto-tip{margin-top:8px;font-size:12px;color:var(--muted,#a9a9b2)}'
  + '.howto-go{margin-top:10px;width:100%;border:0;border-radius:10px;padding:9px 12px;background:#ffe2a1;color:#2a1c06;font:700 13px system-ui,sans-serif}'
  + '.howto-go:hover{background:#fff0c9}'
  + '@keyframes howto-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'
  + '@media (prefers-reduced-motion: reduce){.howto{animation:none}}';
function style() {
  if (typeof document === 'undefined' || document.getElementById('howto-style')) return;
  const s = document.createElement('style'); s.id = 'howto-style'; s.textContent = CSS; document.head.appendChild(s);
}

/** Put "How to play" on a game's card: a button in its head and the steps under it (open by itself the first time). */
export function howTo(card, kind) {
  const h = HOWTO[kind];
  if (!h || !card || typeof document === 'undefined' || card.querySelector('.howto')) return null;
  style();
  const panel = document.createElement('div'); panel.className = 'howto'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'How to play');
  const goal = document.createElement('div'); goal.className = 'howto-goal'; goal.textContent = h.goal;
  const ol = document.createElement('ol');
  for (const s of h.steps) { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); }
  const tip = document.createElement('div'); tip.className = 'howto-tip'; tip.textContent = 'Tip: ' + h.tip;
  const go = document.createElement('button'); go.type = 'button'; go.className = 'howto-go'; go.textContent = 'Got it, let’s play';
  panel.append(goal, ol, tip, go);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'howto-btn'; btn.textContent = 'How to play';
  btn.setAttribute('aria-expanded', 'false');
  const show = (on) => { panel.hidden = !on; btn.setAttribute('aria-expanded', String(on)); btn.textContent = on ? 'Hide' : 'How to play'; };
  for (const b of [btn, go]) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => { e.stopPropagation(); show(panel.hidden); markSeen(kind); });
  go.addEventListener('click', (e) => { e.stopPropagation(); show(false); markSeen(kind); });
  const head = card.querySelector('.g-head');
  if (head) { head.style.display = 'flex'; head.style.alignItems = 'center'; head.style.gap = '8px'; head.appendChild(btn); head.after(panel); }
  else { card.prepend(panel); card.prepend(btn); }
  // the long rules paragraph stays, folded away: the steps above are what you need to start
  const rules = card.querySelector('.g-rules');
  if (rules && !rules.closest('details')) {
    const d = document.createElement('details'); d.className = 'howto-rules';
    const sm = document.createElement('summary'); sm.textContent = 'All the rules'; sm.style.cssText = 'cursor:pointer;color:var(--muted,#a9a9b2);font-size:12px;margin-top:8px';
    rules.replaceWith(d); d.append(sm, rules);
  }
  show(!seen(kind));
  return panel;
}
