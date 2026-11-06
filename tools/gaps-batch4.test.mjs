// docs/GAPS.md batch 4 (2026-11-06): the phonetic alphabet, invisible characters, the final exam grade, an SQL formatter and XML to JSON, all in the page.
//   node --test tools/gaps-batch4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import util, { utilOf, natoWords, BLANKS } from '../void-live-deploy/skills/util.js';
import grades, { gradesOf } from '../void-live-deploy/skills/grades.js';
import { formatSql, xmlToJson, runTextTool } from '../void-live-deploy/lib/text-tools.js';
import { textToolByName } from '../void-live-deploy/skills/text-tools.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a card whose parts run() wires up: querySelector hands out one stub per class
const card = async (skill, text) => {
  const parts = {}, all = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, focus() {}, addEventListener(ev, f) { this.on[ev] = f; } }); };
  const el = { innerHTML: '', dataset: {}, querySelector: part, querySelectorAll: (sel) => all[sel] || [] };
  const said = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc, say() {} });
  return { said, h: el.innerHTML, parts };
};

test('phonetic alphabet named alone: the whole NATO table and a box that spells what is typed', async () => {
  for (const a of ['phonetic alphabet', 'nato alphabet', 'nato phonetic alphabet', 'icao spelling alphabet chart', 'military alphabet']) assert.deepEqual(utilOf(a), { kind: 'nato', s: '' }, a);
  assert.deepEqual(utilOf('nato alphabet for hello'), { kind: 'nato', s: 'hello' });
  for (const a of ['what is the phonetic alphabet', 'international phonetic alphabet', 'phonetic alphabet history']) assert.equal(utilOf(a), null, a);
  assert.equal(natoWords('Hi 9'), 'Hotel India · Nine');
  const c = await card(util, 'phonetic alphabet');
  assert.equal(c.said, 'util');
  for (const w of ['Alfa', 'Juliett', 'X-ray', 'Zulu', 'Nine']) assert.ok(c.h.includes(w), w);
  assert.match(c.h, /ICAO Annex 10/);
  c.parts['util-in'].value = 'sos';
  c.parts['util-in'].on.input();
  assert.equal(c.parts['util-out'].textContent, 'Sierra Oscar Sierra');
});

test('invisible character: four blank characters, each with its own copy button and what it is', async () => {
  for (const a of ['invisible character', 'blank character copy', 'invisible text', 'empty character', 'zero width space', 'copy invisible character']) assert.deepEqual(utilOf(a), { kind: 'blank' }, a);
  for (const a of ['what is an invisible character', 'invisible ink', 'invisible man']) assert.equal(utilOf(a), null, a);
  assert.deepEqual(BLANKS.map(([ch, code]) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') === code), [true, true, true, true]);
  const c = await card(util, 'invisible character');
  assert.equal((c.h.match(/class="util-blank"/g) || []).length, 4);
  for (const code of ['U+200B', 'U+3164', 'U+2800', 'U+00A0']) assert.ok(c.h.includes(code), code);
  assert.ok(!BLANKS.some(([ch]) => c.h.includes(ch)), 'the characters themselves are only in the buttons, never in the page text');
});

test('final exam grade needed: the grades skill opens its final exam form', () => {
  for (const a of ['final exam grade needed', 'grade needed on final exam', 'score i need on my final', 'final grade needed', 'what do i need on my final']) assert.equal(gradesOf(a)?.kind, 'finalForm', a);
  assert.ok(grades.match('final exam grade needed', 'final exam grade needed'));
  assert.equal(gradesOf('when is my final exam'), null);
});

test('sql formatter: keywords in capitals outside strings, each clause on its own line, a subquery indented', () => {
  const out = formatSql("select a, b.c as x, count(*) from users u left join orders o on o.uid = u.id and o.paid = 'yes, and select' where u.age between 18 and 30 and x in (select id from t) order by a desc");
  assert.equal(out, [
    'SELECT', '  a,', '  b.c AS x,', '  COUNT(*)', 'FROM users u', 'LEFT JOIN orders o', '  ON o.uid = u.id', "  AND o.paid = 'yes, and select'",
    'WHERE u.age BETWEEN 18 AND 30', '  AND x IN (', '    SELECT', '      id', '    FROM t', '  )', 'ORDER BY', '  a DESC'].join('\n'));
  assert.equal(formatSql('select 1; select 2'), 'SELECT\n  1;\n\nSELECT\n  2');
  assert.equal(formatSql('select "from" -- where\nfrom t'), 'SELECT\n  "from" -- where\nFROM t');
  assert.equal(runTextTool('sql formatter: select a from b').text, 'SELECT\n  a\nFROM b');
  for (const a of ['sql formatter', 'format sql', 'sql beautifier']) assert.equal(textToolByName(a)?.id, 'sql', a);
  for (const a of ['what is sql', 'sql vs nosql', 'sql']) assert.equal(textToolByName(a), null, a);
});

test('xml to json: elements, attributes, repeats and entities; a broken document says the line it stops at', () => {
  assert.deepEqual(xmlToJson('<?xml version="1.0"?>\n<!-- a note -->\n<note id="7"><to>Tove</to><to>Ann</to><from a="1">Jani &amp; co</from><body/><![CDATA[x<y]]></note>'),
    { note: { '@id': '7', to: ['Tove', 'Ann'], from: { '@a': '1', '#text': 'Jani & co' }, body: null, '#text': 'x<y' } });
  assert.deepEqual(xmlToJson('<n>&#65;&#x42;&lt;</n>'), { n: 'AB<' });
  const bad = (s) => { try { xmlToJson(s); return null; } catch (e) { return e.message; } };
  assert.equal(bad('<a>\n<b>\n</a>'), 'Line 3: </a> closes <b>, which is opened on line 2');
  assert.equal(bad('<a x=1></a>'), 'Line 1: the value of x is not in quotes');
  assert.match(bad('<a></a><b/>'), /^Line 1: there is more after the root element/);
  assert.match(bad('<a>&nbsp;</a>'), /^Line 1: the entity &nbsp;/);
  const r = runTextTool('xml to json: <a>');
  assert.equal(r.text, '');
  assert.equal(r.note, 'Line 1: <a> is opened here and never closed');
  assert.equal(JSON.parse(runTextTool('xml to json: <a><b>1</b></a>').text).a.b, '1');
  for (const a of ['xml to json', 'xml to json converter', 'convert xml to json']) assert.equal(textToolByName(a)?.id, 'xml-json', a);
  assert.equal(textToolByName('xml vs json'), null);
});
