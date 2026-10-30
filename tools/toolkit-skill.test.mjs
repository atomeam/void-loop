// toolkit (skills/toolkit.js): "what tools do you have" and "all tools" take the card; every page /tools/ lists (lib/toolkit.js allTools()) is one escaped link on it, /tools/ itself is not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/toolkit.js';
import { readFileSync } from 'node:fs';
import { allTools } from '../void-live-deploy/lib/toolkit.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const card = (text) => { const el = { dataset: {}, innerHTML: '' }; const r = sk.run(text, { showPage: (fn) => { fn(el); return el; }, esc }); return { r, el }; };

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['what tools do you have?', 'which tools are there', 'list all tools', 'show me all the tools', 'tool list', 'list of tools', 'how many rolls of tape for my boxes']) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['tools', 'how many rolls of wallpaper for 200ft', 'all tools are broken', 'buy some tools', 'what tools do you have for gardening']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('the card: one link per tool page, the count in the title, /tools/ as the page it opens', () => {
  const { r, el } = card('all tools'), list = allTools();
  assert.equal(r, 'toolkit'); assert.equal(el.dataset.page, '/tools/');
  assert.ok(el.innerHTML.startsWith('<h2>' + list.length + ' tools</h2>'), el.innerHTML.slice(0, 40));
  assert.equal((el.innerHTML.match(/<a href=/g) || []).length, list.length);
  for (const [href, label] of list) assert.ok(el.innerHTML.includes('<a href="' + esc(href) + '" style="display:inline-block;padding:5px 12px;border:1px solid #8884;border-radius:999px;text-decoration:none">' + esc(label) + '</a>'), href);
  assert.ok(!el.innerHTML.includes('href="/tools/"'));
  assert.ok(el.innerHTML.includes('<a href="/photos/" ') && el.innerHTML.includes('>Photo tools</a>'));
  assert.match(el.innerHTML, /<div class="src">Each is a full page that works on this device; ask any of them here too, like "flip a coin" or "100 c to f"\.<\/div>$/);
});
test('the card and the Tools page list the same pages: the card once missed the eleven the page lists by hand', () => {
  const html = readFileSync(new URL('../void-live-deploy/tools/index.html', import.meta.url), 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('<nav id="related"'));
  const page = new Set([...main.matchAll(/<li(?: [^>]*)?><a href="(\/[^"]*)"/g)].map((m) => m[1]));
  const onCard = new Set([...card('all tools').el.innerHTML.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]));
  assert.ok(page.size > 80, 'the page lists its tools: ' + page.size);
  assert.deepEqual([...page].filter((h) => !onCard.has(h)), [], 'on /tools/ but not on the card');
  // /tools/ lists a tool Verse built twice under one name once (tools/seo-pages.mjs moreTools); the card may keep both addresses
  const pageNames = new Set([...main.matchAll(/<li(?: [^>]*)?><a href="\/[^"]*">([^<]*)</g)].map((m) => m[1].toLowerCase()));
  const cardNames = new Map([...card('all tools').el.innerHTML.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2].toLowerCase()]));
  assert.deepEqual([...onCard].filter((h) => !page.has(h) && !pageNames.has(cardNames.get(h))), [], 'on the card but not on /tools/');
});
