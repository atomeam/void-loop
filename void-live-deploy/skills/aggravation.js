/**
 * aggravation skill — the classic marble race on a real star board, against 1–3 computer players.
 *
 * Board: a 56-hole track around a four-point star (14 holes a side). Each colour has its own
 * base (4 marbles), its own start hole, and its own 4-hole home lane that leaves the track at
 * that colour's star tip, just before its start. Travel is clockwise.
 * Rules (Parker Brothers style):
 *  - Roll a 1 or a 6 to bring a marble from base to your start hole. A 6 rolls again.
 *  - You may jump anyone, but you may never jump or land on your own marble.
 *  - Land on another colour's marble and it goes back to its base ("aggravated").
 *  - Shortcut holes: the four inner corners of the star. A marble that starts its turn on one may
 *    hop corner to corner (one pip a hop) and leave the shortcut at any corner with the pips left.
 *  - The centre hole is one step past any shortcut hole. Leave the centre only with a 1, onto any
 *    shortcut hole.
 *  - Home needs the exact count. First to fill all four home holes wins.
 * The roll is locked while a move is pending; you pick a marble, then where it goes.
 *
 * Positions: 'b' base, 0..55 a track hole, 'c' the centre, 'h0'..'h3' home (h3 is the deepest).
 */
import { lift3d } from './lift3d.js';
import { rattle } from './sfx.js';

export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const HEX = { red: '#d93a3f', blue: '#2f6fd8', green: '#2c9c5a', yellow: '#e9b52a' };
export const TRACK = 56, SIDE = 14, MARBLES = 4, HOME = 4;
export const STARS = [7, 21, 35, 49];
export const startOf = (c) => (c * SIDE + 1) % TRACK;
export const entryOf = (c) => c * SIDE; // the star tip: last track hole before home
const isHome = (p) => typeof p === 'string' && p[0] === 'h';
const homeK = (p) => Number(p.slice(1));
/** how far along its own lap a track hole is for colour c (0 = start hole, 55 = the home entry) */
export const progressOf = (c, i) => (i - startOf(c) + TRACK) % TRACK;
/** a single number for "how far along" any position is, for the bot and the tests */
export function distance(c, p) {
  if (p === 'b') return -1;
  if (p === 'c') return 42;
  if (isHome(p)) return 56 + homeK(p);
  return progressOf(c, p);
}

export function seatsFor(opponents) {
  const n = Math.max(1, Math.min(3, Number(opponents) || 3));
  return n === 1 ? [0, 2] : n === 2 ? [0, 1, 2] : [0, 1, 2, 3];
}

export function createState(opts = {}) {
  const seats = seatsFor(opts.opponents == null ? 3 : opts.opponents);
  return {
    v: 2,
    seats,
    human: 0, // you are red; everyone else is the computer
    marbles: COLORS.map(() => Array(MARBLES).fill('b')),
    turn: 0,
    dice: null,
    last: null,
    winner: null,
  };
}

/** old (v1, text-only) saves become a fresh game */
export function upgrade(state) {
  return state && state.v === 2 && Array.isArray(state.seats) ? state : createState();
}

function clone(state) { return { ...state, marbles: state.marbles.map((m) => [...m]) }; }

/** roll the die; refused (state returned unchanged) while a roll is still waiting for its move */
export function roll(state, rng = Math.random) {
  if (state.dice != null || state.winner != null) return state;
  const next = clone(state);
  next.dice = 1 + Math.floor(rng() * 6);
  next.face = next.dice; // the die keeps showing the last roll after the move
  next.last = null;
  return next;
}

// one forward step along colour c's route; null past the deepest home hole
function step(c, p) {
  if (isHome(p)) return homeK(p) + 1 < HOME ? 'h' + (homeK(p) + 1) : null;
  if (progressOf(c, p) === TRACK - 1) return 'h0';
  return (p + 1) % TRACK;
}

/** every legal move for colour c with die d: [{ marble, from, to, path, via }] */
export function movesFor(state, c, d) {
  const mine = state.marbles[c], out = [], seen = new Set();
  const ownAt = (p, self) => mine.some((q, j) => j !== self && q === p);
  const add = (m, to, path, via) => {
    const key = m + ':' + to; if (seen.has(key)) return; seen.add(key);
    out.push({ marble: m, from: mine[m], to, path, via });
  };
  // walk n pips from p (all clear of our own marbles); may end in the centre if the last pip leaves a star
  const walk = (m, p, n, path, via) => {
    let cur = p; const trail = [...path];
    for (let s = 0; s < n; s++) {
      if (s === n - 1 && typeof cur === 'number' && STARS.includes(cur) && !ownAt('c', m)) add(m, 'c', [...trail, 'c'], via ? via + '+centre' : 'centre');
      const nx = step(c, cur);
      if (nx == null || ownAt(nx, m)) return;
      cur = nx; trail.push(cur);
    }
    add(m, cur, trail, via);
  };
  const firstBase = mine.indexOf('b'); // marbles in base are alike: offer one
  mine.forEach((p, m) => {
    if (p === 'b') {
      if (m === firstBase && (d === 1 || d === 6) && !ownAt(startOf(c), m)) add(m, startOf(c), [startOf(c)], 'enter');
      return;
    }
    if (p === 'c') {
      if (d === 1) for (const s of STARS) if (!ownAt(s, m)) add(m, s, [s], 'exit');
      return;
    }
    if (isHome(p)) { walk(m, p, d, [], null); return; }
    walk(m, p, d, [], null);
    // the shortcut: start the turn on a star corner, hop clockwise corner to corner
    if (STARS.includes(p)) {
      let at = p, path = [];
      for (let k = 1; k <= d; k++) {
        const nx = STARS[(STARS.indexOf(at) + 1) % 4];
        if (progressOf(c, nx) <= progressOf(c, at)) break; // never hop past your own home
        if (ownAt(nx, m)) break;
        at = nx; path = [...path, nx];
        if (k === d) add(m, at, path, 'shortcut');
        else walk(m, at, d - k, path, 'shortcut');
      }
    }
  });
  return out;
}

/** apply a move (one of movesFor's); bumps whoever sat there, checks the win, passes the turn (a 6 rolls again) */
export function move(state, c, mv) {
  const next = clone(state);
  next.marbles[c][mv.marble] = mv.to;
  next.last = { color: c, marble: mv.marble, to: mv.to, bumped: null };
  if (!isHome(mv.to)) {
    next.marbles.forEach((arr, ci) => {
      if (ci === c) return;
      arr.forEach((q, j) => { if (q === mv.to) { arr[j] = 'b'; next.last.bumped = ci; } });
    });
  }
  if (next.marbles[c].every(isHome)) next.winner = c;
  const again = state.dice === 6 && next.winner == null;
  next.dice = null;
  next.turn = again ? c : nextSeat(next, c);
  return next;
}

/** a roll with no legal move: the turn passes (a 6 still rolls again) */
export function pass(state) {
  const next = clone(state);
  const c = state.turn, again = state.dice === 6;
  next.dice = null; next.last = { color: c, passed: true };
  next.turn = again ? c : nextSeat(next, c);
  return next;
}

function nextSeat(state, c) {
  const s = state.seats, i = s.indexOf(c);
  return s[(i + 1) % s.length];
}

/** the computer's choice: hit, get home, get out, take the shortcut, and keep out of reach */
export function botMove(state, c, d) {
  const moves = movesFor(state, c, d);
  if (!moves.length) return null;
  const others = [];
  state.seats.forEach((oc) => { if (oc !== c) state.marbles[oc].forEach((q) => { if (typeof q === 'number') others.push(q); }); });
  const threatened = (i) => typeof i === 'number' && others.some((q) => { const gap = (i - q + TRACK) % TRACK; return gap >= 1 && gap <= 6; });
  let best = null, top = -Infinity;
  for (const mv of moves) {
    let s = distance(c, mv.to) - distance(c, mv.from);
    const victim = state.seats.find((oc) => oc !== c && state.marbles[oc].some((q) => q === mv.to && !isHome(q)));
    if (victim != null) s += 40 + Math.max(0, distance(victim, mv.to)) * 0.5;
    if (mv.from === 'b') s += 28;
    if (isHome(mv.to) && !isHome(mv.from)) s += 30;
    if (mv.to === 'c') s += 12;
    if (mv.from === 'c') s += progressOf(c, mv.to) / 2;
    if (threatened(mv.to)) s -= 14;
    if (threatened(mv.from)) s += 9;
    if (s > top) { top = s; best = mv; }
  }
  return best;
}

export function aggravationOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|start|open|make)?\s*(?:me\s+)?(?:a\s+)?(?:game\s+of\s+)?(?:aggravation|star\s+marbles)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|void|you|the\s+computer|bots?))?$/i.test(t)) return { kind: 'game' };
  return null;
}

// ---- board geometry (SVG units, centre 0,0) ----
const RT = 178, RI = 80;
const rad = (deg) => deg * Math.PI / 180;
const polar = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
const tipAngle = (c) => 90 + 90 * c; // red bottom, blue left, green top, yellow right: clockwise on screen
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function holeXY(p, c) {
  if (p === 'c') return [0, 0];
  if (isHome(p)) return polar(136 - homeK(p) * 20, tipAngle(c));
  const side = Math.floor(p / SIDE), j = p % SIDE;
  const tip = polar(RT, tipAngle(side)), inner = polar(RI, tipAngle(side) + 45), tip2 = polar(RT, tipAngle(side + 1));
  return j < 7 ? lerp(tip, inner, j / 7) : lerp(inner, tip2, (j - 7) / 7);
}
export function baseXY(c, m) {
  const [cx, cy] = polar(150, tipAngle(c) + 45), o = 11;
  return [cx + (m % 2 ? o : -o), cy + (m < 2 ? -o : o)];
}
const r1 = (v) => Math.round(v * 10) / 10;
const STAR_PATH = (() => { const pts = []; for (let c = 0; c < 4; c++) { pts.push(polar(RT, tipAngle(c)), polar(RI, tipAngle(c) + 45)); } return 'M' + pts.map((p) => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z'; })();

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

function boardSvg() {
  const s = svgEl('svg', { viewBox: '-200 -200 400 400', class: 'ag-board', role: 'img', 'aria-label': 'Star Marbles board' });
  const defs = svgEl('defs', {}, s);
  defs.innerHTML = '<linearGradient id="agWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9925a"/><stop offset=".5" stop-color="#b07a45"/><stop offset="1" stop-color="#8f5d31"/></linearGradient>'
    + '<linearGradient id="agInlay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a3a22"/><stop offset="1" stop-color="#3c2414"/></linearGradient>'
    + '<filter id="agGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.14  0 0 0 0 0.05  0 0 0 0.55 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>'
    + '<radialGradient id="agHole" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#140b05"/><stop offset=".75" stop-color="#2a180c"/><stop offset="1" stop-color="#6b4526"/></radialGradient>'
    + '<filter id="agShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".55"/></filter>'
    + COLORS.map((c) => '<radialGradient id="agM_' + c + '" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="' + HEX[c] + '"/><stop offset=".85" stop-color="' + HEX[c] + '"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>').join('')
    + '<radialGradient id="agGold" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff2c4"/><stop offset=".6" stop-color="#d4a640"/><stop offset="1" stop-color="#8a6420"/></radialGradient>';
  svgEl('rect', { x: -196, y: -196, width: 392, height: 392, rx: 26, fill: 'url(#agWood)' }, s);
  svgEl('rect', { x: -196, y: -196, width: 392, height: 392, rx: 26, fill: 'url(#agWood)', filter: 'url(#agGrain)', opacity: '.9' }, s);
  svgEl('rect', { x: -190, y: -190, width: 380, height: 380, rx: 21, fill: 'none', stroke: 'rgba(255,230,190,.25)', 'stroke-width': 1.2 }, s);
  // the star: a dark inlaid band the track holes sit in
  svgEl('path', { d: STAR_PATH, fill: 'rgba(60,36,20,.18)', stroke: 'url(#agInlay)', 'stroke-width': 26, 'stroke-linejoin': 'round' }, s);
  svgEl('path', { d: STAR_PATH, fill: 'none', stroke: 'rgba(255,225,180,.22)', 'stroke-width': 1, 'stroke-linejoin': 'round', transform: 'scale(1.075)' }, s);
  // each colour: painted home lane, base pad, start and entry rings
  COLORS.forEach((col, c) => {
    const a = polar(146, tipAngle(c)), b = polar(66, tipAngle(c));
    svgEl('line', { x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]), stroke: HEX[col], 'stroke-width': 17, 'stroke-linecap': 'round', opacity: '.55' }, s);
    const [bx, by] = polar(150, tipAngle(c) + 45);
    svgEl('rect', { x: r1(bx - 24), y: r1(by - 24), width: 48, height: 48, rx: 14, fill: HEX[col], opacity: '.5' }, s);
    svgEl('rect', { x: r1(bx - 24), y: r1(by - 24), width: 48, height: 48, rx: 14, fill: 'none', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.2 }, s);
    for (const p of [startOf(c), entryOf(c)]) { const [x, y] = holeXY(p); svgEl('circle', { cx: r1(x), cy: r1(y), r: 9.2, fill: 'none', stroke: HEX[col], 'stroke-width': 2.4, opacity: p === startOf(c) ? '1' : '.6' }, s); }
  });
  // shortcut corners: gold star rings; the centre: a big gold-rimmed hole
  for (const p of STARS) { const [x, y] = holeXY(p); svgEl('circle', { cx: r1(x), cy: r1(y), r: 10.5, fill: 'url(#agGold)', opacity: '.9' }, s); }
  svgEl('circle', { cx: 0, cy: 0, r: 16, fill: 'url(#agGold)' }, s);
  const holes = svgEl('g', { class: 'ag-holes' }, s);
  const hole = (x, y, r, key) => svgEl('circle', { cx: r1(x), cy: r1(y), r, fill: 'url(#agHole)', 'data-hole': key }, holes);
  for (let i = 0; i < TRACK; i++) { const [x, y] = holeXY(i); hole(x, y, 6.4, String(i)); }
  hole(0, 0, 9.5, 'c');
  COLORS.forEach((col, c) => {
    for (let k = 0; k < HOME; k++) { const [x, y] = holeXY('h' + k, c); hole(x, y, 6.4, c + ':h' + k); }
    for (let m = 0; m < MARBLES; m++) { const [x, y] = baseXY(c, m); hole(x, y, 6.4, c + ':b' + m); }
  });
  svgEl('g', { class: 'ag-targets' }, s);
  svgEl('g', { class: 'ag-marbles' }, s);
  return s;
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const timers = new WeakMap(), painters = new WeakMap();
function later(th, fn, ms) { clearTimeout(timers.get(th)); timers.set(th, setTimeout(() => { timers.delete(th); fn(); }, ms)); }
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function mount(th, stageApi) {
  th.state = upgrade(th.state);
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card aggravation-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(452px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Star Marbles</span><span class="g-sub"></span></div>';
  const sub = el.querySelector('.g-sub');
  const board = boardSvg();
  const wrap = document.createElement('div'); wrap.className = 'g-board ag-wrap'; wrap.appendChild(board);
  const bar = document.createElement('div'); bar.className = 'g-bar';
  const die = document.createElement('div'); die.className = 'ag-die'; die.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 9; i++) die.appendChild(document.createElement('i'));
  const status = document.createElement('div'); status.className = 'g-status'; status.setAttribute('aria-live', 'polite');
  const rollBtn = document.createElement('button'); rollBtn.type = 'button'; rollBtn.className = 'g-btn g-primary ag-roll'; rollBtn.textContent = 'Roll';
  bar.append(die, status, rollBtn);
  const foot = document.createElement('div'); foot.className = 'g-foot';
  const opp = document.createElement('div'); opp.className = 'g-seg'; opp.setAttribute('role', 'group'); opp.setAttribute('aria-label', 'computer players');
  opp.innerHTML = '<span>vs</span>' + [1, 2, 3].map((n) => '<button type="button" data-opp="' + n + '">' + n + ' bot' + (n > 1 ? 's' : '') + '</button>').join('');
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  foot.append(opp, again);
  const rules = document.createElement('div'); rules.className = 'g-rules';
  rules.textContent = 'Roll 1 or 6 to leave base; 6 rolls again. Land on a marble to send it home. Start a turn on a gold corner to hop the shortcut; the centre is one past a corner, and you leave it on a 1. Exact count home.';
  el.append(wrap, bar, foot, rules);
  for (const b of el.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-pick], [data-to]')) e.stopPropagation(); });

  let picked = null;
  const humanTurn = () => th.state.winner == null && th.state.turn === th.state.human;
  const myMoves = () => (humanTurn() && th.state.dice != null ? movesFor(th.state, th.state.turn, th.state.dice) : []);
  const posXY = (c, m, p) => (p === 'b' ? baseXY(c, m) : holeXY(p, c));
  function commit(next) { th.state = next; picked = null; stageApi.save && stageApi.save(); paintLive(); schedule(); }
  function paintLive() { const fn = painters.get(th); if (fn) fn(); }
  function paint() {
    const s = th.state, moves = myMoves();
    const g = board.querySelector('.ag-marbles'), tg = board.querySelector('.ag-targets');
    // marbles keep their element so a move glides
    const have = new Map([...g.children].map((n) => [n.dataset.k, n]));
    s.seats.forEach((c) => s.marbles[c].forEach((p, m) => {
      const k = c + ':' + m; let n = have.get(k);
      if (!n) {
        n = svgEl('g', { 'data-k': k, class: 'ag-marble' }, g);
        svgEl('circle', { r: 7.6, fill: 'url(#agM_' + COLORS[c] + ')', filter: 'url(#agShadow)' }, n);
        svgEl('circle', { r: 11, class: 'ag-ring', fill: 'none' }, n);
      }
      have.delete(k);
      const [x, y] = posXY(c, m, p);
      n.style.transform = 'translate(' + r1(x) + 'px,' + r1(y) + 'px)';
      const can = moves.some((mv) => mv.marble === m) && c === s.human;
      n.classList.toggle('can', can); n.classList.toggle('picked', can && picked === m);
      if (can) { n.setAttribute('data-pick', m); n.setAttribute('role', 'button'); n.setAttribute('aria-label', 'your marble ' + (m + 1)); } else { n.removeAttribute('data-pick'); n.removeAttribute('role'); }
      n.classList.toggle('last', !!(s.last && s.last.color === c && s.last.marble === m));
    }));
    for (const n of have.values()) n.remove();
    tg.innerHTML = '';
    const show = picked != null ? moves.filter((mv) => mv.marble === picked) : [];
    for (const mv of show) { const [x, y] = posXY(s.human, mv.marble, mv.to); const t = svgEl('circle', { cx: r1(x), cy: r1(y), r: 9.5, class: 'ag-target', 'data-to': JSON.stringify(mv.to) }, tg); t.setAttribute('role', 'button'); t.setAttribute('aria-label', 'move here'); }
    // die face
    const face = PIPS[s.dice || s.face] || [];
    [...die.children].forEach((pip, i) => pip.classList.toggle('on', face.includes(i)));
    die.style.setProperty('--ag-col', HEX[COLORS[s.turn]]);
    die.classList.toggle('blank', !s.dice);
    if (s.dice && die.dataset.had !== '1' && die.dataset.painted === '1') rattle(); // a fresh roll (anyone's) rattles; not on reopening
    die.dataset.had = s.dice ? '1' : ''; die.dataset.painted = '1';
    rollBtn.disabled = !humanTurn() || s.dice != null;
    sub.textContent = s.seats.length - 1 + ' computer player' + (s.seats.length > 2 ? 's' : '');
    for (const b of opp.querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset.opp) === s.seats.length - 1);
    const who = (c) => (c === s.human ? 'you' : COLORS[c]);
    status.innerHTML = '';
    const dot = document.createElement('span'); dot.className = 'g-dot'; dot.style.background = HEX[COLORS[s.winner != null ? s.winner : s.turn]]; status.appendChild(dot);
    let line;
    if (s.winner != null) line = s.winner === s.human ? 'You win! All four home.' : COLORS[s.winner] + ' wins this one.';
    else if (humanTurn()) line = s.dice == null ? (s.last && s.last.bumped === s.human ? 'Aggravated! ' : '') + 'Your roll' : moves.length ? (picked != null ? 'Rolled ' + s.dice + ' · pick a glowing hole' : 'Rolled ' + s.dice + ' · pick a marble') : 'Rolled ' + s.dice + ' · no move';
    else line = who(s.turn)[0].toUpperCase() + who(s.turn).slice(1) + (s.dice ? ' rolled ' + s.dice : ' is rolling…');
    status.appendChild(document.createTextNode(line));
  }
  painters.set(th, paint);
  function schedule() {
    const s = th.state; if (s.winner != null) return;
    const slow = reduced() ? 0.5 : 1;
    if (s.turn !== s.human) {
      if (s.dice == null) later(th, () => { commit(roll(th.state)); }, 520 * slow);
      else later(th, () => { const st = th.state, mv = botMove(st, st.turn, st.dice); commit(mv ? move(st, st.turn, mv) : pass(st)); }, 620 * slow);
    } else if (s.dice != null && !movesFor(s, s.turn, s.dice).length) later(th, () => commit(pass(th.state)), 1100 * slow);
  }
  rollBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!humanTurn() || th.state.dice != null) return; // locked until the move is made
    if (!reduced()) { die.classList.remove('tumble'); void die.offsetWidth; die.classList.add('tumble'); }
    commit(roll(th.state));
    const moves = myMoves(); if (moves.length && new Set(moves.map((m) => m.marble)).size === 1) { picked = moves[0].marble; paint(); }
  });
  board.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target.closest('[data-to]'), pk = e.target.closest('[data-pick]');
    const moves = myMoves(); if (!moves.length) return;
    if (t && picked != null) { const to = JSON.parse(t.getAttribute('data-to')); const mv = moves.find((m) => m.marble === picked && m.to === to); if (mv) commit(move(th.state, th.state.human, mv)); return; }
    if (pk) {
      const m = Number(pk.getAttribute('data-pick')), mine = moves.filter((mv) => mv.marble === m);
      if (mine.length === 1) commit(move(th.state, th.state.human, mine[0])); else { picked = m; paint(); }
    }
  });
  opp.addEventListener('click', (e) => { const b = e.target.closest('[data-opp]'); if (!b) return; e.stopPropagation(); commit(createState({ opponents: Number(b.dataset.opp) })); });
  again.addEventListener('click', (e) => { e.stopPropagation(); commit(createState({ opponents: th.state.seats.length - 1 })); });
  paint();
  schedule();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  // the board stands in the void in 3D (skills/mini/aggravation.js), the rest of the card beside it; the 2D board stays the fallback
  let still = null; // the board without its marbles and targets, as an SVG string: the 3D board's top
  lift3d(th, stageApi, el, { kind: 'aggravation', board, title: 'Star Marbles', W: 460, H: 400, snapshot: () => {
    if (!still) {
      const copy = board.cloneNode(true);
      for (const n of copy.querySelectorAll('.ag-marbles > *, .ag-targets > *')) n.remove();
      copy.setAttribute('xmlns', NS); copy.setAttribute('width', '400'); copy.setAttribute('height', '400');
      still = new XMLSerializer().serializeToString(copy);
    }
    const xy = (n) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(n.style.transform || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
    return {
      svg: still,
      // every hole on the board, so the 3D board is drilled where the marbles sit
      holes: [...board.querySelectorAll('[data-hole]')].map((n) => ({ x: +n.getAttribute('cx'), y: +n.getAttribute('cy'), r: +n.getAttribute('r') })),
      marbles: [...board.querySelectorAll('.ag-marble')].map((n) => { const [x, y] = xy(n); return { sel: '[data-k="' + n.dataset.k + '"]', x, y, color: HEX[COLORS[+n.dataset.k.split(':')[0]]], can: n.classList.contains('can'), picked: n.classList.contains('picked'), last: n.classList.contains('last') }; }),
      targets: [...board.querySelectorAll('.ag-target')].map((n, i) => ({ sel: '.ag-targets > :nth-child(' + (i + 1) + ')', x: +n.getAttribute('cx'), y: +n.getAttribute('cy') })),
    };
  } });
}

async function run(text, api) {
  if (!aggravationOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'aggravation');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'aggravation'; }
  api.summon('aggravation', { state: createState(), center: true });
  api.say('Star Marbles (plays like Aggravation) · you are red · roll a 1 or 6 to leave base');
  return 'aggravation';
}

export default {
  name: 'aggravation',
  aggravationOf,
  createState,
  roll,
  movesFor,
  move,
  pass,
  botMove,
  examples: ['aggravation', 'play aggravation', "let's play aggravation", 'a game of aggravation'],
  nearMisses: ['connect 4', 'dots and boxes', 'marbles', 'mancala'],
  match(lower, text) { return !!aggravationOf(text); },
  run,
  stageKinds: { aggravation: { mount } },
  suite() {
    const s0 = createState({ opponents: 3 });
    const at = (marbles, turn = 0, dice = null) => ({ ...createState({ opponents: 3 }), marbles, turn, dice });
    const B = ['b', 'b', 'b', 'b'];
    const enter1 = movesFor(s0, 0, 1), enter3 = movesFor(s0, 0, 3), blueStart = movesFor(s0, 1, 6);
    // a capture: red on 10 rolls 4 onto blue's marble at 14
    const cap = at([[10, 'b', 'b', 'b'], [14, 'b', 'b', 'b'], B, B], 0, 4);
    const capMv = movesFor(cap, 0, 4).find((m) => m.to === 14), capped = capMv && move(cap, 0, capMv);
    // the shortcut: red on star 7 rolls 2 -> corner 21 then one more, or the centre path
    const sc = at([[7, 'b', 'b', 'b'], B, B, B], 0, 2), scMoves = movesFor(sc, 0, 2).map((m) => m.to);
    // own marbles block: red on 3 and 5 cannot move the 3 by 2 or 3
    const blk = at([[3, 5, 'b', 'b'], B, B, B], 0, 3), blkTo = movesFor(blk, 0, 3).filter((m) => m.marble === 0).map((m) => m.to);
    // home needs the exact count: red at progress 54 (track 55) with a 6 overshoots h3
    const hm = at([[55, 'b', 'b', 'b'], B, B, B], 0, 6), hm2 = movesFor(at([[55, 'b', 'b', 'b'], B, B, B], 0, 3), 0, 3);
    // centre: leave only on a 1, onto any star
    const ctr = at([['c', 'b', 'b', 'b'], B, B, B], 0, 1), ctrTo = movesFor(ctr, 0, 1).filter((m) => m.marble === 0).map((m) => m.to).sort((a, b) => a - b);
    // the roll is locked while a move is pending; a 6 rolls again
    const rolled = roll(s0, () => 0.99), locked = roll(rolled, () => 0);
    const six = move(rolled, 0, movesFor(rolled, 0, 6)[0]);
    const win = at([['h1', 'h2', 'h3', 0], B, B, B], 0, 1), won = move(win, 0, movesFor(win, 0, 1).find((m) => m.marble === 3));
    const ok = enter1.length === 1 && enter1[0].to === 1 && enter3.length === 0 && blueStart[0].to === 15
      && !!capped && capped.marbles[1][0] === 'b' && capped.last.bumped === 1
      && scMoves.includes(9) && scMoves.includes(22) && scMoves.includes(35)
      && movesFor(at([[6, 'b', 'b', 'b'], B, B, B], 0, 2), 0, 2).some((m) => m.to === 'c')
      && blkTo.length === 0
      && movesFor(hm, 0, 6).filter((m) => m.marble === 0).length === 0 && hm2.some((m) => m.to === 'h1')
      && ctrTo.join() === STARS.join() && movesFor(ctr, 0, 2).filter((m) => m.marble === 0).length === 0
      && rolled.dice === 6 && locked === rolled && six.turn === 0
      && won.winner === 0
      && movesFor(at([[49, 'b', 'b', 'b'], B, B, B], 0, 1), 0, 1).every((m) => m.to !== 7)
      && !!aggravationOf('play aggravation') && !aggravationOf('marbles');
    return { ok, got: JSON.stringify({ enter1: enter1.length, scMoves, blkTo, ctrTo, six: six.turn, won: won.winner }) };
  },
};
