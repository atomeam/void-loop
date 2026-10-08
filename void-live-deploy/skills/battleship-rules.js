/**
 * battleship-rules — Battleship in plain JS (no DOM, no three.js), shared by the card (skills/battleship.js), its 3D board
 * and the tests. Next after Monopoly (Adam, 2026-10-08): the game of hidden state. Void keeps a fleet you cannot see,
 * and every answer it gives (miss, hit, sunk) has to stay consistent with that hidden fleet; Void's own shots use only
 * what it has been told, never your ship positions, and each one records why it was chosen.
 *
 * Grid 10 x 10, cell = row * 10 + col (row 0 = A, col 0 = 1). Fleet: carrier 5, battleship 4, cruiser 3, submarine 3,
 * destroyer 2. Ships don't touch ends or sides is NOT a rule here (the classic game lets them touch).
 *   create({ seed }) -> state      fire(s, cell) -> { s, result }      voidFire(s) -> { s, result, why }
 *   view(s, side) -> what that side may see of the board: its own fleet, and only shots on the other
 *   placeRandom(s, side) -> s (re-deal a fleet before the first shot)
 */
export const N = 10;
export const FLEET = [['Carrier', 5], ['Battleship', 4], ['Cruiser', 3], ['Submarine', 3], ['Destroyer', 2]];
export const cellName = (c) => 'ABCDEFGHIJ'[Math.floor(c / N)] + (c % N + 1);

function next(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const clone = (s) => JSON.parse(JSON.stringify(s));

function deal(s) {
  const taken = new Set(), ships = [];
  for (const [name, len] of FLEET) {
    for (let tries = 0; tries < 500; tries++) {
      const across = next(s) < 0.5, r = Math.floor(next(s) * (across ? N : N - len + 1)), c = Math.floor(next(s) * (across ? N - len + 1 : N));
      const cells = Array.from({ length: len }, (_, k) => (across ? r * N + c + k : (r + k) * N + c));
      if (cells.some((x) => taken.has(x))) continue;
      cells.forEach((x) => taken.add(x)); ships.push({ name, cells }); break;
    }
  }
  return ships;
}

export function create({ seed = (Math.random() * 4294967296) >>> 0 } = {}) {
  const s = { rng: seed >>> 0, turn: 'you', over: null, shots: { you: {}, void: {} }, log: [] };
  s.fleet = { you: deal(s), void: deal(s) };
  return s;
}
export function placeRandom(s0, side = 'you') {
  if (Object.keys(s0.shots.you).length || Object.keys(s0.shots.void).length) return s0; // only before the first shot
  const s = clone(s0); s.fleet[side] = deal(s); return s;
}

const other = (side) => (side === 'you' ? 'void' : 'you');
const sunk = (ship, shots) => ship.cells.every((c) => shots[c]);
// shoot at the other side's fleet: the answer comes from its (hidden) fleet, and only the answer is kept on the shooter's side
function shoot(s, side, cell) {
  const foe = other(side), shots = s.shots[side];
  if (s.over || s.turn !== side || !(cell >= 0 && cell < N * N) || shots[cell]) return null;
  const ship = s.fleet[foe].find((sh) => sh.cells.includes(cell));
  shots[cell] = ship ? 'hit' : 'miss';
  let result = ship ? 'hit' : 'miss';
  if (ship && sunk(ship, shots)) { result = 'sunk'; for (const c of ship.cells) shots[c] = 'sunk'; }
  const sank = result === 'sunk' ? ship.name : null;
  s.log.push({ who: side === 'you' ? 'You' : 'Void', text: 'fired at ' + cellName(cell) + ': ' + (sank ? 'sank the ' + sank : result) });
  if (s.fleet[foe].every((sh) => sunk(sh, shots))) { s.over = side; s.log.push({ who: side === 'you' ? 'You' : 'Void', text: 'sank the whole fleet' }); }
  else if (result === 'miss') s.turn = foe; // a hit fires again
  return { result, sank, cell };
}
export function fire(s0, cell) { const s = clone(s0), r = shoot(s, 'you', cell); return r ? { s, result: r.result, sank: r.sank } : { s: s0, result: null }; }

// What a side may see: its own fleet and the shots the other side has taken at it, but of the other fleet only its own
// shot results (and a ship's cells once it is sunk). The card draws only this, so Void's fleet can't leak to the screen.
export function view(s, side) {
  const foe = other(side), mine = s.shots[side];
  return {
    own: { ships: s.fleet[side].map((sh) => ({ name: sh.name, cells: sh.cells.slice(), sunk: sunk(sh, s.shots[foe]) })), shotsAt: { ...s.shots[foe] } },
    target: { shots: { ...mine }, sunk: s.fleet[foe].filter((sh) => sunk(sh, mine)).map((sh) => ({ name: sh.name, cells: sh.cells.slice() })), afloat: s.fleet[foe].filter((sh) => !sunk(sh, mine)).map((sh) => sh.name) },
    turn: s.turn, over: s.over,
  };
}

// Void's shot, from what it has been told only (view(s, 'void').target): finish a ship it has hit, along the line
// when two hits line up; otherwise hunt on a checkerboard, preferring cells where the most remaining ships still fit.
export function chooseShot(seen, rnd = Math.random) {
  const shots = seen.shots, open = (c) => c >= 0 && c < N * N && !shots[c];
  const hits = Object.keys(shots).map(Number).filter((c) => shots[c] === 'hit');
  const nb = (c) => [c - N, c + N, c % N ? c - 1 : -1, c % N < N - 1 ? c + 1 : -1].filter((x) => x >= 0 && x < N * N);
  if (hits.length) {
    for (const h of hits) for (const d of [1, N]) {
      if (!hits.includes(h + d) || (d === 1 && (h % N) === N - 1)) continue;
      let a = h; while (hits.includes(a - d) && !(d === 1 && a % N === 0)) a -= d;
      let b = h + d; while (hits.includes(b + d) && !(d === 1 && b % N === N - 1)) b += d;
      const ends = [d === 1 && a % N === 0 ? -1 : a - d, d === 1 && b % N === N - 1 ? -1 : b + d].filter(open);
      if (ends.length) return { cell: ends[0], why: 'two hits line up from ' + cellName(a) + ' to ' + cellName(b) + ': the ship runs on along that line' };
    }
    for (const h of hits) { const n = nb(h).filter(open); if (n.length) return { cell: n[Math.floor(rnd() * n.length)], why: 'it hit ' + cellName(h) + ' and the ship must run through a square next to it' }; }
  }
  const left = FLEET.filter(([name]) => !seen.sunk.some((x) => x.name === name)).map(([, len]) => len);
  const score = Array(N * N).fill(0);
  for (const len of left) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const across of [true, false]) {
    const cells = Array.from({ length: len }, (_, k) => (across ? (c + k < N ? r * N + c + k : -1) : (r + k < N ? (r + k) * N + c : -1)));
    if (cells.every((x) => x >= 0 && !shots[x])) for (const x of cells) score[x]++;
  }
  const smallest = Math.min(...left);
  let best = -1, bestScore = -1;
  for (let c = 0; c < N * N; c++) if (!shots[c] && score[c] && (Math.floor(c / N) + (c % N)) % Math.max(2, smallest) === 0 && score[c] + rnd() > bestScore) { best = c; bestScore = score[c] + rnd(); }
  if (best < 0) for (let c = 0; c < N * N; c++) if (!shots[c] && score[c] + rnd() > bestScore) { best = c; bestScore = score[c] + rnd(); }
  return { cell: best, why: 'no ship is half-found, so it hunts where the most of your unsunk ships could still fit' };
}
export function voidFire(s0) {
  const s = clone(s0);
  if (s.over || s.turn !== 'void') return { s: s0, result: null };
  const pick = chooseShot(view(s, 'void').target, () => next(s)); // Void sees only what it has been told
  const r = shoot(s, 'void', pick.cell);
  s.log[s.log.length - (s.over ? 2 : 1)].why = pick.why;
  return { s, result: r.result, sank: r.sank, why: pick.why };
}
