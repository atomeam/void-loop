// tests for the learning pages (lib/learn-core.js, lib/learn-data.js, lib/learn-de.js, lib/learn-sites.js, the table's pages): every skill's problems and their worked
// steps, answer checking, fractions, mastery and spaced review, the flashcard review and decks, the word quiz's level, the typing tutor, the periodic table, the German
// words, the asks that reach the pages and the floor's pages. (tools/learn.test.mjs is another thing: Verse learning from its misses.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/learn-core.js';
import { ELEMENTS, WORDS, TYPE_WORDS } from '../void-live-deploy/lib/learn-data.js';
import { DE, TPL_DE, SKILL_DE, UNIT_DE } from '../void-live-deploy/lib/learn-de.js';
import { LEARN_SITES, learnAskOf } from '../void-live-deploy/lib/learn-sites.js';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { probeFor } from './tower-probes.mjs';

test('every skill makes sound problems: the answer checks, its steps fill, a wrong answer fails', () => {
  const r = C.rng(42);
  for (const s of C.SKILLS) for (let i = 0; i < 60; i++) {
    const p = C.problem(s.id, r); assert.ok(p && p.steps.length, s.id);
    assert.ok(C.check(p, p.answer), s.id + ' ' + C.fill(p.q) + ' accepts ' + p.answer);
    assert.ok(!C.check(p, '999999'), s.id + ' rejects a wrong answer');
    for (const st of [p.q, ...p.steps]) { const t = C.fill(st); assert.doesNotMatch(t, /\{\d\}|undefined|NaN/, s.id + ': ' + t); assert.ok(C.TPL[st.k], st.k); }
  }
  assert.equal(C.SKILLS.length, 25); assert.equal(new Set(C.SKILLS.map((s) => s.id)).size, 25);
  for (const u of C.UNITS) assert.match(u.video, /^https:\/\/www\.khanacademy\.org\/math\//);
});
test('worked solutions are right: 3/4 + 1/6, a borrow through zero, long division, an equation', () => {
  const f = C.problem('fadd', null, [3, 4, 1, 6]); assert.equal(f.answer, '11/12'); assert.deepEqual(f.steps.map((s) => C.fill(s)), ['Common denominator: the least common multiple of 4 and 6 is 12', 'Rewrite: 3/4 = 9/12 and 1/6 = 2/12', 'Add the tops: 9 + 2 = 11, so the answer is 11/12']);
  assert.ok(C.check(f, '22/24') && C.check(f, ' 11 / 12 ') && !C.check(f, '4/10'), 'equal fractions in any form');
  const s = C.problem('sub3', null, [702, 358]); assert.equal(s.answer, '344'); assert.match(C.fill(s.steps[1]), /becomes 9: 9 − 5 = 4/);
  const d = C.problem('longdiv', null, [518, 5]); assert.equal(d.answer, '103 R 3'); assert.ok(C.check(d, '103 r 3') && C.check(d, '103 R3') && C.check(d, '103 Rest 3') && !C.check(d, '103'));
  const e = C.problem('eq2', null, [4, 14, -5]); assert.equal(e.answer, '−5'); assert.ok(C.check(e, '-5') && C.check(e, '−5'));
  const pc = C.problem('pct', null, [15, 80]); assert.equal(pc.answer, '12'); assert.ok(C.check(pc, '12') && C.check(pc, '12.0'));
  assert.equal(C.problem('f2p', null, [3, 4]).answer, '75'); assert.equal(C.problem('order', null, [1, 2, 3, 4]).answer, '20'); assert.equal(C.problem('order', null, [0, 2, 3, 4]).answer, '14');
  assert.equal(C.problem('times', null, [7, 8]).answer, '56'); assert.match(C.fill(C.timesSteps(7, 8)[0]), /Split 8 into 5 \+ 3/);
  assert.ok(C.problem('fadd', C.rng(1), [1, 0, 1, 2]).answer, 'a zero bottom falls back to a picked problem');
});
test('fractions: parse, operate, mixed numbers, the calculator and decimals', () => {
  assert.deepEqual(C.parseFrac('1 1/2'), { n: 3, d: 2 }); assert.deepEqual(C.parseFrac('-2 1/4'), { n: -9, d: 4 }); assert.deepEqual(C.parseFrac('0.75'), { n: 3, d: 4 }); assert.deepEqual(C.parseFrac('6/8'), { n: 3, d: 4 }); assert.equal(C.parseFrac('1/0'), null); assert.equal(C.parseFrac('abc'), null);
  assert.equal(C.parseNum('1,5'), 1.5); assert.equal(C.parseNum('1,500'), 1500); assert.equal(C.parseNum('25%'), 25); assert.equal(C.parseNum('−3'), -3);
  assert.equal(C.mixedStr(C.F(7, 2)), '3 1/2'); assert.equal(C.mixedStr(C.F(-7, 2)), '−3 1/2'); assert.equal(C.fstr(C.F(4, 2)), '2');
  const r = C.fracCalc('1 1/2', 'mul', '2/3'); assert.equal(C.fstr(r.val), '1'); const q = C.fracCalc('5/6', 'div', '1/3'); assert.equal(C.fstr(q.val), '5/2'); assert.equal(q.mixed, '2 1/2'); assert.equal(q.decimal, '2.5');
  assert.equal(C.fracCalc('1/2', 'div', '0'), null); assert.equal(C.fracCalc('x', 'add', '1/2'), null);
  const dd = C.decToFrac('0.375'); assert.equal(C.fstr(dd.val), '3/8'); assert.match(C.fill(dd.steps[0]), /375\/1000/);
  const w = C.worksheet('fadd', 20, 7), w2 = C.worksheet('fadd', 20, 7); assert.equal(w.length, 20); assert.deepEqual(w.map((p) => p.answer), w2.map((p) => p.answer), 'the same seed makes the same sheet');
});
test('mastery: 3, 6 and 10 right in a row; Mastered needs two days; a miss drops a level; reviews come back later', () => {
  let r; for (let i = 0; i < 3; i++) r = C.recordAnswer(r, true, false, '2026-10-01'); assert.equal(r.level, 2);
  for (let i = 0; i < 3; i++) r = C.recordAnswer(r, true, false, '2026-10-01'); assert.equal(r.level, 3); assert.equal(r.due, '2026-10-06');
  for (let i = 0; i < 4; i++) r = C.recordAnswer(r, true, false, '2026-10-01'); assert.equal(r.level, 3, 'ten in a row on one day is not mastered');
  r = C.recordAnswer(r, true, false, '2026-10-03'); assert.equal(r.level, 4); assert.equal(r.due, '2026-10-17');
  r = C.recordAnswer(r, false, false, '2026-10-17'); assert.equal(r.level, 3); assert.equal(r.run, 0);
  const h = C.recordAnswer(undefined, true, true, '2026-10-01'); assert.equal(h.run, 0, 'a hinted answer does not count toward mastery'); assert.equal(h.level, 1);
  assert.deepEqual(C.dueSkills({ fadd: { level: 2, due: '2026-10-02' }, times: { level: 3, due: '2026-10-09' }, nope: { level: 2, due: '2026-10-01' } }, '2026-10-05'), ['fadd']);
  assert.equal(C.courseProgress({ fadd: { level: 4 } }).pct, 4); assert.equal(C.courseProgress({}).pct, 0);
  assert.equal(C.streak(['2026-10-03', '2026-10-04', '2026-10-05'], '2026-10-05'), 3); assert.equal(C.streak(['2026-10-03', '2026-10-04'], '2026-10-05'), 2); assert.equal(C.streak(['2026-10-01'], '2026-10-05'), 0);
});
test('flashcards: the review grows intervals; decks from pasted text, CSV and a link', () => {
  let c = C.reviewCard({}, 'good', '2026-10-01'); assert.equal(c.ivl, 1); c = C.reviewCard(c, 'good', '2026-10-02'); assert.equal(c.ivl, 3); c = C.reviewCard(c, 'good', '2026-10-05'); assert.equal(c.ivl, 8); assert.equal(c.due, '2026-10-13');
  const a = C.reviewCard(c, 'again', '2026-10-13'); assert.equal(a.ivl, 0); assert.equal(a.lapses, 1); assert.ok(a.ease < c.ease); assert.equal(C.reviewCard({}, 'easy', '2026-10-01').ivl, 4);
  assert.deepEqual(C.parseDeck('hola\thello\ngato = cat\nperro - dog\n"a, b","c"\n# note\nbad line\nx;y'), [{ f: 'hola', b: 'hello' }, { f: 'gato', b: 'cat' }, { f: 'perro', b: 'dog' }, { f: 'a, b', b: 'c' }, { f: 'x', b: 'y' }]);
  const d = { name: 'Ünïcode ✓', cards: [{ f: 'a<b>', b: 'ß' }, { f: 'x', b: 'y' }] }, back = C.deckOfToken(C.deckToken(d)); assert.deepEqual(back, d); assert.equal(C.deckOfToken('!!notatoken'), null);
  assert.equal(C.dueCards([{ due: '2026-10-09' }, {}, { due: '2026-10-01' }], '2026-10-05').length, 2);
  const cs = [{ f: '1', b: 'a' }, { f: '2', b: 'b' }, { f: '3', b: 'c' }, { f: '4', b: 'd' }, { f: '5', b: 'e' }], ch = C.choicesFor(cs, 2, C.rng(1)); assert.equal(ch.length, 4); assert.ok(ch.includes('c')); assert.equal(new Set(ch).size, 4);
});
test('the word quiz: 100 words over five levels; three right go up, a miss goes down', () => {
  assert.equal(WORDS.length, 100); for (let l = 1; l <= 5; l++) assert.equal(WORDS.filter((w) => w.level === l).length, 20, 'level ' + l);
  assert.equal(new Set(WORDS.map((w) => w.word)).size, 100); for (const w of WORDS) assert.ok(w.def && w.de, w.word);
  let s = {}; for (let i = 0; i < 3; i++) s = C.vocabStep(s, true); assert.equal(s.level, 2); s = C.vocabStep(s, false); assert.equal(s.level, 1); s = C.vocabStep(s, false); assert.equal(s.level, 1);
  const q = C.vocabQuestion(WORDS, 3, C.rng(3)); assert.equal(q.choices.length, 4); assert.ok(q.choices.includes(q.answer)); assert.equal(WORDS.find((w) => w.word === q.word).level, 3);
  const g = C.vocabQuestion(WORDS, 1, C.rng(3), [], 'de'); assert.equal(WORDS.find((w) => w.word === g.word).de, g.answer);
});
test('the typing tutor: lessons use only the open letters; speed, per-key numbers and the next letter', () => {
  const L = [...C.KEY_ORDER.en].slice(0, 6), text = C.lesson(L, TYPE_WORDS.en, C.rng(9), 14); assert.ok([...text.replace(/ /g, '')].every((c) => L.includes(c)), text); assert.equal(text.split(' ').length, 14);
  const LD = [...C.KEY_ORDER.de].slice(0, 6); assert.ok([...C.lesson(LD, TYPE_WORDS.de, C.rng(2))].every((c) => c === ' ' || LD.includes(c)));
  assert.equal(C.wpm(50, 60000), 10); assert.equal(C.wpm(0, 0), 0);
  const st = C.keyStats([{ k: 'e', ok: true, ms: 200 }, { k: 'e', ok: true, ms: 200 }, { k: 'e', ok: false, ms: 900 }, { k: 'n', ok: true, ms: 400 }]); assert.equal(st.e.n, 3); assert.equal(st.e.miss, 1); assert.equal(st.e.wpm, 60); assert.equal(st.e.acc, 67); assert.equal(st.n.wpm, 30);
  const fast = Object.fromEntries(L.map((c) => [c, { n: 20, wpm: 40, acc: 95 }])); assert.deepEqual(C.nextLetters(L, fast, C.KEY_ORDER.en), [...L, 's']); assert.deepEqual(C.nextLetters(L, { ...fast, e: { n: 20, wpm: 10, acc: 95 } }, C.KEY_ORDER.en), L);
});
test('times tables: facts, speed points and known facts', () => {
  assert.equal(C.timesFacts([2, 7]).length, 24); assert.equal(C.speedPoints(true, 6.4), 16); assert.equal(C.speedPoints(false, 9), 0);
  let s = C.factAnswer(undefined, true, 2000); assert.ok(!C.known(s)); s = C.factAnswer(s, true, 3000); assert.ok(C.known(s)); s = C.factAnswer(s, false, 1000); assert.ok(!C.known(s));
});
test('the periodic table: 118 elements, places, families, configurations and search', () => {
  const E = C.unpackElements(ELEMENTS); assert.equal(E.length, 118); assert.equal(new Set(E.map((e) => e.sym)).size, 118); assert.equal(new Set(E.map((e) => e.row + ':' + e.col)).size, 118, 'no two in one cell');
  const by = (s) => E.find((e) => e.sym === s);
  assert.deepEqual([by('Fe').z, by('Fe').mass, by('Fe').group, by('Fe').period, by('Fe').block, by('Fe').config], [26, '55.845', 8, 4, 'd', '[Ar] 3d6 4s2']);
  assert.equal(by('B').group, 13); assert.equal(by('Ne').group, 18); assert.equal(by('He').group, 18); assert.equal(by('Hf').group, 4); assert.equal(by('La').group, null); assert.equal(by('Og').group, 18);
  assert.equal(by('Cr').config, '[Ar] 3d5 4s1'); assert.equal(by('Cu').config, '[Ar] 3d10 4s1'); assert.equal(by('O').config, '[He] 2s2 2p4'); assert.equal(by('Pb').config, '[Xe] 4f14 5d10 6s2 6p2'); assert.equal(by('H').config, '1s1');
  assert.equal(by('Na').cat, 'alkali'); assert.equal(by('Cl').cat, 'halogen'); assert.equal(by('Ar').cat, 'noble'); assert.equal(by('U').cat, 'actinide'); assert.equal(by('Si').cat, 'metalloid');
  assert.equal(by('Hg').state, 'liquid'); assert.equal(by('N').state, 'gas'); assert.equal(by('Fe').state, 'solid'); assert.equal(by('Og').state, 'unknown'); assert.ok(!by('Tc').stable); assert.ok(by('Fe').stable);
  // standard atomic weights rise with the number except the four known inversions (Ar/K, Co/Ni, Te/I, Th/Pa); a mass number in brackets may fall back
  for (const e of E.slice(1)) { const prev = E[e.z - 2]; if (e.stable && prev.stable && !['K', 'Ni', 'I', 'Pa'].includes(e.sym)) assert.ok(+e.mass > +prev.mass, 'the weight rises at ' + e.sym); }
  assert.equal(C.findElement(E, 'fe').sym, 'Fe'); assert.equal(C.findElement(E, 'Eisen').sym, 'Fe'); assert.equal(C.findElement(E, '79').sym, 'Au'); assert.equal(C.findElement(E, 'oxy').sym, 'O'); assert.equal(C.findElement(E, 'molybdan').sym, 'Mo'); assert.equal(C.findElement(E, ''), null);
});
test('the German words: every template with the same places, every skill, unit and string of the screen', () => {
  assert.deepEqual(Object.keys(TPL_DE).sort(), Object.keys(C.TPL).sort());
  for (const k of Object.keys(C.TPL)) assert.deepEqual([...new Set(TPL_DE[k].match(/\{\d\}/g) || [])].sort(), [...new Set(C.TPL[k].match(/\{\d\}/g) || [])].sort(), 'the same places in ' + k);
  for (const s of C.SKILLS) assert.ok(SKILL_DE[s.id], s.id); for (const u of C.UNITS) assert.ok(UNIT_DE[u.id], u.id);
  for (const l of C.LEVELS) assert.ok(DE[l], l);
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/learn-ui.js', import.meta.url), 'utf8'), missing = [];
  for (const m of src.matchAll(/\b(?:t|btn)\('((?:[^'\\]|\\.)+)'/g)) if (!DE[m[1].replace(/\\u2019/g, '’')] && m[1] !== '=') missing.push(m[1]);
  for (const m of src.matchAll(/panel\('[a-z]+', '((?:[^'\\]|\\.)+)'/g)) if (!DE[m[1]]) missing.push(m[1]);
  assert.deepEqual(missing, [], 'German for every string of the screen');
  for (const w of ['ones', 'tens', 'hundreds', 'to the left', 'to the right']) assert.ok(DE[w], w);
});
test('the asks that reach the pages, and the ones that stay elsewhere', () => {
  for (const [ask, page] of [['periodic table', '/learn/periodic/'], ['interactive periodic table', '/learn/periodic/'], ['times tables', '/learn/times/'], ['multiplication practice', '/learn/times/'], ['times tables speed test', '/learn/times/'], ['typing practice', '/learn/typing/'], ['learn to type', '/learn/typing/'], ['typing test', '/learn/typing/'],
    ['flashcards', '/learn/cards/'], ['flashcard maker', '/learn/cards/'], ['spaced repetition flashcards', '/learn/cards/'], ['fraction calculator', '/learn/fractions/'], ['simplify fractions', '/learn/fractions/'], ['decimal to fraction', '/learn/fractions/'], ['vocabulary quiz', '/learn/vocab/'], ['math practice', '/learn/'], ['practice fractions', '/learn/'], ['math worksheet generator', '/learn/']]) assert.equal(learnAskOf(ask), page, ask);
  for (const ask of ['quiz me', 'quiz me on this', 'flashcards: hola = hello', 'what is 3/4 + 1/6', 'periodic table of my life', 'times', 'typing', 'my period']) assert.equal(learnAskOf(ask), '', ask);
  for (const r of LEARN_SITES) assert.equal(learnAskOf(r.card), r.path, 'the card ask of ' + r.path + ' opens its own page');
});
test('the floor and its lane: every lane site has its own page, row and probe', () => {
  const lane = FLOORS.filter((f) => f.lane === 'learning'); assert.ok(lane.length >= 5);
  for (const f of lane) { const page = LANE_PAGES[f.id]; assert.ok(page, f.id); assert.ok(LEARN_SITES.some((r) => r.path === page && r.lane === f.id), f.id + ' has a row'); assert.equal(f.page, page); const p = probeFor(f.id); assert.equal(p.verse, page); assert.ok(p.ownFacts && p.truth.length >= 3, f.id + ' asks its own question'); for (const a of f.extra) assert.ok(p.askParts[a], f.id + ': ' + a + ' is asked about'); }
  for (const a of FLOORS.find((f) => f.id === 'learning').extra) assert.ok(probeFor('learning').askParts[a], a);
  assert.equal(FLOORS.find((f) => f.id === 'learning').page, '/learn/'); assert.equal(probeFor('learning').verse, '/learn/');
  for (const r of LEARN_SITES) { assert.ok(r.panels.length && r.de && r.de.h1 && r.de.intro, r.path); assert.doesNotMatch(r.intro + r.does + r.asks.join(' ') + r.h1, /\.com\b|\.org\b|\.net\b|khan/i, r.path + ' names no other site'); assert.ok(fs.existsSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url)), r.path); assert.ok(fs.existsSync(new URL('../void-live-deploy/og/' + r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png', import.meta.url)), r.path + ' share picture'); }
});
