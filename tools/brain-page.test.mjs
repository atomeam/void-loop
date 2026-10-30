// tests for Verse Brain full screen (/brain/, owner 2026-10-30: "verse brain needs a full screen"): the asks that open it (lib/brain-ask.js), the
// tool pages' ask box and the stage skill both send them there, the page is registered where every tool page is, and the page itself runs
// the card's own code (no second brain). The page in a real browser: tools/real-pages.mjs '/brain/'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brainFullAsk } from '../void-live-deploy/lib/brain-ask.js';
import { routeAsk, TOOLS } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { PAGE_OF } from '../void-live-deploy/lib/card-frame.js';

const ASKS = ['full screen brain', 'show me your brain full screen', 'open verse brain', 'Open Verse Brain please', 'fullscreen brain', 'verse brain full screen', 'show me the full-screen brain?'];
const NOT = ['verse brain', 'your brain', 'brain teaser', 'full screen', 'open the piano', 'make the video full screen', 'what are you thinking'];

test('the full-screen asks are known, and near misses are not', () => {
  for (const t of ASKS) assert.ok(brainFullAsk(t), t);
  for (const t of NOT) assert.ok(!brainFullAsk(t), t);
});

test('a tool page ask box opens /brain/ for them, and the plain card ask still goes to the stage', () => {
  for (const t of ASKS) assert.equal(routeAsk(t), '/brain/', t);
  assert.equal(routeAsk('verse brain'), '/?q=verse%20brain');
});

test('/brain/ is registered like every tool page: tools, seo, card frame, sitemap, llms.txt, service worker', () => {
  assert.equal(TOOLS['/brain/'], 'Verse Brain');
  assert.ok(PAGES.some((p) => p.path === '/brain/'));
  assert.deepEqual(PAGE_OF['verse-brain'], ['/brain/', 'Verse Brain']);
  const read = (f) => readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
  assert.match(read('sitemap.xml'), /<loc>https:\/\/a-to-mind\.com\/brain\/<\/loc>/);
  assert.match(read('llms.txt'), /https:\/\/a-to-mind\.com\/brain\//);
  assert.match(read('sw.js'), /'\/brain\/'/);
  const html = read('brain/index.html');
  assert.match(html, /<meta name="verse-handoff" content="in: text; out: none">/); assert.match(readFileSync(new URL('../void-live-deploy/brain/app.js', import.meta.url), 'utf8'), /get\('t'\)/);
  const related = (html.match(/<!-- related -->([\s\S]*?)<!-- \/related -->/) || [])[1] || '';
  assert.ok((related.match(/<a href="\/[a-z-]+\/">/g) || []).filter((a) => !/\/tools\//.test(a)).length >= 4, 'at least four sibling tools in the footer: ' + related);
});

test('the page runs the card itself: the brain idea and mountField, with the field resized to the window', () => {
  const app = readFileSync(new URL('../void-live-deploy/brain/app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{ idea \} from '\/skills\/verse-brain\.js'/);
  assert.match(app, /mountField\(th, stageApi, idea\)/);
  assert.match(app, /f\.resize\(/);
  assert.match(app, /B\.selfOf\(b\)/); assert.match(app, /B\.selfSays\(b\)/);
});

test('the stage skill answers the full-screen asks with a link to /brain/, and its card gains a Full screen link', async () => {
  const skill = (await import('../void-live-deploy/skills/verse-brain.js')).default;
  for (const t of ASKS) assert.ok(skill.match(t.toLowerCase(), t), t);
  assert.ok(!skill.match('brain teaser', 'brain teaser'));
  let html = '', said = '';
  const api = { showPage: (fn) => { const p = { dataset: {} }; fn(p); html = p.innerHTML; return p; }, say: (t) => { said = t; } };
  assert.equal(await skill.run('full screen brain', api), 'verse-brain');
  assert.match(html, /href="\/brain\/"/); assert.match(said, /a-to-mind\.com\/brain\//);
  assert.match(readFileSync(new URL('../void-live-deploy/skills/verse-brain.js', import.meta.url), 'utf8'), /full\.href = '\/brain\/'/);
});
