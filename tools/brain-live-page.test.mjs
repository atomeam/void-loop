// /brain/'s live brain view (brain/live.js, brain/live.css, docs/brain.md): drawn only from GET /api/brain, nothing simulated on the main view.
// Run: node --test tools/brain-live-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('the live brain reads /api/brain and nothing it draws is made up', () => {
  const js = read('void-live-deploy/brain/live.js');
  assert.match(js, /fetch\('\/api\/brain'/);
  assert.doesNotMatch(js, /Math\.random|requestAnimationFrame/, 'no simulated activity: every light is an event time from /api/brain');
  assert.match(js, /'not yet'/, 'a missing link in the chain says so');
  for (const id of ['senses', 'attention', 'working', 'episodic', 'semantic', 'procedural', 'reflection', 'planning', 'action', 'evaluation', 'lessons', 'sleep', 'drives']) assert.match(js, new RegExp('\\b' + id + ': \\['), 'a place for ' + id);
});
test('the page puts the live brain first and the simulation behind a labelled Simulation button', () => {
  const html = read('void-live-deploy/brain/index.html'), knows = read('void-live-deploy/brain/knows.js');
  assert.match(html, /id="liveBrain"/); assert.match(html, /import '\/brain\/live\.js';/); assert.match(html, /href="\/brain\/live\.css"/);
  assert.match(html, /id="liveBtn" href="\/brain\/\?view=watch">Watch it think</);
  assert.match(html, /id="watchBtn"[^>]*title="A model of a mind running in your browser\. It is not Verse's own thinking\.">Simulation</);
  assert.match(knows, /params\.get\('view'\) === 'sim' \|\| params\.has\('t'\)/);
  assert.ok(html.indexOf('id="liveBrain"') < html.indexOf('What Verse knows</h2>'), 'live brain before Knows');
});
