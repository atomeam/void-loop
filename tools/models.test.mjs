// node --test tools/models.test.mjs: the model names live in void-live-deploy/lib/models.js and nowhere else.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { models, PATHS, FREE_MODEL, PAID_MODEL, EMBED_MODEL } from '../void-live-deploy/lib/models.js';
import * as router from '../void-live-deploy/lib/router.js';
import { MODEL as reviewModel } from '../void-live-deploy/lib/review-api.js';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');

test('every path resolves to a Workers AI chat model', () => {
  assert.deepEqual([...PATHS].sort(), ['answer', 'figurescript', 'review', 'will']);
  for (const p of PATHS) assert.match(models(p), /^@cf\/[\w.-]+\/[\w.-]+$/, p);
  assert.throws(() => models('nope'));
  assert.equal(models('answer'), FREE_MODEL);
});

test('the router and the review API take their models from models.js', () => {
  assert.equal(router.DEFAULT_MODEL, models('answer'));
  assert.equal(router.PAID_MODEL, PAID_MODEL);
  assert.equal(router.EMBED_MODEL, EMBED_MODEL);
  assert.equal(reviewModel, models('review'));
});

test('no other file names a Workers AI model in a string', () => {
  const hits = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== 'node_modules') walk(p); continue; }
    if (!/\.(js|mjs|html)$/.test(f.name) || p.endsWith(path.join('lib', 'models.js'))) continue;
    if (/['"`]@cf\/[\w-]+\/[\w.-]+['"`]/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(root, p));
  } };
  walk(root);
  assert.deepEqual(hits, [], 'name models in lib/models.js, not here');
});
