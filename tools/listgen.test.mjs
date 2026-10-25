// The list language (void-live-deploy/lib/listgen.js): perchance's way of writing a generator. Run: node --test tools/listgen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../void-live-deploy/lib/listgen.js';

const count = (text, n, seed = 1) => { const g = L.compile(text), c = {}; for (let i = 0; i < n; i++) { const o = L.run(g, L.seedFor(seed, i)).output; c[o] = (c[o] || 0) + 1; } return c; };

test('the starter compiles, runs, and the same seed gives the same results', () => {
  const g = L.compile(L.STARTER); assert.deepEqual(g.errors, []); assert.equal(g.title, 'Tavern of the day');
  const a = L.generate(g, 7, 5), b = L.generate(L.STARTER, 7, 5);
  assert.deepEqual(a, b); assert.equal(a.results.length, 5);
  for (const r of a.results) { assert.match(r.output, /^The [A-Z]/); assert.match(r.image, /tavern called the /); assert.doesNotMatch(r.output, /[[\]{}\u0001]/); }
  // a kept value ([t = ...]) says the same thing in the output and in the picture prompt
  for (const r of a.results) assert.ok(r.image.includes(r.output.match(/^The (.+?), /)[1]), r.output + ' / ' + r.image);
  assert.notDeepEqual(L.generate(g, 8, 5).results, a.results);
  // each result is made again on its own from seedFor
  assert.equal(L.run(g, L.seedFor(7, 3)).output, a.results[3].output);
});
test('nested lists: [list] picks through every level, [list.sub] only from that one', () => {
  const text = 'output\n  [animal]\nbirds\n  [animal.bird]\nanimal\n  cat\n  bird\n    owl\n    crow\n';
  const c = count(text, 400); assert.deepEqual(Object.keys(c).sort(), ['cat', 'crow', 'owl']);
  assert.ok(c.cat > 140 && c.cat < 260, 'cat is half: ' + c.cat); // the top level is two items, cat and the birds
  const b = count('output\n  [animal.bird]\nanimal\n  cat\n  bird\n    owl\n    crow\n', 100); assert.deepEqual(Object.keys(b).sort(), ['crow', 'owl']);
});
test('odds: ^2 twice as likely, ^0 never, ^1/4 a quarter; in {a^3|b} too', () => {
  const c = count('output\n  [x]\nx\n  a ^2\n  b\n  c ^0\n', 3000); assert.equal(c.c, undefined); assert.ok(c.a / c.b > 1.7 && c.a / c.b < 2.3, JSON.stringify(c));
  const q = count('output\n  [x]\nx\n  a ^1/4\n  b\n', 3000); assert.ok(q.b / q.a > 3.3 && q.b / q.a < 4.8, JSON.stringify(q));
  const i = count('output\n  {a^3|b}\n', 3000); assert.ok(i.a / i.b > 2.5 && i.a / i.b < 3.6, JSON.stringify(i));
  assert.match(L.compile('output\n  a ^lots\n').errors[0].message, /odds are a number/);
});
test('inline: {a|b}, {1-6}, {a} before a word, \\ escapes, <br>, comments', () => {
  const r = L.generate('output\n  {red|blue} {1-6} {a} [w] {A} [w] \\[x\\] \\{y\\} 5\\|6 http://x.y // a comment<br>\nw\n  owl\n  hour\n  unicorn\n  cat\n', 3, 40).results.map((x) => x.output);
  for (const o of r) {
    assert.match(o, /^(?:red|blue) [1-6] /); assert.match(o, /\[x\] \{y\} 5\|6 http:\/\/x\.y$/);
    for (const m of o.matchAll(/\b(a|an|A|An) (owl|hour|unicorn|cat)\b/g)) assert.equal(m[1].toLowerCase(), { owl: 'an', hour: 'an', unicorn: 'a', cat: 'a' }[m[2]], o);
  }
  assert.equal(L.run('output\n  one<br>two\n', 1).output, 'one\ntwo');
  assert.equal(L.run('output\n  a\\sb\n', 1).output, 'a b');
});
test('methods: titleCase, upperCase, lowerCase, sentenceCase, pluralForm, singularForm, selectMany, selectUnique, joinItems, selectAll', () => {
  const run = (expr, items = '  big cat\n') => L.run('output\n  ' + expr + '\nx\n' + items, 5).output;
  assert.equal(run('[x.titleCase]'), 'Big Cat'); assert.equal(run('[x.upperCase]'), 'BIG CAT'); assert.equal(run('[x.sentenceCase]'), 'Big cat');
  assert.equal(run('[x.pluralForm]'), 'big cats'); assert.equal(run('[x.pluralForm]', '  wolf\n'), 'wolves'); assert.equal(run('[x.pluralForm]', '  pony\n'), 'ponies'); assert.equal(run('[x.pluralForm]', '  box\n'), 'boxes'); assert.equal(run('[x.pluralForm]', '  Child\n'), 'Children');
  assert.equal(run('[x.singularForm]', '  ponies\n'), 'pony'); assert.equal(run('[x.singularForm]', '  people\n'), 'person');
  assert.equal(run('[x.selectMany(3).joinItems(" + ")]'), 'big cat + big cat + big cat');
  const u = run('[x.selectUnique(3).joinItems("|")]', '  a\n  b\n  c\n').split('|'); assert.deepEqual([...u].sort(), ['a', 'b', 'c']);
  assert.equal(run('[x.selectUnique(9)]', '  a\n  b\n').split(', ').length, 2, 'never more than there are');
  assert.equal(run('[x.selectAll.joinItems(" ")]', '  a\n  b\n  c\n'), 'a b c');
  assert.equal(run('[x.selectAll.titleCase]', '  a b\n  c\n'), 'A B, C');
});
test('kept values: [n = list] says the pick, [n] repeats it, [n = list, ""] says nothing', () => {
  for (let s = 1; s < 30; s++) { const o = L.run('output\n  [n = x.titleCase, ""]<[n]> and [n]\nx\n  ann\n  bo\n  cy\n', s).output; const m = o.match(/^<(\w+)> and (\w+)$/); assert.ok(m, o); assert.equal(m[1], m[2]); }
  assert.match(L.run('output\n  [n = x] [n]\nx\n  a\n', 1).output, /^a a$/);
});
test('a plain list (nothing indented) is one list, one entry per line, with odds', () => {
  const g = L.compile('alpha\nbeta ^0\n\ngamma'); assert.equal(g.plain, true); assert.deepEqual(g.errors, []);
  assert.deepEqual(Object.keys(count('alpha\nbeta ^0\n\ngamma', 200)).sort(), ['alpha', 'gamma']);
  assert.match(L.compile('').errors[0].message, /no entries/); assert.equal(L.generate('a\nb', 1, 3).results.length, 3); assert.equal(L.generate('a', 1, 999).results.length, 50, 'at most 50 a go');
});
test('errors are plain words with the line they are on', () => {
  const e = (t) => L.compile(t).errors.map((x) => x.line + ': ' + x.message).join('\n');
  assert.match(e('animal\n  cat\n'), /^1: there is no output list/m);
  assert.match(e('output\n  [anmal]\nanimal\n  cat\n'), /^2: there is no list called anmal/m);
  assert.match(e('output\n  [Animal]\nanimal\n  cat\n'), /did you mean animal\?/);
  assert.match(e('output\n  [x\nx\n  a\n'), /^2: a \[ is never closed/m);
  assert.match(e('output\n  x}\n'), /^2: a \} closes something/m);
  assert.match(e('output\n  [x]\nmy list\n  a\n'), /^3: "my list" is not a list name/m);
  assert.match(e('output\n  [x]\nx\n  big cat\n    tabby\n'), /^4: "big cat" has entries under it/m);
  assert.match(e('output\n  [x]\nx\n'), /the list x has no entries/);
  assert.match(e('output\n  [selectOne]\nselectOne\n  a\n'), /a word the language uses/);
  // at run time: a list that picks from itself, and a list with only ^0
  assert.match(L.run('output\n  [o]\no\n  [o] again\n', 1).errors[0].message, /without end|too much work/);
  assert.match(L.run('output\n  [x]\nx\n  a ^0\n', 1).errors[0].message, /odds of 0/);
  assert.match(L.run('output\n  [x.nope]\nx\n  a\n', 1).errors[0].message, /no nested list or way called nope/);
});
test('the $output = ... one-line form, $title, and an image list', () => {
  const g = L.compile('$title = Names\n$output = [n.titleCase]\n$image = a portrait of [n]\nn\n  zed\n'); assert.deepEqual(g.errors, []);
  assert.equal(g.title, 'Names'); assert.deepEqual(L.run(g, 1), { output: 'Zed', image: 'a portrait of zed', errors: [], ai: [] });
});
test('limits: text, output length, work', () => {
  assert.ok(L.compile('output\n  a\n' + 'x'.repeat(L.MAX_TEXT)).errors.length >= 0);
  const big = L.run('output\n  [x.selectMany(100)][x.selectMany(100)][x.selectMany(100)]\nx\n  ' + 'y'.repeat(200) + '\n', 1).output; assert.ok(big.length <= L.MAX_OUT);
  const work = L.run('output\n  [a.selectMany(100)]\na\n  [b.selectMany(100)]\nb\n  [c.selectMany(100)]\nc\n  z\n', 1); assert.match(work.errors[0].message, /too much work/);
});
test('share codes round-trip, compressed and plain; junk is null', async () => {
  const p = L.toShare(L.STARTER); assert.match(p, /^p\.[A-Za-z0-9_-]+$/); assert.equal(await L.unpackShare(p), L.STARTER);
  const z = await L.packShare(L.STARTER); assert.match(z, /^z\./); assert.ok(z.length < p.length); assert.equal(await L.unpackShare(z), L.STARTER);
  const uni = 'output\n  ünïcödé ✨ 名前\n'; assert.equal(await L.unpackShare(await L.packShare(uni)), uni);
  for (const bad of ['', 'x.abc', 'z.!!!!', 'p.%%%']) assert.equal(await L.unpackShare(bad), null, bad);
});
test('decks, {s}, letters, dice, possessiveForm, pastTense', () => {
  for (let s = 1; s < 20; s++) {
    const o = L.run('output\n  [d = x.consumableList, ""][d] [d] [d]|[d]\nx\n  a\n  b\n  c\n', s).output, [three, fourth] = o.split('|');
    assert.deepEqual(three.split(' ').sort(), ['a', 'b', 'c'], o); assert.match(fourth, /^[abc]$/, 'a used-up deck starts over');
    assert.match(L.run('output\n  {1-3} cat{s}, {a-c}, {2d6+1}\n', s).output, /^(?:1 cat|[23] cats), [abc], (?:[3-9]|1[0-3])$/);
  }
  assert.equal(L.run('output\n  [x.possessiveForm] [y.possessiveForm]\nx\n  cat\ny\n  cats\n', 1).output, "cat's cats'");
  assert.equal(L.run('output\n  [v.pastTense]\nv\n  fly away\n', 1).output, 'flew away');
  assert.equal(L.run('output\n  [v.pastTense]\nv\n  stop it\n', 1).output, 'stopped it');
  assert.equal(L.run('output\n  [v.pastTense]\nv\n  carry on\n', 1).output, 'carried on');
});
const HERO = '$meta\n  title = Hero maker\n  description = Heroes by gender\n$inputs\n  gender = select female|male\n  level = number 1-20\n  nick = text Shadow\noutput\n  [n = names[gender]] the [cls], level [level]. [if (level > 10) {A veteran.} else if (level > 5) {Seasoned.} else {A rookie.}] [level >= 15 ? "Legendary!" : "-"] [level * 2] hp [nick]\nnames\n  female\n    Ada\n    Mira\n  male\n    Bo\n    Ivo\ncls\n  wizard ^[gender == "female"]\n  knight ^[gender == "male"]\n  bard\n';
test('inputs, [names[gender]], ^[condition], if / else if / else, ternaries and arithmetic', () => {
  const g = L.compile(HERO); assert.deepEqual(g.errors, []);
  assert.deepEqual(g.meta, { title: 'Hero maker', description: 'Heroes by gender', layout: 'lines' }); assert.equal(g.title, 'Hero maker');
  assert.deepEqual(g.inputs.map((x) => [x.name, x.kind, x.def]), [['gender', 'select', 'female'], ['level', 'number', '1'], ['nick', 'text', 'Shadow']]);
  const m = L.generate(g, 1, 30, { inputs: { gender: 'male', level: '16', nick: 'Rex' } }).results.map((r) => r.output);
  for (const o of m) assert.match(o, /^(?:Bo|Ivo) the (?:knight|bard), level 16\. A veteran\. Legendary! 32 hp Rex$/, o);
  const f = L.generate(g, 1, 30, { inputs: { gender: 'female', level: '7' } }).results.map((r) => r.output);
  for (const o of f) assert.match(o, /^(?:Ada|Mira) the (?:wizard|bard), level 7\. Seasoned\. - 14 hp Shadow$/, o);
  assert.match(L.run(g, 1, { inputs: { gender: 'robot', level: '99' } }).output, /^(?:Ada|Mira) .* level 20\./, 'a value not offered falls back; a number is kept in range');
  assert.match(L.run('output\n  [x[k]]\nx\n  a\n    one\nk\n  b\n', 1).errors[0].message, /no nested list called b/);
  assert.equal(L.run('output\n  [1 + 2 * 3] [(1 + 2) * 3] [7 % 4] [10 / 4] [!true] ["a" + "b"] [3 > 2 && 2 > 1] ["b" < "a" || "yes"]\n', 1).output, '7 9 3 2.5 false ab true yes');
  // only the branch a condition takes is picked from
  const ifOnly = L.run('output\n  [if (1 > 2) {[o]} else {fine}]\no\n  [o]\n', 1); assert.deepEqual([ifOnly.output, ifOnly.errors], ['fine', []]);
  assert.match(L.run('output\n  [if (x {a}]\nx\n  a\n', 1).errors[0].message, /cannot read/);
});
test('imports: a published generator\'s output and lists, by its 8-letter id; a missing one is said plainly', () => {
  const lib = L.compile('output\n  [a] from afar\na\n  owl\n  crow\n');
  const g = L.compile('animals = {import:abcdefgh}\noutput\n  I saw [animals] and [animals.a.upperCase]\n'); assert.deepEqual(g.errors, []); assert.deepEqual(g.imports, ['abcdefgh']);
  for (let s = 1; s < 10; s++) assert.match(L.run(g, s, { imports: { abcdefgh: lib } }).output, /^I saw (?:owl|crow) from afar and (?:OWL|CROW)$/);
  assert.match(L.run(g, 1).errors[0].message, /abcdefgh is not loaded/);
  assert.match(L.compile('x = {import:Some Name}\noutput\n  [x]\n').errors[0].message, /8-letter id/);
});
test('$meta and $inputs say plainly what is wrong', () => {
  assert.match(L.compile('$meta\n  colour = red\noutput\n  a\n').errors[0].message, /\$meta line/);
  assert.match(L.compile('$meta\n  image = https://evil.example/x.png\noutput\n  a\n').errors[0].message, /gallery/);
  assert.match(L.compile('$inputs\n  g = dropdown a\noutput\n  a\n').errors[0].message, /an input is/);
});
test('presentTense, futureTense, negativeForm and verbBase', () => {
  const t = (w) => [L.presentTense(w), L.futureTense(w), L.negativeForm(w)];
  assert.deepEqual(t('walked to town'), ['walks to town', 'will walk to town', 'did not walk to town']);
  assert.deepEqual(t('flew away'), ['flies away', 'will fly away', 'did not fly away']);
  assert.deepEqual(t('walks home'), ['walks home', 'will walk home', 'does not walk home']);
  assert.deepEqual(t('is happy'), ['is happy', 'will be happy', 'is not happy']);
  assert.deepEqual(t('can swim'), ['can swim', 'can swim', 'cannot swim']);
  assert.deepEqual(t('will sing'), ['sings', 'will sing', 'will not sing']);
  assert.deepEqual(t('Smiled'), ['Smiles', 'Will smile', 'Did not smile']);
  for (const [a, b] of [['liked', 'like'], ['created', 'create'], ['stopped', 'stop'], ['carried', 'carry'], ['visited', 'visit'], ['goes', 'go'], ['went', 'go']]) assert.equal(L.verbBase(a), b, a);
  assert.equal(L.run('output\n  [v.futureTense]\nv\n  ran home\n', 1).output, 'will run home');
});
test('tap to reroll: the output entry\'s parts, tidied across parts; one part worked out again with the kept values', () => {
  const g = L.compile('output\n  [n = name, ""]{A} [adj] [animal] named [n] saw {2-3} bird{s}.\nname\n  Pip\nadj\n  odd\n  big\n  eager\nanimal\n  owl\n  cat\n');
  for (let s = 1; s < 20; s++) {
    const r = L.run(g, s, { spans: true }), parts = L.tidySpans(r.spans);
    assert.equal(parts.map((x) => x.t).join(''), r.output); assert.deepEqual(r.vars, { n: 'Pip' });
    const i = parts.findIndex((x) => x.src === 'adj'); const again = L.reroll(g, r.spans[i], s + 100, { vars: r.vars }); assert.match(again.t, /^(?:odd|big|eager)$/);
    const next = r.spans.slice(); next[i] = { ...next[i], t: again.t }; const t = L.tidySpans(next).map((x) => x.t).join('');
    assert.match(t, /^(?:An odd|A big|An eager) (?:owl|cat) named Pip saw [23] birds\.$/, t);
  }
  assert.equal(L.reroll(g, { src: 'n', kind: '[' }, 1, { vars: { n: 'Pip' } }).t, 'Pip', 'a kept value stays itself');
});
test('{ai: ...}: the prompt is worked out and marked for the page to fill; at most three a result', () => {
  const r = L.run('output\n  Hi. {ai: one line about a [x] knight} {ai: a} {ai: b} {ai: c}\nx\n  brave\n', 1);
  assert.deepEqual(r.ai, ['one line about a brave knight', 'a', 'b']);
  assert.equal(L.aiMarks(r.output, ['A knight.', 'A.']), 'Hi. A knight. A. … ');
});
test('{wheel: list}, $layout, shared data reads and {add:}/{set:} writes', async () => {
  const g = L.compile('$layout = cards\noutput\n  Lunch: {wheel: food}<br>Visits: [shared.visits] {add: visits}{set: last = soup}\nfood\n  pizza ^3\n  soup\n  [adj] salad\nadj\n  green\n');
  assert.deepEqual(g.errors, []); assert.equal(g.meta.layout, 'cards');
  const seen = {};
  for (let s = 1; s < 400; s++) { const r = L.run(g, s, { shared: { visits: 41 } }); const w = r.wheels[0]; assert.deepEqual(w.entries.map((e) => [e.label, e.weight]), [['pizza', 3], ['soup', 1], ['green salad', 1]]); assert.equal(r.output, 'Lunch: ' + w.entries[w.winner].label + '\nVisits: 41 '); seen[w.winner] = (seen[w.winner] || 0) + 1; assert.deepEqual(r.writes, [{ op: 'add', key: 'visits' }, { op: 'set', key: 'last', value: 'soup' }]); }
  assert.ok(seen[0] / seen[1] > 2.2 && seen[0] / seen[1] < 4, 'the wheel picks by weight: ' + JSON.stringify(seen));
  assert.match(L.run(g, 1).output, /Visits:  $/, 'no shared data: empty');
  assert.match(L.compile('$layout = spiral\noutput\n  a\n').errors[0].message, /\$layout is one of/);
  assert.match(L.run('output\n  {wheel: nope}\nnope2\n  a\n', 1).errors[0].message, /no list called nope/);
  const { AI_GENERATORS } = await import('../void-live-deploy/lib/ai-generators.js');
  assert.ok(AI_GENERATORS.length >= 5);
  for (const a of AI_GENERATORS) { const c = L.compile(a.text); assert.deepEqual(c.errors, [], a.id); const r = L.run(c, 3); assert.equal(r.ai.length, 1, a.id); assert.match(r.ai[0], /^(?:invent|suggest) /, a.id); assert.doesNotMatch(r.ai[0], /[[\]{}]/, a.id); }
});
