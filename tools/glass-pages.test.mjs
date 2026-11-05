import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stamp, gaps } from './glass-pages.mjs';
import { contrast } from '../void-live-deploy/lib/empty-state.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('ink and text on the accent clear WCAG AA; white on the key blue does not', () => {
  assert.ok(contrast([242, 244, 251], [5, 5, 5]) >= 4.5 && contrast([195, 200, 216], [5, 5, 5]) >= 4.5);
  assert.ok(contrast([7, 8, 15], [158, 178, 255]) >= 4.5 && contrast([255, 255, 255], [158, 178, 255]) < 4.5);
});

test('stamp opts a page in once, and every old-palette page has it', () => {
  const once = stamp('<html lang="en"><style>:root{--accent:#a58bff}</style></html>');
  assert.match(once, /class="vs-tool"><link rel="stylesheet" href="\/verse\.css">/);
  assert.match(once, /#a58bff/);
  assert.equal(stamp(once), once);
  assert.equal(stamp('<html><link rel="stylesheet" href="/verse.css"></html>'), '<html><link rel="stylesheet" href="/verse.css"></html>');
  assert.deepEqual(gaps(), []);
  assert.match(read('void-live-deploy/verse.css'), /html\.vs-tool:root:not\(\[data-theme=light\]\)/);
  assert.doesNotMatch(read('void-live-deploy/index.html'), /vs-tool/);
  assert.match(read('void-live-deploy/functions/is-it/[what].js'), /class="vs-tool"><link rel="stylesheet" href="\/verse\.css">/);
});
