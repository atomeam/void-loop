// Convergence step 2 (lists run 20): asOf (air, pollen, uv) and slug (api/reflect, lib/will-guard) are one copy each in lib/ask-text.js.
// The old copies are kept here verbatim and compared on many inputs, so the move changed nothing a visitor or a job target sees.
// Run: node --test tools/ask-text-step2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { asOf, slug } from '../void-live-deploy/lib/ask-text.js';
import { slug as willSlug, targetOf } from '../void-live-deploy/lib/will-guard.js';

function oldAsOf(iso) {
  if (!iso) return new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const d = new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    + (/T\d/.test(iso) ? ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
}
const oldSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

test('asOf reads every kind of reading time as the three old copies did', () => {
  for (const iso of ['', null, undefined, '2026-11-12', '2026-11-12T15:00', '2026-11-12T15:00:00Z', '2026-02-30', 'soon', '2026-11-12T', 'T12']) assert.equal(asOf(iso), oldAsOf(iso), String(iso));
});
test('slug makes the same ids and job targets as before', () => {
  for (const s of ['Build the Map!', '  ', 'Ünïcode words ✓', 'a'.repeat(80), '--x--', 'Make a manifest file in the skills/ directory', 42]) { assert.equal(slug(s), oldSlug(s)); assert.equal(willSlug(s), oldSlug(s)); }
  assert.equal(targetOf('Build the Map!'), 'will:build-the-map');
});
test('no copy is left in the files that had one', () => {
  for (const f of ['skills/air.js', 'skills/pollen.js', 'skills/uv.js']) assert.doesNotMatch(readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8'), /function asOf\(/, f);
  for (const f of ['functions/api/reflect.js', 'lib/will-guard.js']) assert.doesNotMatch(readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8'), /const slug = /, f);
});
