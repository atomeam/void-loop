/**
 * rack skill — the game rack: a 3D walnut shelf of boxed board games standing in the void (skills/mini/rack.js). Tap a box
 * and that game opens and the rack is put away ("games" brings it back). Its card is separate (skills/side-card.js) and lists the same games as buttons, so the rack works
 * where WebGL can't run too. "games", "what games do you have", "play a game", "game rack", "board games".
 */
import { grip, sideCard } from './side-card.js';

// one entry per board game Void plays; `ask` is what opening it types
export const GAMES = [
  { id: 'chess', title: 'Chess', ask: 'play chess', color: '#2c2f38', ink: '#f4e9d2', motif: 'chess' },
  { id: 'checkers', title: 'Checkers', ask: 'play checkers', color: '#8f2d22', ink: '#fff3e0', motif: 'checkers' },
  { id: 'go', title: 'Go', ask: 'play go', color: '#d9a85a', ink: '#2a1a0a', motif: 'go' },
  { id: 'othello', title: 'Reversi', ask: 'play othello', color: '#1b6b40', ink: '#f4f1ea', motif: 'othello' },
  { id: 'connect4', title: 'Four in a Row', ask: 'play connect 4', color: '#1f4fbf', ink: '#fff4c2', motif: 'connect4' },
  { id: 'tictactoe', title: 'Tic-tac-toe', ask: 'play tic tac toe', color: '#c0562e', ink: '#fff6e6', motif: 'tictactoe' },
  { id: 'mancala', title: 'Mancala', ask: 'play mancala', color: '#6b4426', ink: '#f6e3c4', motif: 'mancala' },
  { id: 'aggravation', title: 'Star Marbles', ask: 'play aggravation', color: '#2f5fa8', ink: '#fdf6e3', motif: 'aggravation' },
  { id: 'sorry', title: 'Back to Start', ask: 'play sorry', color: '#c8202c', ink: '#fff8e7', motif: 'aggravation' },
  { id: 'battleship', title: 'Sea Battle', ask: 'play battleship', color: '#1d4e6e', ink: '#e8f4ff', motif: 'battleship' },
  { id: 'poker', title: 'Poker', ask: 'play poker', color: '#17563a', ink: '#f2e6c9', motif: 'poker' },
  { id: 'fireworks', title: 'Fireworks', ask: 'play fireworks', color: '#1b2233', ink: '#ffe9a8', motif: 'fireworks' },
  { id: 'monopoly', title: 'The Landlord’s Game', ask: 'play monopoly', color: '#c8e3c4', ink: '#1d3b25', motif: 'monopoly' },
];

export function rackOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets)\s+)?play\s+(?:a\s+)?(?:board\s+)?game$|^what\s+(?:board\s+)?games?\s+(?:can\s+i\s+play|do\s+you\s+have|are\s+there)$|^(?:any\s+)?(?:board\s+)?games$/.test(t)) return { kind: 'rack' };
  if (/^(?:show\s+(?:me\s+)?|open\s+|summon\s+)?(?:the\s+|a\s+|your\s+)?(?:3d\s+)?(?:game|games|board\s*game|board\s*games)\s+(?:rack|shelf|shelves|cabinet|closet|cupboard)$|^(?:show\s+(?:me\s+)?)(?:the\s+|your\s+)?(?:board\s+)?games$/.test(t)) return { kind: 'rack' };
  // a board game Void can't play yet, asked for as a game ("play scrabble", "scrabble board game"): say so plainly, record
  // the request, and show the rack. A bare name ("scrabble") stays a question about the word.
  const m = /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open)\s+(?:a\s+|an\s+|some\s+)?(?:game\s+of\s+)?([a-z][a-z' ]{1,24}?)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$|^([a-z][a-z' ]{1,24}?)\s+board\s*game$/.exec(t);
  const name = m && (m[1] || m[2]);
  if (name && SOON[name]) return { kind: 'rack', wanted: SOON[name] };
  return null;
}
// board games people ask for that Void doesn't play yet; each ask is recorded
export const SOON = { scrabble: 'Scrabble', risk: 'Risk', clue: 'Clue', cluedo: 'Cluedo', catan: 'Catan', 'settlers of catan': 'Catan',
  backgammon: 'Backgammon', ludo: 'Ludo', parcheesi: 'Parcheesi', trouble: 'Trouble', 'snakes and ladders': 'Snakes and ladders', 'chutes and ladders': 'Chutes and ladders', 'chinese checkers': 'Chinese checkers', dominoes: 'dominoes' };

const HINT = 'try: chess · checkers · go · monopoly · tic tac toe · reversi · four in a row · mancala · star marbles · back to start · rock paper scissors · magic 8 ball';

function mount(th, stageApi) {
  const phone = Math.min(innerWidth, innerHeight) < 560;
  const W = phone ? Math.min(innerWidth - 20, 380) : 440, H = Math.round(W * 0.78);
  const el = document.createElement('div');
  el.className = 'thing kept-card free-board rack-wrap';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const view = document.createElement('div'); view.className = 'rack-view';
  view.style.cssText = 'position:relative;width:100%;height:' + H + 'px';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.append(view, grip('Game rack'));
  const card = document.createElement('div'); card.className = 'rack-card';
  card.innerHTML = '<div class="g-head"><span class="g-title">Games</span><span class="g-sub">tap a box on the shelf</span></div>';
  const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  // picking a game puts the rack away (the board takes its place in the void); "games" brings it back
  const open = (id) => {
    const g = GAMES.find((x) => x.id === id);
    if (!g || !stageApi.ask) return;
    delete stageApi.things()[th.id]; stageApi.save && stageApi.save();
    stageApi.ask(g.ask);
  };
  for (const g of GAMES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn rack-pick'; b.dataset.game = g.id; b.textContent = g.title;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); open(g.id); });
    list.appendChild(b);
  }
  card.appendChild(list);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  sideCard(th, stageApi, card, { boardW: W, boardH: H + 24, w: 260 });
  if (stageApi.miniature) {
    stageApi.miniature(view, 'rack', { games: GAMES.map(({ ask, ...g }) => g), onPick: open }, { key: 'rack:' + th.id, label: '3D game rack: tap a box to open that game; drag to look around', maxPolar: 1.5, minPolar: 0.5 })
      .catch((e) => { console.warn('[rack] 3D unavailable, the card lists the games', e); el.remove(); });
  } else el.remove();
}

async function run(text, api) {
  const q = rackOf(text);
  if (!q) return 'none';
  if (q.wanted && api.reportMiss) api.reportMiss(text, 'game not built yet: ' + q.wanted); // the request lands on the miss board
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'rack');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); }
  else {
    const phone = Math.min(innerWidth, innerHeight) < 560, w = phone ? Math.min(innerWidth - 20, 380) : 440, both = phone ? w : w + 280;
    api.summon('rack', { hold: true, x: Math.max(10, Math.round((innerWidth - both) / 2)), y: phone ? 56 : 60 });
  }
  api.say(q.wanted ? q.wanted + ' isn’t here yet · your ask is noted · these are ready: tap a box' : HINT);
  return 'rack';
}

export default {
  name: 'rack',
  rackOf,
  GAMES,
  examples: ['games', 'what games do you have', 'play a game', "let's play a game", 'game rack', 'show me the games', 'board games', 'the game shelf', 'play scrabble', 'scrabble board game'],
  nearMisses: ['play chess', 'play go', 'video games', 'games for kids', 'what is game theory', 'hunger games', 'play monopoly', 'what is a monopoly', 'play music', 'play sorry by justin bieber'],
  match(lower, text) { return !!rackOf(text); },
  run,
  stageKinds: { rack: { mount } },
};
