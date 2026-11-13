import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffTexts } from '../void-live-deploy/lib/textdiff.js';
import { diffSummary, foldText } from '../void-live-deploy/lib/text-diff-page.js';
import { onRequestGet } from '../void-live-deploy/functions/text-diff/index.js';

test('case and extra spaces can be set aside before the lines are compared', () => {
  assert.equal(foldText('A  b', { lower: true, space: true }), 'a b');
  assert.equal(diffSummary(diffTexts(foldText('Cat', { lower: true }), foldText('cat', { lower: true }))).line, 'The two texts are the same.');
  assert.equal(foldText('Cat', {}), 'Cat');
});

test('a changed line is one removal and one addition', () => {
  const rows = diffTexts('one\ntwo', 'one\nthree');
  assert.equal(diffSummary(rows).line, '1 line removed, 1 line added, 1 unchanged.');
  assert.equal(diffSummary(diffTexts('same', 'same')).line, 'The two texts are the same.');
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/text-diff/index.html', import.meta.url), 'utf8');
  const res = await onRequestGet({
    request: new Request('https://a-to-mind.com/text-diff/?original=one%0Atwo&changed=one%0Athree'),
    next: async () => new Response(html),
  });
  const body = await res.text();
  assert.match(body, /1 line removed, 1 line added, 1 unchanged/);
  assert.match(body, /data-t="del"/);
  assert.match(body, /data-t="add"/);
  assert.match(body, />two</);
  assert.match(body, />three</);
});
