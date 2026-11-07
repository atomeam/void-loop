// The Lab's usefulness gate (tools/lab-grade.mjs), the gallery that lists tools first (tools/lab-import.mjs renderGallery) and the pure parts of
// the six tools made from the toys' ideas (void-live-deploy/lab/{level,checksum,pattern,photo-palette,dictation,mind-map}/).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { grade, ideaOf, verdictOf, LAB_TOOLS, countsOf } from './lab-grade.mjs';
import { renderGallery, listed } from './lab-import.mjs';
import { flatTilt, edgeAngle, poseOf, slopeOf, angleOf, isLevel, minusZero } from '../void-live-deploy/lab/level/level.js';
import { sha256, expectedOf, verdictOf as sumVerdict, sumsFileOf, sumLine, sizeOf } from '../void-live-deploy/lab/checksum/sums.js';
import { PRESETS, seedGrid, step, shades, paint, linkOf, fromLink } from '../void-live-deploy/lab/pattern/pattern.js';
import { toLab, fromLab, pointsOf, paletteOf, cssOf, pctOf } from '../void-live-deploy/lab/photo-palette/palette.js';
import { marksOf, joinOf, wordsOf } from '../void-live-deploy/lab/dictation/dictate.js';
import { treeOf, outlineOf, layoutOf, svgOf, packOf, unpackOf, sizeOf as ideasOf } from '../void-live-deploy/lab/mind-map/outline.js';

test('the gate: a field to poke is a toy, even a clever one; a page that takes your text and gives a file back, with its job named, is a tool', () => {
  const toy = { dir: 'F537-orientation-mlp-lattice-gas-mind', html: '<canvas></canvas><script>addEventListener("deviceorientation",()=>{})</script>', spec: '# F537 Lattice gas mind\nA novel combination of a lattice gas and an MLP.' };
  assert.equal(grade(toy).grade, 'toy'); assert.equal(ideaOf(toy).key, 'level', 'its tilt reading is a spirit level waiting');
  assert.deepEqual(verdictOf(toy), { grade: 'toy', idea: 'level' });
  const tool = { dir: 'F700-invoice-maker', spec: '# F700 Invoice maker\nJob: make an invoice from what you type and download it as a PDF.',
    html: '<textarea id="t"></textarea><button id="dl">Download</button><script>const a=document.createElement("a");a.download="invoice.pdf";</script>' };
  assert.equal(grade(tool).grade, 'tool', JSON.stringify(grade(tool)));
  assert.deepEqual(verdictOf(tool), { grade: 'tool' });
  assert.equal(grade({ dir: 'F701-sealed-swarm-portal', html: '<canvas></canvas>', spec: 'A swarm sealed with SHA-256.' }).grade, 'toy');
  const c = countsOf([{ grade: 'tool' }, { grade: 'toy', idea: 'level' }, { grade: 'toy', idea: null }]);
  assert.deepEqual([c.total, c.tool, c.toy, c.pure, c.ideas.level], [3, 1, 2, 1, 1]);
});

test('every idea with a page names a page that exists', async () => {
  const fs = await import('node:fs');
  assert.ok(LAB_TOOLS.length >= 7);
  for (const t of LAB_TOOLS) assert.ok(fs.existsSync(new URL('../void-live-deploy' + t.page + 'index.html', import.meta.url)), t.page);
});

test('the gallery: the tools first, with how many experiments each came from; the rest folded away under them, all still there', () => {
  const cat = [
    { slug: 'f010-a', num: 10, title: 'A', blurb: 'a', status: 'works', grade: 'toy', idea: 'level' }, { slug: 'f020-b', num: 20, title: 'B', blurb: 'b', status: 'works', grade: 'tool' },
    { slug: 'f030-c', num: 30, title: 'C', blurb: 'c', status: 'works', grade: 'toy', idea: 'level' }, { slug: 'f040-d', num: 40, title: 'D', blurb: 'd', status: 'broken', grade: 'toy', idea: 'level' }];
  const html = renderGallery(cat), fold = html.indexOf('<details>');
  assert.equal(listed(cat).length, 3);
  assert.ok(html.indexOf('href="/lab/level/"') > 0 && html.indexOf('href="/lab/level/"') < fold, 'the spirit level is listed above the fold');
  assert.match(html, /Spirit level<\/h2>.*?from 2 experiments/s, 'the broken one is not counted');
  assert.ok(html.indexOf('/lab/f020-b/') < fold, 'an experiment graded a tool is listed with the tools');
  assert.ok(html.indexOf('/lab/f030-c/') > fold && html.indexOf('/lab/f010-a/') > fold, 'the toys are still there, folded');
  assert.doesNotMatch(html, /f040-d/); assert.match(html, /The 2 experiments behind them/);
  assert.doesNotMatch(html.replace(/<script src="[^"]*" defer><\/script>/g, ''), /<script/);
});

test('spirit level: tilt from gravity, slope in every unit people use, a zero, and the same angle from a rise and a run', () => {
  assert.equal(poseOf({ x: 0, y: 0, z: 9.81 }), 'flat'); assert.equal(poseOf({ x: 9.81, y: 0, z: 0 }), 'edge');
  const t = flatTilt({ x: 0, y: 0, z: 9.81 }); assert.ok(Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9);
  assert.ok(Math.abs(Math.abs(edgeAngle({ x: 9.81 * Math.sin(0.1), y: 9.81 * Math.cos(0.1), z: 0 })) - 0.1 * 180 / Math.PI) < 0.01);
  const s = slopeOf(45); assert.equal(Number(s.percent), 100); assert.equal(Number(s.perMetre), 1000);
  assert.ok(Math.abs(angleOf(1, 12) - Math.atan(1 / 12) * 180 / Math.PI) < 1e-9); assert.ok(!Number.isFinite(angleOf('', '')));
  assert.ok(isLevel(0.2) && !isLevel(0.5)); assert.equal(minusZero(3, 1), 2);
});

test('checksum: the streamed SHA-256 equals the real one for any size and any cut; a pasted sum is read whatever its dressing', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 70000]) {
    const b = crypto.randomBytes(n), want = crypto.createHash('sha256').update(b).digest('hex');
    assert.equal(sha256().update(b).hex(), want, 'one piece, ' + n);
    const h = sha256(); for (let i = 0; i < n; i += 37) h.update(b.subarray(i, i + 37)); assert.equal(h.hex(), want, 'pieces, ' + n);
  }
  const e3 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert.deepEqual(expectedOf('sha256:' + e3.toUpperCase()), { hex: e3, algo: 'SHA-256' });
  assert.deepEqual(expectedOf(e3 + '  ubuntu.iso'), { hex: e3, algo: 'SHA-256' }); assert.equal(expectedOf('hello'), null);
  assert.equal(expectedOf('d41d8cd98f00b204e9800998ecf8427e').algo, 'MD5');
  assert.equal(sumVerdict(e3, expectedOf(e3), 'SHA-256'), 'match'); assert.equal(sumVerdict('00' + e3.slice(2), expectedOf(e3), 'SHA-256'), 'differs'); assert.equal(sumVerdict(e3, expectedOf(e3), 'MD5'), '');
  assert.deepEqual(sumsFileOf(e3 + '  ./a.iso\n' + e3 + ' *b.img\nSHA256 (c.zip) = ' + e3).map((x) => x.name), ['a.iso', 'b.img', 'c.zip']);
  assert.equal(sumLine(e3, 'a\nb'), e3 + '  a b'); assert.equal(sizeOf(1536), '1.5 KB');
});

test('pattern: the same seed grows the same tile, and the link carries it', () => {
  const a = step(seedGrid(5, 32), PRESETS.coral, 200), b = step(seedGrid(5, 32), PRESETS.coral, 200);
  assert.ok(a.B.every((v, i) => v === b.B[i])); assert.ok(!a.B.every((v, i) => v === step(seedGrid(6, 32), PRESETS.coral, 200).B[i]));
  const px = paint(shades(a), 32, 64, '#000000', '#ffffff'); assert.equal(px.length, 64 * 64 * 4); assert.equal(px[3], 255);
  const s = { preset: 'maze', seed: 42, back: '#0b0a10', ink: '#a58bff' }; assert.deepEqual(fromLink('#p=' + linkOf(s)), s); assert.equal(fromLink('#p=nope.1.000000.ffffff'), null);
});

test('photo palette: OKLab round trip, the main colours with their shares, CSS out', () => {
  for (const c of [[0, 0, 0], [255, 255, 255], [12, 200, 99], [250, 30, 140]]) assert.deepEqual(fromLab(toLab(c)), c);
  const px = new Uint8ClampedArray(4 * 100); for (let i = 0; i < 100; i++) px.set([...(i < 75 ? [200, 30, 30] : [20, 40, 220]), i === 99 ? 0 : 255], i * 4);
  const pal = paletteOf(pointsOf(px), 2); assert.deepEqual(pal.map((p) => p.hex), ['#c81e1e', '#1428dc']); assert.equal(pctOf(pal[0].share), '76%');
  assert.match(cssOf(pal), /--photo-1: #c81e1e;/); assert.equal(pctOf(0.004), '<1%'); assert.deepEqual(paletteOf([]), []);
});

test('dictation: spoken punctuation becomes marks, sentences start with a capital, pieces join with the right spacing', () => {
  assert.equal(marksOf('hi comma how are you question mark'), 'hi, how are you?');
  let t = ''; for (const p of ['hello comma my name is sam full stop', 'i like this question mark', 'new paragraph next thing', 'quote yes close quote they said period']) t = joinOf(t, p);
  assert.equal(t, 'Hello, my name is sam. I like this?\n\nNext thing "yes" they said.'); assert.equal(wordsOf(t), 13);
});

test('mind map: an outline becomes a tree, the tree an SVG, and the link carries the outline', () => {
  const tr = treeOf('Trip\n  Where\n    - Lisbon\n    - Porto\n  When\n\t\tMay');
  assert.deepEqual(tr.kids.map((k) => k.text), ['Where', 'When']); assert.deepEqual(tr.kids[0].kids.map((k) => k.text), ['Lisbon', 'Porto']);
  assert.equal(ideasOf(tr), 6); assert.equal(outlineOf(tr).split('\n').length, 6); assert.equal(layoutOf(tr).length, 6);
  const svg = svgOf(treeOf('A <b> & c\n  d')); assert.ok(svg.startsWith('<svg ') && svg.includes('A &lt;b&gt; &amp; c') && !svg.includes('<b>'));
  assert.equal(unpackOf(packOf('héllo → map\n  x')), 'héllo → map\n  x'); assert.equal(treeOf('  \n'), null);
});
