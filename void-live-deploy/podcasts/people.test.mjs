import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('podcasts page has people section', () => {
  const htmlPath = path.join(process.cwd(), 'void-live-deploy/podcasts/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  assert.ok(html.includes('id="peoplePane"'), 'should contain peoplePane id');
  assert.ok(html.includes('id="peopleH"'), 'should contain peopleH id');
  assert.ok(html.includes('Meet the people behind your favorite podcasts'), 'should contain the heading text');
});
