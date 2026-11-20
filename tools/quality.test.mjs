import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Q from '../void-live-deploy/lib/quality.js';
const perfect = () => ({
  gfx: { webgl: true, webgpu: true, animated: true, entropy: 8.5, gpuPath: true }, speedPhone: { dcl: 500, load: 800, bytes: 200e3, cls: 0 },
  layout: { contrast: 0, targets: 0, scrollX: 0, clipped: 0, bare: 0 }, type: { bodyMin: 17, sizes: 5, read: { grade: 6, words: 200, sentenceWords: 12, acronyms: 0.01 } },
  motion: { transitions: 6, feedback: true, reduced: true, alive: true }, art: { images: 2, broken: 0, placeholders: 0, soft: 0, entropy: 8 },
  errs: { errors: 0, failedRequests: 0, brokenImages: 0, placeholderText: 0, deadEnd: false }, flows: { links: 8, brokenLinks: 0, controls: 4, controlsWithEffect: 4, handoffBroken: 0 },
  logic: { probes: 5, probesPassed: 5, exam: 100 },
});
const vis = (n) => ({ graphics: n, layout: n, typography: n, motion: n, art: n });

test('correctness weighs 50, as much as the whole visual half and more than graphics', () => {
  assert.equal(Q.CRITERIA.reduce((n, c) => n + c.weight, 0), 100);
  const w = (h) => Q.CRITERIA.filter((c) => c.half === h).reduce((n, c) => n + c.weight, 0);
  assert.equal(w('correct'), 50); assert.equal(w('visual'), 50); assert.ok(w('correct') > Q.WEIGHTS.graphics);
});
test('only a surface that is both beautiful and correct passes, and only when a judge has seen it', () => {
  assert.equal(Q.scoreSurface(perfect(), vis(10)).pass, true);
  assert.equal(Q.scoreSurface(perfect(), null).pass, false, 'unjudged is capped below the pinnacle');
  const ugly = { ...perfect(), gfx: { entropy: 1 } }; assert.equal(Q.scoreSurface(ugly, vis(10)).pass, false);
  const wrong = { ...perfect(), logic: { probes: 5, probesPassed: 2 } }; const r = Q.scoreSurface(wrong, vis(10));
  assert.equal(r.pass, false); assert.ok(r.correct < Q.PINNACLE && r.visual >= Q.PINNACLE);
  const flat = Q.scoreSurface({ ...perfect(), gfx: { webgl: false, animated: false, entropy: 3 } }, vis(10));
  assert.ok(flat.criteria.graphics < 40, 'a flat page without 3D scores low on graphics');
});
test('placeholder art, a wall of jargon and a cramped layout score low', () => {
  const placeholder = Q.scoreArt({ art: { images: 1, broken: 0, placeholders: 1, soft: 0, entropy: 6 } }); assert.ok(placeholder <= 60);
  const jargon = 'Assimilation gate verification yields heterogeneous aspect parity across inventoried floors, notwithstanding canonical orthogonality of instrumentation. '.repeat(6);
  const plain = 'Verse is learning to replace one website right now. It is almost there. Here is what is left to do. Pick a site to see how close it is. '.repeat(3);
  assert.ok(Q.readability(jargon).grade > 14); assert.ok(Q.readability(plain).grade < 7);
  assert.ok(Q.scoreTypography({ type: { bodyMin: 16, sizes: 5, read: Q.readability(jargon) } }) < 60);
  assert.ok(Q.scoreLayout({ layout: { contrast: 4, targets: 5, scrollX: 20, clipped: 2, bare: 1 } }) < 30);
});
test('keep only when the score rose and nothing else broke', () => {
  const a = Q.scoreSurface(perfect(), vis(7)), b = Q.scoreSurface({ ...perfect(), motion: { transitions: 0 } }, vis(7));
  assert.equal(Q.decide(b, a).keep, true); assert.equal(Q.decide(a, b).keep, false); assert.equal(Q.decide(a, a).keep, false);
  const worseErrors = Q.scoreSurface({ ...perfect(), errs: { errors: 2 }, gfx: { webgl: true, animated: true, entropy: 8.5, gpuPath: true } }, vis(10));
  assert.equal(Q.decide(Q.scoreSurface({ ...perfect(), gfx: { entropy: 1 } }, vis(7)), worseErrors).keep, false);
  assert.equal(Q.decide(b, a, { neighbours: [{ id: '/x/', before: { total: 80 }, after: { total: 60 } }] }).keep, false);
});
test('the next surface is the biggest weighted loss, and the Tower\'s gaps pull it forward', () => {
  const row = (id, total, loss) => ({ id, path: id, score: { total, weakest: [{ id: 'graphics', score: 7, loss }] } });
  assert.equal(Q.pickWeakest([row('/a/', 60, 1500), row('/b/', 70, 900)]).id, '/a/');
  assert.equal(Q.pickWeakest([row('/a/', 60, 1500), row('/b/', 70, 900)], { gaps: { '/b/': 100 } }).id, '/b/');
  assert.equal(Q.pickWeakest([{ ...row('/a/', 60, 1500), triedAt: Date.now() }], {}), null);
  assert.deepEqual(Q.towerGaps({ gaps: [{ surface: '/snail/', progress: 10 }, { surface: 'bad', gap: 1 }] }), { '/snail/': 90 });
});
test('the board keeps ids and numbers, a short history, and never a rival name', () => {
  let b = { surfaces: [] };
  for (let i = 0; i < 15; i++) b = Q.boardAdd(b, { id: '/a/', kind: 'page', score: { total: 50 + i, visual: 40, correct: 60, judged: false } }, '2026-11-19T0' + (i % 10) + ':00:00Z', 10);
  assert.equal(b.surfaces[0].history.length, 10); assert.deepEqual(Q.boardSummary(b), { surfaces: 1, average: 64, passing: 0 });
  assert.match(JSON.stringify(b), /^[\w\s"{}\[\]:,.\-\/]+$/);
});
test('the rate of improvement, its flattening, and the fix that works best', () => {
  const now = Date.parse('2026-11-19T12:00:00Z'), c = (d, kept, gain, cents = 0) => ({ at: new Date(now - d * 864e5).toISOString(), kept, gain, cents });
  const r = Q.rateOf([c(1, true, 10, 20), c(0.5, false, 0), c(0.2, true, 4)], now);
  assert.equal(r.kept, 2); assert.equal(r.gained, 14); assert.equal(r.perDollar, 70);
  assert.equal(Q.dailySeries([c(0, true, 5)], 3, now).length, 3);
  assert.equal(Q.flattening([c(5, true, 9), c(4, true, 8)]).flat, false);
  assert.equal(Q.flattening(Array.from({ length: 6 }, (_, i) => c(6 - i, false, 0))).flat, true);
  assert.equal(Q.flattening(Array.from({ length: 6 }, (_, i) => c(6 - i, true, 0.2))).flat, true);
  assert.deepEqual(Q.rankImprovers(['a', 'b', 'c'], { a: { n: 2, gain: 4 }, b: { n: 2, gain: 12 } }), ['c', 'b', 'a']);
});
test('creating: a page that does the job gets the work; a new thing must clear the board; time splits on evidence', () => {
  const pages = [{ path: '/bestiary/', title: 'Animal guide', about: 'Pictures and facts about animals like the snail' }, { path: '/tools/', title: 'Tools', about: 'all tools' }];
  assert.equal(Q.dupeOf('snail animal facts', pages).path, '/bestiary/'); assert.equal(Q.dupeOf('quantum chess', pages), null);
  const board = { surfaces: [{ id: '/a/', history: [{ total: 60 }] }, { id: '/b/', history: [{ total: 70 }] }, { id: '/c/', history: [{ total: 80 }] }] };
  assert.equal(Q.createGate({ visual: 75, correct: 75, criteria: { errors: 100 } }, board).ship, true);
  assert.equal(Q.createGate({ visual: 75, correct: 60, criteria: { errors: 100 } }, board).ship, false);
  assert.equal(Q.createGate({ visual: 90, correct: 90, criteria: { errors: 50 } }, board).ship, false);
  const flat = Array.from({ length: 6 }, (_, i) => ({ at: '2026-11-19T00:00:0' + i + 'Z', kept: false, gain: 0 }));
  assert.ok(Q.splitTurns(flat, []).create > Q.splitTurns([], []).create); assert.equal(Q.splitTurns(flat, []).create + Q.splitTurns(flat, []).improve, 10);
});
test('blub is judged against the best mascots, and a clip is scored on graphics, animation, writing and humor', () => {
  assert.match(Q.visionPrompt('/blub/'), /This is blub, the blobfish mascot/); assert.doesNotMatch(Q.visionPrompt('/tools/'), /This is blub/);
  assert.equal(Q.readClip('{"graphics":8,"animation":6,"writing":7,"humor":7}').humor, 7); assert.equal(Q.readClip('{"graphics":11,"animation":6,"writing":7,"humor":7}'), null);
  assert.equal(Q.scoreClip({ graphics: 8, animation: 6, writing: 7, humor: 7 }), 70); assert.equal(Q.scoreClip(null), null);
  assert.match(Q.clipPrompt('blub'), /humor/);
});
