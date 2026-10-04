/**
 * aggravation skill — classic marble race, hot-seat on the stage.
 * State: four colors, six marbles each. Marbles live in 'base', on the outer loop
 * (0..27), in their home lane ('h0'..'h3'), or on the center star.
 * Roll 1 to leave base. Landing on an opponent marble (not on a home lane or the
 * star) sends it home to base. Home lanes and the star are safe.
 */
export const COLORS = ['red', 'blue', 'green', 'yellow'];
const LOOP = 28;

export function createState() {
  return {
    marbles: COLORS.map(() => Array(6).fill('base')),
    turn: 0, // index into COLORS
    dice: null,
    last: null,
    winner: null,
  };
}

export function roll(state) {
  state = { ...state, marbles: state.marbles.map((m) => [...m]) };
  state.dice = 1 + Math.floor(Math.random() * 6);
  state.last = null;
  return state;
}

function inHome(s) { return typeof s === 'string' && s[0] === 'h'; }
const outerIndex = (s) => (typeof s === 'number' ? s : -1);

export function movesFor(state, color, die) {
  const out = [];
  state.marbles[color].forEach((pos, i) => {
    if (pos === 'base') {
      if (die === 1) out.push({ marble: i, to: 0 });
      return;
    }
    if (pos === 'star') return;
    if (inHome(pos)) {
      const lane = Number(pos[1]) + die;
      if (lane > 4) return;
      out.push({ marble: i, to: lane === 4 ? 'star' : 'h' + lane });
      return;
    }
    const loopPos = outerIndex(pos) + die;
    if (loopPos < LOOP) {
      out.push({ marble: i, to: loopPos });
    } else {
      const over = loopPos - LOOP;
      // outer finished -> first home lane slot (h0 corresponds to one lap from start)
      const lane = over;
      if (lane === 0) out.push({ marble: i, to: 'h0' });
      else if (lane <= 4) out.push({ marble: i, to: lane === 4 ? 'star' : 'h' + lane });
    }
  });
  return out;
}

export function move(state, color, marble, to) {
  const next = { ...state, marbles: state.marbles.map((m) => [...m]), dice: null, last: null };
  next.marbles[color][marble] = to;
  // bump: another color's marble on the same outer space returns to base
  if (typeof to === 'number') {
    next.marbles.forEach((arr, ci) => {
      if (ci === color) return;
      arr.forEach((p, i) => { if (p === to) { arr[i] = 'base'; next.last = { color: ci, bumped: true }; } });
    });
  }
  if (next.marbles[color].every((p) => p === 'star')) next.winner = color;
  next.turn = (color + 1) % COLORS.length;
  return next;
}

export function aggravationOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|start|open|make)?\s*(?:me\s+)?(?:a\s+)?(?:game\s+of\s+)?aggravation$/i.test(t)) return { kind: 'game' };
  return null;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card aggravation-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:240px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(12,12,12,0.92);font-size:12px;cursor:grab;user-select:none';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em';
  head.textContent = 'Aggravation';
  const status = document.createElement('div');
  const board = document.createElement('div');
  board.style.cssText = 'margin:8px 0';
  const rollBtn = document.createElement('button');
  rollBtn.type = 'button'; rollBtn.textContent = 'roll';
  rollBtn.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:3px 12px;cursor:pointer';
  const moves = document.createElement('div');

  function legalMoves() {
    if (th.state.dice == null) return [];
    return movesFor(th.state, th.state.turn, th.state.dice);
  }
  function paint() {
    status.textContent = th.state.winner != null
      ? COLORS[th.state.winner] + ' wins · all six on the star'
      : COLORS[th.state.turn] + "'s turn" + (th.state.dice != null ? ' · rolled ' + th.state.dice : '');
    board.innerHTML = '';
    COLORS.forEach((c, ci) => {
      const counts = { base: 0, loop: 0, home: 0, star: 0 };
      th.state.marbles[ci].forEach((p) => { counts[p === 'base' ? 'base' : p === 'star' ? 'star' : inHome(p) ? 'home' : 'loop']++; });
      const row = document.createElement('div');
      row.textContent = c + ': base ' + counts.base + ' · loop ' + counts.loop + ' · home ' + counts.home + ' · star ' + counts.star;
      row.style.color = c;
      board.appendChild(row);
    });
    const lm = legalMoves();
    moves.innerHTML = '';
    if (th.state.dice != null && legalMoves().length === 0) moves.textContent = 'no legal moves — next player';
    lm.forEach((mv) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'move marble ' + (mv.marble + 1) + ' to ' + (typeof mv.to === 'number' ? 'space ' + mv.to : mv.to);
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:2px 0;font:inherit;color:inherit;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:8px;padding:2px 8px;cursor:pointer';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        th.state = move(th.state, th.state.turn, mv.marble, mv.to);
        paint();
      });
      moves.appendChild(b);
    });
  }
  rollBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  rollBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const color = th.state.turn;
    th.state = roll(th.state);
    if (movesFor(th.state, color, th.state.dice).length === 0) {
      th.state = { ...th.state, turn: (color + 1) % COLORS.length, dice: null }; // nothing to do: pass
    }
    paint();
  });
  el.appendChild(head); el.appendChild(board); el.appendChild(rollBtn); el.appendChild(moves); el.appendChild(status);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!aggravationOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'aggravation');
  if (existing) { api.stage.render(); return 'aggravation'; }
  api.summon('aggravation', { state: createState(), x: 60, y: 70 });
  api.say('aggravation · roll 1 to leave base · tap a move');
  return 'aggravation';
}

export default {
  name: 'aggravation',
  aggravationOf,
  createState,
  roll,
  movesFor,
  move,
  examples: ['aggravation', 'play aggravation', "let's play aggravation", 'a game of aggravation'],
  nearMisses: ['connect 4', 'dots and boxes', 'marbles', 'mancala'],
  match(lower, text) { return !!aggravationOf(text); },
  run,
  stageKinds: { aggravation: { mount } },
};
