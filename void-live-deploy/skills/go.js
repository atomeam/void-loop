/**
 * go skill — the board game Go, two people on one 9×9 board (asked for by Void in its first daily reflection, 2026-10-08:
 * domains/void.voice.md). Same shape as othello.js: a pure engine and a card.
 * The lesson Void asked for is the interaction model: placing a stone is a move, not a verdict. A placement removes
 * opposing stones only when it takes their last liberty (that is a real capture, and only then does a capture count go
 * up); nothing is scored, no territory is worked out and no winner is named until someone presses "Count position".
 * The board is 3D and stands in the void (skills/mini/go.js); its card is separate (skills/side-card.js). A flat board
 * stands in where WebGL can't run. There is no Void opponent and no real-time loop: Black and White are two separate seats taking turns on one device.
 * Rules: captures, no suicide, simple ko (no immediate retake of a single stone), passing. Two passes in a row end play;
 * then the players tap dead groups and count. Counting is area scoring (stones + surrounded empty points) with 7 komi
 * for White. Before both have passed a count is an estimate of the position, never a result. Not covered: superko.
 */
import { grip, sideCard } from './side-card.js';
const LETTERS = 'ABCDEFGHJKLMNOPQRST'; // Go skips I
export const KOMI = 7;

export function createGoState(size = 9) {
  return { size, board: Array(size * size).fill(0), turn: 1, moveCount: 0, captured: { 1: 0, 2: 0 }, passes: 0, ko: -1, status: 'playing', dead: [], last: -1 };
}

export const pointName = (i, size = 9) => LETTERS[i % size] + (size - Math.floor(i / size));
const near = (i, size) => {
  const r = Math.floor(i / size), c = i % size, out = [];
  if (r > 0) out.push(i - size); if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1); if (c < size - 1) out.push(i + 1);
  return out;
};

// the connected group at i and its liberties (empty points next to it)
export function groupAt(board, size, i) {
  const color = board[i], stones = [], libs = new Set(), seen = new Set([i]), todo = [i];
  while (todo.length) {
    const p = todo.pop(); stones.push(p);
    for (const q of near(p, size)) {
      if (board[q] === 0) libs.add(q);
      else if (board[q] === color && !seen.has(q)) { seen.add(q); todo.push(q); }
    }
  }
  return { stones, liberties: libs.size };
}

// Place a stone for the side to move. Returns { nextState, captured: [points removed] }; throws on an illegal point.
// The only thing a placement settles is what the rules settle at once: opposing groups left with no liberty come off.
export function placeStone(state, i) {
  const { size } = state;
  if (state.status !== 'playing') throw new Error('play has ended');
  if (!(i >= 0 && i < size * size) || state.board[i] !== 0) throw new Error('that point is taken');
  if (i === state.ko) throw new Error('ko: that stone can’t be retaken right away');
  const me = state.turn, them = 3 - me, board = state.board.slice();
  board[i] = me;
  const taken = [];
  for (const q of near(i, size)) {
    if (board[q] !== them) continue;
    const g = groupAt(board, size, q);
    if (g.liberties === 0) for (const s of g.stones) { board[s] = 0; taken.push(s); }
  }
  const mine = groupAt(board, size, i);
  if (mine.liberties === 0) throw new Error('no liberties: that would be suicide');
  // simple ko: one stone took exactly one stone and now stands alone with one liberty, so the point it took can't be retaken next move
  const ko = taken.length === 1 && mine.stones.length === 1 && mine.liberties === 1 ? taken[0] : -1;
  const captured = { ...state.captured, [me]: state.captured[me] + taken.length };
  return { nextState: { ...state, board, turn: them, moveCount: state.moveCount + 1, captured, passes: 0, ko, last: i }, captured: taken };
}

// a pass hands the turn over; it wins nothing. The second pass in a row ends play and opens the count.
export function pass(state) {
  if (state.status !== 'playing') throw new Error('play has ended');
  const passes = state.passes + 1;
  return { ...state, turn: 3 - state.turn, passes, ko: -1, moveCount: state.moveCount + 1, last: -1, status: passes >= 2 ? 'ended' : 'playing' };
}

// after play ends: tap a group to mark it dead (or alive again). Only then does it count for the other side.
export function toggleDead(state, i) {
  if (state.status !== 'ended' || !state.board[i]) return state;
  const g = groupAt(state.board, state.size, i).stones, dead = new Set(state.dead);
  const on = !dead.has(i);
  for (const s of g) { if (on) dead.add(s); else dead.delete(s); }
  return { ...state, dead: [...dead] };
}

// back to playing when the players disagree about what is dead
export function resume(state) {
  return state.status === 'ended' ? { ...state, status: 'playing', passes: 0, dead: [] } : state;
}

// Area count, only when asked: each side's stones on the board plus empty regions only its stones touch; dead stones count
// as the other side's. Before play has ended it is an estimate (final: false) and names no winner.
export function countPosition(state) {
  const { size } = state, dead = new Set(state.dead), board = state.board.map((v, i) => (dead.has(i) ? 0 : v));
  const area = { 1: 0, 2: 0 }, stones = { 1: 0, 2: 0 }, seen = new Set();
  let neutral = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i]) { area[board[i]]++; stones[board[i]]++; continue; }
    if (seen.has(i)) continue;
    const region = [], touch = new Set(), todo = [i]; seen.add(i);
    while (todo.length) {
      const p = todo.pop(); region.push(p);
      for (const q of near(p, size)) {
        if (board[q]) touch.add(board[q]);
        else if (!seen.has(q)) { seen.add(q); todo.push(q); }
      }
    }
    if (touch.size === 1) area[[...touch][0]] += region.length; else neutral += region.length;
  }
  const black = area[1], white = area[2] + KOMI, final = state.status === 'ended';
  // the explanation: what each side's number is made of
  const why = { black: { stones: stones[1], territory: area[1] - stones[1] }, white: { stones: stones[2], territory: area[2] - stones[2], komi: KOMI } };
  const out = { black, white, komi: KOMI, neutral, final, why };
  if (final) out.result = black > white ? 'B+' + (black - white) : 'W+' + (white - black);
  return out;
}

export function goOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/\bgo fish\b|\bgo kart|\bpokemon go\b|\bgo (?:to|home|out|back|away)\b/.test(t)) return null;
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+|teach\s+me\s+(?:to\s+play\s+)?)?(?:play|start|open|summon|make|show|learn)?\s*(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:go|baduk|weiqi|wei qi|igo)(?:\s+(?:game|board))?(?:\s+(?:with|against)\s+(?:me|a friend|my friend|void|you))?$/.test(t)
    && !/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)go$/.test(t)) return { kind: 'game' }; // bare "go" is the game (Adam typed it); "let's go" is not
  if (/^(?:a\s+)?(?:9x9\s+|nine by nine\s+)?go board$|^(?:the\s+)?board game go$/.test(t)) return { kind: 'game' };
  return null;
}

const SEAT = { 1: 'Black', 2: 'White' };

function mount(th, stageApi) {
  style();
  if (!th.state || th.state.size !== 9 || !Array.isArray(th.state.board) || th.state.board.length !== 81) th.state = createGoState(9); // a saved or shared board that isn't a 9×9 Go board starts fresh
  const N = th.state.size;
  const phone = Math.min(innerWidth, innerHeight) < 560;
  const BW = phone ? Math.min(innerWidth - 20, 400) : 460, BH = Math.round(BW * 0.82);
  // the board stands in the void on its own (no card around it); the slim grip under it is what you drag
  const el = document.createElement('div');
  el.className = 'thing kept-card free-board go-board-wrap';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + BW + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const view = document.createElement('div'); view.className = 'go-view';
  view.style.cssText = 'position:relative;width:100%;height:' + BH + 'px';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.append(view, grip('Go · 9×9'));
  // the card: separate, beside the board (or under it on a narrow screen), moved on its own
  const card = document.createElement('div');
  card.className = 'game-card go-card';
  card.innerHTML = '<div class="g-head"><span class="g-title">Go</span><span class="g-sub">two players · Black first</span></div>';
  const note = document.createElement('div'); note.className = 'go-note';
  note.textContent = 'A placed stone is a move, not a verdict. Nothing is counted until you ask.';
  const status = document.createElement('div'); status.className = 'g-status go-status'; status.setAttribute('aria-live', 'polite');
  const btn = (label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const passBtn = btn('Pass', 'go-pass'), countBtn = btn('Count position', 'go-count'), again = btn('New game', 'go-new');
  const tools = document.createElement('div'); tools.className = 'go-tools'; tools.append(passBtn, countBtn, again);
  const caps = document.createElement('div'); caps.className = 'go-caps';
  const count = document.createElement('div'); count.className = 'go-countout'; count.hidden = true;
  card.append(status, tools, caps, count, note);
  let said = '', mini = null, flat = null;
  const save = () => stageApi.save && stageApi.save();
  const data = () => ({ size: N, board: th.state.board, last: th.state.last, dead: th.state.dead, onPoint: tap });
  function tap(i) {
    const st = th.state;
    if (st.status === 'ended') { th.state = toggleDead(st, i); count.hidden = true; said = 'Marked. Count position when you both agree.'; paint(); save(); return; }
    try {
      const r = placeStone(st, i);
      th.state = r.nextState;
      said = SEAT[st.turn] + ' played ' + pointName(i, N) + (r.captured.length ? ' and captured ' + r.captured.length + '.' : '. Nothing is counted yet.');
    } catch (err) { said = String(err.message || err).replace(/^./, (x) => x.toUpperCase()) + '.'; paint(); return; }
    count.hidden = true; // an earlier count no longer describes this board
    paint(); save();
  }
  passBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (th.state.status === 'ended') { th.state = resume(th.state); said = 'Play resumed.'; count.hidden = true; paint(); save(); return; }
    const who = SEAT[th.state.turn];
    th.state = pass(th.state);
    said = th.state.status === 'ended' ? who + ' passed too. Play has ended: tap any dead groups, then Count position.' : who + ' passed. A pass wins nothing.';
    count.hidden = true; paint(); save();
  });
  countBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = countPosition(th.state);
    count.hidden = false;
    // built from nodes, not an HTML string: the numbers come from a saved board, which may have been shared
    const line = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
    const w = c.why, dead = th.state.dead.length;
    count.replaceChildren(line('b', 'Black ' + c.black), document.createTextNode(' · '), line('b', 'White ' + c.white),
      line('div', 'Black: ' + w.black.stones + ' stones + ' + w.black.territory + ' points only Black surrounds. White: ' + w.white.stones + ' stones + '
        + w.white.territory + ' points only White surrounds + ' + w.white.komi + ' komi for moving second.' + (c.neutral ? ' ' + c.neutral + ' points touch both colours and count for nobody.' : '')
        + (dead ? ' ' + dead + ' stones marked dead count for the other side.' : '')),
      c.final ? line('div', (c.result[0] === 'B' ? 'Black' : 'White') + ' wins by ' + c.result.slice(2) + '.', 'go-result')
        : line('div', 'An estimate of the board as it stands, not a result. Play goes on.'));
  });
  again.addEventListener('click', (e) => { e.stopPropagation(); th.state = createGoState(N); said = ''; count.hidden = true; paint(); save(); });
  function paint() {
    const st = th.state;
    caps.textContent = 'Captured · Black ' + st.captured[1] + ' · White ' + st.captured[2];
    passBtn.textContent = st.status === 'ended' ? 'Resume play' : 'Pass';
    let line = said || (st.status === 'ended' ? 'Play has ended. Tap dead groups, then Count position.' : '');
    if (st.status === 'playing') line = (line ? line + ' ' : '') + SEAT[st.turn] + ' to play.';
    status.textContent = line;
    if (mini) mini.update(data()); else if (flat) flat();
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  sideCard(th, stageApi, card, { boardW: BW, boardH: BH + 24, w: 290 });
  paint();
  const fallback = () => { if (flat) return; flat = flatBoard(view, N, () => th.state, tap); paint(); };
  if (stageApi.miniature) {
    stageApi.miniature(view, 'go', data(), { key: 'go:' + th.id, label: '3D Go board: tap a point to place a stone; drag to look around', maxPolar: 1.2, minPolar: 0.12 })
      .then((h) => { mini = h; paint(); }).catch((e) => { console.warn('[go] 3D unavailable, flat board', e); fallback(); });
  } else fallback();
}

// where WebGL can't run: the same board drawn flat (SVG), same taps
function flatBoard(host, N, getState, tap) {
  const svgNS = 'http://www.w3.org/2000/svg', S = 40, pad = 30, W = pad * 2 + S * (N - 1);
  const frame = document.createElement('div'); frame.className = 'go-frame';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`); svg.setAttribute('class', 'go-flat'); svg.setAttribute('role', 'grid');
  // every node is made with createElementNS (no HTML strings): a saved board, maybe shared, can't inject markup
  const make = (tag, attrs, parent, text) => { const n = document.createElementNS(svgNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text !== undefined) n.textContent = text; parent.appendChild(n); return n; };
  const linesG = make('g', { class: 'go-lines' }, svg);
  for (let k = 0; k < N; k++) {
    const p = pad + k * S;
    make('line', { x1: pad, y1: p, x2: W - pad, y2: p }, linesG); make('line', { x1: p, y1: pad, x2: p, y2: W - pad }, linesG);
    make('text', { x: p, y: pad - 16 }, linesG, LETTERS[k]); make('text', { x: pad - 18, y: p + 4 }, linesG, String(N - k));
  }
  for (const i of N === 9 ? [20, 24, 40, 56, 60] : []) make('circle', { cx: pad + (i % N) * S, cy: pad + Math.floor(i / N) * S, r: 3.5 }, linesG);
  const stonesG = make('g', { class: 'go-stones' }, svg), points = [];
  for (let i = 0; i < N * N; i++) {
    const b = document.createElementNS(svgNS, 'rect');
    b.setAttribute('x', pad + (i % N) * S - S / 2); b.setAttribute('y', pad + Math.floor(i / N) * S - S / 2);
    b.setAttribute('width', S); b.setAttribute('height', S); b.setAttribute('class', 'go-pt');
    b.dataset.i = i; b.setAttribute('role', 'gridcell'); b.setAttribute('aria-label', 'point ' + pointName(i, N));
    b.addEventListener('click', (e) => { e.stopPropagation(); tap(i); });
    points.push(b); svg.appendChild(b);
  }
  frame.appendChild(svg); host.style.height = 'auto'; host.appendChild(frame);
  return function paint() {
    const st = getState(), dead = new Set(st.dead);
    stonesG.replaceChildren();
    for (let i = 0; i < N * N; i++) {
      const v = st.board[i];
      if (v) make('circle', { class: 'go-stone ' + (v === 1 ? 'b' : 'w') + (dead.has(i) ? ' dead' : ''), cx: pad + (i % N) * S, cy: pad + Math.floor(i / N) * S, r: S * 0.46 }, stonesG);
    }
    const last = Number(st.last);
    if (last >= 0 && last < N * N) make('circle', { class: 'go-mark', cx: pad + (last % N) * S, cy: pad + Math.floor(last / N) * S, r: S * 0.15 }, stonesG);
    for (let i = 0; i < N * N; i++) points[i].classList.toggle('open', st.status === 'playing' && !st.board[i]);
  };
}

// Inject the board's look once (the page's .game-card/.g-* styles do the card itself)
function style() {
  if (typeof document === 'undefined' || document.getElementById('go-style')) return;
  const s = document.createElement('style'); s.id = 'go-style';
  s.textContent = '.go-card .g-status{display:block;min-height:36px}'
    + '.go-frame{padding:6px;border-radius:12px;background:linear-gradient(145deg,#e2b56a,#c48f45);box-shadow:0 14px 30px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,240,200,.6),inset 0 -2px 5px rgba(90,50,10,.4)}'
    + '.go-flat{display:block;width:100%;height:auto}.go-lines line{stroke:#3b2610;stroke-width:1.2}.go-lines circle{fill:#3b2610}'
    + '.go-lines text{font:600 11px system-ui,sans-serif;fill:#5a3a16;text-anchor:middle}'
    + '.go-pt{fill:transparent}.go-pt.open{cursor:pointer}.go-pt.open:hover{fill:rgba(0,0,0,.08)}'
    + '.go-stone{pointer-events:none;animation:piecePop .25s var(--ease,ease) both}.go-stone.b{fill:#16171b;stroke:#000;stroke-width:1}'
    + '.go-stone.w{fill:#f4f1ea;stroke:#8f897c;stroke-width:1}.go-stone.dead{opacity:.35}.go-mark{fill:none;stroke:#d9534f;stroke-width:2.5;pointer-events:none}'
    + '.go-note{margin:10px 2px 4px;font-size:var(--fs-s,13px);color:var(--ink-2,#aaa)}'
    + '.go-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.go-caps{margin-top:8px;font-size:var(--fs-s,13px);color:var(--ink-2,#aaa);font-variant-numeric:tabular-nums}'
    + '.go-countout{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06);font-variant-numeric:tabular-nums}.go-countout span,.go-countout div{color:var(--ink-2,#aaa);font-size:var(--fs-s,13px)}'
    + '.go-countout .go-result{color:var(--ink,#fff);font-weight:600}';
  document.head.appendChild(s);
}

async function run(text, api) {
  if (!goOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'go');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'go'; } // one board at a time
  const phone = Math.min(innerWidth, innerHeight) < 560, bw = phone ? Math.min(innerWidth - 20, 400) : 460;
  const both = phone ? bw : bw + 20 + 290; // the board and its card side by side
  api.summon('go', { state: createGoState(9), x: Math.max(10, Math.round((innerWidth - both) / 2)), y: phone ? 56 : 48 });
  api.say('Go · two players, Black first · a stone is a move; press Count position when you want the count');
  return 'go';
}

// the engine on made-up positions: skills-check runs this every time
function suite() {
  const at = (s) => { const c = LETTERS.indexOf(s[0]), r = 9 - +s.slice(1); return r * 9 + c; };
  const play = (st, ...pts) => pts.reduce((s, p) => (p === 'pass' ? pass(s) : placeStone(s, at(p)).nextState), st);
  let s = play(createGoState(), 'E5');
  if (s.captured[1] || s.captured[2] || s.status !== 'playing' || s.turn !== 2) return { ok: false, got: 'a plain placement changed a count' };
  // black surrounds the white stone at E5: the last liberty taken captures it, and only then the count goes up
  s = play(createGoState(), 'E4', 'E5', 'D5', 'A1', 'F5', 'A2');
  if (s.captured[1] !== 0) return { ok: false, got: 'captured before the last liberty' };
  s = play(s, 'E6');
  if (s.captured[1] !== 1 || s.board[at('E5')] !== 0) return { ok: false, got: 'capture on the last liberty' };
  // suicide is refused; ko forbids the immediate retake
  try { play(createGoState(), 'A2', 'J9', 'B1', 'A1'); return { ok: false, got: 'suicide allowed' }; } catch (_) {}
  let k = play(createGoState(), 'D5', 'E5', 'E4', 'F4', 'E6', 'F6', 'J9', 'G5', 'F5'); // black F5 captures white E5 into a ko
  if (k.captured[1] !== 1) return { ok: false, got: 'ko setup capture' };
  try { play(k, 'E5'); return { ok: false, got: 'ko retake allowed' }; } catch (_) {}
  // two passes end play; the count is an estimate until then and a result after
  let p = play(createGoState(), 'E5', 'pass');
  if (p.status !== 'playing' || countPosition(p).final || countPosition(p).result) return { ok: false, got: 'one pass decided something' };
  p = play(p, 'pass');
  const c = countPosition(p);
  if (p.status !== 'ended' || !c.final || c.black !== 81 || c.white !== KOMI || c.result !== 'B+74') return { ok: false, got: JSON.stringify(c) };
  return { ok: true };
}

export default {
  name: 'go',
  goOf,
  createGoState,
  placeStone,
  pass,
  countPosition,
  toggleDead,
  suite,
  examples: ['go', 'play go', "let's play go", 'a game of go', 'go board', 'play baduk', 'teach me to play go', 'the board game go'],
  nearMisses: ['go to the store', 'play go fish', "let's go", 'go home', 'how far did you go', 'go go go', 'pokemon go'],
  match(lower, text) { return !!goOf(text); },
  run,
  stageKinds: { go: { mount } },
};
