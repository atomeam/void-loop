/**
 * rack skill — the game rack: a 3D walnut shelf of boxed board games standing in the void (skills/mini/rack.js). Tap a box
 * and that game opens and the rack is put away ("games" brings it back). Its card is separate (skills/side-card.js) and lists the same games as buttons, so the rack works
 * where WebGL can't run too. "games", "what games do you have", "play a game", "game rack", "board games".
 */
import { grip, sideCard } from './side-card.js';
import { LEVELS, getLevel, setLevel } from './game-level.js';
import PARODY from '../lib/parody.js';
import { GAMES as LADDER_GAMES, ASKS as ARCADE_ASKS, arcadeRow, load as loadLadder } from '../lib/ladder.js';

// Verse's parody of any classic game (asked by Verse: a searchable games matrix and a "parody-forge" card), folded into the game rack.
// From domains/void.board-game-law.md §5 (tools/parody.mjs): what is free to copy, what is protected, and Verse's own version.
// "parody of monopoly", "your version of clue", "is reversi public domain", "make a v01d version of risk", "parody games". Pure.
const PARODY_RE = /^(?:(?:what(?:'s| is)|whats|show(?: me)?|tell me|make(?: me)?|forge|build|give me)\s+)?(?:the\s+|a\s+|an\s+)?(?:v01d|void|verse|your|ur)?\s*(?:parody|version|take|spin|remake|knock-?off)\s+(?:of|on)\s+(.+)$|^parody[\s-]forge\s+(.+)$|^is\s+(.+?)\s+(?:in\s+the\s+)?public\s+domain$|^can\s+(?:v01d|void|verse|you)\s+(?:copy|make|clone)\s+(.+)$/;
export function parodyOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:show|list)(?: me)?\s+)?(?:the\s+|your\s+|(?:verse|v01d)'?s?\s+|(?:verse|void)'?s?\s+)?(?:parody|parodies)(?:\s+games?)?$|^(?:v01d|(?:verse|void)|verse)\s+parod(?:y|ies)$|^parody[\s-]forge$/.test(t)) return { all: true };
  const m = PARODY_RE.exec(t); if (!m) return null;
  const name = (m[1] || m[2] || m[3] || m[4] || '').replace(/^(?:the|a|an)\s+/, '').replace(/\s+(?:board\s+)?game$/, '').replace(/[^a-z0-9 &']+/g, '').trim();
  const row = PARODY.find((r) => r.names.includes(name) || r.generic.toLowerCase() === name || r.parody.toLowerCase() === name);
  return row ? { row } : (/\bgame\b/.test(t) && !(m[3] || m[4]) ? { unknown: name } : null); // an unknown name only when it is called a game
}
function parodyCard(q, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    if (q.all) { el.innerHTML = '<h2>Verse\'s parody games</h2><p class="sub">Rules are free; names, art and wording are not. My own version of each (not legal advice).</p><ul style="padding-left:18px">' + PARODY.map((r) => '<li><b>' + esc(r.parody) + '</b> · ' + esc(r.game) + (r.twist ? ' <span class="sub">— ' + esc(r.twist) + '</span>' : '') + '</li>').join('') + '</ul>'; return; }
    if (q.unknown) { el.innerHTML = '<h2>' + esc(q.unknown) + '</h2><p>That game is not in my parody matrix yet. Its rules would be free to use; its name, art and rulebook wording are not. Ask "parody games" for the 30 I have.</p>'; return; }
    const r = q.row, play = GAMES.find((g) => r.names.includes(g.id) || r.names.some((n) => g.ask === 'play ' + n));
    el.innerHTML = '<h2>' + esc(r.parody) + '</h2><div class="sub">Verse\'s version of ' + esc(r.game) + '</div>' + (r.twist ? '<p>' + esc(r.twist) + '</p>' : '')
      + '<ul style="padding-left:18px"><li><b>Public domain?</b> ' + esc(r.status) + '</li><li><b>Protected</b> ' + esc(r.protects) + '</li><li><b>Safest version</b> ' + esc(r.safest) + '</li><li><b>Generic name</b> ' + esc(r.generic) + '</li></ul>'
      + (play ? '<a href="#" data-ask="' + esc(play.ask) + '">Play it now</a> · ' : '') + '<span class="sub">Not legal advice.</span>';
  });
  return 'rack';
}


// one entry per board game Verse plays; `ask` is what opening it types
export const GAMES = [
  { id: 'chess', title: 'Chess', ask: 'play chess', color: '#2c2f38', ink: '#f4e9d2', motif: 'chess' },
  { id: 'checkers', title: 'Checkers', ask: 'play checkers', color: '#8f2d22', ink: '#fff3e0', motif: 'checkers' },
  { id: 'go', title: 'Go', ask: 'play go', color: '#d9a85a', ink: '#2a1a0a', motif: 'go' },
  { id: 'othello', title: 'Reversi', ask: 'play othello', color: '#1b6b40', ink: '#f4f1ea', motif: 'othello' },
  { id: 'connect4', title: 'Four in a Row', ask: 'play connect 4', color: '#1f4fbf', ink: '#fff4c2', motif: 'connect4' },
  { id: 'tictactoe', title: 'Tic-tac-toe', ask: 'play tic tac toe', color: '#c0562e', ink: '#fff6e6', motif: 'tictactoe' },
  { id: 'mancala', title: 'Mancala', ask: 'play mancala', color: '#6b4426', ink: '#f6e3c4', motif: 'mancala' },
  { id: 'aggravation', title: 'Star Marbles', ask: 'play aggravation', color: '#2f5fa8', ink: '#fdf6e3', motif: 'aggravation' },
  { id: 'ringer', title: 'Ringer', ask: 'play marbles', color: '#6e5238', ink: '#f3eedf', motif: 'ringer' },
  { id: 'sorry', title: 'Back to Start', ask: 'play sorry', color: '#c8202c', ink: '#fff8e7', motif: 'aggravation' },
  { id: 'battleship', title: 'Sea Battle', ask: 'play battleship', color: '#1d4e6e', ink: '#e8f4ff', motif: 'battleship' },
  { id: 'poker', title: 'Poker', ask: 'play poker', color: '#17563a', ink: '#f2e6c9', motif: 'poker' },
  { id: 'fireworks', title: 'Fireworks', ask: 'play fireworks', color: '#1b2233', ink: '#ffe9a8', motif: 'fireworks' },
  { id: 'monopoly', title: 'The Landlord’s Game', ask: 'play monopoly', color: '#c8e3c4', ink: '#1d3b25', motif: 'monopoly' },
  { id: 'voidquest', title: 'VoidQuest', ask: 'play voidquest', color: '#14122b', ink: '#cdbcff', motif: 'monopoly' },
  { id: 'eightball', title: 'Magic 8 Ball', ask: 'magic 8 ball', color: '#111114', ink: '#e8e8ff', motif: 'fireworks' },
];

export function rackOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets)\s+)?play\s+(?:a\s+)?(?:board\s+)?game$|^what\s+(?:board\s+)?games?\s+(?:can\s+(?:i|we)\s+play|do\s+you\s+have|are\s+there)(?:\s+on\s+this\s+site|\s+here)?$|^(?:any\s+)?board\s+games$/.test(t)) return { kind: 'rack' }; // a bare "games" is the Game Box's (skills/gamebox.js)
  if (/^(?:show\s+(?:me\s+)?|open\s+|summon\s+)?(?:the\s+|a\s+)?(?:games?\s+(?:card|picker|menu|list)|board\s+games?\s+card)$|^(?:pick|choose)\s+a\s+(?:board\s+)?game$/.test(t)) return { kind: 'rack' };
  if (/^(?:show\s+(?:me\s+)?|open\s+|summon\s+)?(?:the\s+|a\s+|your\s+)?(?:3d\s+)?(?:game|games|board\s*game|board\s*games)\s+(?:rack|shelf|shelves|cabinet|closet|cupboard)$|^(?:show\s+(?:me\s+)?)(?:the\s+|your\s+)?board\s+games$/.test(t)) return { kind: 'rack' }; // "show me the games" is the Game Box's
  // a board game Verse can't play yet, asked for as a game ("play scrabble", "scrabble board game"): say so plainly, record
  // the request, and show the rack. A bare name ("scrabble") stays a question about the word.
  const m = /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open)\s+(?:a\s+|an\s+|some\s+)?(?:game\s+of\s+)?([a-z][a-z' ]{1,24}?)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|(?:verse|void)|you))?$|^([a-z][a-z' ]{1,24}?)\s+board\s*game$/.exec(t);
  const name = m && (m[1] || m[2]);
  if (name && SOON[name]) return { kind: 'rack', wanted: SOON[name] };
  return null;
}
// board games people ask for that Verse doesn't play yet; each ask is recorded
export const SOON = { scrabble: 'Scrabble', risk: 'Risk', clue: 'Clue', cluedo: 'Cluedo', catan: 'Catan', 'settlers of catan': 'Catan',
  backgammon: 'Backgammon', ludo: 'Ludo', parcheesi: 'Parcheesi', trouble: 'Trouble', 'snakes and ladders': 'Snakes and ladders', 'chutes and ladders': 'Chutes and ladders', 'chinese checkers': 'Chinese checkers', dominoes: 'dominoes' };

const HINT = 'pick Verse’s level, then a game · try: chess · checkers · go · monopoly · voidquest · tic tac toe · reversi · four in a row · mancala · star marbles · marbles · back to start · rock paper scissors · magic 8 ball';

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
  // the arcade (Verse Studio): the games with Verse as player two, each with your record against Verse once you have played it ("arcade games" opens this card)
  const arc = document.createElement('div'); arc.className = 'rack-arcade'; arc.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  const arcHead = document.createElement('div'); arcHead.className = 'g-sub'; arcHead.style.cssText = 'width:100%;font-size:12px'; arcHead.textContent = 'Arcade · you against Verse';
  arc.appendChild(arcHead);
  const ladder = loadLadder();
  for (const g of LADDER_GAMES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn rack-arcade-pick'; b.dataset.arcade = g; b.textContent = arcadeRow(ladder, g);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); if (!stageApi.ask) return; delete stageApi.things()[th.id]; stageApi.save && stageApi.save(); stageApi.ask(ARCADE_ASKS[g]); });
    arc.appendChild(b);
  }
  card.appendChild(arc);
  // game strength (asked by Verse twice): each game's evidence rating from skills/families.json, proven to experiment, as a mark on its
  // button and in its title; nothing shows until the file is read, and a game with no skill of its own gets none
  fetch('/skills/families.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((fam) => {
    if (!fam || !list.isConnected) return;
    const tiers = new Map(); for (const f of fam.families || []) for (const s of f.skills || []) tiers.set(s.name, s);
    for (const b of list.querySelectorAll('button[data-game]')) {
      const s = tiers.get(b.dataset.game) || tiers.get(GAMES.find((g) => g.id === b.dataset.game)?.skill || ''); if (!s) continue;
      b.dataset.tier = s.tier; b.title = s.tier + ': ' + (s.why || '');
      const m = document.createElement('span'); m.className = 'rack-tier'; m.style.cssText = 'margin-left:5px;font-size:10px;opacity:' + ({ proven: '1', checked: '.8', tested: '.6', experiment: '.45' }[s.tier] || '.6');
      m.textContent = { proven: '●●●', checked: '●●○', tested: '●○○', experiment: '○○○' }[s.tier] || ''; m.setAttribute('aria-label', s.tier); b.appendChild(m);
    }
  }).catch(() => {});
  // one Verse strength for every game (skills/game-level.js): the games read it before Verse moves
  const lv = document.createElement('div'); lv.className = 'rack-level'; lv.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:10px;font-size:12px;color:var(--muted)';
  lv.append('Verse plays:');
  const paintLv = () => lv.querySelectorAll('button').forEach((x) => { x.style.opacity = x.dataset.level === getLevel() ? '1' : '.5'; x.setAttribute('aria-pressed', String(x.dataset.level === getLevel())); });
  for (const l of LEVELS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn rack-level-pick'; b.dataset.level = l; b.textContent = l;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); setLevel(l); paintLv(); });
    lv.appendChild(b);
  }
  paintLv(); card.appendChild(lv);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  sideCard(th, stageApi, card, { boardW: W, boardH: H + 24, w: 260 });
  if (stageApi.miniature) {
    stageApi.miniature(view, 'rack', { games: GAMES.map(({ ask, ...g }) => g), onPick: open }, { key: 'rack:' + th.id, label: '3D game rack: tap a box to open that game; drag to look around', maxPolar: 1.5, minPolar: 0.5 })
      .catch((e) => { console.warn('[rack] 3D unavailable, the card lists the games', e); el.remove(); });
  } else el.remove();
}

async function run(text, api) {
  const pq = parodyOf(text); if (pq) return parodyCard(pq, api);
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
  parodyOf,
  GAMES,
  // "games" and "show me the games" open the Game Box now (skills/gamebox.js, 2026-10-22), which lists this shelf as "play a game"
  examples: ['parody of monopoly', 'parody games', 'is reversi public domain', 'what games do you have', 'play a game', "let's play a game", 'game rack', 'board games', 'the game shelf', 'play scrabble', 'scrabble board game', 'games card', 'pick a game'],
  nearMisses: ['play chess', 'play go', 'video games', 'games for kids', 'what is game theory', 'hunger games', 'play monopoly', 'what is a monopoly', 'play music', 'play sorry by justin bieber'],
  match(lower, text) { return !!rackOf(text) || !!parodyOf(text); },
  run,
  stageKinds: { rack: { mount } },
};
