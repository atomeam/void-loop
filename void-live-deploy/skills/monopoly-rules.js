/**
 * monopoly-rules — a property-trading board game with Monopoly's rules, in plain JS (no DOM, no three.js), shared by the
 * card (skills/monopoly.js), its 3D board and the tests. Asked for by Adam, 2026-10-08, as the next game: it is the first
 * one where money and ownership persist across a long run of turns, and where Void plays seats of its own.
 * The rules and numbers are the classic ones; the street names, the cards' wording and the look are our own.
 *
 * What a seat can do is what the rules allow, and every act is named for what it is:
 *  - a roll moves you; landing can force things you did not choose (rent, tax, a card, jail): the log says "forced"
 *  - buying is always the buyer's own choice (Buy / Don't buy); nothing is bought automatically
 *  - a trade is an offer the other seat accepts or declines; Void says why
 *  - Void's seats choose like players (no peeking at the dice or the decks) and record why each choice was made
 *
 *   create({ voids = 1, seed }) -> state      roll(s) -> s      buy(s, yes) -> s      build(s, i) -> s      endTurn(s) -> s
 *   payJail(s) -> s      offer(s, { space, cash }) -> { s, accepted, why }      voidTurn(s) -> s (one whole Void turn)
 *   rentFor(s, i, diceSum) -> number      canBuild(s, p, i) -> bool      worth(s, p) -> number
 * Not yet: auctions, mortgages, trades Void starts, house shortages.
 */
export const START_MONEY = 1500, GO_PAY = 200, JAIL = 10, GO_TO_JAIL = 30, JAIL_FINE = 50;

// t: kind; g: colour group; p: price; r: rent with 0..4 houses and a hotel; h: house cost
const P = (n, g, p, r, h) => ({ t: 'street', n, g, p, r, h });
export const SPACES = [
  { t: 'go', n: 'Go' }, P('Old Mill Row', 'brown', 60, [2, 10, 30, 90, 160, 250], 50), { t: 'chest', n: 'Community Chest' },
  P('Cinder Lane', 'brown', 60, [4, 20, 60, 180, 320, 450], 50), { t: 'tax', n: 'Income Tax', pay: 200 },
  { t: 'station', n: 'North Station', p: 200 }, P('Harbor Walk', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { t: 'chance', n: 'Chance' }, P('Lantern Street', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  P('Kite Hill', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50), { t: 'jail', n: 'Jail' },
  P('Orchard Avenue', 'pink', 140, [10, 50, 150, 450, 625, 750], 100), { t: 'utility', n: 'Power Works', p: 150 },
  P('Signal Street', 'pink', 140, [10, 50, 150, 450, 625, 750], 100), P('Copper Row', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { t: 'station', n: 'East Station', p: 200 }, P('Maple Court', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { t: 'chest', n: 'Community Chest' }, P('Foundry Lane', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P('Beacon Road', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100), { t: 'parking', n: 'Free Parking' },
  P('Market Square', 'red', 220, [18, 90, 250, 700, 875, 1050], 150), { t: 'chance', n: 'Chance' },
  P('Glass Street', 'red', 220, [18, 90, 250, 700, 875, 1050], 150), P('Union Avenue', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { t: 'station', n: 'South Station', p: 200 }, P('Sunrise Terrace', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P('Meadow Drive', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150), { t: 'utility', n: 'Water Works', p: 150 },
  P('Goldfinch Way', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150), { t: 'gotojail', n: 'Go to Jail' },
  P('Cedar Park', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200), P('Granite Way', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { t: 'chest', n: 'Community Chest' }, P('Summit Avenue', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { t: 'station', n: 'West Station', p: 200 }, { t: 'chance', n: 'Chance' },
  P('Skyline Drive', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200), { t: 'tax', n: 'Luxury Tax', pay: 100 },
  P('Crown Heights', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];
export const GROUP = {};
SPACES.forEach((s, i) => { if (s.g) (GROUP[s.g] = GROUP[s.g] || []).push(i); });
export const buyable = (i) => !!SPACES[i].p;

// cards: what they do, in our own words
const CHANCE = [
  { n: 'Advance to Go. Collect 200.', go: 0 }, { n: 'Advance to Union Avenue.', go: 24 }, { n: 'Advance to Orchard Avenue.', go: 11 },
  { n: 'Advance to the nearest station.', near: 'station' }, { n: 'Go back three spaces.', back: 3 }, { n: 'Go to Jail.', jail: true },
  { n: 'The bank pays you a dividend of 50.', cash: 50 }, { n: 'Get out of Jail free. Keep this card.', free: true },
  { n: 'Speeding fine: pay 15.', cash: -15 }, { n: 'Your building loan matures. Collect 150.', cash: 150 },
];
const CHEST = [
  { n: 'Advance to Go. Collect 200.', go: 0 }, { n: 'Bank error in your favour. Collect 200.', cash: 200 }, { n: 'Doctor’s fee: pay 50.', cash: -50 },
  { n: 'You sell some stock. Collect 50.', cash: 50 }, { n: 'Go to Jail.', jail: true }, { n: 'Get out of Jail free. Keep this card.', free: true },
  { n: 'Holiday fund matures. Collect 100.', cash: 100 }, { n: 'Tax refund. Collect 20.', cash: 20 }, { n: 'Hospital bill: pay 100.', cash: -100 },
  { n: 'You inherit 100.', cash: 100 },
];

// a seeded generator kept in the state, so a game reloads and replays exactly (and tests are fixed)
function next(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const die = (s) => 1 + Math.floor(next(s) * 6);
function shuffled(s, n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = (s) => JSON.parse(JSON.stringify(s));

export function create({ voids = 1, seed = (Math.random() * 4294967296) >>> 0 } = {}) {
  const n = Math.max(1, Math.min(3, voids | 0 || 1));
  const s = {
    players: [{ name: 'You', seat: 'you', money: START_MONEY, pos: 0, jail: 0, free: 0, out: false }],
    owner: {}, houses: {}, turn: 0, phase: 'roll', dice: null, doubles: 0, pending: null, rng: seed >>> 0, moves: 0, log: [], winner: null,
  };
  for (let k = 0; k < n; k++) s.players.push({ name: n === 1 ? 'Void' : 'Void ' + (k + 1), seat: 'void', money: START_MONEY, pos: 0, jail: 0, free: 0, out: false });
  s.decks = { chance: shuffled(s, CHANCE.length), chest: shuffled(s, CHEST.length) };
  return s;
}

const say = (s, p, text, extra = {}) => { s.log.push({ who: p == null ? null : s.players[p].name, text, ...extra }); if (s.log.length > 200) s.log.splice(0, s.log.length - 200); };
export const owned = (s, p) => Object.keys(s.owner).map(Number).filter((i) => s.owner[i] === p);
export const hasSet = (s, p, g) => GROUP[g].every((i) => s.owner[i] === p);
export function worth(s, p) { return s.players[p].money + owned(s, p).reduce((a, i) => a + SPACES[i].p + (s.houses[i] || 0) * (SPACES[i].h || 0), 0); }

export function rentFor(s, i, sum = 7) {
  const sp = SPACES[i], o = s.owner[i];
  if (o == null) return 0;
  if (sp.t === 'station') return 25 * 2 ** (owned(s, o).filter((j) => SPACES[j].t === 'station').length - 1);
  if (sp.t === 'utility') return sum * (owned(s, o).filter((j) => SPACES[j].t === 'utility').length === 2 ? 10 : 4);
  const h = s.houses[i] || 0;
  return h ? sp.r[h] : sp.r[0] * (hasSet(s, o, sp.g) ? 2 : 1);
}

// money moves; a seat that can't pay sells houses at half price (forced), then is out, its property going to the creditor
function pay(s, p, amount, to = null, why = '') {
  const pl = s.players[p];
  pl.money -= amount;
  if (to != null) s.players[to].money += amount;
  if (pl.money >= 0) return;
  for (const i of owned(s, p).sort((a, b) => (SPACES[b].h || 0) - (SPACES[a].h || 0))) {
    while ((s.houses[i] || 0) > 0 && pl.money < 0) { s.houses[i]--; pl.money += SPACES[i].h / 2; say(s, p, 'sold a house on ' + SPACES[i].n + ' for ' + SPACES[i].h / 2 + ' to pay' + (why ? ' ' + why : ''), { forced: true }); }
  }
  if (pl.money >= 0) return;
  pl.out = true;
  for (const i of owned(s, p)) { if (to != null) s.owner[i] = to; else delete s.owner[i]; delete s.houses[i]; }
  if (to != null) s.players[to].money += pl.money; // the creditor gets what was left (the debt beyond it is lost)
  pl.money = 0;
  say(s, p, 'is out: could not pay' + (why ? ' ' + why : ''), { forced: true });
  const left = s.players.map((x, k) => (x.out ? -1 : k)).filter((k) => k >= 0);
  // the game is over when one seat is left, or when you are out (the Void seats don't play on without you): the richest left wins
  if (left.length === 1 || s.players[0].out) { s.winner = left.sort((a, b) => worth(s, b) - worth(s, a))[0]; s.phase = 'over'; say(s, s.winner, 'wins'); }
}

function moveTo(s, p, dest, { passGo = true } = {}) {
  const pl = s.players[p];
  if (passGo && dest < pl.pos) { pl.money += GO_PAY; say(s, p, 'passed Go and collected ' + GO_PAY); }
  pl.pos = dest;
}
function toJail(s, p, why) { const pl = s.players[p]; pl.pos = JAIL; pl.jail = 1; s.doubles = 0; say(s, p, 'went to Jail: ' + why, { forced: true }); }

function land(s, p, sum) {
  const pl = s.players[p], i = pl.pos, sp = SPACES[i];
  if (sp.t === 'gotojail') return toJail(s, p, 'landed on Go to Jail');
  if (sp.t === 'tax') { say(s, p, 'paid ' + sp.pay + ' ' + sp.n, { forced: true }); return pay(s, p, sp.pay, null, sp.n); }
  if (sp.t === 'chance' || sp.t === 'chest') {
    const deck = s.decks[sp.t], k = deck.shift(); deck.push(k);
    const c = (sp.t === 'chance' ? CHANCE : CHEST)[k];
    say(s, p, 'drew ' + sp.n + ': ' + c.n, { forced: true });
    if (c.cash) return c.cash > 0 ? (pl.money += c.cash) : pay(s, p, -c.cash, null, 'the card');
    if (c.free) { pl.free++; return; }
    if (c.jail) return toJail(s, p, 'the card');
    if (c.back) { pl.pos = (pl.pos + 40 - c.back) % 40; return land(s, p, sum); }
    if (c.go != null) { moveTo(s, p, c.go); return c.go === 0 ? undefined : land(s, p, sum); }
    if (c.near) { let j = (pl.pos + 1) % 40; while (SPACES[j].t !== c.near) j = (j + 1) % 40; moveTo(s, p, j); return land(s, p, sum); }
    return;
  }
  if (!buyable(i)) return;
  const o = s.owner[i];
  if (o == null) { s.pending = { buy: i }; s.phase = 'buy'; return; }
  if (o === p || s.players[o].out) return;
  const rent = rentFor(s, i, sum);
  say(s, p, 'paid ' + rent + ' rent to ' + s.players[o].name + ' for ' + sp.n, { forced: true });
  pay(s, p, rent, o, 'rent on ' + sp.n);
}

export function roll(s0, dice = null) { // dice: [a, b] to fix the roll (tests); otherwise the state's own generator
  const s = clone(s0), p = s.turn, pl = s.players[p];
  if (s.phase !== 'roll' || pl.out) return s0;
  const a = dice ? dice[0] : die(s), b = dice ? dice[1] : die(s), dbl = a === b;
  s.dice = [a, b]; s.moves++;
  if (pl.jail) {
    if (dbl) { pl.jail = 0; say(s, p, 'rolled ' + a + '+' + b + ', doubles: out of Jail'); }
    else if (pl.jail >= 3) { say(s, p, 'rolled ' + a + '+' + b + ' on the third try and paid the ' + JAIL_FINE + ' fine', { forced: true }); pl.jail = 0; pay(s, p, JAIL_FINE, null, 'the Jail fine'); if (pl.out) return finish(s); }
    else { pl.jail++; say(s, p, 'rolled ' + a + '+' + b + ', still in Jail'); s.phase = 'end'; return s; }
    s.doubles = 0; // leaving Jail on doubles does not roll again
  } else if (dbl) {
    s.doubles++;
    if (s.doubles === 3) { say(s, p, 'rolled doubles three times'); toJail(s, p, 'three doubles in a row'); s.phase = 'end'; return s; }
  } else s.doubles = 0;
  say(s, p, 'rolled ' + a + '+' + b);
  moveTo(s, p, (pl.pos + a + b) % 40);
  land(s, p, a + b);
  return finish(s);
}
function finish(s) {
  if (s.phase === 'over' || s.phase === 'buy') return s;
  const pl = s.players[s.turn];
  s.phase = !pl.out && !pl.jail && s.doubles > 0 ? 'roll' : 'end';
  return s;
}

export function buy(s0, yes) {
  const s = clone(s0), p = s.turn, i = s.pending && s.pending.buy;
  if (s.phase !== 'buy' || i == null) return s0;
  if (yes && s.players[p].money >= SPACES[i].p) { s.players[p].money -= SPACES[i].p; s.owner[i] = p; say(s, p, 'bought ' + SPACES[i].n + ' for ' + SPACES[i].p); }
  else say(s, p, 'did not buy ' + SPACES[i].n);
  s.pending = null; s.phase = 'roll';
  return finish(s);
}

export function canBuild(s, p, i) {
  const sp = SPACES[i];
  if (sp.t !== 'street' || s.owner[i] !== p || !hasSet(s, p, sp.g) || (s.houses[i] || 0) >= 5 || s.players[p].money < sp.h) return false;
  const h = s.houses[i] || 0; // build evenly: never more than one ahead of the rest of the set
  return GROUP[sp.g].every((j) => (s.houses[j] || 0) >= h);
}
export function build(s0, i) {
  const s = clone(s0), p = s.turn;
  if (s.players[p].out || !canBuild(s, p, i)) return s0;
  s.players[p].money -= SPACES[i].h; s.houses[i] = (s.houses[i] || 0) + 1;
  say(s, p, 'built ' + (s.houses[i] === 5 ? 'a hotel' : 'house ' + s.houses[i]) + ' on ' + SPACES[i].n + ' for ' + SPACES[i].h);
  return s;
}

export function payJail(s0) {
  const s = clone(s0), p = s.turn, pl = s.players[p];
  if (!pl.jail || s.phase !== 'roll') return s0;
  if (pl.free) { pl.free--; say(s, p, 'used a Get out of Jail free card'); }
  else if (pl.money >= JAIL_FINE) { pl.money -= JAIL_FINE; say(s, p, 'paid ' + JAIL_FINE + ' to leave Jail'); }
  else return s0;
  pl.jail = 0;
  return s;
}

export function endTurn(s0) {
  const s = clone(s0);
  if (s.phase !== 'end') return s0;
  s.doubles = 0; s.dice = null;
  let k = s.turn;
  do k = (k + 1) % s.players.length; while (s.players[k].out);
  s.turn = k; s.phase = 'roll';
  return s;
}

// ---- Void's seats: it chooses like a player and says why (the why goes in the log and to Void's reflections) ----
const RESERVE = 150;
function setsWouldComplete(s, p, i) { const g = SPACES[i].g; return !!g && GROUP[g].every((j) => j === i || s.owner[j] === p); }
export function voidWantsToBuy(s, p, i) {
  const sp = SPACES[i], cash = s.players[p].money, left = cash - sp.p;
  if (left < 0) return { yes: false, why: 'cannot afford it (' + cash + ' on hand)' };
  if (setsWouldComplete(s, p, i) && left >= 50) return { yes: true, why: 'it completes the ' + sp.g + ' set' };
  if (sp.g && GROUP[sp.g].some((j) => s.owner[j] != null && s.owner[j] !== p) && left < RESERVE * 2)
    return { yes: false, why: 'another player already holds part of the ' + sp.g + ' set and cash is tight' };
  if (left >= RESERVE) return { yes: true, why: 'it can afford it and keep ' + left + ' in reserve' };
  return { yes: false, why: 'buying would leave only ' + left + ', under its ' + RESERVE + ' reserve' };
}
// one whole turn for the Void seat whose turn it is: jail, roll, buy, build, end
export function voidTurn(s0) {
  let s = clone(s0);
  const p = s.turn;
  if (s.players[p].seat !== 'void' || s.players[p].out || s.phase === 'over') return s0;
  for (let guard = 0; guard < 12 && s.turn === p && s.phase !== 'over'; guard++) {
    const pl = s.players[p];
    if (s.phase === 'roll' && pl.jail) {
      const early = owned(s, p).length < 4 && Object.keys(s.owner).length < 20;
      if (early && (pl.free || pl.money >= JAIL_FINE + RESERVE)) { s = payJail(s); say(s, p, 'chose to leave Jail at once', { why: 'there is still property to buy' }); }
      else say(s, p, 'chose to stay in Jail and roll', { why: early ? 'cash is low' : 'most property is owned: Jail is a safe place to wait' });
    }
    if (s.phase === 'roll') { s = roll(s); continue; }
    if (s.phase === 'buy') {
      const i = s.pending.buy, d = voidWantsToBuy(s, p, i);
      s = buy(s, d.yes); s.log[s.log.length - 1].why = d.why; continue;
    }
    if (s.phase === 'end') {
      // build evenly on the set it can best afford, keeping a reserve
      let built = true;
      while (built) {
        built = false;
        const options = owned(s, p).filter((i) => canBuild(s, p, i) && s.players[p].money - SPACES[i].h >= RESERVE).sort((a, b) => (s.houses[a] || 0) - (s.houses[b] || 0) || SPACES[b].p - SPACES[a].p);
        if (options.length) { s = build(s, options[0]); s.log[s.log.length - 1].why = 'it owns the whole ' + SPACES[options[0]].g + ' set and keeps ' + RESERVE + ' in reserve'; built = true; }
      }
      s = endTurn(s);
    }
  }
  return s;
}

// a trade is an offer: you offer cash for one of a Void seat's properties; Void accepts or declines and says why
export function offer(s0, { space, cash }) {
  const i = Number(space), c = Math.floor(Number(cash) || 0), me = s0.turn, o = s0.owner[i];
  if (s0.players[me].seat !== 'you' || o == null || s0.players[o].seat !== 'void' || s0.players[o].out || c <= 0 || c > s0.players[me].money)
    return { s: s0, accepted: false, why: 'that offer is not possible' };
  const sp = SPACES[i], s = clone(s0), name = s.players[o].name;
  let accepted = false, why;
  if (s.houses[i] || (sp.g && GROUP[sp.g].some((j) => s.houses[j]))) why = 'it has built on that set';
  else if (sp.g && hasSet(s, o, sp.g)) why = 'it would break up its own ' + sp.g + ' set';
  else if (sp.g && GROUP[sp.g].every((j) => j === i || s.owner[j] === me) && c < sp.p * 3) why = 'it would hand you the whole ' + sp.g + ' set, and that is worth more than ' + c;
  else if (c < Math.ceil(sp.p * 1.5)) why = c + ' is under the ' + Math.ceil(sp.p * 1.5) + ' it wants for a ' + sp.p + ' property';
  else { accepted = true; why = c + ' is a fair price for ' + sp.n; }
  say(s, me, 'offered ' + c + ' for ' + sp.n);
  if (accepted) { s.players[me].money -= c; s.players[o].money += c; s.owner[i] = me; }
  say(s, o, (accepted ? 'accepted' : 'declined') + ' the offer for ' + sp.n, { why });
  return { s, accepted, why: name + ' ' + (accepted ? 'accepted' : 'declined') + ': ' + why };
}
