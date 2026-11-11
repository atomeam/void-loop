import test from 'node:test';
import assert from 'node:assert/strict';
import { probe } from './flow-probe.mjs';
test('probe is 2', () => { assert.equal(probe(), 2); });
