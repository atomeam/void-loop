// tools/lab-import.mjs, lab-probe.mjs (classify) and lab-sync.mjs (pending, merge): a draft becomes a page with no inline script, the title and blurb come
// from its SPEC, the honest notice only where WebGPU/WebXR is used, nothing is ever deleted, and what is committed under void-live-deploy/lab/ agrees
// with its catalog. Run: node --test tools/lab-import.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rename, renameMarkup, slugOf, numberOf, parseSpec, clip, needsOf, externalize, convertPage, unfinished, metaOf, importDrafts, listed, renderGallery, brokenMd, tryNext, hashOf, readDrafts, LAB_DIR } from './lab-import.mjs';
import { classify, hasFallback } from './lab-probe.mjs';
import { pending, merge } from './lab-sync.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lab-test-'));
const draft = (root, dir, html, spec) => { fs.mkdirSync(path.join(root, dir), { recursive: true }); fs.writeFileSync(path.join(root, dir, 'index.html'), html); if (spec != null) fs.writeFileSync(path.join(root, dir, 'SPEC.md'), spec); };
const PAGE = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>old</title></head><body><canvas id="c"></canvas><script>const a = 1;</script><script type="module">import "./x.js";</script></body></html>';

test('slugs and numbers from the draft names', () => {
  assert.equal(slugOf('F044-Resonant Echo_Portals'), 'f044-resonant-echo-portals');
  assert.equal(slugOf('044-x'), '044-x');
  assert.equal(numberOf('F-300-kuramoto'), 300); assert.equal(numberOf('044-x'), 44); assert.equal(numberOf('F0171-o'), 171); assert.equal(numberOf('frontier-x'), 0);
});

test('SPEC.md gives the title (heading, any dash, F-number dropped) and the blurb (after Concept); a placeholder gives nothing', () => {
  assert.deepEqual(parseSpec('# F300 ' + String.fromCharCode(8212) + ' Orient-Causal MLP\n\n## Concept\nDeviceOrientation tilt feeds a population of local tiny MLPs, one per agent.\n'), { title: 'Orient-Causal MLP', blurb: 'DeviceOrientation tilt feeds a population of local tiny MLPs, one per agent.' });
  assert.equal(parseSpec('# F-048: Evolving Particle-Life Mind\nA Canvas2D particle-life simulation whose matrix is evolved by a worker.').title, 'Evolving Particle-Life Mind');
  assert.deepEqual(parseSpec('PLACEHOLDER_SPEC'), { title: null, blurb: null });
  assert.equal(parseSpec('# Resonance Field Agent\n\n**Slug:** x  \n**Run:** 171 (frontier-engine)\n\nA field of agents that settle where the pointer rests, drawn on one canvas.').blurb, 'A field of agents that settle where the pointer rests, drawn on one canvas.');
});

test('clip cuts at a sentence or a word, never with an ellipsis, and strips markdown', () => {
  const long = 'First sentence is short enough to keep whole here and then some more words. ' + 'word '.repeat(60);
  const c = clip(long, 120); assert.ok(c.length <= 120 && c.endsWith('.') && !/…|\.\.\./.test(c));
  assert.ok(!/…|\.\.\./.test(clip('word '.repeat(80), 100)) && clip('word '.repeat(80), 100).length <= 100);
  assert.equal(clip('a **bold** `code` [link](http://x) end'), 'a bold code link end');
});

test('needsOf reads WebGPU and WebXR use off the source', () => {
  assert.deepEqual(needsOf('if (!navigator.gpu) {} navigator.xr.requestSession'), ['webgpu', 'webxr']);
  assert.deepEqual(needsOf('const g = navigator.gpuish; document.xr'), []);
});

test('externalize moves inline scripts out, keeping the type, and leaves data and external scripts alone', () => {
  const { html, scripts } = externalize(PAGE + '<script type="application/ld+json">{"a":1}</script><script src="core.js"></script><script> </script><script type="importmap">{}</script>');
  assert.deepEqual(scripts.map((s) => [s.file, s.type]), [['app.js', ''], ['app-2.js', 'module']]);
  assert.match(html, /<script src="app\.js"><\/script>/); assert.match(html, /<script type="module" src="app-2\.js"><\/script>/);
  assert.match(html, /application\/ld\+json/); assert.match(html, /src="core\.js"/); assert.match(html, /type="importmap"/);
  assert.equal(scripts[0].code, 'const a = 1;');
});

test('convertPage: head, one h1, a way back, the beacon, and the notice only when asked', () => {
  const meta = { slug: 'f1-x', title: 'The "X" Mind', blurb: 'It <does> a thing & more.', num: 1, source: 'F1-x' };
  const { html } = convertPage(PAGE, meta, []);
  assert.match(html, /<title>The &quot;X&quot; Mind · Verse lab<\/title>/); assert.equal((html.match(/<title/g) || []).length, 1);
  assert.match(html, /<meta name="description" content="It &lt;does&gt; a thing &amp; more\.">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/a-to-mind\.com\/lab\/f1-x\/">/); assert.match(html, /og:image/); assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/); assert.match(html, /<script src="\/visit\.js" defer><\/script>/); assert.match(html, /href="\/lab\/lab\.css"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1); assert.match(html, /<footer class="vl-bar"><a href="\/lab\/">/); assert.match(html, /Ask Verse anything/);
  assert.doesNotMatch(html, /needs\.js/); assert.doesNotMatch(html, /noindex/i);
  assert.match(convertPage(PAGE, meta, ['webgpu', 'webxr']).html, /<script src="\/lab\/needs\.js" data-needs="webgpu webxr" defer><\/script>/);
  assert.equal((convertPage(PAGE.replace('<canvas', '<h1>Mine</h1><canvas'), meta, []).html.match(/<h1\b/g) || []).length, 1, 'a page with its own h1 gets no second');
  assert.match(convertPage('<p>bare fragment</p>', meta, []).html, /<\/footer>/, 'even a fragment gets the way back');
  assert.doesNotMatch(convertPage(PAGE.replace('<head>', '<head><meta name="description" content="x">'), meta, []).html, /content="x"/, 'the draft\'s own description is replaced');
});

test('the rename: the old name in text a person reads, never in tags, ids, scripts markup, styles or the lowercase void', () => {
  assert.equal(rename('The Void and V01D, in the void, Voidless'), 'The Verse and Verse, in the void, Voidless');
  const h = '<style>.Void{color:red}</style><div id="Void" class="V01D">The Void canvas</div><!-- Void --><script>var Void = 1;</script><p>V01D and void</p>';
  assert.equal(renameMarkup(h), '<style>.Void{color:red}</style><div id="Void" class="V01D">The Verse canvas</div><!-- Void --><script>var Void = 1;</script><p>Verse and void</p>');
  assert.equal(metaOf('F1-x', '<title>x</title>', '# F1 A Void Mind\n\n## Concept\nA field on the Void canvas where tiny minds learn to follow the pointer.').blurb, 'A field on the Verse canvas where tiny minds learn to follow the pointer.');
});

test('a draft cut off mid-script is not a page', () => {
  assert.equal(unfinished(PAGE), ''); assert.match(unfinished('<body><script>let a = ['), /truncated/);
  assert.equal(unfinished('<script type="application/ld+json">{}</script><script src="a.js"></script>'), '');
});

test('importDrafts: pages and app files written, siblings the page names copied, notes skipped, idempotent, never deletes', () => {
  const d = tmp(), out = tmp();
  draft(d, 'F001-First Light', PAGE.replace('<canvas', '<script src="core.js"></script><canvas'), '# F001 First Light\n\n## Concept\nA small field that wakes where the pointer moves across the dark.\n');
  fs.writeFileSync(path.join(d, 'F001-First Light', 'core.js'), 'var core = 1;'); fs.writeFileSync(path.join(d, 'F001-First Light', 'notes.js'), 'unused'); fs.writeFileSync(path.join(d, 'F001-First Light', 'x-scan.md'), '# notes');
  draft(d, 'F002-gpu', '<html><body><script>if (!navigator.gpu) {}</script></body></html>', null);
  draft(d, 'F003-cut', '<html><body><script>let a = [', null);
  fs.mkdirSync(path.join(d, 'proposal-only')); fs.writeFileSync(path.join(d, 'proposal-only', 'proposed-index.html'), '<p>diff</p>');
  const one = importDrafts({ drafts: d, out });
  assert.deepEqual(one.map((r) => r.slug), ['f001-first-light', 'f002-gpu', 'f003-cut']);
  assert.ok(one[0].changed && !one[2].changed && one[2].error && !fs.existsSync(path.join(out, 'f003-cut')), 'a cut-off file is reported and not written');
  assert.ok(fs.existsSync(path.join(out, 'f001-first-light', 'app.js')) && fs.existsSync(path.join(out, 'f001-first-light', 'app-2.js')));
  assert.ok(fs.existsSync(path.join(out, 'f001-first-light', 'core.js')) && !fs.existsSync(path.join(out, 'f001-first-light', 'notes.js')) && !fs.existsSync(path.join(out, 'f001-first-light', 'x-scan.md')));
  assert.ok(fs.existsSync(path.join(out, 'lab.css')) && fs.existsSync(path.join(out, 'needs.js')));
  assert.equal(one[0].title, 'First Light'); assert.deepEqual(one[1].needs, ['webgpu']);
  assert.match(fs.readFileSync(path.join(out, 'f002-gpu', 'index.html'), 'utf8'), /needs\.js/);
  assert.ok(importDrafts({ drafts: d, out }).every((r) => !r.changed), 'a second run changes nothing');
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'f002-gpu', 'index.html'), 'utf8').replace(/<script src[^>]*><\/script>/g, ''), /<script>/);
  fs.writeFileSync(path.join(out, 'old-page.txt'), 'kept'); importDrafts({ drafts: d, out, only: new Set(['f001-first-light']), noticeFor: new Set() });
  assert.ok(fs.existsSync(path.join(out, 'old-page.txt')), 'nothing is deleted');
  assert.equal(importDrafts({ drafts: d, out, skip: new Set(['f001-first-light']) }).some((r) => r.slug === 'f001-first-light'), false);
  fs.writeFileSync(path.join(d, 'F001-First Light', 'index.html'), PAGE + '<!-- edited -->');
  assert.ok(importDrafts({ drafts: d, out }).find((r) => r.slug === 'f001-first-light').changed, 'a changed draft is updated');
  const gpuNoNotice = importDrafts({ drafts: d, out: tmp(), noticeFor: new Set() }); assert.deepEqual(gpuNoNotice.find((r) => r.slug === 'f002-gpu').needs, ['webgpu']);
});

test('the gallery: static, newest first, only what runs, escaped, no script', () => {
  const cat = [
    { slug: 'f010-a', num: 10, title: 'A <b>', blurb: 'Blurb & more.', status: 'works' }, { slug: 'f300-c', num: 300, title: 'C', blurb: 'c', status: 'needs-webgpu' },
    { slug: 'f020-b', num: 20, title: 'B', blurb: 'b', status: 'works' }, { slug: 'f999-bad', num: 999, title: 'Bad', blurb: 'x', status: 'broken', error: 'boom' }];
  assert.deepEqual(listed(cat).map((e) => e.slug), ['f300-c', 'f020-b', 'f010-a']);
  const html = renderGallery(cat);
  assert.doesNotMatch(html.replace(/<script src="[^"]*" defer><\/script>/g, ''), /<script/); assert.doesNotMatch(html, /f999-bad/); assert.match(html, /A &lt;b&gt;/); assert.match(html, /Needs WebGPU/);
  assert.ok(html.indexOf('/lab/f300-c/') < html.indexOf('/lab/f020-b/') && html.indexOf('/lab/f020-b/') < html.indexOf('/lab/f010-a/'));
  assert.equal((html.match(/<h1/g) || []).length, 1); assert.match(html, /rel="canonical" href="https:\/\/a-to-mind\.com\/lab\/"/);
});

test('classify: needs-* without a fallback; a fallback that paints works; a code error is broken; blank is broken', () => {
  const ok = { errors: [], painted: true };
  assert.deepEqual(classify({ needs: ['webgpu'], fallback: false }, ok), { status: 'needs-webgpu' });
  assert.deepEqual(classify({ needs: ['webxr'], fallback: false }, ok), { status: 'needs-webxr' });
  assert.deepEqual(classify({ needs: ['webgpu'], fallback: true }, ok), { status: 'works' });
  assert.equal(classify({ needs: ['webgpu'], fallback: true }, { errors: ["pageerror: Cannot read properties of null (reading 'requestDevice')"], painted: true }).status, 'needs-webgpu');
  assert.equal(classify({ needs: ['webgpu'], fallback: false }, { errors: ['pageerror: cemb is not defined'], painted: true }).status, 'broken');
  assert.equal(classify({ needs: [], fallback: true }, ok).status, 'works');
  const blank = classify({ needs: [], fallback: true }, { errors: [], painted: false }); assert.equal(blank.status, 'broken'); assert.match(blank.error, /blank page/);
  assert.match(classify({}, { errors: ['pageerror: x is not defined'], painted: true }).error, /x is not defined/);
  assert.ok(hasFallback("c.getContext('2d')") && hasFallback('canvas.getContext("webgl2")') && !hasFallback("canvas.getContext('webgpu')"));
});

test('lab-sync: only new or changed drafts are tested; results merge by slug', () => {
  const d = tmp(); draft(d, 'F001-a', PAGE, '# F001 A\n\nA small experiment about waves that you can play with on one page.'); draft(d, 'F002-b', PAGE, null);
  const drafts = readDrafts(d), first = drafts[0], cat = [{ slug: 'f001-a', hash: hashOf(first), status: 'works', num: 1 }];
  assert.deepEqual(pending(drafts, cat).map((p) => p.meta.slug), ['f002-b']);
  assert.deepEqual(pending(drafts, cat, { all: true }).map((p) => p.meta.slug), ['f001-a', 'f002-b']);
  assert.deepEqual(pending(drafts, cat, { only: new Set(['f001-a']) }).map((p) => p.meta.slug), ['f001-a']);
  assert.deepEqual(pending(drafts, [{ slug: 'f001-a', hash: 'old' }, { slug: 'f002-b', hash: hashOf(drafts[1]) }]).map((p) => p.meta.slug), ['f001-a'], 'a changed draft is tested again');
  assert.deepEqual(merge(cat, [{ slug: 'f001-a', num: 1, status: 'broken' }, { slug: 'f009-z', num: 9, status: 'works' }]).map((e) => e.slug + ':' + e.status), ['f009-z:works', 'f001-a:broken']);
});

test('domains/lab.broken.md: one queue-ready line per broken experiment, with what to try', () => {
  const md = brokenMd([{ slug: 'f1-x', num: 1, source: 'F1-x', status: 'broken', error: 'pageerror: cemb is not defined' }, { slug: 'f2-y', num: 2, status: 'works' }]);
  assert.match(md, /^- f1-x \| draft: drafts\/F1-x\/index\.html \| error: pageerror: cemb is not defined \| try: a name used/m); assert.doesNotMatch(md, /f2-y/);
  assert.match(brokenMd([]), /\(none\)/);
  for (const e of ['blank page', 'has already been declared', 'Unexpected token', 'x is not defined', 'object stores', 'http 404: /a.js', 'weird']) assert.ok(tryNext(e).length > 10, e);
});

test('what is committed under void-live-deploy/lab/ agrees with its catalog', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(LAB_DIR, 'catalog.json'), 'utf8'));
  assert.ok(cat.length > 100, 'the catalog lists the imported drafts');
  assert.equal(new Set(cat.map((e) => e.slug)).size, cat.length);
  const gallery = fs.readFileSync(path.join(LAB_DIR, 'index.html'), 'utf8');
  for (const e of cat) {
    assert.match(e.slug, /^[a-z0-9-]+$/);
    if (e.status === 'broken') { assert.ok(e.error, e.slug + ' says why'); assert.ok(!gallery.includes('/lab/' + e.slug + '/'), e.slug + ' is not listed'); continue; }
    assert.ok(['works', 'needs-webgpu', 'needs-webxr'].includes(e.status), e.slug);
    const page = fs.readFileSync(path.join(LAB_DIR, e.slug, 'index.html'), 'utf8');
    assert.ok(gallery.includes('href="/lab/' + e.slug + '/"'), e.slug + ' is in the gallery');
    assert.doesNotMatch(page.replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '').replace(/<script\b[^>]*ld\+json[^>]*>[\s\S]*?<\/script>/gi, ''), /<script\b/i, e.slug + ' has an inline script (the deploy would need a rule for it)');
    assert.equal(/needs\.js/.test(page), e.status.startsWith('needs-'), e.slug + ' carries the notice exactly when it needs WebGPU or WebXR');
  }
  const md = fs.readFileSync(new URL('../domains/lab.broken.md', import.meta.url), 'utf8');
  for (const e of cat.filter((x) => x.status === 'broken')) assert.ok(md.includes('- ' + e.slug + ' |'), e.slug + ' is in domains/lab.broken.md');
});
