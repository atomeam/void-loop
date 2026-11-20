// Boards and Fan fiction stay off the Tools list and the 'Use with' links until people post there (fun audit 2026-11-20)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { allTools, relatedOf, routeAsk, QUIET } = await import('../void-live-deploy/lib/toolkit.js');

test('empty rooms are not listed or suggested, but asking for them still opens them', () => {
  const html = readFileSync(new URL('../void-live-deploy/tools/index.html', import.meta.url), 'utf8');
  for (const p of QUIET) {
    assert.ok(!allTools().some(([h]) => h === p), p + ' on the tools card');
    assert.ok(!html.includes('href="' + p + '"'), p + ' on /tools/');
    for (const [h] of allTools()) assert.ok(!relatedOf(h).some((r) => r.href === p), p + ' suggested beside ' + h);
  }
  assert.equal(routeAsk('fan fiction'), '/fanfic/');
  assert.equal(routeAsk('image boards'), '/boards/');
});
