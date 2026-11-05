import test from 'node:test';
import assert from 'node:assert/strict';
import { isSystemsMonitor, boardOf, boardHtml } from '../void-live-deploy/skills/systems-monitor.js';

const esc = (s) => String(s);

test('the board uses the status API and never invents up', () => {
  assert.equal(isSystemsMonitor('systems monitor'), true);
  assert.equal(isSystemsMonitor('status of my systems'), true);
  assert.equal(isSystemsMonitor('system status for the onboarding flow'), false);
  const live = boardOf({ overall: 'degraded', guards: [{ name: 'a-to-mind.com', now: 'down', what: 'the home page answers' }, { name: 'Films', now: 'up', what: 'VERSE FILMS is live' }] });
  assert.equal(live.overall, 'degraded');
  assert.deepEqual(live.rows.map((r) => r.now), ['down', 'up']);
  const html = boardHtml(esc, live);
  assert.match(html, /down/);
  assert.doesNotMatch(html, /green/i);
  const missing = boardOf(null);
  assert.equal(missing.overall, 'unknown');
  assert.equal(missing.rows.length, 0);
  assert.match(boardHtml(esc, missing), /did not answer/);
  assert.doesNotMatch(boardHtml(esc, missing), />up</);
});
