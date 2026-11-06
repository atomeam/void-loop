// tools/lab-use-it.mjs: every published lab experiment opens the working tool its idea became, and the daily sync keeps it so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { barOf, withTool, toolForEntry, backfill, applyAll, LAB } from './lab-use-it.mjs';
import { verdictOf, foldOf, toolOf, IDEAS, LAB_TOOLS } from './lab-grade.mjs';
import { convertPage, metaOf, readCatalog } from './lab-import.mjs';

const plain = '<footer class="vl-bar"><a href="/lab/">&larr; Lab</a> <a href="/">Ask Verse anything</a></footer>';
const level = toolOf('level');

test('the bar gains its tool, once, and a draft with no tool keeps the old bar', () => {
  assert.equal(barOf(null), plain, 'no tool: the bar is exactly as before');
  const page = '<html><body><canvas></canvas>' + plain + '\n</body></html>', once = withTool(page, level), twice = withTool(once, level);
  assert.match(once, /<a class="vl-use" href="\/lab\/level\/" data-tool="Spirit level">Use it: Spirit level<\/a><\/footer><script src="\/lab\/use-it\.js" defer><\/script>/);
  assert.equal(twice, once, 'idempotent');
  assert.equal((twice.match(/use-it\.js/g) || []).length, 1);
  assert.equal(withTool(once, toolOf('pattern')).includes('/lab/level/'), false, 'a changed idea replaces the old tool');
  assert.equal(withTool('<p>no bar</p>', level), '<p>no bar</p>');
});

test('a new draft is published with its tool (convertPage)', () => {
  const meta = metaOf('F901-tilt-swarm-mind', '<canvas></canvas>', '# Tilt Swarm');
  const { html } = convertPage('<!doctype html><html><head></head><body><canvas></canvas></body></html>', { ...meta, tool: level });
  assert.match(html, /Use it: Spirit level/);
  assert.doesNotMatch(convertPage('<html><body></body></html>', meta).html, /vl-use/, 'no tool given (the probe stage): no tool link');
});

test('every toy has a tool: matched by its technique, or folded into the nearest one', () => {
  assert.deepEqual(verdictOf({ dir: 'F950-lenia-gait-evolver', html: '<canvas></canvas>', spec: '' }), { grade: 'toy', idea: 'pattern', folded: true });
  assert.equal(foldOf({ dir: 'F951-hypervector-dreamer' }).key, 'mindmap');
  assert.equal(verdictOf({ dir: '141-local-private-not-shared', html: '<canvas></canvas>', spec: '' }).idea, 'notes');
  assert.equal(verdictOf({ dir: 'F530-webrtc-reservoir-mind', html: '<canvas></canvas>', spec: '' }).idea, 'webrtc');
  for (const i of IDEAS) assert.ok(i.page, i.key + ' has a page to open');
  assert.equal(LAB_TOOLS.length, IDEAS.length);
  const b = backfill([{ slug: 'f222-screen-grazing-lichen', source: 'F222-screen-grazing-lichen', title: 'Screen-Grazing Lichen', grade: 'toy' }, { slug: 'x', grade: 'tool' }, { slug: 'y', grade: 'toy', idea: 'level' }]);
  assert.deepEqual([b[0].idea, b[0].folded, b[1].idea, b[2].idea], ['pattern', true, undefined, 'level']);
  assert.equal(toolForEntry({ grade: 'tool' }), null, 'a draft that is a tool already opens nothing else');
  assert.equal(toolForEntry({ grade: 'toy', idea: 'checksum' }).page, '/lab/checksum/');
});

test('every published experiment in the repo opens its tool, and every tool page exists', () => {
  const catalog = readCatalog(LAB), r = applyAll({ catalog, write: false });
  assert.deepEqual(r.missing, []); assert.equal(r.changed, 0, 'node tools/lab-use-it.mjs has been run');
  assert.ok(catalog.filter((e) => e.grade === 'toy').every((e) => e.idea), 'no toy is left without an idea');
  for (const t of LAB_TOOLS) assert.ok(fs.existsSync(path.join(LAB, '..', t.page, 'index.html')), t.page);
  assert.ok(fs.existsSync(path.join(LAB, 'use-it.js')));
});

test('each tool sits on the Verse page it belongs to, never the homepage, and the page links it back', async () => {
  const { PLACES, placeIn, MARK } = await import('./lab-place.mjs');
  assert.equal(PLACES['/'], undefined, 'nothing on the homepage');
  const toolkit = fs.readFileSync(path.join(LAB, '..', 'lib', 'toolkit.js'), 'utf8');
  for (const [page, rows] of Object.entries(PLACES)) {
    const html = fs.readFileSync(path.join(LAB, '..', page, 'index.html'), 'utf8');
    assert.equal(placeIn(html, rows), html, page + ' is current (node tools/lab-place.mjs)');
    assert.equal(html.split(MARK[0]).length, 2, page + ' has one section');
    for (const [key] of rows) {
      const t = toolOf(key);
      assert.ok(html.includes('src="' + t.page + '" title="' + t.tool + '" loading="lazy"'), page + ' frames ' + t.tool + ' lazily');
      assert.ok(html.includes('<a href="' + t.page + '">'), page + ' links ' + t.page);
      assert.ok(toolkit.includes("'" + t.page + "'"), t.page + ' is in the related links');
    }
  }
  const home = fs.readFileSync(path.join(LAB, '..', 'index.html'), 'utf8');
  assert.ok(!home.includes(MARK[0]), 'the homepage carries no lab section');
});
