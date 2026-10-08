/**
 * mancala skill — Kalah on the stage, against Void.
 * Contract, same as tictactoe.js and othello.js: { name, mancalaOf, createMancalaState, resolveMove,
 * legalMoves, voidMove, examples, nearMisses, match, run, stageKinds }.
 * "play mancala", "kalah", "let's play mancala".
 *
 * Twelve pits, four seeds each, two stores empty. Sowing runs counter-clockwise and never puts a
 * seed in the other side's store. A side that runs out of seeds ends the game: the rest go to
 * whoever still has pit seeds, and the bigger store wins.
 *
 * Pit numbering: 0-5 are yours along the bottom (left to right), 6-11 are Void's along the top (right to left). Stores are [you, Void].
 */
import { lift3d } from './lift3d.js';

const SEEDS = 4;
const PITS = 12;
// counter-clockwise round the board: your row left to right, your store (right), Void's row right to left
// (6 is top right, 11 top left, so 11 - i sits across from pit i), Void's store (left), back to your pit 0
const RING = [
  [0, 1, 2, 3, 4, 5, 'S', 6, 7, 8, 9, 10, 11],
  [6, 7, 8, 9, 10, 11, 'N', 0, 1, 2, 3, 4, 5],
];
const STORE_OF = ['S', 'N'];

export function createMancalaState() {
  return { pits: new Array(PITS).fill(SEEDS), store: [0, 0], turn: 0, over: false, result: null };
}

/** Your pits are 0-5, Void's are 6-11. */
export function owns(player, pit) { return player === 0 ? pit >= 0 && pit <= 5 : pit >= 6 && pit <= 11; }

/** The pit across from this one, for a capture. */
export function opposite(player, pit) { return 11 - pit; } // the same for both sides: 0 faces 11, 5 faces 6

export function legalMoves(state, player) {
  if (state.over) return [];
  const out = [];
  for (let i = 0; i < PITS; i++) if (owns(player, i) && state.pits[i] > 0) out.push(i);
  return out;
}

function sideSeeds(pits, player) {
  let n = 0;
  for (let i = 0; i < PITS; i++) if (owns(player, i)) n += pits[i];
  return n;
}

/** Ends the game when a side is empty: the other side sweeps its pits, then the stores decide. */
function settle(state) {
  if (!state.over && sideSeeds(state.pits, 0) > 0 && sideSeeds(state.pits, 1) > 0) return state;
  const pits = state.pits.slice(), store = state.store.slice();
  for (let i = 0; i < PITS; i++) { store[owns(0, i) ? 0 : 1] += pits[i]; pits[i] = 0; }
  const result = store[0] > store[1] ? 'you_win' : store[1] > store[0] ? 'void_wins' : 'draw';
  return { ...state, pits, store, over: true, turn: -1, result };
}

/**
 * Sow from one pit. Returns { nextState, sown, captured, last, extraTurn }.
 * A capture needs the last seed to land in a pit on your own side holding exactly one seed with the
 * pit opposite it occupied - that one plus the opposite seeds go to your store.
 * Landing in your own store hands you another go.
 */
export function resolveMove(state, pit) {
  if (state.over) throw new Error('game over');
  const player = state.turn;
  if (!owns(player, pit)) throw new Error(`pit ${pit} is not ${player === 0 ? 'yours' : "Void's"}`);
  const sown = state.pits[pit];
  if (sown < 1) throw new Error(`pit ${pit} is empty`);

  const pits = state.pits.slice(), store = state.store.slice();
  pits[pit] = 0;
  const ring = RING[player], start = ring.indexOf(pit);
  for (let k = 1; k <= sown; k++) {
    const slot = ring[(start + k) % ring.length];
    if (slot === STORE_OF[player]) store[player] += 1;
    else pits[slot] += 1;
  }
  const last = ring[(start + sown) % ring.length];
  let captured = 0;
  if (typeof last === 'number' && owns(player, last) && pits[last] === 1) {
    const across = opposite(player, last);
    if (pits[across] > 0) { captured = pits[across] + 1; pits[across] = 0; pits[last] = 0; store[player] += captured; }
  }
  const extraTurn = last === STORE_OF[player];
  const next = settle({ ...state, pits, store, turn: extraTurn ? player : (player === 0 ? 1 : 0), over: false, result: null });
  return { nextState: next, sown, captured, last, extraTurn };
}

/** Stores first, then pit seeds: a seed in your store is banked, one in a pit can still be lost. */
export function evaluate(state, player) {
  const opp = player === 0 ? 1 : 0;
  const mine = state.store[player] * 3 + sideSeeds(state.pits, player);
  const theirs = state.store[opp] * 3 + sideSeeds(state.pits, opp);
  return mine - theirs;
}

/** Negamax over the sow tree. Kalah chains run long, so this stays shallow on purpose. */
export function search(state, player, depth) {
  if (state.over) return player === 0 ? state.store[0] - state.store[1] : state.store[1] - state.store[0];
  const moves = legalMoves(state, player);
  if (!moves.length) return evaluate(state, player);
  if (depth <= 0) return evaluate(state, player);
  let best = -1e9;
  for (const m of moves) {
    let next;
    try { next = resolveMove(state, m).nextState; } catch (_) { continue; }
    const v = -search(next, player === 0 ? 1 : 0, depth - 1);
    if (v > best) best = v;
  }
  return best === -1e9 ? evaluate(state, player) : best;
}

/** Void's pit, or -1 when it has to pass. Only valid on Void's turn. */
export function voidMove(state, depth = 3) {
  if (state.over || state.turn !== 1) return -1;
  const moves = legalMoves(state, 1);
  if (!moves.length) return -1;
  let best = -1, bestScore = -1e9;
  for (const m of moves) {
    let next;
    try { next = resolveMove(state, m).nextState; } catch (_) { continue; }
    const v = next.over ? next.store[1] - next.store[0] : -search(next, 0, depth - 1);
    if (v > bestScore) { bestScore = v; best = m; }
  }
  return best;
}

export function mancalaOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|make|start|open)?\s*(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:game\s+of\s+)?(?:mancala|kalah)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game', label: 'Mancala' };
  return null;
}

const BEADS = ['#5fc4c0', '#e8a33d', '#d86a7a', '#efe7d6', '#6f8fe0', '#8fcf6a'];
// seeds sit where a hand would drop them: a golden-angle scatter, the same spot every time
function seedsHTML(n, max, tall) {
  const out = [], shown = Math.min(n, max);
  for (let k = 0; k < shown; k++) {
    const a = k * 2.39996, r = shown === 1 ? 0 : 0.32 * Math.sqrt((k + 0.5) / shown);
    const x = 50 + Math.cos(a) * r * 100, y = 50 + Math.sin(a) * r * (tall ? 260 : 100);
    out.push('<i style="left:' + x.toFixed(1) + '%;top:' + (tall ? 50 + (y - 50) / 2.6 : y).toFixed(1) + '%;--b:' + BEADS[(k * 7 + n) % BEADS.length] + '"></i>');
  }
  return out.join('');
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card mancala-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px';
  el.innerHTML = '<div class="g-head"><span class="g-title">Mancala</span><span class="g-sub">your pits are the bottom row</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const grid = document.createElement('div'); grid.className = 'mc-board';
  wrap.appendChild(grid);
  const bar = document.createElement('div'); bar.className = 'g-bar';
  const status = document.createElement('div'); status.className = 'g-status'; status.setAttribute('aria-live', 'polite');
  const again = document.createElement('button');
  again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  bar.append(status, again);
  const rules = document.createElement('div'); rules.className = 'g-rules';
  rules.textContent = 'Tap a pit to sow counter-clockwise. Last seed in your store: go again. Last seed in your own empty pit captures the seeds opposite. Empty a side to end it.';

  const stores = [document.createElement('div'), document.createElement('div')];
  for (const s of stores) s.className = 'mc-pit mc-store';
  const cells = [];
  function pitButton(i) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = i; b.className = 'mc-pit';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (th.state.over || th.state.turn !== 0) return;
      try { th.state = resolveMove(th.state, i).nextState; paint(); stageApi.save && stageApi.save(); schedule(); } catch (_) { /* not your pit, or empty */ }
    });
    cells.push(b);
    return b;
  }
  // Void's store on your left, yours on your right; both span the two rows.
  // Top row is Void's pits 11-6 read right to left (counter-clockwise sowing), bottom row is yours 0-5.
  const voidPits = [11, 10, 9, 8, 7, 6].map(pitButton);
  const yourPits = [0, 1, 2, 3, 4, 5].map(pitButton);
  grid.append(stores[1], ...voidPits, stores[0], ...yourPits);

  const fill = (node, n, max, tall) => { node.innerHTML = '<span class="mc-seeds">' + seedsHTML(n, max, tall) + '</span><b class="mc-n">' + n + '</b>'; };
  function paint() {
    const s = th.state;
    voidPits.forEach((vp, n) => { const i = 11 - n; fill(vp, s.pits[i] || 0, 14); vp.disabled = true; vp.setAttribute('aria-label', `Void pit ${6 - n}: ${s.pits[i] || 0} seeds`); });
    yourPits.forEach((yp, n) => { fill(yp, s.pits[n] || 0, 14); yp.disabled = s.over || s.turn !== 0 || !s.pits[n]; yp.setAttribute('aria-label', `your pit ${n + 1}: ${s.pits[n] || 0} seeds`); });
    fill(stores[0], s.store[0], 30, true); fill(stores[1], s.store[1], 30, true);
    stores[0].setAttribute('aria-label', `your store: ${s.store[0]}`);
    stores[1].setAttribute('aria-label', `Void store: ${s.store[1]}`);
    status.textContent = s.over
      ? (s.result === 'you_win' ? `You win ${s.store[0]}–${s.store[1]}!` : s.result === 'void_wins' ? `Void wins ${s.store[1]}–${s.store[0]}` : `Drawn ${s.store[0]}–${s.store[1]}`)
      : (s.turn === 0 ? 'Your move · tap one of your pits' : 'Void is thinking…');
  }
  // Void replies on a short delay so the card reads as a turn, not a jump.
  function schedule() {
    setTimeout(function tick() {
      if (!el.isConnected || th.state.over || th.state.turn !== 1) return;
      const m = voidMove(th.state);
      if (m >= 0) { try { th.state = resolveMove(th.state, m).nextState; paint(); stageApi.save && stageApi.save(); } catch (_) { /* raced */ } }
      if (!th.state.over && th.state.turn === 1) setTimeout(tick, 650);
    }, 600);
  }
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); th.state = createMancalaState(); paint(); stageApi.save && stageApi.save(); });
  el.append(wrap, bar, rules);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  schedule();
  // the board stands in the void in 3D (skills/mini/mancala.js), the rest of the card beside it; the 2D board stays the fallback
  lift3d(th, stageApi, el, { kind: 'mancala', board: grid, title: 'Mancala', W: 520, H: 250,
    snapshot: () => ({ pits: th.state.pits.slice(), store: th.state.store.slice(), playable: [...grid.querySelectorAll('button.mc-pit:not(:disabled)')].map((b) => +b.dataset.i) }) });
}

async function run(text, api) {
  if (!mancalaOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'mancala');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'mancala'; } // one board at a time
  api.summon('mancala', { state: createMancalaState(), center: true });
  api.say('mancala — you are the bottom row — tap a pit to sow');
  return 'mancala';
}

export default {
  name: 'mancala',
  mancalaOf,
  createMancalaState,
  resolveMove,
  legalMoves,
  voidMove,
  examples: ['play mancala', 'mancala', 'lets play mancala', 'kalah', 'a game of mancala'],
  nearMisses: ['what is mancala', 'mancala rules', 'play connect 4', 'what is connect 4', 'othello rules'],
  match(lower, text) { return !!mancalaOf(text); },
  run,
  stageKinds: { mancala: { mount } },
  suite() {
    const blank = () => new Array(12).fill(0);
    const at = (pits, store = [0, 0], turn = 0) => ({ pits, store, turn, over: false, result: null });
    const open = createMancalaState();
    // pit 0 with four seeds reaches pits 1-4; pit 5 with four wraps store -> 6 -> 7 -> 8. Pits 0 and 6
    // hold a seed each so neither side is empty and the game does not end on the spot.
    const plain = resolveMove(open, 0);
    const wrapPits = blank(); wrapPits[5] = 4; wrapPits[0] = 1; wrapPits[6] = 1;
    const wrap = resolveMove(at(wrapPits), 5);
    // Six seeds from pit 0 land 1,2,3,4,5,store: that is the extra turn.
    const six = blank(); six[0] = 6; six[11] = 1;
    const extra = resolveMove(at(six), 0);
    // One seed onto an empty pit of yours, opposite a full one, captures both.
    const capPits = blank(); capPits[0] = 1; capPits[10] = 2;
    const cap = resolveMove(at(capPits), 0);
    // Emptying a side sweeps the rest to the store that side emptied into.
    const sweepPits = blank(); sweepPits[0] = 1; sweepPits[1] = 2;
    const sweep = resolveMove(at(sweepPits, [10, 5]), 0);
    const gift = blank(); gift[6] = 1; gift[8] = 2; gift[10] = 3; gift[4] = 5; // Void's 6 -> 7 captures your 5 across
    let threw = false;
    try { resolveMove(open, 6); } catch (_) { threw = true; }
    const ok = open.pits.every((v) => v === 4) && open.store[0] === 0 && open.store[1] === 0
      && legalMoves(open, 0).length === 6 && legalMoves(open, 1).length === 6
      && plain.captured === 0 && plain.nextState.pits.join(',') === '0,5,5,5,5,4,4,4,4,4,4,4'
      && wrap.last === 8 && wrap.nextState.store[0] === 1 && wrap.nextState.store[1] === 0
      && extra.last === 'S' && extra.extraTurn === true && extra.nextState.turn === 0
      && cap.captured === 3 && cap.nextState.store[0] === 3
      && sweep.nextState.over === true && sweep.nextState.store[0] === 13 && sweep.nextState.result === 'you_win'
      && sweep.nextState.pits.every((v) => v === 0)
      && threw
      && voidMove(open) === -1 && voidMove(at(gift, [0, 0], 1)) === 6
      && owns(0, 5) && !owns(0, 6) && opposite(0, 1) === 10 && opposite(1, 6) === 5 && opposite(1, 7) === 4
      && ['play mancala', 'mancala', 'kalah', 'lets play mancala', 'a game of mancala'].every((a) => !!mancalaOf(a))
      && ['what is mancala', 'mancala rules', 'play connect 4'].every((a) => !mancalaOf(a));
    return { ok, got: `sown ${plain.sown} wrap ${wrap.last} extra ${extra.extraTurn} capture ${cap.captured} sweep ${sweep.nextState.result}` };
  },
};
