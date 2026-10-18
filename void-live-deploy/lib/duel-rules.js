// The V01D card duel's rules (frontier #33): pure, no DOM, no network, no randomness. Two sides see the same table and choose.
// Each side has a Root (Power 5, Resistance 8, two open arrows) and a Treasury (starts 6). A turn: collect Income (2 + the Income of
// your cards in play that are not neutralised), then up to two actions: summon a card onto an open arrow of one of your cards for its
// cost, attack an enemy card with one of yours (coins can be pledged by both sides), or pass (bank two coins and end the turn).
//   cost = max(1, ceil((Power + Resistance) / 4))
//   attack: Power + support + pledge  must beat (strictly)  Resistance + support + answer;  support = friendly cards touching it (not neutralised)
//   a beaten card is neutralised: its arrows stay, it gives no Income, cannot attack, supports nobody, counts no Power.
// First to neutralise the other Root wins; after 12 turns (both sides together) the side with more total Power in play wins.
// Stats of real skills come from lib/card-frame.js cardOf (statsFor); a name with no evidence is a fresh card (1 / 1 / 0, cost 1).
// Abilities (owner, 2026-10-18: "lets start thinking about the stats and card game rules to make the cards better"), each earned from a
// real fact, never invented, the way Magic's keywords sit on a card's text box:
//   Proven  (the skill's evidence rating is proven, a mythic card): it cannot be neutralised on the turn it is summoned.
//   Fresh   (tested in the last 7 days, families.json last_tested): +1 Resistance (at most 9).
//   Linked  (it has arrows: it imports other skills, deps.json): +1 Income for each of its arrows a friendly card stands on.
//   Kin, a table rule for every card: +1 Power while another of your cards from the same family is in play and not neutralised.
import { cardOf } from './card-frame.js';

export const TURNS = 12, ACTIONS = 2, START_TREASURY = 6, BASE_INCOME = 2, MAX_ARROWS = 3;
export const other = (side) => (side === 'you' ? 'void' : 'you');
const int = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.max(lo, Math.min(hi, Math.round(+n))) : d);

/** a card definition: { name, power, resistance, income, arrows }; no stats gives the fresh card (1 / 1 / 0). Pure. */
export const ABILITIES = { proven: 'Proven: cannot be neutralised the turn it is summoned', fresh: 'Fresh: tested this week, +1 Resistance', linked: 'Linked: +1 Income for each arrow a friendly card stands on' };
export const FRESH_DAYS = 7;
export function card({ name = 'Idea', power = 1, resistance = 1, income = 0, arrows = 1, abilities = [], family = '' } = {}) {
  const ab = [...new Set((Array.isArray(abilities) ? abilities : []).filter((a) => Object.hasOwn(ABILITIES, a)))];
  return { name: String(name).trim().slice(0, 40) || 'Idea', power: int(power, 0, 99, 1), resistance: int(resistance, 0, 99, 1), income: int(income, 0, 99, 0), arrows: int(arrows, 0, MAX_ARROWS, 1),
    abilities: ab, family: /^[a-z][a-z0-9-]{0,30}$/.test(family) ? family : '' };
}
export const cost = (c) => Math.max(1, Math.ceil((int(c.power, 0, 99, 1) + int(c.resistance, 0, 99, 1)) / 4));

/** the stats a real skill has earned, as a card definition: cardOf over its families.json entry and deps.json entry, else a fresh card. Pure. */
export function statsFor(name, families, deps, { today = new Date().toISOString().slice(0, 10) } = {}) {
  let skill = null, family = '';
  for (const f of (families && families.families) || []) for (const s of f.skills || []) if (s.name === name) { skill = s; family = f.id || ''; }
  const f = deps && deps.files, d = f && f['skills/' + name + '.js'];
  const c = skill ? cardOf({ skill, deps: d ? { imports: (d.imports || []).filter((x) => !/\/mini\//.test(x)), importedBy: d.importedBy || [] } : null }) : null;
  if (!c || c.power == null) return card({ name });
  const days = skill.last_tested ? (Date.parse(today) - Date.parse(skill.last_tested)) / 864e5 : Infinity;
  const fresh = days >= 0 && days <= FRESH_DAYS, arrows = c.arrowsOut || 0;
  const abilities = [skill.tier === 'proven' && 'proven', fresh && 'fresh', arrows > 0 && 'linked'].filter(Boolean);
  return card({ name, power: c.power, resistance: Math.min(9, c.toughness + (fresh ? 1 : 0)), income: c.income || 0, arrows, abilities, family });
}

const mk = (id, side, def, parent, slot, root, turn = 0) => ({ id, side, name: def.name, power: def.power, resistance: def.resistance, income: def.income, arrows: def.arrows,
  abilities: def.abilities || [], family: def.family || '', summoned: turn, parent, slot, root: !!root, neutralised: false });
const has = (c, a) => !!(c && c.abilities && c.abilities.includes(a));

/** a new duel. pool: the cards V01D may summon, e.g. { void: [card(...)] }; with none it summons fresh ideas. Pure. */
export function newState({ pool = null } = {}) {
  const root = { name: 'Root', power: 5, resistance: 8, income: 0, arrows: 2 };
  return { turn: 0, side: 'you', actions: ACTIONS, due: true, treasury: { you: START_TREASURY, void: START_TREASURY }, nextId: 3, over: null, log: [],
    pool: { void: ((pool && pool.void) || []).map((c) => card(c)) },
    cards: [mk('y1', 'you', root, null, 0, true), mk('v2', 'void', root, null, 0, true)] };
}
const clone = (s) => ({ ...s, treasury: { ...s.treasury }, cards: s.cards.map((c) => ({ ...c })), log: s.log.slice(), pool: s.pool });
const byId = (s, id) => s.cards.find((c) => c.id === id) || null;
const touching = (s, c) => s.cards.filter((o) => o.side === c.side && !o.neutralised && (o.parent === c.id || o.id === c.parent));
/** how many friendly cards stand against the card's arrows, parent or children, that are not neutralised */
export const support = (s, c) => touching(s, c).length;
/** Kin: +1 Power while another of the side's cards from the same family is in play and not neutralised */
export const kin = (s, c) => (c.family && s.cards.some((o) => o.id !== c.id && o.side === c.side && !o.neutralised && o.family === c.family) ? 1 : 0);
export const powerOf = (s, c) => c.power + kin(s, c);
/** Linked: one more coin for each of the card's arrows a friendly card stands on */
const linked = (s, c) => (has(c, 'linked') ? s.cards.filter((o) => o.parent === c.id && o.side === c.side).length : 0);
export const incomeOf = (s, side) => BASE_INCOME + s.cards.filter((c) => c.side === side && !c.neutralised).reduce((n, c) => n + c.income + linked(s, c), 0);
export const powerIn = (s, side) => s.cards.filter((c) => c.side === side && !c.neutralised).reduce((n, c) => n + powerOf(s, c), 0);
/** Proven: a card cannot be neutralised on the turn it was summoned */
export const shielded = (s, t) => has(t, 'proven') && !t.root && t.summoned === s.turn;
/** the open arrows of a side: [{ parent, slot }] over its cards in table order (neutralised cards keep their arrows) */
export function openArrows(s, side) {
  const out = [];
  for (const c of s.cards) if (c.side === side) for (let i = 0; i < c.arrows; i++) if (!s.cards.some((o) => o.parent === c.id && o.slot === i)) out.push({ parent: c.id, slot: i });
  return out;
}

/** the side to move collects its Income, once per turn. Pure. */
export function collectIncome(s) {
  if (!s.due || s.over) return s;
  const n = clone(s), g = incomeOf(n, n.side);
  n.treasury[n.side] += g; n.due = false; n.log.push(n.side + ' collects ' + g);
  return n;
}
const atkTotal = (s, a, pledge) => powerOf(s, a) + support(s, a) + pledge;
const defBase = (s, t) => t.resistance + support(s, t);
/** the coins the defender puts in answer when it is not told: the least that holds, if it can pay for it (a Root pays whatever it can) */
export function defenderAnswer(s, action) {
  const a = byId(s, action.from), t = byId(s, action.target); if (!a || !t) return 0;
  const need = Math.max(0, atkTotal(s, a, action.pledge || 0) - defBase(s, t)), have = s.treasury[t.side];
  return need <= have && (t.root || need <= Math.ceil(have / 2)) ? need : 0;
}

/** why an action is not allowed now, or null when it is. Pure. */
export function whyIllegal(s0, action) {
  const s = s0.due ? collectIncome(s0) : s0, side = s.side;
  if (s.over) return 'the duel is over';
  if (!action || typeof action !== 'object') return 'no action';
  if (action.type === 'pass') return null;
  if (s.actions < 1) return 'no actions left';
  if (action.type === 'summon') {
    const c = card(action.card || {}), p = byId(s, action.parent);
    if (!p || p.side !== side) return 'summon onto one of your own cards';
    if (!(action.slot >= 0 && action.slot < p.arrows)) return 'that card has no such arrow';
    if (s.cards.some((o) => o.parent === p.id && o.slot === action.slot)) return 'that arrow is taken';
    if (cost(c) > s.treasury[side]) return 'not enough coins: it costs ' + cost(c);
    return null;
  }
  if (action.type === 'attack') {
    const a = byId(s, action.from), t = byId(s, action.target), pl = action.pledge || 0;
    if (!a || a.side !== side) return 'attack with one of your own cards';
    if (a.neutralised) return 'a neutralised card cannot attack';
    if (!t || t.side === side) return 'attack an enemy card';
    if (t.neutralised) return 'that card is already neutralised';
    if (shielded(s, t)) return t.name + ' is Proven: it cannot be neutralised the turn it is summoned';
    if (!Number.isInteger(pl) || pl < 0 || pl > s.treasury[side]) return 'pledge between 0 and your Treasury';
    if (action.answer != null && (!Number.isInteger(action.answer) || action.answer < 0 || action.answer > s.treasury[t.side])) return 'the answer is between 0 and the defender\'s Treasury';
    return null;
  }
  return 'unknown action';
}

/** every action the side to move may take: summons (of the cards in `pool`, default its own pool), attacks (each pledge) and pass. Pure. */
export function legalActions(s0, pool = null) {
  const s = s0.due ? collectIncome(s0) : s0, side = s.side, out = [{ type: 'pass' }];
  if (s.over || s.actions < 1) return s.over ? [] : out;
  const own = pool || s.pool[side], defs = (own && own.length ? own : [card()]).map((c) => card(c));
  const arrows = openArrows(s, side);
  for (const d of defs) if (cost(d) <= s.treasury[side]) for (const ar of arrows) out.push({ type: 'summon', card: d, parent: ar.parent, slot: ar.slot });
  for (const a of s.cards) if (a.side === side && !a.neutralised) for (const t of s.cards) if (t.side !== side && !t.neutralised) if (!shielded(s, t)) for (let p = 0; p <= s.treasury[side]; p++) out.push({ type: 'attack', from: a.id, target: t.id, pledge: p });
  return out;
}

function endTurn(s) {
  s.turn += 1;
  if (s.turn >= TURNS) {
    const y = powerIn(s, 'you'), v = powerIn(s, 'void');
    s.over = { winner: y > v ? 'you' : v > y ? 'void' : 'draw', why: 'power', you: y, void: v };
    s.log.push('after ' + TURNS + ' turns: Power ' + y + ' to ' + v);
    return s;
  }
  s.side = other(s.side); s.actions = ACTIONS; s.due = true;
  const g = incomeOf(s, s.side); s.treasury[s.side] += g; s.due = false; s.log.push(s.side + ' collects ' + g);
  return s;
}

/** the state after an action: a NEW state, or an Error for an illegal action. Pure. */
export function apply(s0, action) {
  const why = whyIllegal(s0, action); if (why) throw new Error('illegal: ' + why);
  const s = clone(collectIncome(s0)), side = s.side;
  s.log = s.log.slice(-40);
  if (action.type === 'pass') { s.treasury[side] += 2; s.log.push(side + ' passes and banks 2'); return endTurn(s); }
  s.actions -= 1;
  if (action.type === 'summon') {
    const c = card(action.card); s.treasury[side] -= cost(c);
    const id = (side === 'you' ? 'y' : 'v') + s.nextId++; s.cards.push(mk(id, side, c, action.parent, action.slot, false, s.turn));
    s.log.push(side + ' summons ' + c.name + ' (' + c.power + '/' + c.resistance + ')');
  } else {
    const a = byId(s, action.from), t = byId(s, action.target), pl = action.pledge || 0;
    const ans = action.answer != null ? action.answer : defenderAnswer(s, { ...action, pledge: pl }), def = t.side;
    const A = atkTotal(s, a, pl), D = defBase(s, t) + ans;
    s.treasury[side] -= pl; s.treasury[def] -= ans;
    if (A > D) { t.neutralised = true; s.log.push(side + ' ' + a.name + ' (' + A + ') neutralises ' + t.name + ' (' + D + ')'); if (t.root) s.over = { winner: side, why: 'root' }; }
    else s.log.push(side + ' ' + a.name + ' (' + A + ') fails against ' + t.name + ' (' + D + ')');
  }
  if (s.over) return s;
  return s.actions < 1 ? endTurn(s) : s;
}

/** V01D's next action, always the same for the same state: a safe attack if one is good, else the strongest affordable summon, else pass. Pure. */
export function opponentMove(s0) {
  const s = s0.due ? collectIncome(s0) : s0, side = s.side, foe = other(side);
  if (s.over) return null;
  if (s.actions < 1) return { type: 'pass' };
  const have = s.treasury[side], held = s.treasury[foe];
  let best = null;
  for (const a of s.cards) if (a.side === side && !a.neutralised) for (const t of s.cards) if (t.side === foe && !t.neutralised && !shielded(s, t)) {
    const base = defBase(s, t), room = Math.min(held, 2);
    for (let p = 0; p <= Math.min(have, Math.floor(have / 2)); p++) if (atkTotal(s, a, p) > base + room) {
      const key = [t.root ? 1 : 0, t.power, -p]; // the Root first, then the strongest card, then the fewest coins
      if (!best || cmp(key, best.key) > 0) best = { key, action: { type: 'attack', from: a.id, target: t.id, pledge: p } };
      break;
    }
  }
  if (best) return best.action;
  const arrows = openArrows(s, side);
  if (arrows.length) {
    const defs = (s.pool[side] && s.pool[side].length ? s.pool[side] : [card()]).filter((d) => cost(d) <= have);
    defs.sort((x, y) => (y.power + y.resistance) - (x.power + x.resistance) || cost(x) - cost(y) || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    if (defs[0]) return { type: 'summon', card: defs[0], parent: arrows[0].parent, slot: arrows[0].slot };
  }
  return { type: 'pass' };
}
function cmp(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
