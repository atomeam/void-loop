// skills/lab.js: "verse lab" and its near spellings open the lab card, look-alikes do not, and the count comes from the catalog.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import lab, { summary } from '../void-live-deploy/skills/lab.js';

test('lab: the asks that mean the lab take it, the look-alikes do not', () => {
  for (const a of ['verse lab', 'Vers lab', 'the lab', 'lab', 'open the lab', 'where is the lab?', "verse's lab", 'show me the lab', 'lab experiments', 'the lab on verse', 'verses lab'])
    assert.ok(lab.match(a.toLowerCase(), a), a + ' opens the lab');
  for (const a of ['lab results', 'lab coat', 'labrador puppies', 'chemistry lab safety', 'what is a lab', 'blood lab work', 'collaborate'])
    assert.ok(!lab.match(a.toLowerCase(), a), a + ' is not the lab');
});

test('lab: the card counts what is live in the real catalog and lists the newest first', () => {
  const cat = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/lab/catalog.json', import.meta.url), 'utf8'));
  const s = summary(cat);
  assert.equal(s.live, cat.filter((e) => e.status !== 'broken').length);
  assert.equal(s.total, cat.length);
  assert.ok(s.newest.length > 0 && s.newest.length <= 8);
  for (let i = 1; i < s.newest.length; i++) assert.ok((s.newest[i - 1].num || 0) >= (s.newest[i].num || 0), 'newest first');
  for (const e of s.newest) assert.ok(fs.existsSync(new URL('../void-live-deploy/lab/' + e.slug + '/index.html', import.meta.url)), e.slug + ' is a real page');
  assert.deepEqual(summary(null), { live: 0, total: 0, newest: [] });
});

test('lab: the card escapes what it shows and links to /lab/', () => {
  let html = '';
  const el = { dataset: {}, set innerHTML(v) { html = v; }, get innerHTML() { return html; }, isConnected: true };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const saved = globalThis.fetch; globalThis.fetch = () => Promise.resolve({ ok: false });
  try { assert.equal(lab.run('verse lab', { showPage: (b) => b(el), esc }), 'lab'); } finally { globalThis.fetch = saved; }
  assert.equal(el.dataset.page, '/lab/');
  assert.match(html, /href="\/lab\/"/);
});
