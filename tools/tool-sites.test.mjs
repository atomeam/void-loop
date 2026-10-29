// tests for lib/tool-sites.js, lib/pdf-ui.js and lib/kanban-ui.js: the table of pages of the PDF and Kanban floors agrees with the floors, the tools and the words on the screen
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDF_SITES, KANBAN_SITES, SITE_PAGES, PDF_ASK, KANBAN_ASK, pdfToolOf } from '../void-live-deploy/lib/tool-sites.js';
import { TOOL_INFO } from '../void-live-deploy/lib/pdf-ui.js';
import { STRINGS, FEATURES } from '../void-live-deploy/lib/kanban-ui.js';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { probeFor } from './tower-probes.mjs';

test('every lane site of the pdf and kanban floors has a page of its own, and every row names a lane site or a leader', () => {
  for (const [floor, rows] of [['pdf', PDF_SITES], ['kanban', KANBAN_SITES]]) {
    const lane = FLOORS.filter((f) => f.lane === floor);
    assert.ok(lane.length >= 4, floor + ' has a lane');
    for (const f of lane) { const page = LANE_PAGES[f.id]; assert.ok(page, f.id + ' has its own page'); assert.ok(rows.some((r) => r.path === page && r.lane === f.id), f.id + ' -> ' + page); assert.equal(f.page, page); assert.equal(probeFor(f.id).verse, page, 'the gate measures it against that page'); }
    assert.equal(rows.filter((r) => r.lane === floor).length, 1, 'one leader page'); assert.equal(FLOORS.find((f) => f.id === floor).page, '/' + floor + '/');
  }
  assert.equal(new Set(SITE_PAGES.map((r) => r.path)).size, SITE_PAGES.length);
});
test('every pdf row lists tools the screen has; every kanban row switches on features the screen knows', () => {
  for (const r of PDF_SITES) { assert.ok(r.tools.length >= 1, r.path); for (const t of [...r.tools, ...(r.also || [])]) assert.ok(TOOL_INFO[t], r.path + ' ' + t); assert.equal(new Set(r.tools).size, r.tools.length, r.path); }
  for (const r of KANBAN_SITES) for (const k of Object.keys(r.features)) assert.ok(k in FEATURES.all, r.path + ' ' + k);
  for (const r of SITE_PAGES) assert.doesNotMatch(r.intro + r.does + r.asks.join(' ') + r.h1, /\.com\b|\.org\b|\.net\b|\.io\b|\.fi\b|trello\b.*\bbetter\b/i, r.path + ' names no other site');
});
test('the kanban screen is the same in English and German, and its help line is built from the page\'s features', () => {
  assert.deepEqual(Object.keys(STRINGS.de).sort(), Object.keys(STRINGS.en).sort()); assert.deepEqual(Object.keys(STRINGS.de.ft).sort(), Object.keys(STRINGS.en.ft).sort());
  for (const [k, v] of Object.entries(STRINGS.en)) if (typeof v === 'string') assert.ok(STRINGS.de[k] && (STRINGS.de[k] !== v || v.length < 10 || /^(Boards|Board|Info|Import)/.test(v)), 'German for ' + k);
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/kanban-ui.js', import.meta.url), 'utf8'); assert.match(src, /helpText\(\)/);
});
test('the asks that reach the pages: a tool for each pdf ask, never the stage card for questions about a pdf', () => {
  for (const [ask, tool] of [['merge pdf', 'merge'], ['combine pdf files', 'merge'], ['split a pdf', 'split'], ['compress pdf', 'compress'], ['reduce pdf size', 'compress'], ['jpg to pdf', 'img2pdf'], ['pdf to jpg', 'pdf2img'], ['rotate a pdf', 'rotate'], ['reorder pdf pages', 'pages'], ['pdf tools', '']]) { assert.ok(PDF_ASK.test(ask), ask); assert.equal(pdfToolOf(ask), tool, ask); }
  for (const ask of ['ask questions about a pdf', 'what is a pdf', 'pdf', 'merge sort', 'split the bill']) assert.ok(!PDF_ASK.test(ask), ask);
  for (const ask of ['kanban', 'kanban board', 'make a kanban board', 'free kanban board']) assert.ok(KANBAN_ASK.test(ask), ask);
  for (const ask of ['task board', 'my tasks', 'kanban meaning']) assert.ok(!KANBAN_ASK.test(ask), ask);
});
test('each page and its module are what the table makes (tools/tool-site-pages.mjs --check)', async () => {
  const { pageOf, appOf, slug } = await import('./tool-site-pages.mjs');
  for (const [rows, kind] of [[PDF_SITES, 'pdf'], [KANBAN_SITES, 'kanban']]) for (const r of rows) {
    const app = fs.readFileSync(new URL('../void-live-deploy' + r.path + 'app.js', import.meta.url), 'utf8'); assert.equal(app, appOf(r, kind), r.path + 'app.js');
    const html = fs.readFileSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url), 'utf8'); assert.match(html, /<nav id="related"/); assert.ok(html.includes('<title>' + r.name.replace(/&/g, '&amp;') + ' · Verse</title>'), r.path); assert.ok(pageOf(r, kind).includes(r.path + 'app.js')); assert.ok(html.includes('/og/' + slug(r.path) + '.png'), r.path + ' has its own share picture'); assert.ok(fs.existsSync(new URL('../void-live-deploy/og/' + slug(r.path) + '.png', import.meta.url)), r.path + ' picture is there'); assert.match(html, /og:description/);
  }
});

// Verse asked (2026-10-29 card): "a tool-sites.js row and LANE_PAGES for any new tower". 106 lane sites still share their floor's page;
// a lane site added from now on comes with a page of its own, so the count of shared ones may only fall. Lower OWN_PAGE_DEBT as pages land.
const OWN_PAGE_DEBT = 106;
test('a new lane site comes with a page of its own: the lane sites that share their floor\'s page may not grow', () => {
  const shared = FLOORS.filter((f) => f.lane && !LANE_PAGES[f.id]).map((f) => f.id);
  assert.ok(shared.length <= OWN_PAGE_DEBT, (shared.length - OWN_PAGE_DEBT) + ' new lane site(s) without a page of their own (LANE_PAGES, from a lib/tool-sites.js or SELF_SITES row): ' + shared.slice(-5).join(', '));
  for (const f of FLOORS.filter((x) => x.lane && LANE_PAGES[x.id])) assert.equal(f.page, LANE_PAGES[f.id], f.id + ' opens its own page');
});
