// V01D's rules engine (frontier #35): rules are data, the engine is pure, clashes are settled in a fixed order and written in plain words.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../void-live-deploy/lib/rules-engine.js';
import * as D from '../void-live-deploy/lib/duel-rules.js';
import { proposeRule } from '../void-live-deploy/lib/rule-propose.js';
import { gamesOf, playTurns, playLines, SET_NAMES } from '../void-live-deploy/lib/rules-play.js';

const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'lib');
const set = (n) => JSON.parse(fs.readFileSync(path.join(lib, 'rulesets', n + '.json'), 'utf8'));
const stackOf = (...names) => names.map(set);
const rule = (o) => ({ id: 'r', source: 'test', layer: 2, when: 'summon', then: [{ do: 'modify', stat: 'cost', add: 1 }], ...o });
const only = (...rules) => [{ name: 'test', rules }];
const def = (o) => ({ name: 'X', power: 1, resistance: 1, ...o });
const sum = (st, d, parent, slot, stack) => { const r = E.step(st, { type: 'summon', def: d, parent, slot }, stack); assert.equal(r.denied, null, JSON.stringify(r.denied)); return r.state; };
const cost = (stack, d = def({})) => { const r = E.step(E.newGame({ coins: 50 }), { type: 'summon', def: d, parent: 'y1', slot: 0 }, stack); return { r, spent: 50 - r.state.res.you.coins }; };

test('the validator accepts a well-formed rule and says exactly why it rejects the rest', () => {
  assert.deepEqual(E.validateRule(rule({})), { ok: true, errors: [] });
  const bad = (r) => E.validateRule(r).errors;
  assert.deepEqual(bad('when a song is summoned'), ['rule must be an object']);
  assert.deepEqual(bad(null), ['rule must be an object']);
  assert.deepEqual(bad(rule({ then: [{ do: 'eval', code: 'process.exit()' }] })), ['rule.then[0].do "eval" is not an effect (allowed: replace, deny, allow, modify, gain, neutralise, consume, endTurn, log, summon, move, win, sortOrder)']);
  assert.deepEqual(bad(rule({ code: 'x' })), ['rule has an unknown field "code"']);
  assert.deepEqual(bad(rule({ layer: 4 })), ['rule.layer must be 1, 2 or 3']);
  assert.deepEqual(bad(rule({ when: 'explode' })), ['rule.when "explode" is not an event (allowed: ' + E.EVENTS.join(', ') + ')']);
  assert.deepEqual(bad(rule({ id: 'Bad Id' })), ['rule.id must be 1-40 characters of a-z, 0-9 and -']);
  assert.deepEqual(bad(rule({ layer: 3 })), ['rule.then[0] (modify) is not allowed in layer 3 (layers: 2)']);
  const f = bad(rule({ if: [{ fact: 'secrets', cmp: 'eq', value: 1 }] }));
  assert.equal(f.length, 1); assert.match(f[0], /^rule\.if\[0\]\.fact "secrets" is not a fact \(allowed: /);
  assert.deepEqual(bad(rule({ then: [{ do: 'modify', stat: 'cost' }] })), ['rule.then[0].add is missing']);
  assert.deepEqual(bad(rule({ then: [{ do: 'modify', stat: 'luck', add: 1 }] })), ['rule.then[0].stat "luck" is not a value (allowed: ' + E.STATS.join(', ') + ')']);
  assert.deepEqual(bad(rule({ then: [] })), ['rule.then must be a list of 1 to 6 effects']);
});

test('the validator refuses anything code-shaped: functions, markup, template text, odd types, loops and oversize rules', () => {
  const bad = (r) => E.validateRule(r);
  assert.deepEqual(bad(rule({ then: [{ do: 'modify', stat: 'cost', add: () => 1 }] })).errors, ['rule must be plain data (no functions, classes or loops)']);
  const loop = rule({}); loop.self = loop; assert.equal(bad(loop).ok, false);
  assert.equal(bad(Object.assign(Object.create({ evil: 1 }), rule({}))).ok, false);
  for (const text of ['<script>alert(1)</script>', '${process.env}', 'x`y`', 'a=>b', 'eval(1)', '{"a":1}', 'a\nb', 'x'.repeat(121)]) assert.equal(bad(rule({ then: [{ do: 'deny', reason: text }] })).ok, false, text);
  assert.equal(bad(rule({ then: [{ do: 'deny', reason: 'a card cannot be summoned now (rule 4: the gate is shut).' }] })).ok, true);
  assert.equal(bad(rule({ then: [{ do: 'modify', stat: 'cost', add: '1+1' }] })).ok, false);
  assert.equal(bad(rule({ then: [{ do: 'modify', stat: 'cost', add: { fact: 'cardPower', over: 0 } }] })).ok, false);
  assert.equal(bad(rule({ then: [{ do: 'modify', stat: 'cost', add: { fact: 'constructor' } }] })).ok, false);
  assert.equal(bad(rule({ if: [{ fact: 'cardKind', cmp: 'gt', value: 'song' }] })).ok, false, 'a word fact is only eq or ne');
  assert.equal(bad(rule({ if: [{ fact: 'cardKind', cmp: 'eq', value: 'Song(); drop' }] })).ok, false);
  const big = rule({ pad: 'x'.repeat(1600) });
  assert.deepEqual(bad(big).errors, ['rule is larger than 1500 characters']);
  assert.equal(bad(rule({ if: Array.from({ length: 7 }, () => ({ fact: 'turn', cmp: 'gte', value: 1 })) })).ok, false);
});

test('a stack drops what is invalid or duplicated, says so, and obeys the rest', () => {
  const stack = [{ name: 'a', rules: [rule({ id: 'ok', then: [{ do: 'modify', stat: 'cost', add: 2 }] }), { id: 'bad', layer: 9 }, rule({ id: 'ok', then: [{ do: 'modify', stat: 'cost', add: 5 }] })] }];
  const { rules, conflicts } = E.resolveStack(stack);
  assert.deepEqual(rules.map((r) => r.id), ['ok']);
  assert.deepEqual(conflicts.map((c) => c.kind), ['invalid', 'duplicate-id']);
  assert.equal(cost(stack).spent, 2);
  assert.match(E.explain(conflicts)[0], /^A rule from the a set \(bad\) was left out: /);
});

test('layers settle in a fixed order whatever the load order: replace (1), then modify (2)', () => {
  const rep = rule({ id: 'rep', layer: 1, then: [{ do: 'replace', stat: 'cost', value: 4 }] }), mod = rule({ id: 'mod', then: [{ do: 'modify', stat: 'cost', add: 1 }] });
  assert.equal(cost(only(mod, rep)).spent, 5);
  assert.equal(cost(only(rep, mod)).spent, 5);
  assert.deepEqual(E.resolveStack(only(mod, rep)).rules.map((r) => r.id), ['rep', 'mod']);
});

test('within a layer the timestamp (load order) decides: a clamp first and an addition after differ from the reverse', () => {
  const clamp = rule({ id: 'clamp', then: [{ do: 'modify', stat: 'cost', add: 5, max: 3 }] }), plus = rule({ id: 'plus', then: [{ do: 'modify', stat: 'cost', add: 1 }] });
  assert.equal(cost(only(clamp, plus)).spent, 4, '5 clamped to 3, then 1 more');
  assert.equal(cost(only(plus, clamp)).spent, 3, '1, then 1 + 5 clamped to 3');
  assert.equal(cost([{ name: 'one', rules: [clamp] }, { name: 'two', rules: [plus] }]).spent, 4, 'load order runs across sets in the stack');
});

test('can\'t beats can: in one layer a deny beats an allow; a lower layer beats a higher one; the loser is logged', () => {
  const deny = (o) => rule({ id: 'deny', layer: 1, then: [{ do: 'deny', reason: 'the gate is shut' }], ...o }), allow = (o) => rule({ id: 'allow', layer: 1, then: [{ do: 'allow', reason: 'the gate is open' }], ...o });
  const go = (stack) => E.step(E.newGame(), { type: 'summon', def: def({}), parent: 'y1', slot: 0 }, stack);
  let r = go(only(allow(), deny())); assert.equal(r.denied.rule, 'deny');
  const c = r.conflicts.find((x) => x.kind === 'clash');
  assert.deepEqual([c.winner.rule, c.losers[0].rule], ['deny', 'allow']);
  assert.match(E.explain([c])[0], /both are layer 1, and can't beats can/);
  r = go(only(deny({ layer: 2 }), allow({ layer: 1 }))); assert.equal(r.denied, null, 'the layer 1 allow beats the layer 2 deny');
  assert.deepEqual(r.conflicts.filter((x) => x.kind === 'clash').map((x) => [x.winner.rule, x.losers[0].rule]), [['allow', 'deny']]);
  r = go(only(deny({ layer: 1 }), allow({ layer: 2 }))); assert.equal(r.denied.rule, 'deny');
  assert.match(E.explain(r.conflicts.filter((x) => x.kind === 'clash'))[0], /layer 1 is settled before layer 2/);
  assert.equal(go(only(allow())).conflicts.filter((x) => x.kind === 'clash').length, 0, 'an allow nobody contradicts is no clash');
  assert.equal(go(only(deny())).state.cards.length, 2, 'a denied event changes nothing');
});

test('a rule that dependsOn another is applied after it, however it was loaded; cycles and missing rules drop their rules with a logged conflict', () => {
  const first = rule({ id: 'first', then: [{ do: 'modify', stat: 'cost', add: 5, max: 3 }] }), second = rule({ id: 'second', then: [{ do: 'modify', stat: 'cost', add: 1 }], dependsOn: ['first'] });
  assert.deepEqual(E.resolveStack(only(second, first)).rules.map((r) => r.id), ['first', 'second']);
  assert.equal(cost(only(second, first)).spent, 4);
  const a = rule({ id: 'a', dependsOn: ['b'] }), b = rule({ id: 'b', dependsOn: ['a'] }), c = rule({ id: 'c', dependsOn: ['a'] }), d = rule({ id: 'd' });
  const res = E.resolveStack(only(a, b, c, d));
  assert.deepEqual(res.rules.map((r) => r.id), ['d']);
  assert.deepEqual(res.conflicts.map((x) => x.kind), ['cycle', 'unknown-dependency']);
  assert.deepEqual(res.conflicts[0].rules.sort(), ['a', 'b']);
  assert.equal(E.explain(res.conflicts)[0], 'Rules "a" and "b" depend on each other in a circle, so all of them were left out.');
  assert.deepEqual(E.resolveStack(only(rule({ id: 'x', dependsOn: ['nobody'] }))).conflicts.map((x) => x.kind), ['unknown-dependency']);
  const late = rule({ id: 'late', layer: 3, when: 'pass', then: [{ do: 'endTurn' }] }), early = rule({ id: 'early', layer: 1, when: 'pass', then: [{ do: 'allow' }], dependsOn: ['late'] });
  assert.deepEqual(E.resolveStack(only(late, early)).conflicts.map((x) => x.kind), ['dependency-layer']);
});

test('the engine is deterministic and never touches the state it is given', () => {
  const stack = stackOf('duel', 'mana', 'tribute'), s0 = E.startGame(E.newGame(), stack).state, frozen = JSON.stringify(s0);
  const ev = { type: 'summon', def: def({ name: 'Ox', power: 3, resistance: 3 }), parent: 'y1', slot: 0 };
  const r1 = E.step(s0, ev, stack), r2 = E.step(s0, ev, stack);
  assert.equal(JSON.stringify(s0), frozen); assert.deepEqual(r1, r2);
  const g1 = playTurns(stack, { turns: 6 }), g2 = playTurns(stack, { turns: 6 });
  assert.deepEqual(playLines(g1), playLines(g2)); assert.deepEqual(g1.state, g2.state);
  assert.equal(E.step(s0, { type: 'dance' }, stack).denied.reason, 'unknown event');
  assert.equal(E.step({ ...s0, over: { winner: 'you' } }, ev, stack).denied.reason, 'the game is over');
});

test('the engine source holds no eval, no Function constructor, no dynamic import, no network and no clock or dice', () => {
  for (const f of ['rules-engine.js', 'rule-propose.js', 'rules-play.js']) {
    const src = fs.readFileSync(path.join(lib, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of [/\beval\s*\(/, /new\s+Function/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /Math\.random/, /Date\.now/, /new Date/, /\brequire\s*\(/, /setTimeout/]) assert.doesNotMatch(src, bad, f + ' ' + bad);
  }
  assert.ok(fs.readFileSync(path.join(lib, 'rules-engine.js'), 'utf8').split('\n').length < 400);
});

test('all six rule sets are valid data and stack together without a single dropped rule', () => {
  assert.deepEqual(fs.readdirSync(path.join(lib, 'rulesets')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort(), SET_NAMES.slice().sort());
  const stack = SET_NAMES.map(set), res = E.resolveStack(stack);
  assert.deepEqual(res.conflicts, []);
  for (const s of stack) { assert.ok(s.title && s.about && s.name); assert.ok(s.rules.length >= 2); for (const r of s.rules) assert.equal(E.validateRule(r).ok, true, r.id); }
  assert.equal(res.rules.length, stack.reduce((n, s) => n + s.rules.length, 0));
  assert.equal(/yu-gi-oh|magic the|dungeons|pokemon/i.test(JSON.stringify(stack)), false, 'no other game\'s name is in the data');
});

// ---- the duel as rules reproduces lib/duel-rules.js, the reference implementation
function sameGame(pools, label) {
  const stack = stackOf('duel'); let d = D.newState({ pool: { void: pools.void } }); d.pool.you = pools.you;
  let e = E.startGame(E.newGame(), stack).state, n = 0;
  const key = (cs) => cs.map((c) => [c.id, c.name, c.power, c.resistance, c.income, c.neutralised, c.parent, c.slot, c.root].join()).join('|');
  while (!d.over && n < 300) {
    n++; let a = D.opponentMove(d); if (a.type === 'attack') a = { ...a, answer: D.defenderAnswer(d, a) };
    d = D.apply(d, a);
    const r = E.step(e, a.type === 'summon' ? { type: 'summon', def: a.card, parent: a.parent, slot: a.slot } : a.type === 'attack' ? { type: 'attack', from: a.from, target: a.target, pledge: a.pledge || 0, answer: a.answer } : { type: 'pass' }, stack);
    assert.equal(r.denied, null, label + ' step ' + n + ' ' + JSON.stringify(a) + ' ' + JSON.stringify(r.denied)); e = r.state;
    assert.equal(key(e.cards), key(d.cards), label + ' cards after step ' + n);
    assert.deepEqual({ you: e.res.you.coins, void: e.res.void.coins }, d.treasury, label + ' treasury after step ' + n);
    assert.equal(e.turn, d.turn, label + ' turn'); if (!d.over) assert.equal(e.side, d.side, label + ' side');
  }
  assert.ok(d.over, label + ' ended'); assert.equal(e.over.winner, d.over.winner); assert.equal(e.over.why, d.over.why);
  return { n, over: d.over };
}
test('the duel written as data plays exactly like duel-rules.js on the same scripted games (cards, Treasuries, turns, the winner and why)', () => {
  const strong = { you: [D.card({ name: 'Ox', power: 9, resistance: 9, arrows: 3 }), D.card({ name: 'Bank', power: 1, resistance: 3, income: 2 })], void: [D.card({ name: 'Wolf', power: 5, resistance: 5, arrows: 2 }), D.card({ name: 'Pup', power: 3, resistance: 2 })] };
  const mixed = { you: [D.card({ name: 'Ox', power: 6, resistance: 6, arrows: 2 }), D.card({ name: 'Bank', power: 1, resistance: 3, income: 2 })], void: [D.card({ name: 'Wolf', power: 9, resistance: 9, arrows: 3 }), D.card({ name: 'Pup', power: 3, resistance: 2 })] };
  const games = [sameGame(strong, 'strong'), sameGame(mixed, 'mixed'), sameGame({ you: [D.card({ name: 'a', power: 2, resistance: 2 })], void: [D.card({ name: 'b', power: 2, resistance: 2 })] }, 'small')];
  assert.ok(games.some((g) => g.over.why === 'root'), 'one game ends by a fallen Root');
  assert.ok(games.some((g) => g.over.why === 'power'), 'one game ends on Power after 12 turns');
});

test('the duel as data refuses what duel-rules.js refuses', () => {
  const stack = stackOf('duel'); let s = E.startGame(E.newGame(), stack).state;
  const no = (ev, why) => { const r = E.step(s, ev, stack); assert.ok(r.denied, JSON.stringify(ev)); assert.match(r.denied.reason, why); };
  no({ type: 'summon', def: def({}), parent: 'v2', slot: 0 }, /your own cards/);
  no({ type: 'summon', def: def({}), parent: 'y1', slot: 2 }, /not open/);
  no({ type: 'attack', from: 'y1', target: 'y1', pledge: 0 }, /no second card/);
  no({ type: 'attack', from: 'v2', target: 'y1', pledge: 0 }, /one of your own/);
  no({ type: 'attack', from: 'y1', target: 'v2', pledge: 99 }, /more than the Treasury/);
  s = sum(s, def({}), 'y1', 0, stack); no({ type: 'summon', def: def({}), parent: 'y1', slot: 0 }, /not open/);
  s = sum(s, def({}), 'y1', 1, stack); assert.equal(s.side, 'void', 'two actions end the turn');
  no({ type: 'summon', def: def({}), parent: 'y1', slot: 0 }, /your own cards/);
});

// ---- two games at once, worked out by hand
test('stacked: the duel and the tribute set. A strong card is refused (a clash the layers settle), then allowed with a material', () => {
  const stack = stackOf('duel', 'tribute'); let s = E.startGame(E.newGame(), stack).state;
  assert.deepEqual([s.res.you.coins, s.actionsLeft], [8, 2], 'income 2 on top of 6, two actions');
  const drake = def({ name: 'Ember Drake', kind: 'creature', power: 7, resistance: 4 });
  let r = E.step(s, { type: 'summon', def: drake, parent: 'y1', slot: 0 }, stack);
  assert.equal(r.denied.set, 'tribute'); assert.equal(r.denied.rule, 'tribute-strong-needs-material'); assert.equal(r.state, s);
  const clash = r.conflicts.find((c) => c.kind === 'clash');
  assert.deepEqual([clash.winner.set, clash.winner.rule, clash.winner.layer, clash.losers[0].set, clash.losers[0].rule, clash.losers[0].layer], ['tribute', 'tribute-strong-needs-material', 1, 'duel', 'duel-any-idea', 2]);
  assert.equal(E.explain([clash])[0], 'Clash on the summon: the tribute rules (rule "tribute-strong-needs-material", layer 1, forbids: a card of Power 6 or more needs one of your cards given up as material) against the duel rules (rule "duel-any-idea", layer 2, allows: any idea may be summoned). The first wins, because layer 1 is settled before layer 2.');
  assert.equal(E.explain(r.log.filter((l) => l.kind === 'deny'))[0], 'The tribute rules (rule "tribute-strong-needs-material") blocked the summon because a card of Power 6 or more needs one of your cards given up as material.');
  s = E.step(s, { type: 'summon', def: def({ name: 'Scout', power: 2, resistance: 2 }), parent: 'y1', slot: 0 }, stack).state;
  assert.deepEqual([s.res.you.coins, s.actionsLeft, s.cards.length], [7, 1, 3], 'price ceil(4/4) = 1');
  r = E.step(s, { type: 'summon', def: drake, parent: 'y1', slot: 1, materials: ['y3'] }, stack); s = r.state;
  assert.equal(s.cards.find((c) => c.name === 'Ember Drake').power, 8, 'the material lends one Power (layer 2)');
  assert.equal(s.cards.some((c) => c.id === 'y3'), false, 'the material was given up (layer 3)');
  assert.deepEqual([s.res.you.coins, s.turn, s.side, s.res.void.coins, s.actionsLeft], [4, 1, 'void', 8, 2], 'price ceil(11/4) = 3 from 7; the second action ends the turn; void collects 2');
  assert.ok(E.explain(r.log).some((l) => /give up Scout as material/.test(l)));
  assert.match(E.step(s, { type: 'summon', def: drake, parent: 'v2', slot: 0, materials: ['y1'] }, stack).denied.reason, /is not one of your cards in play/, 'a Root is never material');
});

test('stacked: the mana set. One land a turn, and every land pays a coin each turn; a card costs its printed coins', () => {
  const stack = stackOf('mana'); let s = E.startGame(E.newGame({ coins: 0 }), stack).state;
  assert.equal(s.res.you.coins, 0);
  s = E.step(s, { type: 'land' }, stack).state; assert.equal(s.res.you.lands, 1);
  assert.equal(E.step(s, { type: 'land' }, stack).denied.reason, 'only one land can be played each turn');
  s = E.step(s, { type: 'pass' }, stack).state; assert.deepEqual([s.side, s.turn], ['void', 1]);
  s = E.step(s, { type: 'pass' }, stack).state; assert.deepEqual([s.side, s.turn, s.res.you.coins, s.landsThisTurn], ['you', 2, 1, 0], 'one land pays one coin at the turn start');
  const sc = def({ name: 'Scout', cost: 2 });
  assert.equal(E.step(s, { type: 'summon', def: sc, parent: 'y1', slot: 0 }, stack).denied.reason, 'you need 2 coins and have 1');
  s = E.step(s, { type: 'land' }, stack).state; s = E.step(s, { type: 'pass' }, stack).state; s = E.step(s, { type: 'pass' }, stack).state;
  assert.equal(s.res.you.coins, 3, 'two lands now pay two coins');
  assert.equal(E.step(s, { type: 'summon', def: sc, parent: 'y1', slot: 0 }, stack).state.res.you.coins, 1);
});

test('stacked: the duel and the initiative set. The faster side goes first next round and gets one more action', () => {
  const stack = stackOf('duel', 'initiative'); let s = E.startGame(E.newGame(), stack).state;
  s = E.step(s, { type: 'pass' }, stack).state; assert.deepEqual([s.side, s.res.you.coins, s.res.void.coins, s.actionsLeft], ['void', 10, 8, 2]);
  s = E.step(s, { type: 'summon', def: def({ name: 'Scout', speed: 3 }), parent: 'v2', slot: 0 }, stack).state; assert.deepEqual([s.res.void.coins, s.actionsLeft], [7, 1]);
  const r = E.step(s, { type: 'pass' }, stack); s = r.state;
  assert.deepEqual(s.order, ['void', 'you'], 'the sides are put in order by total Speed');
  assert.deepEqual([s.side, s.turn, s.res.void.coins, s.actionsLeft], ['void', 2, 11, 3], 'void banked 2 (9), collects 2 (11), and has 2 actions + 1 for being faster');
  assert.ok(E.explain(r.log).includes('The initiative rules (rule "initiative-order"): the order of play by speed is void, then you.'));
});

test('stacked: merge. Two cards become one by the fixed rules, capped by a rule that dependsOn the sums; it must be your own two cards', () => {
  const stack = stackOf('merge'); let s = E.newGame();
  s = sum(s, def({ name: 'Wren', kind: 'song', power: 5, resistance: 3, income: 1 }), 'y1', 0, stack);
  s = sum(s, def({ name: 'Brook', kind: 'place', power: 4, resistance: 6, income: 2 }), 'y1', 1, stack);
  const r = E.step(s, { type: 'merge', from: 'y3', target: 'y4', name: 'Brook Song' }, stack), m = r.state.cards.find((c) => c.name === 'Brook Song');
  assert.deepEqual([m.power, m.resistance, m.income, r.state.cards.length], [7, 8, 3, 3], 'power 5 + ceil(4/2), resistance 6 + ceil(3/2), income 1 + 2');
  assert.ok(E.step(s, { type: 'merge', from: 'y3', target: 'y4' }, stack).state.cards.some((c) => c.name === 'Wren + Brook'));
  let h = sum(E.newGame(), def({ name: 'A', power: 12, resistance: 12 }), 'y1', 0, stack);
  h = sum(h, def({ name: 'B', power: 11, resistance: 10 }), 'y1', 1, stack);
  const cap = E.step(h, { type: 'merge', from: 'y3', target: 'y4' }, stack).state.cards.find((c) => c.name === 'A + B');
  assert.deepEqual([cap.power, cap.resistance], [12, 12]);
  assert.equal(E.step(s, { type: 'merge', from: 'y1', target: 'v2' }, stack).denied.reason, 'both cards must be yours');
});

test('stacked: lines. A piece slides in a straight line and no farther than its Speed', () => {
  const stack = stackOf('lines'); const s = sum(E.newGame(), def({ name: 'Rook', speed: 2 }), 'y1', 0, stack);
  const go = (to) => E.step(s, { type: 'move', from: 'y3', to }, stack);
  assert.equal(go({ x: 2, y: 0 }).denied, null);
  assert.deepEqual([go({ x: 2, y: 0 }).state.cards[2].x, go({ x: 0, y: -2 }).state.cards[2].y], [2, -2]);
  assert.equal(go({ x: 1, y: 1 }).denied.reason, 'a piece slides along a straight line');
  assert.equal(go({ x: 3, y: 0 }).denied.reason, 'a piece moves at most its Speed in squares');
});

test('a chain of rules that end the turn at every turn start is cut off, not looped', () => {
  const loop = rule({ id: 'spin', layer: 3, when: ['turnStart', 'pass'], then: [{ do: 'endTurn' }] });
  const r = E.step(E.newGame(), { type: 'pass' }, only(loop));
  assert.ok(r.state.turn <= 4); assert.ok(E.explain(r.log).some((l) => /cut off/.test(l)));
});

test('three games at once play a few turns and every clash is written in plain words', () => {
  const stack = stackOf('duel', 'mana', 'tribute'), play = playTurns(stack, { turns: 6 }), lines = playLines(play);
  assert.ok(play.steps.length > 8); assert.ok(lines.some((l) => l.startsWith('Clash on the summon: the tribute rules')));
  assert.ok(lines.every((l) => typeof l === 'string' && l.length > 3 && !/undefined|\[object|NaN/.test(l)), lines.find((l) => /undefined|\[object|NaN/.test(l)));
  assert.ok(lines.some((l) => /^Verse /.test(l)) && lines.some((l) => /^You /.test(l)));
  assert.equal(playLines(playTurns(stackOf('duel'), { turns: 2 })).some((l) => l.startsWith('Clash')), false, 'the duel alone clashes with nothing');
  const everything = playTurns(SET_NAMES.map(set), { turns: 8 }); assert.ok(everything.steps.length > 8 && everything.load.length === 0);
});

test('gamesOf reads "duel with mana and tribute rules" and refuses what is not two known games', () => {
  assert.deepEqual(gamesOf('duel with mana and tribute rules'), ['duel', 'mana', 'tribute']);
  assert.deepEqual(gamesOf('Play cards with initiative'), ['duel', 'initiative']);
  assert.deepEqual(gamesOf("let's play the duel and merge rules!"), ['duel', 'merge']);
  assert.deepEqual(gamesOf('play mana with tribute'), ['mana', 'tribute']);
  for (const no of ['duel', 'play chess', 'play football with friends', 'duel with a dragon', 'mana and tribute', 'play mana with mana', 'what is a duel with mana', '']) assert.equal(gamesOf(no), null, no);
});

// ---- propose a rule in words
test('proposeRule turns a few sentence shapes into rules that validate, and makes nothing up for anything else', () => {
  const a = proposeRule('When a song is summoned, gain 1'); assert.equal(E.validateRule(a.rule).ok, true);
  assert.deepEqual([a.rule.layer, a.rule.when, a.rule.if, a.rule.then], [3, 'summon', [{ fact: 'cardKind', cmp: 'eq', value: 'song' }], [{ do: 'gain', resource: 'coins', n: 1 }]]);
  const b = proposeRule('Creatures cannot attack on turn one.'); assert.equal(E.validateRule(b.rule).ok, true);
  assert.deepEqual([b.rule.layer, b.rule.when, b.rule.if], [1, 'attack', [{ fact: 'cardKind', cmp: 'eq', value: 'creature' }, { fact: 'round', cmp: 'eq', value: 1 }]]);
  const w = proposeRule('witches can\'t attack until turn 3').rule; assert.deepEqual([w.if[0].value, w.if[1]], ['witch', { fact: 'round', cmp: 'lt', value: 3 }]);
  const c = proposeRule('a card with power over 6 costs one more'); assert.equal(E.validateRule(c.rule).ok, true);
  assert.deepEqual([c.rule.layer, c.rule.when, c.rule.if, c.rule.then], [2, 'summon', [{ fact: 'cardPower', cmp: 'gt', value: 6 }], [{ do: 'modify', stat: 'cost', add: 1 }]]);
  assert.deepEqual(proposeRule('a card with speed at most 1 costs two less').rule.then, [{ do: 'modify', stat: 'cost', add: -2, min: 0 }]);
  assert.equal(proposeRule('cards cannot attack on turn two').rule.if.length, 1, 'cards in general carry no kind condition');
  for (const no of ['dragons rule the world', 'make the game more fun', 'when a song is summoned, delete the database', 'when a song is summoned, gain lots', 'a card with power over 6 costs one more; eval(1)', 'x', '', null, 'a'.repeat(300)]) {
    const r = proposeRule(no); assert.equal(r.rule, null, String(no)); assert.ok(r.reason.length > 10);
  }
  assert.match(proposeRule('make the game more fun').reason, /I understand: when a <kind> is summoned/);
  assert.deepEqual(proposeRule('when a song is summoned, gain 1'), proposeRule('when a song is summoned, gain 1'));
});

test('a rule proposed in words is obeyed by the engine like any other', () => {
  const stack = [{ name: 'mine', rules: [proposeRule('creatures cannot attack on turn one').rule, proposeRule('a card with power over 6 costs one more').rule, proposeRule('when a song is summoned, gain 1').rule] }];
  let s = sum(E.newGame(), def({ name: 'Wolf', kind: 'creature', power: 7, resistance: 1 }), 'y1', 0, stack);
  assert.equal(6 - s.res.you.coins, 1, 'free in this stack, plus the one more the proposed rule adds');
  assert.match(E.step(s, { type: 'attack', from: 'y3', target: 'v2', pledge: 0 }, stack).denied.reason, /creature/);
  s = sum(s, def({ name: 'Tune', kind: 'song' }), 'y1', 1, stack); assert.equal(s.res.you.coins, 6 - 1 + 1);
  s = { ...s, turn: 2 }; assert.equal(E.step(s, { type: 'attack', from: 'y3', target: 'v2', pledge: 0 }, stack).denied, null, 'turn two: the ban is over');
});
