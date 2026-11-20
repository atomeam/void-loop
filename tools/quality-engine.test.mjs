import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Q from '../void-live-deploy/lib/quality.js';
import { calibrate, FIXTURES, blankRec } from './quality-engine.mjs';
test('the vision answer is read strictly, and the judge is calibrated against the reference fails and fixes', async () => {
  assert.equal(Q.readVision('no json'), null); assert.equal(Q.readVision('{"graphics":11}'), null);
  assert.equal(Q.readVision('x {"graphics":3,"layout":4,"typography":5,"motion":3,"art":2,"fits":2,"nonsense":["a cube"]} y').art, 2);
  const labels = JSON.parse(fs.readFileSync(new URL('./fixtures/quality/labels.json', import.meta.url), 'utf8'));
  const dir = new URL('./fixtures/quality/', import.meta.url).pathname;
  assert.equal(FIXTURES.length, 4); for (const f of FIXTURES) assert.ok(fs.existsSync(dir + f.id + '.jpg'));
  const stub = async (png, what) => { const id = FIXTURES.find((f) => what.includes(f.why)).id; return { ...labels[id], fits: 5, nonsense: [] }; };
  const ok = await calibrate({ judge: stub, dir }); assert.equal(ok.ok, true, JSON.stringify(ok.problems));
  const lenient = await calibrate({ judge: async () => ({ graphics: 8, layout: 8, typography: 8, motion: 8, art: 8, fits: 8, nonsense: [] }), dir });
  assert.equal(lenient.ok, false, 'a judge that marks a reference fail 8 is not strict enough');
  assert.equal((await calibrate({ judge: async () => null, dir })).ok, false);
  assert.equal(blankRec().id, 'quality');
});
