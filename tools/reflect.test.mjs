import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageMinutes } from './reflect.mjs';

const NOW = Date.parse('2026-10-19T12:00:00Z');
test('ageMinutes: minutes since the newest entry of the kind, infinite when there is none, never negative', () => {
  const e = [{ kind: 'build', at: '2026-10-19T11:50:00Z' }, { kind: 'daily', at: '2026-10-19T09:00:00Z' }, { kind: 'daily', at: '2026-10-18T09:00:00Z' }];
  assert.equal(ageMinutes(e, 'daily', NOW), 180);
  assert.equal(ageMinutes(e, 'build', NOW), 10);
  assert.equal(ageMinutes([], 'daily', NOW), Infinity);
  assert.equal(ageMinutes(null, 'daily', NOW), Infinity);
  assert.equal(ageMinutes([{ kind: 'daily', at: '2026-10-19T13:00:00Z' }], 'daily', NOW), 0);
  assert.equal(ageMinutes([{ kind: 'daily', at: 'nonsense' }], 'daily', NOW), Infinity);
});

test('the deploy asks for the full reflection after a build, throttled, and never lets a failure block it', () => {
  const d = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(d, /node tools\/reflect\.mjs --daily --if-older 180 \| tee -a "\$GITHUB_STEP_SUMMARY" \|\| true/);
});
