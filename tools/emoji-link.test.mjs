// a-to-mind.com/emoji/<emoji or name> lands on that emoji's every-platform grid (functions/emoji/[[path]].js); /emoji/ is the emoji page
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetOf, onRequest } from '../void-live-deploy/functions/emoji/[[path]].js';

test('/emoji/<x> goes to the grid with the emoji in ?e=', () => {
  assert.equal(targetOf('/emoji'), '/emojis/');
  assert.equal(targetOf('/emoji/'), '/emojis/');
  assert.equal(targetOf('/emoji/%F0%9F%94%A5'), '/emojis/everywhere/?e=%F0%9F%94%A5');
  assert.equal(targetOf('/emoji/fire/'), '/emojis/everywhere/?e=fire');
  assert.equal(targetOf('/emoji/%E0%A4%A'), '/emojis/everywhere/?e=%25E0%25A4%25A');
});
test('the function answers a 302 and the route reaches it', () => {
  const r = onRequest({ request: new Request('https://a-to-mind.com/emoji/%F0%9F%98%82') });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://a-to-mind.com/emojis/everywhere/?e=%F0%9F%98%82');
  const routes = JSON.parse(readFileSync(new URL('../void-live-deploy/_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/emoji/*') && routes.include.includes('/emoji'));
  assert.ok(!/:splat\b[^\n]*\?|\?[^\n]*:splat/.test(readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8')), 'Pages does not fill :splat in a query string');
});
