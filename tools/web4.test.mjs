// Web4 (lib/web4.js, skills/web4.js): four layers in order, no crypto words, every `where` ask reaches a real skill (or is a page ask
// named in PAGE_ASKS and listed in the page's own hints), the honest sentence is on the card, and the ask phrasings route to the skill.
// Run: node --test tools/web4.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LAYERS, HONEST, WHOSE, PAGE_ASKS, allText } from '../void-live-deploy/lib/web4.js';
import web4, { web4Html } from '../void-live-deploy/skills/web4.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const names = JSON.parse(readFileSync(resolve(root, 'skills/index.json'), 'utf8'));
const mods = []; for (const n of names) mods.push((await import(pathToFileURL(resolve(root, 'skills', n + '.js')).href)).default);
const first = (a) => { const k = mods.find((s) => s.match(a.toLowerCase(), a)); return k ? k.name : null; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('four layers, in order, each with a name, a short line and an ask', () => {
  assert.deepEqual(LAYERS.map((l) => l.n), [1, 2, 3, 4]);
  for (const l of LAYERS) {
    assert.ok(l.name && l.did && l.where && l.label);
    const sentences = l.line.split(/(?<=[.!?])\s+/).length;
    assert.ok(sentences >= 2 && sentences <= 4, 'Web ' + l.n + ' has ' + sentences + ' sentences');
  }
});

test('no crypto words anywhere on the card, and the card text is the module text', () => {
  assert.doesNotMatch(allText(), /blockchain|token|coin|NFT|crypto|wallet/i);
  assert.doesNotMatch(web4Html(esc), /blockchain|token|coin|NFT|crypto|wallet/i);
});

test('every where ask reaches a real skill first, or is a page ask the page lists as its own', () => {
  const page = readFileSync(resolve(root, 'void.html'), 'utf8');
  for (const l of LAYERS) {
    if (PAGE_ASKS.includes(l.where)) assert.ok(page.includes("'" + l.where + "'"), l.where + ' is not one of the page\'s own hints');
    else { const k = first(l.where); assert.ok(k && k !== 'web4', '"' + l.where + '" reaches ' + k); }
  }
});

test('the honest sentence and whose name it is are on the card; links carry the asks', () => {
  const html = web4Html(esc);
  assert.ok(HONEST.startsWith('Web4 is our name for it') && html.includes(esc(HONEST)) && html.includes(esc(WHOSE)));
  for (const l of LAYERS) assert.ok(html.includes('data-ask="' + esc(l.where) + '"'));
  assert.ok(html.indexOf('Web 1') > html.indexOf('Web 4'), 'the ladder is drawn with Web 1 at the bottom');
});

test('the asks reach web4, and look-alikes do not', () => {
  for (const a of ['what is web4', 'are you web4', 'web 1 2 3 4', "what's web 4", 'web4', 'Web4?']) assert.equal(first(a), 'web4', a);
  for (const a of ['what is web3', 'web design basics', 'web 2.0 sites', 'web4 domains for sale']) assert.notEqual(first(a), 'web4', a);
  assert.equal(web4.name, 'web4');
});

test('the book prints the ladder: the generated page carries all four steps', () => {
  const book = JSON.parse(readFileSync(resolve(root, 'skills/guide.json'), 'utf8'));
  const p = book.pages.find((x) => x.name === 'web4');
  assert.ok(p && /Web 1 read/.test(p.line) && /Web 4 ask and it appears/.test(p.line));
});
