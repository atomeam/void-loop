// Lab tool pages share /verse.css (html.vs-tool) and must not ship the old light palette on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lab = join(root, 'void-live-deploy/lab');
const MUST = ['f631-chore-rota', 'f639-label-name-tag-sheet', 'f667-spatial-room-layout-planner', 'f646-weighted-decision-matrix'];
const LIGHT_HEX = /#(?:f7f5f2|f8f9fa|f6f7f9|f5f5f5|fafafa|f4f4f4|eeeeee|fff(?:fff)?)\b/i;
const OLD_GREEN = /#2d6a4f\b/i;
const DOC_BG = /(?:^|})[^{}]*\b(?:html|body|:root)\b[^{]*\{[^}]*?(?:background(?:-color)?|--bg)\s*:\s*([^;}]+)/gi;
const read = (p) => readFileSync(p, 'utf8');
const stripPrint = (css) => String(css || '').replace(/@media\s+print\s*\{(?:[^{}]|\{[^{}]*\})*\}/gi, '');
const stylesOf = (html) => [...String(html || '').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');

function isLightColor(val) {
  const v = String(val || '').toLowerCase().replace(/\s+/g, '');
  if (/var\(--/.test(v)) return false;
  if (LIGHT_HEX.test(v) || v === 'white') return true;
  const m = v.match(/rgb\((\d+),(\d+),(\d+)/);
  return !!(m && m.slice(1).every((n) => Number(n) >= 230));
}
function lightDocumentBackgrounds(html) {
  const hits = [];
  for (const m of stripPrint(stylesOf(html)).matchAll(DOC_BG)) if (isLightColor(m[1])) hits.push(m[1].trim());
  return hits;
}
function labPages() {
  return readdirSync(lab).filter((name) => statSync(join(lab, name)).isDirectory() && existsSync(join(lab, name, 'index.html')));
}
function hasIds(html, ids, label) {
  for (const id of ids) assert.match(html, new RegExp('id="' + id + '"'), label + ' ' + id);
}

test('the previously light lab tools opt into /verse.css and the shared tool theme', () => {
  for (const slug of MUST) {
    const html = read(join(lab, slug, 'index.html'));
    assert.match(html, /class="[^"]*\bvs-tool\b/, slug);
    assert.match(html, /href="\/verse\.css"/, slug);
    assert.match(html, /href="\/lab\/tool-theme\.css"/, slug);
    assert.deepEqual(lightDocumentBackgrounds(html), [], slug);
    assert.doesNotMatch(stripPrint(stylesOf(html)), OLD_GREEN, slug);
  }
  const shared = read(join(lab, 'tool-theme.css'));
  assert.match(shared, /html\.vs-tool/);
  assert.match(shared, /var\(--card\)/);
  assert.match(shared, /var\(--accent\)/);
  assert.match(shared, /var\(--d-key\)/);
  assert.doesNotMatch(stripPrint(shared), /--bg\s*:\s*#f7f5f2/);
});

test('no lab page hardcodes the old light document palette on screen', () => {
  const bad = [];
  for (const slug of labPages()) {
    const html = read(join(lab, slug, 'index.html'));
    const hits = lightDocumentBackgrounds(html);
    const screen = stripPrint(stylesOf(html));
    if (hits.length) bad.push(slug + ': ' + hits.join(', '));
    if (/--bg\s*:\s*#f7f5f2/i.test(screen) || (OLD_GREEN.test(screen) && /--accent\s*:\s*#2d6a4f/i.test(screen))) bad.push(slug + ': old theme tokens');
  }
  assert.deepEqual(bad, []);
});

test('chore rota, room planner, label sheet and decision matrix keep their controls', () => {
  hasIds(read(join(lab, 'f631-chore-rota/index.html')), ['people-list', 'chores-list', 'add-person', 'add-chore', 'weeks', 'offset', 'rota-container', 'download', 'print', 'reset', 'export-canvas'], 'rota');
  assert.match(read(join(lab, 'f631-chore-rota/index.html')), /Reset lists/);
  const rotaJs = read(join(lab, 'f631-chore-rota/app.js'));
  assert.match(rotaJs, /getComputedStyle/);
  assert.match(rotaJs, /function theme\(/);
  assert.doesNotMatch(rotaJs, OLD_GREEN);
  assert.doesNotMatch(rotaJs, /fillStyle\s*=\s*'#fff(?:fff)?'/);
  assert.doesNotMatch(rotaJs, /fillStyle\s*=\s*'#1a1a1a'/);
  hasIds(read(join(lab, 'f667-spatial-room-layout-planner/index.html')), ['roomW', 'roomL', 'setRoom', 'addBed', 'addTable', 'addChair', 'addSofa', 'clear', 'floor', 'download', 'copyList', 'save'], 'room');
  const roomJs = read(join(lab, 'f667-spatial-room-layout-planner/app.js'));
  assert.match(roomJs, /getComputedStyle\(document\.body\)/);
  assert.match(roomJs, /getComputedStyle\(floor\)/);
  assert.doesNotMatch(roomJs, /fillStyle = '#fff'/);
  assert.doesNotMatch(roomJs, /#e8f0e8/);
  const labels = read(join(lab, 'f639-label-name-tag-sheet/index.html'));
  hasIds(labels, ['names', 'size', 'fontSize', 'bg', 'fg', 'gen', 'dl', 'preview'], 'labels');
  assert.match(labels, /#preview[^}]*background:\s*#fff/);
  hasIds(read(join(lab, 'f646-weighted-decision-matrix/index.html')), ['options', 'criteria', 'matrix', 'ranking', 'add-option', 'add-criterion', 'copy', 'csv', 'share', 'reset', 'status'], 'matrix');
});
