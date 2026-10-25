// The notes page's pure half (lib/notes.js): cleaning pasted html, markdown both ways, text and html export, import, versions (every 30 s, restore keeps
// what it replaced), search with highlights, the share link, the quick line, the words, and the page's registrations
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as N from '../void-live-deploy/lib/notes.js';
import { routeAsk, TOOLS, RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { FLOORS, LANES } from '../void-live-deploy/lib/tower.js';
import { probeFor } from './tower-probes.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');

test('clean drops scripts, styles, handlers and foreign tags, keeps the safe ones', () => {
  const h = N.clean('<p style="color:red" onclick="x()">hi <strong>there</strong><script>alert(1)</script><span class="Mso">!</span></p><a href="javascript:alert(1)">bad</a><a href="https://a.co/?x=1&y=2">ok</a><img src=x onerror=y>');
  assert.equal(h, '<p>hi <b>there</b>!</p>bad<a href="https://a.co/?x=1&amp;y=2" rel="noopener noreferrer" target="_blank">ok</a>');
  assert.equal(N.clean('1 < 2'), '1 &lt; 2');
});
test('text, words and markdown out', () => {
  const h = '<h1>Plan</h1><p>Buy <b>milk</b> and <i>eggs</i></p><ul class="todo"><li class="chk done">milk</li><li class="chk">eggs</li></ul><ol><li>one</li><li>two</li></ol><pre><code>a < b</code></pre>';
  assert.equal(N.toText(h), 'Plan\nBuy milk and eggs\n[x] milk\n[ ] eggs\n- one\n- two\na < b');
  assert.equal(N.wordCount('<p>Buy milk, eggs and bread. Don\'t forget.</p>'), 7);
  assert.equal(N.wordCount(''), 0);
  const md = N.toMd(h);
  assert.match(md, /^# Plan\n\nBuy \*\*milk\*\* and \*eggs\*/);
  assert.match(md, /- \[x\] milk\n- \[ \] eggs/); assert.match(md, /1\. one\n2\. two/); assert.match(md, /```\na < b\n```/);
});
test('markdown comes back in as the same note', () => {
  const md = '# Title\n\nSome **bold** and *italic* and `code` and [a link](https://x.org/a).\n\n- one\n- two\n\n- [ ] todo\n- [x] done\n\n1. first\n2. second\n\n> quoted\n\n```\nlet a = 1 < 2\n```\n';
  const h = N.mdToHtml(md);
  assert.match(h, /<h1>Title<\/h1>/); assert.match(h, /<b>bold<\/b>/); assert.match(h, /<a href="https:\/\/x\.org\/a"/); assert.match(h, /<li class="chk done">done<\/li>/); assert.match(h, /<ol><li>first/);
  assert.equal(N.mdToHtml(N.toMd(h)), h);
  assert.equal(N.mdToHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});
test('export and import', () => {
  const d = N.newDoc(1000, { title: 'Trip', html: '<p>Pack <b>socks</b></p>' });
  assert.match(N.exportMd(d), /^# Trip\n\nPack \*\*socks\*\*/); assert.equal(N.exportTxt(d), 'Trip\n\nPack socks\n');
  assert.match(N.exportHtml(d), /<title>Trip<\/title>[\s\S]*<h1>Trip<\/h1>\n<p>Pack <b>socks<\/b><\/p>/);
  assert.deepEqual(N.importText('trip.md', '# Hello\n\nworld'), { title: 'Hello', html: '<p>world</p>' });
  assert.deepEqual(N.importText('C:\\x\\list.txt', 'a\nb\n\nc'), { title: 'list', html: '<p>a<br>b</p><p>c</p>' });
  assert.equal(N.titleOf({ title: '  ' }), 'Untitled');
});
test('versions: one per 30 s of change, none for no change, restore keeps what it replaced', () => {
  let d = N.newDoc(0, { title: 'A', html: '<p>one</p>' });
  d = N.snapshot(d, 1000); assert.equal(d.versions.length, 1);
  assert.equal(N.snapshot(d, 2000), d, 'unchanged: no new version');
  const e = { ...d, html: '<p>two</p>' };
  assert.equal(N.snapshot(e, 20000).versions.length, 1, 'changed but inside 30 s: wait');
  let f = N.snapshot(e, 40000); assert.equal(f.versions.length, 2);
  assert.equal(N.snapshot(e, 5000, true).versions.length, 2, 'on demand: at once');
  f = { ...f, html: '<p>three</p>' };
  const r = N.restore(f, 1000, 100000);
  assert.equal(r.html, '<p>one</p>'); assert.equal(r.versions.length, 3); assert.equal(r.versions[2].html, '<p>three</p>');
  assert.equal(N.restore(f, 999, 5), f);
  const list = N.snapshotsFor(f); assert.deepEqual(list.map((v) => v.t), [40000, 1000]); assert.equal(list[0].words, 1);
  let g = N.newDoc(0, { title: 'x', html: '<p>0</p>' }); for (let i = 1; i < 150; i++) g = N.snapshot({ ...g, html: '<p>' + i + '</p>' }, i * 31000); assert.equal(g.versions.length, N.KEEP);
  assert.equal(N.snapshot(N.newDoc(0), 99999).versions.length, 0, 'an empty note keeps nothing');
});
test('search: every word, title first, snippets, highlights', () => {
  const docs = [N.newDoc(1, { id: 'a', title: 'Shopping list', html: '<p>milk eggs bread</p>' }), N.newDoc(2, { id: 'b', title: 'Ideas', html: '<p>write about milk and the shopping trip</p>' }), N.newDoc(3, { id: 'c', title: 'Other', html: '<p>nothing</p>' })];
  const r = N.search(docs, 'shopping milk'); assert.deepEqual(r.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(N.search(docs, 'MILK').map((x) => x.id).sort(), ['a', 'b']); assert.deepEqual(N.search(docs, 'zebra'), []); assert.deepEqual(N.search(docs, '  '), []);
  assert.match(r[1].snippet, /milk/);
  assert.equal(N.mark('Milk & <eggs>', 'milk eggs'), '<mark>Milk</mark> &amp; &lt;<mark>eggs</mark>&gt;');
  assert.equal(N.mark('a.b', 'a.b'), '<mark>a.b</mark>');
});
test('the share link carries one note and cleans what comes back', () => {
  const d = N.newDoc(1, { title: 'Grüße ✓', html: '<p>héllo <b>wörld</b></p>' });
  const l = N.shareLink(d, 'https://a-to-mind.com'); assert.match(l, /^https:\/\/a-to-mind\.com\/notes\/\?n=[A-Za-z0-9_-]+$/);
  const back = N.fromShare(l.split('n=')[1]); assert.deepEqual(back, { title: 'Grüße ✓', html: '<p>héllo <b>wörld</b></p>' });
  assert.equal(N.fromShare('%%%'), null);
  const evil = Buffer.from(JSON.stringify({ t: 'x', h: '<img src=x onerror=1><p>ok</p>' })).toString('base64url'); assert.equal(N.fromShare(evil).html, '<p>ok</p>');
});
test('quickNote: a title and a checklist from one line', () => {
  const q = N.quickNote('note: Shopping list - milk, eggs, bread');
  assert.equal(q.title, 'Shopping list'); assert.equal(q.html, '<ul class="todo"><li class="chk">milk</li><li class="chk">eggs</li><li class="chk">bread</li></ul>');
  assert.deepEqual(N.quickNote('buy milk'), { title: 'buy milk', html: '' });
  assert.deepEqual(N.quickNote('new note: call mum: about sunday'), { title: 'call mum', html: '<p>about sunday</p>' });
  assert.equal(N.quickNote('note:'), null);
});
test('load keeps only good documents', () => {
  const s = N.load(JSON.stringify({ cur: 'zz', docs: [{ id: 'a', title: 't', html: '<script>x</script><p>y</p>', updated: 5 }, { nope: 1 }] }));
  assert.equal(s.docs.length, 1); assert.equal(s.docs[0].html, '<p>y</p>'); assert.equal(s.cur, 'a'); assert.deepEqual(N.load('garbage'), { docs: [], cur: null });
});
test('the words come in German too', () => { assert.equal(N.wordsFor('de-AT').title, 'Notizen'); assert.equal(N.wordsFor('en-US').title, 'Notes'); assert.deepEqual(Object.keys(N.wordsFor('de')), Object.keys(N.wordsFor('en'))); });

test('the page is registered everywhere', () => {
  assert.equal(TOOLS['/notes/'], 'Notes'); assert.ok(RELATED['/notes/'].length >= 2);
  assert.equal(routeAsk('note: buy milk'), '/notes/?q=buy%20milk'); assert.equal(routeAsk('new note'), '/notes/'); assert.equal(routeAsk('my notes'), '/notes/');
  assert.ok(PAGES.some((p) => p.path === '/notes/'));
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'/notes/'"));
  const f = FLOORS.find((x) => x.id === 'docs and notes'); assert.match(f.page, /^\/notes\//); assert.ok(LANES['docs and notes'].length >= 5);
  const p = probeFor('docs and notes'); assert.ok(p && p.ask.verse.startsWith('/notes/?q='));
  const html = fs.readFileSync(path.join(root, 'notes', 'index.html'), 'utf8');
  for (const w of ['contenteditable', 'Version history', 'Search all notes', '.md', 'aria-label']) assert.ok(html.includes(w), w);
});
