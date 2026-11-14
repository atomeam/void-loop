import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

const page = readFileSync(new URL('../void-live-deploy/echo-vault/index.html', import.meta.url), 'utf8');
const redirects = readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8');

test('Echo Vault names the archive and keeps the two reading-only sites off the public floor', () => {
  assert.match(page, /<h1>Echo Vault: Internet History Archive<\/h1>/);
  assert.match(page, /only something to read/);
  assert.match(page, /id="paper-notes"/);
  assert.match(page, /id="hosting-brochure"/);
  assert.match(page, /5 April 2013/);
  assert.match(page, /13 November 2026/);
  assert.doesNotMatch(page, /the original/i);
  assert.doesNotMatch(page, /thunit\.com|randomarea\.com|nameunit\.com/i);
  assert.equal(FLOORS.some((f) => f.id === 'research' || f.page === '/research/'), false);
  assert.match(redirects, /\/research\/? \/echo-vault\/\?entry=paper-notes 301/);
});
