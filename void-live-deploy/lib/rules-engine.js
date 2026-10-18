// V01D's rules engine (frontier #35; owner, 2026-10-16: "V01D can combine and obey all games' rules simultaneously").
// Rules are DATA, never code: { id, source, layer, when, if, then, dependsOn }. The vocabulary below is closed and validated, so a rule a
// stranger proposes can never be code. The engine is pure: step(state, event, stack) -> { state, log, conflicts, denied }; no randomness,
// no I/O, no eval. A stack is an ordered list of rule sets ({ name, rules }); every set in it is in force at once.
// How clashes are settled (a fixed order):
//   layer 1: "instead" (replace a value) and "can't"/"may" (deny/allow)   layer 2: values (modify) and permissions   layer 3: what happens after
//   within a layer by timestamp (load order); a rule that dependsOn another comes after it; a dependency cycle drops all its rules;
//   a deny and an allow on the same event: the lower layer decides, in the same layer deny beats allow ("can't beats can"); the loser is logged.
// Order inside one event: layer 1 replacements, layer 2 modifications (values), then permissions are settled on the final values,
// then the base action happens, then layer 3 effects run in order, each condition read from the state as it is by then.
export const LIMITS = { ruleChars: 1500, rulesPerSet: 64, sets: 8, conditions: 6, effects: 6, depends: 3, chain: 3 };
export const EVENTS = ['turnStart', 'roundStart', 'summon', 'land', 'attack', 'move', 'merge', 'pass'];
export const STATS = ['cost', 'power', 'resistance', 'income', 'attack', 'defense', 'actions'];
const CMPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'], STR_FACTS = ['mover', 'cardKind', 'otherKind'];
const TEXT = /^[A-Za-z0-9 .,'’:;!?()+\-–/%]{1,120}$/, ID = /^[a-z0-9][a-z0-9-]{0,39}$/, WORD = /^[a-z][a-z-]{0,19}$/;

// ---- facts: every number or word a condition or an amount may read; x = { st, ev, foe, card, other, vals, mats }
const active = (st, side) => st.cards.filter((c) => c.side === side && !c.neutralised);
const sum = (cs, k) => cs.reduce((n, c) => n + (c[k] || 0), 0);
const b = (v) => (v ? 1 : 0), n0 = (v) => (Number.isFinite(v) ? v : 0);
export const support = (st, c) => (c ? st.cards.filter((o) => o.side === c.side && !o.neutralised && o.id !== c.id && (o.parent === c.id || o.id === c.parent)).length : 0);
const FACTS = {
  mover: (x) => x.st.side, turn: (x) => x.st.turn, round: (x) => Math.floor(x.st.turn / x.st.order.length) + 1, actionsLeft: (x) => x.st.actionsLeft,
  coins: (x) => x.st.res[x.st.side].coins, foeCoins: (x) => x.st.res[x.foe].coins, lands: (x) => x.st.res[x.st.side].lands,
  landsThisTurn: (x) => x.st.landsThisTurn, summonsThisTurn: (x) => x.st.summonsThisTurn,
  cardsInPlay: (x) => active(x.st, x.st.side).length, foeCardsInPlay: (x) => active(x.st, x.foe).length,
  myIncome: (x) => sum(active(x.st, x.st.side), 'income'), mySpeed: (x) => sum(active(x.st, x.st.side), 'speed'), foeSpeed: (x) => sum(active(x.st, x.foe), 'speed'),
  cardKind: (x) => (x.card && x.card.kind) || '', cardPower: (x) => n0(x.card && x.card.power), cardResistance: (x) => n0(x.card && x.card.resistance),
  cardIncome: (x) => n0(x.card && x.card.income), cardSpeed: (x) => n0(x.card && x.card.speed), cardCost: (x) => n0(x.card && x.card.cost),
  cardBulk: (x) => n0(x.card && x.card.power + x.card.resistance), cardSupport: (x) => support(x.st, x.card),
  cardIsMine: (x) => b(x.card && x.card.side === x.st.side), cardNeutralised: (x) => b(x.card && x.card.neutralised),
  otherKind: (x) => (x.other && x.other.kind) || '', otherPower: (x) => n0(x.other && x.other.power), otherResistance: (x) => n0(x.other && x.other.resistance),
  otherIncome: (x) => n0(x.other && x.other.income), otherSupport: (x) => support(x.st, x.other), otherIsMine: (x) => b(x.other && x.other.side === x.st.side),
  otherIsRoot: (x) => b(x.other && x.other.root), otherNeutralised: (x) => b(x.other && x.other.neutralised),
  maxPower: (x) => Math.max(FACTS.cardPower(x), FACTS.otherPower(x)), minPower: (x) => Math.min(FACTS.cardPower(x), FACTS.otherPower(x)),
  maxResistance: (x) => Math.max(FACTS.cardResistance(x), FACTS.otherResistance(x)), minResistance: (x) => Math.min(FACTS.cardResistance(x), FACTS.otherResistance(x)),
  sumIncome: (x) => FACTS.cardIncome(x) + FACTS.otherIncome(x),
  pledge: (x) => x.ev.pledge | 0, answer: (x) => x.ev.answer | 0, materials: (x) => x.mats.length,
  parentIsMine: (x) => b(x.parent && x.parent.side === x.st.side),
  slotOpen: (x) => b(x.parent && Number.isInteger(x.ev.slot) && x.ev.slot >= 0 && x.ev.slot < x.parent.arrows && !x.st.cards.some((o) => o.parent === x.parent.id && o.slot === x.ev.slot)),
  moveDx: (x) => Math.abs(x.dx), moveDy: (x) => Math.abs(x.dy), moveDistance: (x) => Math.max(Math.abs(x.dx), Math.abs(x.dy)),
};
for (const s of STATS) FACTS[s] = (x) => n0(x.vals[s]);
export const FACT_NAMES = Object.keys(FACTS);
const NUM_FACTS = FACT_NAMES.filter((f) => !STR_FACTS.includes(f));
const cmp = (a, op, v) => (op === 'eq' ? a === v : op === 'ne' ? a !== v : op === 'gt' ? a > v : op === 'gte' ? a >= v : op === 'lt' ? a < v : a <= v);
const holds = (x, c) => cmp(FACTS[c.fact](x), c.cmp, typeof c.value === 'object' ? FACTS[c.value.fact](x) : c.value);
const amount = (x, a) => (typeof a === 'number' ? a : Math.ceil((FACTS[a.fact](x) * (a.times == null ? 1 : a.times)) / (a.over == null ? 1 : a.over)));

// ---- the schema: the effect vocabulary, each with the layers it may sit in and its fields ('?' = optional)
const EFFECTS = {
  replace: [[1], { stat: 'stat', value: 'amount' }], deny: [[1, 2], { reason: 'text' }], allow: [[1, 2], { 'reason?': 'text' }],
  modify: [[2], { stat: 'stat', add: 'amount', 'min?': 'int', 'max?': 'int' }],
  gain: [[3], { resource: ['coins', 'lands', 'actions'], n: 'amount', 'who?': ['mover', 'foe'] }],
  neutralise: [[3], {}], consume: [[3], {}], endTurn: [[3], {}], log: [[3], { text: 'text' }],
  summon: [[3], { name: 'text', power: 'int', resistance: 'int', 'income?': 'int', 'kind?': 'kind' }],
  move: [[3], { dx: 'int', dy: 'int' }], win: [[3], { who: ['mover', 'power'], 'why?': 'kind' }], sortOrder: [[3], { by: ['speed', 'power', 'income'] }],
};
const int = (v) => Number.isInteger(v) && Math.abs(v) <= 999;
function checkField(v, type, at, err) {
  if (type === 'int') { if (!int(v)) err(at + ' must be a whole number between -999 and 999'); }
  else if (type === 'text') { if (typeof v !== 'string' || !TEXT.test(v) || /\w\(/.test(v)) err(at + ' must be 1-120 characters of plain text (letters, digits, spaces and . , \' : ; ! ? ( ) + - / %)'); }
  else if (type === 'kind') { if (typeof v !== 'string' || !WORD.test(v)) err(at + ' must be a lower-case word (a-z and -, up to 20 characters)'); }
  else if (type === 'stat') { if (!STATS.includes(v)) err(at + ' "' + v + '" is not a value (allowed: ' + STATS.join(', ') + ')'); }
  else if (Array.isArray(type)) { if (!type.includes(v)) err(at + ' "' + v + '" is not allowed here (allowed: ' + type.join(', ') + ')'); }
  else if (type === 'amount') {
    if (int(v)) return;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return err(at + ' must be a whole number or { fact, times, over }');
    for (const k of Object.keys(v)) if (!['fact', 'times', 'over'].includes(k)) err(at + ' has an unknown field "' + k + '"');
    if (!NUM_FACTS.includes(v.fact)) err(at + '.fact "' + v.fact + '" is not a number fact (allowed: ' + NUM_FACTS.join(', ') + ')');
    if (v.times != null && !int(v.times)) err(at + '.times must be a whole number');
    if (v.over != null && !(int(v.over) && v.over >= 1)) err(at + '.over must be a whole number of at least 1');
  }
}
const plain = (v, d = 0) => d < 7 && (v === null || ['string', 'number', 'boolean'].includes(typeof v) && (typeof v !== 'number' || Number.isFinite(v))
  || (Array.isArray(v) ? v.every((i) => plain(i, d + 1)) : typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v)) && Object.values(v).every((i) => plain(i, d + 1))));

/** is this a rule the engine will take? { ok, errors: [exact messages] }. Pure; never runs anything it is given. */
export function validateRule(rule) {
  const errors = [], err = (m) => errors.push(m);
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return { ok: false, errors: ['rule must be an object'] };
  if (!plain(rule)) return { ok: false, errors: ['rule must be plain data (no functions, classes or loops)'] };
  if (JSON.stringify(rule).length > LIMITS.ruleChars) return { ok: false, errors: ['rule is larger than ' + LIMITS.ruleChars + ' characters'] };
  for (const k of Object.keys(rule)) if (!['id', 'source', 'layer', 'when', 'if', 'then', 'dependsOn'].includes(k)) err('rule has an unknown field "' + k + '"');
  if (typeof rule.id !== 'string' || !ID.test(rule.id)) err('rule.id must be 1-40 characters of a-z, 0-9 and -');
  if (typeof rule.source !== 'string' || !TEXT.test(rule.source) || rule.source.length > 40) err('rule.source must be 1-40 characters of plain text');
  if (![1, 2, 3].includes(rule.layer)) err('rule.layer must be 1, 2 or 3');
  for (const w of [].concat(rule.when === undefined ? [] : rule.when)) if (!EVENTS.includes(w)) err('rule.when "' + w + '" is not an event (allowed: ' + EVENTS.join(', ') + ')');
  if (rule.when === undefined || (Array.isArray(rule.when) && !rule.when.length)) err('rule.when must name an event');
  if (rule.if !== undefined && (!Array.isArray(rule.if) || rule.if.length > LIMITS.conditions)) err('rule.if must be a list of at most ' + LIMITS.conditions + ' conditions');
  else (rule.if || []).forEach((c, i) => {
    const at = 'rule.if[' + i + ']';
    if (!c || typeof c !== 'object' || Array.isArray(c)) return err(at + ' must be an object { fact, cmp, value }');
    for (const k of Object.keys(c)) if (!['fact', 'cmp', 'value'].includes(k)) err(at + ' has an unknown field "' + k + '"');
    if (!FACT_NAMES.includes(c.fact)) return err(at + '.fact "' + c.fact + '" is not a fact (allowed: ' + FACT_NAMES.join(', ') + ')');
    if (!CMPS.includes(c.cmp)) err(at + '.cmp "' + c.cmp + '" is not a comparison (allowed: ' + CMPS.join(', ') + ')');
    if (STR_FACTS.includes(c.fact)) { if (!['eq', 'ne'].includes(c.cmp)) err(at + '.cmp must be eq or ne for a word fact'); if (typeof c.value !== 'string' || !(WORD.test(c.value) || c.value === '')) err(at + '.value must be a lower-case word'); }
    else checkField(c.value, 'amount', at + '.value', err), typeof c.value === 'object' && c.value && (c.value.times != null || c.value.over != null) && err(at + '.value may only name a fact');
  });
  if (!Array.isArray(rule.then) || !rule.then.length || rule.then.length > LIMITS.effects) err('rule.then must be a list of 1 to ' + LIMITS.effects + ' effects');
  else rule.then.forEach((e, i) => {
    const at = 'rule.then[' + i + ']';
    if (!e || typeof e !== 'object' || !EFFECTS[e.do]) return err(at + '.do "' + (e && e.do) + '" is not an effect (allowed: ' + Object.keys(EFFECTS).join(', ') + ')');
    const [layers, fields] = EFFECTS[e.do];
    if ([1, 2, 3].includes(rule.layer) && !layers.includes(rule.layer)) err(at + ' (' + e.do + ') is not allowed in layer ' + rule.layer + ' (layers: ' + layers.join(', ') + ')');
    const names = Object.keys(fields).map((f) => f.replace('?', ''));
    for (const k of Object.keys(e)) if (k !== 'do' && !names.includes(k)) err(at + ' has an unknown field "' + k + '"');
    for (const [f, type] of Object.entries(fields)) { const k = f.replace('?', ''); if (e[k] === undefined) { if (!f.endsWith('?')) err(at + '.' + k + ' is missing'); } else checkField(e[k], type, at + '.' + k, err); }
  });
  if (rule.dependsOn !== undefined && (!Array.isArray(rule.dependsOn) || rule.dependsOn.length > LIMITS.depends || !rule.dependsOn.every((d) => typeof d === 'string' && ID.test(d)))) err('rule.dependsOn must be a list of at most ' + LIMITS.depends + ' rule ids');
  return { ok: !errors.length, errors };
}

// ---- the stack: validate, order, drop what cannot be obeyed (every drop is a logged conflict)
const cache = new WeakMap();
/** { rules: ordered, conflicts } for a stack of { name, rules } sets. Pure (cached by the stack object). */
export function resolveStack(stack) {
  if (cache.has(stack)) return cache.get(stack);
  const conflicts = [], byId = new Map(), all = []; let ts = 0;
  if (stack.length > LIMITS.sets) conflicts.push({ kind: 'invalid', set: 'stack', rule: '-', errors: ['a stack holds at most ' + LIMITS.sets + ' rule sets'] });
  for (const set of stack.slice(0, LIMITS.sets)) for (const r of (Array.isArray(set.rules) ? set.rules : []).slice(0, LIMITS.rulesPerSet)) {
    const v = validateRule(r), at = ts++;
    if (!v.ok) { conflicts.push({ kind: 'invalid', set: set.name, rule: (r && typeof r.id === 'string' && r.id) || '?', errors: v.errors }); continue; }
    if (byId.has(r.id)) { conflicts.push({ kind: 'duplicate-id', set: set.name, rule: r.id }); continue; }
    const rule = { ...r, when: [].concat(r.when), set: set.name, ts: at, dead: false }; byId.set(r.id, rule); all.push(rule);
  }
  const live = () => all.filter((r) => !r.dead), drop = (r, c) => { r.dead = true; conflicts.push({ set: r.set, rule: r.id, ...c }); };
  const settle = () => { for (let more = true; more;) { more = false; for (const r of live()) for (const d of r.dependsOn || []) {
    const dep = byId.get(d);
    if (!dep || dep.dead) { drop(r, { kind: 'unknown-dependency', dependsOn: d }); more = true; break; }
    if (dep.layer > r.layer) { drop(r, { kind: 'dependency-layer', dependsOn: d }); more = true; break; }
  } } };
  settle();
  const reaches = (from, target, seen = new Set()) => (from.dependsOn || []).some((d) => d === target.id || (!seen.has(d) && seen.add(d) && reaches(byId.get(d), target, seen)));
  const loop = live().filter((r) => reaches(r, r));
  if (loop.length) { conflicts.push({ kind: 'cycle', rules: loop.map((r) => r.id), sets: loop.map((r) => r.set) }); loop.forEach((r) => { r.dead = true; }); settle(); }
  const rules = [], placed = new Set();
  for (const layer of [1, 2, 3]) {
    const pool = live().filter((r) => r.layer === layer).sort((p, q) => p.ts - q.ts);
    while (pool.length) { const i = pool.findIndex((r) => (r.dependsOn || []).every((d) => placed.has(d))); const [r] = pool.splice(i, 1); placed.add(r.id); rules.push(r); }
  }
  const out = { rules, conflicts }; cache.set(stack, out); return out;
}

// ---- the game: a state is plain JSON
/** a new game: cards are { id, side, name, kind, power, resistance, income, cost, speed, arrows, parent, slot, root, neutralised, x, y } */
export function newGame({ sides = ['you', 'void'], coins = 6, lands = 0, root = { power: 5, resistance: 8, arrows: 2 } } = {}) {
  const st = { turn: 0, side: sides[0], order: sides.slice(), actionsLeft: 0, summonsThisTurn: 0, landsThisTurn: 0, nextId: sides.length + 1, over: null, res: {}, cards: [] };
  sides.forEach((s, i) => { st.res[s] = { coins, lands }; st.cards.push(makeCard(s[0] + (i + 1), s, { name: 'Root', kind: 'root', ...root }, null, 0, true)); });
  return st;
}
const lim = (v, hi, d) => (Number.isFinite(+v) ? Math.max(0, Math.min(hi, Math.round(+v))) : d);
/** a card definition from anything: names and kinds are cut to size, numbers are whole and bounded */
export function makeDef(d = {}) {
  return { name: String(d.name || 'Idea').trim().slice(0, 40) || 'Idea', kind: WORD.test(d.kind) ? d.kind : 'idea', power: lim(d.power, 99, 1), resistance: lim(d.resistance, 99, 1),
    income: lim(d.income, 99, 0), cost: lim(d.cost, 99, 0), speed: lim(d.speed, 99, 0), arrows: lim(d.arrows, 3, 1) };
}
const makeCard = (id, side, def, parent, slot, root) => ({ id, side, ...makeDef(def), parent: parent || null, slot: slot == null ? null : slot, root: !!root, neutralised: false, x: 0, y: 0 });
const find = (st, id) => st.cards.find((c) => c.id === id) || null;

function context(st, ev) {
  const x = { st, ev, foe: st.order.find((s) => s !== st.side), card: null, other: null, parent: null, vals: {}, mats: [], dx: 0, dy: 0 };
  const t = ev.type;
  if (t === 'summon') {
    x.parent = find(st, ev.parent); x.card = { ...makeDef(ev.def), side: st.side, parent: ev.parent || null, root: false, neutralised: false };
    x.vals = { cost: 0, power: x.card.power, resistance: x.card.resistance, income: x.card.income };
    for (const id of (Array.isArray(ev.materials) ? ev.materials : []).slice(0, 3)) {
      const m = find(st, id);
      if (!m || m.side !== st.side || m.root || id === ev.parent || x.mats.includes(m)) return { error: 'material "' + id + '" is not one of your cards in play' };
      x.mats.push(m);
    }
  } else if (['attack', 'move', 'merge'].includes(t)) {
    x.card = find(st, ev.from); x.other = find(st, ev.target);
    if (!x.card) return { error: 'there is no such card to act with' };
    if (t !== 'move' && (!x.other || x.other === x.card)) return { error: 'there is no second card to act on' };
    x.vals = t === 'attack' ? { attack: 0, defense: 0 } : t === 'merge' ? { cost: 0, power: 0, resistance: 0, income: 0 } : {};
    if (t === 'move') { if (!ev.to || !int(ev.to.x) || !int(ev.to.y)) return { error: 'a move needs a place to go' }; x.dx = ev.to.x - x.card.x; x.dy = ev.to.y - x.card.y; }
    if ((ev.pledge != null && !(Number.isInteger(ev.pledge) && ev.pledge >= 0)) || (ev.answer != null && !(Number.isInteger(ev.answer) && ev.answer >= 0))) return { error: 'coins pledged must be a whole number of 0 or more' };
  } else if (t === 'turnStart') x.vals = { income: 0, actions: 0 };
  return x;
}

const lab = (side) => (side === 'you' ? 'You' : side === 'void' ? 'Verse' : side[0].toUpperCase() + side.slice(1)), poss = (side) => (side === 'you' ? 'your' : lab(side) + '\'s');
const act = (side, verb) => lab(side) + ' ' + (side === 'you' ? verb : verb + (/(s|ch|sh|x)$/.test(verb) ? 'es' : 's'));
const things = (n, word) => n + ' ' + (n === 1 ? word.replace(/s$/, '') : word);
const plainName = (e) => ({ deny: 'forbids', allow: 'allows' }[e.do]);
/** deny/allow effects that matched: the lower layer decides, in one layer deny beats allow; returns { denied, clash } */
function settlePerms(perms) {
  const denies = perms.filter((p) => p.e.do === 'deny'), allows = perms.filter((p) => p.e.do === 'allow');
  if (!denies.length) return {};
  const by = (a, c) => a.r.layer - c.r.layer || a.r.ts - c.r.ts, d = denies.slice().sort(by)[0], a = allows.slice().sort(by)[0];
  if (a && a.r.layer < d.r.layer) return { winner: a, losers: denies };
  return { denied: d, winner: d, losers: allows };
}

function dispatch(st, ev, rules, out, depth) {
  const x = context(st, ev), log = out.log;
  if (x.error) { log.push({ kind: 'deny', set: 'engine', rule: 'engine', event: ev.type, reason: x.error }); return { set: 'engine', rule: 'engine', reason: x.error }; }
  const mine = rules.filter((r) => r.when.includes(ev.type)), sees = (r) => (r.if || []).every((c) => holds(x, c));
  for (const r of mine) if (r.layer < 3 && sees(r)) for (const e of r.then) {
    if (e.do !== 'replace' && e.do !== 'modify') continue;
    const from = n0(x.vals[e.stat]); let to = e.do === 'replace' ? amount(x, e.value) : from + amount(x, e.add);
    if (e.min != null) to = Math.max(e.min, to);
    if (e.max != null) to = Math.min(e.max, to);
    x.vals[e.stat] = to;
    const last = log[log.length - 1];
    if (to !== from) { if (last && last.kind === e.do && last.rule === r.id && last.stat === e.stat) last.to = to; else log.push({ kind: e.do, set: r.set, rule: r.id, event: ev.type, stat: e.stat, from, to }); }
  }
  const perms = []; for (const r of mine) if (r.layer < 3 && sees(r)) for (const e of r.then) if (e.do === 'deny' || e.do === 'allow') perms.push({ r, e });
  const verdict = settlePerms(perms), lose = (p) => ({ set: p.r.set, rule: p.r.id, layer: p.r.layer, does: plainName(p.e), reason: p.e.reason || p.r.id });
  if (verdict.winner && verdict.losers.length) out.conflicts.push({ kind: 'clash', event: ev.type, winner: lose(verdict.winner), losers: verdict.losers.map(lose) });
  if (verdict.denied) { const d = verdict.denied; log.push({ kind: 'deny', set: d.r.set, rule: d.r.id, event: ev.type, reason: d.e.reason }); return { set: d.r.set, rule: d.r.id, reason: d.e.reason }; }
  const me = st.res[st.side], foe = st.res[x.foe], v = x.vals, pay = (ev.pledge | 0), ans = (ev.answer | 0);
  if (v.cost > me.coins) return stop(out, ev, 'you need ' + v.cost + ' coins and have ' + me.coins);
  if (pay > me.coins || ans > foe.coins) return stop(out, ev, 'coins pledged are more than the Treasury holds');
  const say = (text) => log.push({ kind: 'base', event: ev.type, text }), who = st.side;
  if (ev.type === 'summon') {
    me.coins -= v.cost; st.summonsThisTurn += 1; const id = who[0] + st.nextId++;
    x.made = makeCard(id, who, { ...x.card, power: v.power, resistance: v.resistance, income: v.income }, ev.parent, ev.slot); st.cards.push(x.made);
    say(act(who, 'summon') + ' ' + x.made.name + ' (' + x.made.power + '/' + x.made.resistance + ') for ' + things(v.cost, 'coins'));
  } else if (ev.type === 'land') { st.landsThisTurn += 1; say(act(who, 'play') + ' a land'); }
  else if (ev.type === 'attack') {
    me.coins -= pay; foe.coins -= ans;
    say(act(who, 'attack') + ' ' + poss(x.other.side) + ' ' + x.other.name + ' with ' + poss(who) + ' ' + x.card.name + ': ' + v.attack + ' against ' + v.defense + (v.attack > v.defense ? ' and it gets through' : ' and it is held'));
  } else if (ev.type === 'move') { x.card.x += x.dx; x.card.y += x.dy; say(act(who, 'move') + ' ' + x.card.name + ' to ' + x.card.x + ',' + x.card.y); }
  else if (ev.type === 'merge') {
    const a = x.card, o = x.other, total = Math.min(3, a.arrows + o.arrows);
    st.cards.filter((c) => c.parent === o.id).forEach((c) => { const s2 = c.slot + a.arrows; c.parent = s2 < total ? a.id : null; c.slot = c.parent ? s2 : null; });
    st.cards = st.cards.filter((c) => c !== o); me.coins -= v.cost;
    Object.assign(a, { name: String(ev.name || a.name + ' + ' + o.name).slice(0, 40), power: v.power, resistance: v.resistance, income: v.income, arrows: total, speed: Math.max(a.speed, o.speed) });
    say(act(who, 'merge') + ' ' + o.name + ' into ' + a.name + ' (' + a.power + '/' + a.resistance + ')');
  } else if (ev.type === 'pass') say(act(who, 'pass'));
  const flags = { ended: false };
  for (const r of mine) if (r.layer === 3 && !st.over && sees(r)) for (const e of r.then) {
    if (st.over) break;
    const note = (text) => log.push({ kind: 'effect', set: r.set, rule: r.id, event: ev.type, text });
    if (e.do === 'gain') { const side = e.who === 'foe' ? x.foe : who, n = amount(x, e.n); if (e.resource === 'actions') st.actionsLeft += n; else st.res[side][e.resource] += n; note(n < 0 ? act(side, 'lose') + ' ' + things(-n, e.resource) : act(side, 'gain') + ' ' + things(n, e.resource)); }
    else if (e.do === 'neutralise' && x.other) { x.other.neutralised = true; note(poss(x.other.side) + ' ' + x.other.name + ' is neutralised'); }
    else if (e.do === 'consume' && x.mats.length) { st.cards = st.cards.filter((c) => !x.mats.includes(c)); note(act(who, 'give') + ' up ' + x.mats.map((m) => m.name).join(', ') + ' as material'); }
    else if (e.do === 'summon') { const t = makeCard(who[0] + st.nextId++, who, e, null, null); st.cards.push(t); note(t.name + ' appears (' + t.power + '/' + t.resistance + ')'); }
    else if (e.do === 'move' && (x.made || x.card)) { const m = x.made || x.card; m.x += e.dx; m.y += e.dy; note(m.name + ' moves by ' + e.dx + ',' + e.dy); }
    else if (e.do === 'win') { st.over = e.who === 'mover' ? { winner: who, why: e.why || 'rules' } : powerWinner(st, e.why); note(st.over.winner === 'draw' ? 'the game is drawn' : act(st.over.winner, 'win') + ' by ' + st.over.why); }
    else if (e.do === 'sortOrder') { const score = (s) => sum(active(st, s), e.by); st.order = st.order.map((s, i) => ({ s, i })).sort((p, q) => score(q.s) - score(p.s) || p.i - q.i).map((p) => p.s); note('the order of play by ' + e.by + ' is ' + st.order.join(', then ')); }
    else if (e.do === 'endTurn') flags.ended = true;
    else if (e.do === 'log') note(e.text);
  }
  if (ev.type === 'turnStart' && !st.over) { me.coins += v.income; st.actionsLeft = v.actions; say(act(who, 'collect') + ' ' + things(v.income, 'coins') + (v.actions ? ' and ' + (who === 'you' ? 'have' : 'has') + ' ' + things(v.actions, 'actions') : '')); }
  if (flags.ended && !st.over) endTurn(st, rules, out, depth);
  return null;
}
const stop = (out, ev, reason) => { out.log.push({ kind: 'deny', set: 'engine', rule: 'engine', event: ev.type, reason }); return { set: 'engine', rule: 'engine', reason }; };
function powerWinner(st) {
  const p = st.order.map((s) => [s, sum(active(st, s), 'power')]).sort((a, c) => c[1] - a[1]);
  return { winner: p[0][1] === p[1][1] ? 'draw' : p[0][0], why: 'power', power: Object.fromEntries(p) };
}
function endTurn(st, rules, out, depth) {
  if (depth >= LIMITS.chain) { out.log.push({ kind: 'base', event: 'endTurn', text: 'a chain of turn changes was cut off after ' + LIMITS.chain }); return; }
  st.turn += 1; st.actionsLeft = 0; st.summonsThisTurn = 0; st.landsThisTurn = 0;
  let i = st.order.indexOf(st.side) + 1;
  if (i >= st.order.length) { dispatch(st, { type: 'roundStart' }, rules, out, depth + 1); i = 0; }
  st.side = st.order[i]; out.log.push({ kind: 'base', event: 'endTurn', text: 'turn ' + (st.turn + 1) + ': ' + lab(st.side) + ' to move' });
  dispatch(st, { type: 'turnStart' }, rules, out, depth + 1);
}

/** one event under a stack of rule sets: { state (a new one), log, conflicts, denied: null | { set, rule, reason } }. Pure and deterministic. */
export function step(state, event, stack) {
  const { rules, conflicts } = resolveStack(Array.isArray(stack) ? stack : []), st = JSON.parse(JSON.stringify(state));
  const out = { log: [], conflicts: conflicts.slice() };
  if (st.over) return { state, log: [{ kind: 'deny', set: 'engine', rule: 'engine', event: event && event.type, reason: 'the game is over' }], conflicts: out.conflicts, denied: { set: 'engine', rule: 'engine', reason: 'the game is over' } };
  if (!event || !EVENTS.includes(event.type)) return { state, log: [{ kind: 'deny', set: 'engine', rule: 'engine', event: String(event && event.type), reason: 'that is not an event the engine knows' }], conflicts: out.conflicts, denied: { set: 'engine', rule: 'engine', reason: 'unknown event' } };
  const denied = dispatch(st, event, rules, out, 0);
  return { state: denied ? state : st, log: out.log, conflicts: out.conflicts, denied };
}
/** the first turn: step the turn start for the side to move */
export const startGame = (state, stack) => step(state, { type: 'turnStart' }, stack);

// ---- plain words
const evName = (t) => String(t).replace(/([A-Z])/g, ' $1').toLowerCase();
const the = (set, lower) => (lower ? 't' : 'T') + (set === 'engine' ? 'he engine' : 'he ' + set + ' rules');
/** log and conflict entries as plain-words lines */
export function explain(entries) {
  return entries.map((e) => {
    if (e.kind === 'deny') return the(e.set) + (e.rule === 'engine' ? '' : ' (rule "' + e.rule + '")') + ' blocked the ' + evName(e.event) + ' because ' + e.reason + '.';
    if (e.kind === 'clash') {
      const w = e.winner, ls = e.losers.map((l) => the(l.set, true) + ' (rule "' + l.rule + '", layer ' + l.layer + ', ' + l.does + ': ' + l.reason + ')').join(' and ');
      const why = e.losers.every((l) => l.layer === w.layer) ? 'both are layer ' + w.layer + ', and can\'t beats can' : 'layer ' + w.layer + ' is settled before layer ' + Math.max(...e.losers.map((l) => l.layer));
      return 'Clash on the ' + evName(e.event) + ': ' + the(w.set, true) + ' (rule "' + w.rule + '", layer ' + w.layer + ', ' + w.does + ': ' + w.reason + ') against ' + ls + '. The first wins, because ' + why + '.';
    }
    if (e.kind === 'modify') return the(e.set) + ' (rule "' + e.rule + '") changed ' + e.stat + ' from ' + e.from + ' to ' + e.to + ' for the ' + evName(e.event) + '.';
    if (e.kind === 'replace') return the(e.set) + ' (rule "' + e.rule + '") set ' + e.stat + ' to ' + e.to + ' instead of ' + e.from + ' for the ' + evName(e.event) + '.';
    if (e.kind === 'effect') return the(e.set) + ' (rule "' + e.rule + '"): ' + e.text + '.';
    if (e.kind === 'base') return e.text.charAt(0).toUpperCase() + e.text.slice(1) + '.';
    if (e.kind === 'invalid') return 'A rule from ' + (e.set === 'stack' ? 'the stack' : 'the ' + e.set + ' set') + ' (' + e.rule + ') was left out: ' + e.errors.join('; ') + '.';
    if (e.kind === 'duplicate-id') return 'Rule "' + e.rule + '" in the ' + e.set + ' set was left out: another rule already has that id.';
    if (e.kind === 'cycle') return 'Rules ' + e.rules.map((r) => '"' + r + '"').join(' and ') + ' depend on each other in a circle, so all of them were left out.';
    if (e.kind === 'unknown-dependency') return 'Rule "' + e.rule + '" was left out: it depends on "' + e.dependsOn + '", which is not in force.';
    if (e.kind === 'dependency-layer') return 'Rule "' + e.rule + '" was left out: it depends on "' + e.dependsOn + '", which sits in a later layer.';
    return 'Something happened that the engine has no words for (' + e.kind + ').';
  });
}
