// Tools pack 7 (owner, 2026-10-18): study cards (151 to 160), dev tools (161 to 170), accessibility modes (171 to 180). Pure logic only;
// the browser section "tools pack 7" in test_void.mjs plays them on the stage.
// Run: node --test tools/tools-pack-7.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import study, * as SC from '../void-live-deploy/skills/study-cards.js';
import * as S from '../void-live-deploy/lib/study-cards.js';
import devTools, * as DT from '../void-live-deploy/skills/dev-tools.js';
import * as D from '../void-live-deploy/lib/dev-tools.js';
import a11y, * as AM from '../void-live-deploy/skills/accessibility-modes.js';
import * as A from '../void-live-deploy/lib/a11y-modes.js';
import { utilOf } from '../void-live-deploy/skills/util.js';

const routes = (skill, yes, no) => {
  for (const a of yes) assert.ok(skill.match(a.toLowerCase(), a), skill.name + ' should take: ' + a);
  for (const a of no) assert.ok(!skill.match(a.toLowerCase(), a), skill.name + ' should leave: ' + a);
};

test('routing: every example is taken, every near miss left', () => {
  routes(study, study.examples, study.nearMisses);
  routes(devTools, devTools.examples, devTools.nearMisses);
  routes(a11y, a11y.examples, a11y.nearMisses);
});

test('study asks: flashcards, drill, quiz from a list, glossary, definition, code, algorithm, formula, cite', () => {
  assert.deepEqual(S.parseStudy('flashcards: hola = hello, gato = cat').pairs, [{ q: 'hola', a: 'hello' }, { q: 'gato', a: 'cat' }]);
  assert.equal(S.parseStudy('make flashcards for spanish: casa = house').title, 'spanish');
  assert.equal(S.parseStudy('language drill: bonjour = hello; merci = thanks').mode, 'drill');
  assert.equal(S.parseStudy('quiz me from my list: a = b; c = d').mode, 'quiz');
  assert.equal(S.parseStudy('quiz me on this'), null);
  assert.deepEqual(S.parseStudy('capital of France = Paris'), null);
  // a comma stays inside an answer unless every comma part is a pair
  assert.equal(S.parsePairs('why is the sky blue = scattering, mostly').length, 1);
  assert.equal(S.parsePairs('a = 1, b = 2, c = 3').length, 3);
  assert.equal(S.parseStudy('glossary builder').mode, 'glossary');
  assert.equal(S.parseStudy('add to glossary: kern = space between letters').mode, 'glossary-add');
  assert.deepEqual(S.parseStudy('definition card for entropy: a measure of disorder'), { mode: 'define', term: 'entropy', def: 'a measure of disorder' });
  const code = S.parseStudy('python code card for reverse a string: def r(s):\n    return s[::-1]');
  assert.equal(code.lang, 'python'); assert.equal(code.name, 'reverse a string'); assert.match(code.code, /return s\[::-1\]/);
  assert.deepEqual(S.parseStudy('algorithm steps card for binary search: 1. sort 2. look at the middle 3. halve').steps, ['sort', 'look at the middle', 'halve']);
  const f = S.parseStudy('formula card for energy: E = mc^2 where E energy, m mass, c speed of light');
  assert.equal(f.expr, 'E = mc^2'); assert.deepEqual(f.legend.map((l) => l.sym), ['E', 'm', 'c']);
  for (const no of ['what are flashcards', 'best flashcard app: x = y', 'what is a glossary', 'cite this as APA', 'define serendipity']) assert.equal(S.parseStudy(no), null, no);
});

test('cite as: fields found in free text, three styles', () => {
  const c = S.parseCite('The Origin of Species by Charles Darwin, 1859, https://example.org/origin.');
  assert.deepEqual(c, { title: 'The Origin of Species', author: 'Charles Darwin', year: '1859', url: 'https://example.org/origin' });
  assert.equal(S.formatCite(c, 'apa'), 'Darwin, C. (1859). The Origin of Species. https://example.org/origin');
  assert.equal(S.formatCite(c, 'mla'), 'Darwin, Charles. “The Origin of Species.” 1859, https://example.org/origin.');
  assert.equal(S.formatCite(c, 'chicago'), 'Darwin, Charles. The Origin of Species. 1859. https://example.org/origin.');
  assert.equal(S.formatCite({ title: 'A page', author: '', year: '', url: '' }, 'apa'), '(n.d.). A page.');
  assert.equal(S.parseStudy('cite as mla: The Origin of Species by Charles Darwin 1859').style, 'mla');
  assert.equal(S.parseCite(''), null);
});

test('spaced repeat: a right answer moves up a box and out, a wrong one comes straight back', () => {
  const t = '2026-10-18';
  let c = S.newCard('q', 'a', t);
  c = S.grade(c, true, t, 1); assert.equal(c.box, 2); assert.equal(c.due, '2026-10-19');
  c = S.grade(c, true, '2026-10-19', 2); assert.equal(c.box, 3); assert.equal(c.due, '2026-10-21');
  for (let i = 0; i < 6; i++) c = S.grade(c, true, t, 3 + i);
  assert.equal(c.box, 5); assert.equal(c.due, '2026-10-26');
  c = S.grade(c, false, t, 20); assert.equal(c.box, 1); assert.equal(c.due, t);
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(S.daysBetween('2026-10-18', '2026-10-21'), 3);
  const cards = [{ ...S.newCard('a', '1', t), cool: 5 }, { ...S.newCard('b', '2', t), cool: 0 }, { ...S.newCard('c', '3', '2026-10-30') }];
  assert.equal(S.nextCard(cards, t), 1);          // the one answered longest ago first
  assert.equal(S.dueCards(cards, t).length, 2);
  assert.equal(S.nextCard([cards[2]], t), -1);
  assert.equal(S.nextDueDay(cards, t), '2026-10-30');
});

test('typed answers: accents, case, punctuation and one slip are forgiven; variants after a slash', () => {
  assert.ok(S.checkAnswer('Cafe', 'café').ok);
  assert.ok(S.checkAnswer('  HELLO!! ', 'hello').exact);
  assert.ok(S.checkAnswer('elephent', 'elephant').ok);       // one slip in a long word
  assert.ok(!S.checkAnswer('cat', 'cut').ok);                // not in a short one
  assert.ok(S.checkAnswer('couch', 'sofa / couch').ok);
  assert.ok(!S.checkAnswer('', 'x').ok);
  const d = S.deckOf({ mode: 'drill', pairs: [{ q: 'a', a: 'b' }] }, '2026-10-18');
  assert.equal(d.typed, true); assert.equal(d.cards[0].box, 1);
  assert.deepEqual(S.glossaryAdd([{ t: 'zebra', d: 'z' }], [{ q: 'Apple', a: 'a' }, { q: 'zebra', a: 'new' }]).map((e) => e.t + '=' + e.d), ['Apple=a', 'zebra=new']);
});

test('json formatter and base64', () => {
  assert.equal(D.formatJson('{"a":[1,2]}').out, '{\n  "a": [\n    1,\n    2\n  ]\n}');
  assert.equal(D.formatJson('{ "a": 1 }', { minify: true }).out, '{"a":1}');
  assert.equal(D.formatJson('{a:1}').ok, false);
  assert.equal(D.formatJson('   ').out, '');
  assert.equal(D.b64Encode('héllo ✓'), 'aMOpbGxvIOKckw==');
  assert.equal(D.b64Decode('aMOpbGxvIOKckw==').out, 'héllo ✓');
  assert.equal(D.b64Decode('aGVsbG8').out, 'hello');           // missing padding
  assert.equal(D.b64Decode('aGVsbG8_').ok, true);              // url-safe alphabet accepted
  assert.equal(D.b64Decode('###').ok, false);
});

test('regex test box: matches, groups, flags, and a pattern that could hang is refused', () => {
  const r = D.regexTest('(\\d+)-(\\d+)', '', 'a 12-34 b 5-6');
  assert.deepEqual(r.matches.map((m) => m.text), ['12-34', '5-6']);
  assert.deepEqual(r.matches[0].groups, ['12', '34']);
  assert.equal(D.regexTest('HELLO', 'i', 'say hello').matches.length, 1);
  assert.equal(D.regexTest('[', '', 'x').ok, false);
  assert.equal(D.regexTest('(a+)+$', '', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!').ok, false);
  assert.equal(D.regexTest('a', '', 'x'.repeat(5000)).ok, false);
  assert.deepEqual(D.regexPieces('ab12cd', D.regexTest('\\d+', '', 'ab12cd').matches), [{ text: 'ab', hit: false }, { text: '12', hit: true }, { text: 'cd', hit: false }]);
  assert.deepEqual(D.parseRegexBody('/\\d+/g on abc 123'), { pattern: '\\d+', flags: 'g', text: 'abc 123' });
  assert.deepEqual(D.parseRegexBody('\\w+ :: hi there'), { pattern: '\\w+', flags: '', text: 'hi there' });
});

test('cron explain and next runs', () => {
  const say = (e) => D.explainCron(e).text;
  assert.equal(say('*/5 * * * *'), 'Every 5 minutes.');
  assert.equal(say('0 9 * * 1-5'), 'At 09:00 on Monday through Friday.');
  assert.equal(say('30 2 1 * *'), 'At 02:30 on day-of-month 1.');
  assert.equal(say('@daily'), 'At 00:00 every day.');
  assert.equal(say('0 0 1 jan *'), 'At 00:00 on day-of-month 1 in January.');
  assert.match(say('15,45 8-17 * * mon-fri'), /minutes 15 and 45 past every hour from 8 through 17 on Monday through Friday/);
  assert.match(say('0 9 15 * 1'), /either the date or the weekday/);
  assert.equal(D.explainCron('61 * * * *').ok, false);
  assert.equal(D.explainCron('* * *').ok, false);
  const runs = D.nextRuns('0 9 * * 1-5', new Date(2026, 9, 16, 10, 0)); // a Friday at 10:00: next are Mon, Tue, Wed
  assert.deepEqual(runs.map((d) => d.getDay() + ':' + d.getHours()), ['1:9', '2:9', '3:9']);
  assert.equal(D.nextRuns('0 0 31 2 *', new Date(2026, 0, 1)).length, 0);
});

test('http status, dummy rows, commit polish', () => {
  assert.equal(D.httpInfo(404).name, 'Not Found');
  assert.match(D.httpInfo(499).means, /4xx/);
  assert.equal(D.httpInfo(99), null);
  const a = D.dummyRows(['id', 'name', 'email'], 3, 7), b = D.dummyRows(['id', 'name', 'email'], 3, 7);
  assert.deepEqual(a, b);                                       // the same rows for one seed
  assert.deepEqual(a.map((r) => r.id), [1, 2, 3]);
  assert.match(a[0].email, /^[a-z]+\.[a-z]+@example\.com$/);
  assert.equal(D.dummyRows(['id'], 9999, 1).length, D.DUMMY_MAX_ROWS);
  assert.deepEqual(D.columnsIn('name, emails and cities, nonsense'), ['name', 'email', 'city']);
  assert.equal(D.toCsv(['a', 'b'], [{ a: 'x,y', b: 2 }]), 'a,b\n"x,y",2');
  const c = D.polishCommit('fixed the login bug.');
  assert.equal(c.plain, 'Fix the login bug'); assert.equal(c.conventional, 'fix: fix the login bug');
  assert.equal(D.polishCommit('Added dark mode').conventional, 'feat: add dark mode');
  assert.equal(D.polishCommit('feat(ui): stopped flicker on reload').conventional, 'feat(ui): stop flicker on reload');
  assert.ok(D.polishCommit('wip').notes.some((n) => /vague/.test(n)));
  assert.ok(D.polishCommit('add ' + 'x'.repeat(80)).notes.some((n) => /72/.test(n)));
  assert.equal(D.polishCommit('   '), null);
});

test('dev tool asks: what each says, and the look-alikes left alone', () => {
  assert.equal(D.devOf('format json {"a":1}').input, '{"a":1}');
  assert.equal(D.devOf('minify this json: {"a": 1}').opts.minify, true);
  assert.equal(D.devOf('base64 decode aGVsbG8=').opts.dir, 'decode');
  assert.equal(D.devOf('encode hello in base64').input, 'hello');
  assert.equal(D.devOf('what does "0 9 * * 1-5" mean in cron').input, '0 9 * * 1-5');
  assert.equal(D.devOf('http 503').input, '503');
  assert.deepEqual(D.devOf('generate 12 rows of dummy data with name email').opts.n, 12);
  assert.equal(D.devOf('polish my commit message: fixed bug').mode, 'commit');
  for (const no of ['what is json', 'json vs xml', 'what is base64', 'regex for email', 'what is a cron job', 'http status of google.com', 'how to write a good commit message', 'dummy data']) assert.equal(D.devOf(no), null, no);
});

test('colour converter forms land on the existing colour card', () => {
  assert.deepEqual(utilOf('#ff8800 to rgb'), { kind: 'color', c: '#ff8800' });
  assert.deepEqual(utilOf('hex to rgb #ff8800'), { kind: 'color', c: '#ff8800' });
  assert.deepEqual(utilOf('convert #fff to hsl'), { kind: 'color', c: '#fff' });
  assert.deepEqual(utilOf('rgb 255 136 0 to hex'), { kind: 'color', c: '#ff8800' });
  assert.deepEqual(utilOf('rgb to hex 255 136 0'), { kind: 'color', c: '#ff8800' });
  assert.equal(utilOf('rgb 300 0 0 to hex'), null);
  assert.equal(utilOf('bad to rgb'), null);                     // a word that happens to be hex digits
});

test('accessibility asks: one switch each, "off" for all, questions left alone', () => {
  const one = (t) => { const p = A.parseA11y(t); return p && p.act === 'set' ? p.id + ':' + (p.on ? 'on' : 'off') : p && p.act; };
  assert.equal(one('dyslexia friendly font'), 'dyslexia:on');
  assert.equal(one('dyslexia friendly font off'), 'dyslexia:off');
  assert.equal(one('turn on reduced motion'), 'motion:on');
  assert.equal(one('turn off reduced motion'), 'motion:off');
  assert.equal(one('stop animations'), 'motion:on');
  assert.equal(one('turn off animations'), 'motion:on');        // switching the animations off is the switch being on
  assert.equal(one('allow animations'), 'motion:off');
  assert.equal(one('colorblind safe palette'), 'colorblind:on');
  assert.equal(one('44px click targets'), 'targets:on');
  assert.equal(one('bigger tap targets off'), 'targets:off');
  assert.equal(one('captions for system speech'), 'captions:on');
  assert.equal(one('haptic tick on keep'), 'haptic:on');
  assert.equal(one('sticky focus outline'), 'outline:on');
  assert.equal(one('keyboard only stage move'), 'keys:on');
  assert.equal(one('focus trap'), 'trap:on');
  assert.equal(one('screen reader labels off'), 'labels:off');
  assert.equal(one('accessibility settings'), 'panel');
  assert.equal(one('which accessibility settings are on'), 'status');
  for (const no of ['what is dyslexia', 'what is a focus trap', 'is my website accessible', 'tap the screen to keep', 'accessibility', 'what is reduced motion']) assert.equal(A.parseA11y(no), null, no);
});

test('accessibility state: only known true/false switches survive, labels default on', () => {
  assert.equal(A.readState(null).labels, true);
  assert.equal(A.readState(null).motion, false);
  assert.deepEqual(A.readState('{"motion":true,"junk":1,"dyslexia":"yes"}').motion, true);
  assert.equal(A.readState('{"dyslexia":"yes"}').dyslexia, false);
  assert.equal(A.readState('not json').labels, true);
  const s = A.readState('{"motion":true,"colorblind":true,"captions":true}');
  assert.deepEqual(A.classesFor(s).sort(), ['a11y-cb', 'a11y-motion']);
  assert.equal(JSON.parse(A.writeState(s)).motion, true);
  const bag = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  AM.saveState({ ...s, outline: true }, bag);
  assert.equal(AM.loadState(bag).outline, true);
  assert.equal(AM.loadState({ getItem() { throw new Error('blocked'); } }).labels, true);   // blocked storage: the defaults
});

test('screen-reader labels and keyboard moves', () => {
  assert.equal(A.describeThing({ kind: 'sticky', text: 'buy  milk' }), 'Sticky note: buy milk');
  assert.equal(A.describeThing({ kind: 'habits', habits: [{ name: 'walk' }, { name: 'read' }] }), 'Habit ring: walk, read');
  assert.equal(A.describeThing({ kind: 'study', mode: 'flash', title: 'Spanish' }), 'Study card: Flash, Spanish');
  assert.equal(A.describeThing({ kind: 'weird-thing' }), 'Weird thing');
  assert.ok(A.describeThing({ kind: 'sticky', text: 'x'.repeat(300) }).length <= 90);
  assert.ok(A.isGenericLabel('sticky card') && A.isGenericLabel(null) && !A.isGenericLabel('Restore Chess'));
  assert.deepEqual(A.moveBy({ x: 100, y: 50 }, 'ArrowRight', false), { x: 110, y: 50 });
  assert.deepEqual(A.moveBy({ x: 100, y: 50 }, 'ArrowUp', true), { x: 100, y: 10 });
  assert.deepEqual(A.moveBy({ x: 5, y: 5 }, 'ArrowLeft', true), { x: 0, y: 5 });
  assert.equal(A.moveBy({ x: 1, y: 1 }, 'Enter', false), null);
});

test('the study card skill and the dev tool skill hand out what they promise', () => {
  assert.equal(typeof SC.parseStudy, 'function');
  assert.equal(typeof DT.devOf, 'function');
  assert.equal(study.stageKinds.study.mount.length, 2);
  assert.ok(devTools.stageKinds.devtool && a11y.stageKinds.a11y && typeof a11y.decorate === 'function');
});

test('a word count counts the text as typed: a closing "!" is the text\'s, not stripped like an ask\'s', async () => {
  const { utilOf: u } = await import('../void-live-deploy/skills/util.js');
  const s = u('word count: The quick brown fox jumps over the lazy dog. It was not amused!').s;
  assert.equal(s.length, 63); assert.equal((s.match(/[\p{L}\p{N}'’-]+/gu) || []).length, 13);
  assert.equal(u('how many words in hello there?').s, 'hello there');
});
