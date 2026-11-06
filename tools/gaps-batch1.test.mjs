// docs/GAPS.md batch 1 (2026-11-06): asks Verse was seen to fail on, now answered here, in the page, with nothing sent anywhere.
//   node --test tools/gaps-batch1.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import util, { utilOf } from '../void-live-deploy/skills/util.js';
import textTools, { textToolByName } from '../void-live-deploy/skills/text-tools.js';
import color, { isColor } from '../void-live-deploy/skills/color.js';
import { ageCalcBirth } from '../void-live-deploy/skills/time-math.js';
import { spaced, askWheel } from '../void-live-deploy/lib/wheel.js';
import { TOOLS, textToolOf, applyTool } from '../void-live-deploy/lib/text-tools.js';
import { code128, modulesOf, barcodeSvg, WIDTHS } from '../void-live-deploy/lib/barcode.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a card whose parts run() wires up: querySelector hands out one stub per class, and typing fires its input handler
const card = async (skill, text) => {
  const parts = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, addEventListener(ev, f) { this.on[ev] = f; } }); };
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelector: part, querySelectorAll: () => [] };
  const said = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true });
  return { said, h: el.innerHTML, parts, type: (cls, s) => { parts[cls].value = s; parts[cls].on.input(); } };
};

test('a random colour asked with a verb in front is the colour skill, which picks one here', async () => {
  for (const a of ['generate a random color', 'pick a random colour', 'random color generator', 'give me a random color', 'random hex color', 'random color']) assert.ok(isColor(a), a);
  for (const a of ['random color meaning', 'pick a color for my room', 'what color is the sky']) assert.ok(!isColor(a), a);
  const { said, h } = await card(color, 'generate a random color');
  assert.equal(said, 'color');
  assert.match(h, /#[0-9a-f]{6}/);
});

test('contrast between two colours: the WCAG ratio and the four checks', async () => {
  assert.deepEqual(utilOf('contrast ratio between #000000 and #ffffff'), { kind: 'contrast', a: '#000000', b: '#ffffff' });
  const { h } = await card(util, 'contrast ratio between #000000 and #ffffff');
  assert.ok(h.includes('<h2>Contrast 21:1</h2>'), h);
  assert.equal((h.match(/ passes \(needs/g) || []).length, 4, h);
  const grey = await card(util, 'contrast ratio between #777777 and #ffffff');
  assert.ok(grey.h.includes('<h2>Contrast 4.48:1</h2>') && grey.h.includes('AA normal text</b> fails'), grey.h);
  for (const a of ['contrast in photography', 'high contrast mode', 'generate a random color']) assert.equal(utilOf(a), null, a);
});

test('Markdown with the text after a colon fills the converter at once, escaped', async () => {
  assert.deepEqual(utilOf('convert markdown to html: **bold**'), { kind: 'mdmaker', s: '**bold**' });
  const c = await card(util, 'convert markdown to html: **bold** <i>x</i>');
  assert.equal(c.parts['util-in'].value, '**bold** <i>x</i>');
  assert.ok(c.parts['util-out'].textContent.includes('<strong>bold</strong>') && c.parts['util-out'].textContent.includes('&lt;i&gt;'), c.parts['util-out'].textContent);
  assert.deepEqual(utilOf('markdown to html'), { kind: 'mdmaker' }, 'the empty box by its name still works');
});

test('Code 128: the 107 patterns, the checksum and set C for digit runs', () => {
  assert.equal(WIDTHS.length, 107);
  for (const w of WIDTHS.slice(0, 106)) assert.equal([...w].reduce((a, b) => a + +b, 0), 11, w);
  assert.equal([...WIDTHS[106]].reduce((a, b) => a + +b, 0), 13, 'stop');
  assert.deepEqual(code128('12345'), { set: 'B', codes: [104, 17, 18, 19, 20, 21, 90, 106] });
  assert.deepEqual(code128('123456'), { set: 'C', codes: [105, 12, 34, 56, 44, 106] });
  const b = code128('Hi');
  assert.equal(b.codes.at(-2), (104 + 1 * 40 + 2 * 73) % 103, 'checksum is the weighted sum mod 103');
  for (const bad of ['', 'é', 'x'.repeat(81), 'a\nb']) assert.equal(code128(bad), null, JSON.stringify(bad));
  assert.equal(modulesOf([104]), '211214');
});

test('the barcode is an SVG drawn here; the text under it is escaped', async () => {
  const svg = barcodeSvg('<a>', { esc });
  assert.ok(svg.startsWith('<svg ') && svg.includes('&lt;a&gt;') && !svg.includes('<a>'), svg);
  assert.deepEqual(utilOf('make a barcode for 12345'), { kind: 'barcode', s: '12345' });
  assert.deepEqual(utilOf('barcode for ABC-42'), { kind: 'barcode', s: 'ABC-42' });
  assert.deepEqual(utilOf('barcode generator'), { kind: 'barcode', s: '' });
  for (const a of ['what is a barcode', 'barcode scanner', 'barcode']) assert.equal(utilOf(a), null, a);
  const c = await card(util, 'make a barcode for 12345');
  assert.equal(c.parts['util-in'].value, '12345');
  assert.ok(c.parts['util-bc'].innerHTML.startsWith('<svg '), c.parts['util-bc'].innerHTML);
  assert.ok(!/<img\b|https?:\/\/(?!www\.w3\.org)/.test(c.h + c.parts['util-bc'].innerHTML), 'nothing fetched');
  c.type('util-in', 'é');
  assert.equal(c.parts['util-bc'].innerHTML, '');
  assert.match(c.parts['util-say'].textContent, /plain letters/);
});

test('a text tool named on its own opens a box that works as you type', async () => {
  for (const a of ['remove duplicate lines', 'extract emails', 'sort lines alphabetically', 'rot13', 'slugify']) assert.ok(textToolByName(a), a);
  for (const a of ['frequency', 'what is rot13', 'how do i remove duplicate lines', 'sort these lines: b ⏎ a', 'sort the list', 'sort my list']) assert.equal(textToolByName(a), null, a);
  const c = await card(textTools, 'remove duplicate lines');
  assert.equal(c.said, 'text-tools');
  assert.ok(c.h.includes('<textarea class="tt-in"'), c.h);
  c.type('tt-in', 'a\nb\na');
  assert.equal(c.parts['tt-out'].textContent, 'a\nb');
  c.type('tt-in', '');
  assert.equal(c.parts['tt-out'].textContent, '');
});

test('age calculator with a birth date fills the date in; a date to come or with no year is not one', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  assert.equal(ageCalcBirth('age calculator born 1990-05-01', now), '1990-05-01');
  assert.equal(ageCalcBirth('age calculator for someone born may 1 1990', now), '1990-05-01');
  assert.equal(ageCalcBirth('age calculator born 2030-01-01', now), '');
  assert.equal(ageCalcBirth('age calculator born may 1', now), '');
  assert.equal(ageCalcBirth('age calculator', now), '');
});

test('a wheel of words with spaces only splits into entries; a phrase stays one', () => {
  assert.equal(spaced('pizza tacos sushi'), 'pizza, tacos, sushi');
  assert.equal(spaced('a, b c'), 'a, b c', 'commas win');
  assert.equal(spaced('pizza tacos'), 'pizza tacos', 'two words could be one name');
  assert.deepEqual(askWheel('spin a wheel with pizza tacos sushi').entries.map((e) => e.label), ['pizza', 'tacos', 'sushi']);
});

test('random words, nouns, verbs, dates and the Fibonacci sequence; no tool id is used twice', () => {
  const ids = TOOLS.map((t) => t.id);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
  const run = (a, ctx = {}) => { const p = textToolOf(a); return p && applyTool(p, { rng: () => 0, now: new Date('2026-11-06T12:00:00Z'), ...ctx }); };
  assert.match(run('random word').text, /^\S+ \((?:noun|verb|adjective)\)$/);
  assert.equal(run('5 random words').text.split('\n').length, 5);
  assert.equal(run('random noun').id, 'noun');
  assert.equal(run('random verb').id, 'verb');
  assert.equal(run('date stamp').text, '2026-11-06', 'the date stamp keeps its own id');
  assert.match(run('random date').text, /^1970-01-01 /);
  assert.match(run('random date between 1990 and 2000', { rng: () => 0.999999 }).text, /^2000-12-31 /);
  const f = run('first 10 fibonacci numbers').text.split('\n');
  assert.equal(f.length, 10);
  assert.equal(f[9], 'F9  34');
  assert.ok(run('first 300 fibonacci numbers').text.includes('F299  ' + (() => { let a = 0n, b = 1n; for (let i = 0; i < 299; i++) [a, b] = [b, a + b]; return a; })()), 'exact past 2^53');
});
