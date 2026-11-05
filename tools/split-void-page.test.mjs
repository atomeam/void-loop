// The deploy pulls the home page's style and main script out of the HTML the visitor downloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitHome } from './split-void-page.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('a small page splits into a stylesheet and scripts that wait for the first paint', () => {
  const html = '<html><head><title>Verse</title></head><body>\n  <style>\n    /* home polish: x */\n    body{margin:0}\n  </style>\n  <script>\n    // Private learning log\n    const LOOP_KEY = 1;\n  </script>\n  <script>\n  // ---- The sky: a\n  const sky = 1;\n  </script>\n  <script>\n  // ---- Presence: b\n  const presence = 1;\n  </script>\n  <script>\n  // ---- Synapses: c\n  const synapses = 1;\n  </script>\n</body></html>';
  const split = splitHome(html);
  assert.ok(split);
  assert.match(split.html, /href="\/void-home\.css"/);
  assert.match(split.html, /media="print"/);
  assert.doesNotMatch(split.html, /rel="preload" href="\/void-boot\.js"/);
  assert.doesNotMatch(split.html, /<script src="\/void-/);
  assert.match(split.html, /add\("\/void-boot\.js"\)/);
  assert.match(split.html, /requestAnimationFrame\(boot\)/);
  assert.match(split.html, /add\("\/void-sky\.js"\)/);
  assert.match(split.html, /add\("\/verse-field\.js", "module"\)/);
  assert.match(split.html, /largest-contentful-paint/);
  assert.doesNotMatch(split.html, /<style>/);
  assert.equal(split.files['void-boot.js'].includes('LOOP_KEY'), true);
  assert.equal(split.files['void-home.css'].includes('home polish'), true);
  assert.equal(splitHome(split.html), null);
});

test('the real home page paints the blank stage from HTML and keeps each script parseable', () => {
  const html = readFileSync(resolve(root, 'void.html'), 'utf8');
  const before = Buffer.byteLength(html);
  const split = splitHome(html);
  assert.ok(split);
  const after = Buffer.byteLength(split.html);
  assert.ok(after < before / 3, after + ' of ' + before);
  assert.doesNotMatch(split.html, /id="verse-hero"/); // blank home: no hero words, just the sky and the ask bar (owner, 2026-11-04)
  assert.match(split.html, /id="dock"/);
  assert.match(split.html, /id="verse-critical"/);
  assert.match(split.html, /id="input"/);
  assert.doesNotMatch(split.html, /home polish/);
  assert.doesNotMatch(split.html, /rel="preload" href="\/void-boot\.js"/);
  assert.doesNotMatch(split.html, /rel="preload" href="\/skills\/index\.json"/);
  assert.match(split.html, /add\("\/void-boot\.js"\)/);
  assert.equal(split.files['void-boot.js'].includes('const LOOP_KEY'), true);
  assert.equal(split.files['void-boot.js'].includes('or idle'), true);
  assert.match(split.files['void-cards.css'], /home cards:/);
  assert.match(split.files['void-home.css'], /home stage:/);
  assert.doesNotMatch(split.files['void-home.css'], /home cards:/);
  assert.match(split.files['void-boot.js'], /void-cards\.css/);
  assert.doesNotMatch(split.html, /void-cards\.css/);
  assert.equal(split.files['void-sky.js'].includes('sky-rules.js'), true);
  const dir = mkdtempSync(join(tmpdir(), 'void-split-'));
  for (const [name, body] of Object.entries(split.files)) {
    if (!name.endsWith('.js')) continue;
    const p = join(dir, name);
    writeFileSync(p, body);
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    assert.equal(r.status, 0, name + ' ' + (r.stderr || '').slice(0, 200));
  }
});

test('the sky and the other decor scripts never run before the main script has run (live: things is not defined)', () => {
  const html = '<html><body>\n  <script>\n    // Private learning log\n    let things = {};\n  </script>\n  <style>\n    /* home polish: x */\n  </style>\n  <script>\n  // ---- The sky: a\n  Object.keys(things);\n  </script>\n  <script>\n  // ---- Presence: b\n  </script>\n  <script>\n  // ---- Synapses: c\n  </script>\n</body></html>';
  const split = splitHome(html);
  assert.ok(split);
  const loader = split.html.slice(split.html.lastIndexOf('<script>') + 8, split.html.lastIndexOf('</script>'));
  // run the loader with a fake DOM where scripts finish in the worst order: decor is asked for first, the main script loads last
  const added = []; let lcp = null, timer = null, raf = [];
  const el = () => ({ set src(v) { this._src = v; }, get src() { return this._src; } });
  const document = { readyState: 'complete', body: { appendChild: (s) => added.push(s) }, head: { appendChild() {} }, createElement: el, getElementById: () => null, addEventListener() {} };
  const window = { addEventListener() {} };
  class PerformanceObserver { constructor(f) { lcp = () => f({ getEntries: () => [1] }, this); } observe() {} disconnect() {} }
  new Function('document', 'window', 'PerformanceObserver', 'requestAnimationFrame', 'setTimeout', loader)(document, window, PerformanceObserver, (f) => raf.push(f), (f) => { timer = f; });
  lcp(); // the largest paint lands before the two frames that start boot
  const srcs = () => added.map((s) => s.src);
  assert.deepEqual(srcs(), ['/void-boot.js'], 'only the main script is fetched before it has run');
  timer(); assert.deepEqual(srcs(), ['/void-boot.js']);
  while (raf.length) raf.shift()();
  assert.deepEqual(srcs(), ['/void-boot.js'], 'boot is added once');
  added[0].onload();
  assert.ok(srcs().includes('/void-sky.js') && srcs().indexOf('/void-sky.js') > 0);
  assert.equal(srcs().filter((s) => s === '/void-sky.js').length, 1);
});

test('an ask typed before the main script has run is asked once it has run (live: the returning visit\'s "films" never opened)', () => {
  const html = '<html><body>\n  <script>\n    // Private learning log\n  </script>\n  <style>\n    /* home polish: x */\n  </style>\n  <script>\n  // ---- The sky: a\n  </script>\n  <script>\n  // ---- Presence: b\n  </script>\n  <script>\n  // ---- Synapses: c\n  </script>\n</body></html>';
  const split = splitHome(html);
  const loader = split.html.slice(split.html.lastIndexOf('<script>') + 8, split.html.lastIndexOf('</script>'));
  const on = (o) => { o.h = {}; o.addEventListener = (t, f) => { (o.h[t] ||= []).push(f); }; return o; };
  const input = on({ value: '' }), asked = [];
  const go = on({ click() { for (const f of go.h.click || []) f(); if (go.real) go.real(input.value); } });
  const added = [];
  const document = { readyState: 'complete', body: { appendChild: (s) => added.push(s) }, head: { appendChild() {} }, createElement: () => ({}), getElementById: (id) => ({ input, go })[id] || null, addEventListener() {} };
  new Function('document', 'window', 'PerformanceObserver', 'requestAnimationFrame', 'setTimeout', loader)(document, { addEventListener() {} }, undefined, () => {}, () => {});
  input.value = 'films'; for (const f of input.h.keydown) f({ key: 'Enter' });
  assert.deepEqual(added.map((s) => s.src), ['/void-boot.js'], 'an early Enter starts the main script at once');
  go.real = (v) => asked.push(v); // the main script has run: its click handler is on the button
  added[0].onload();
  assert.deepEqual(asked, ['films']);
  go.click(); assert.deepEqual(asked, ['films', 'films'], 'after boot the loader keeps out of the way');
  assert.equal(added.filter((s) => s.src === '/void-boot.js').length, 1);
});

test('the empty home hides the away line and keeps the ask bar', () => {
  const html = readFileSync(resolve(root, 'void.html'), 'utf8');
  const split = splitHome(html);
  assert.match(html, /#away-note,#v01d,#verse-install\{display:none !important\}/);
  assert.match(html, /id="row"/);
  assert.match(html, /id="input"/);
  assert.match(html, /id="void-anchor"/);
  assert.match(split.html, /#away-note,#v01d,#verse-install\{display:none !important\}/);
  assert.match(split.html, /id="row"/);
});

test('a phone does not fetch the ask engine until a tap, a key, or twelve seconds', () => {
  const prev = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const html = '<html><body><input id="input"><button id="go"></button>\n  <script>\n    // Private learning log\n    let things = {};\n  </script>\n  <style>\n    /* home polish: x */\n  </style>\n  <script>\n  // ---- The sky: a\n  Object.keys(things);\n  </script>\n  <script>\n  // ---- Presence: b\n  </script>\n  <script>\n  // ---- Synapses: c\n  </script>\n</body></html>';
    const split = splitHome(html);
    const loader = split.html.slice(split.html.lastIndexOf('<script>') + 8, split.html.lastIndexOf('</script>'));
    const added = [], listeners = {};
    let late = null;
    const document = {
      readyState: 'complete',
      body: { appendChild: (s) => added.push(s) },
      head: { appendChild() {} },
      createElement: () => ({}),
      getElementById: () => ({ value: '', addEventListener() {} }),
      addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
      removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
    };
    new Function('document', 'window', 'PerformanceObserver', 'requestAnimationFrame', 'setTimeout', 'matchMedia', loader)(document, { addEventListener() {} }, class { constructor() {} observe() {} disconnect() {} }, () => {}, (f, ms) => { late = { f, ms }; }, matchMedia);
    assert.deepEqual(added.map((s) => s.src), [], 'an empty phone home does not fetch the engine');
    assert.equal(late.ms, 12000);
    listeners.pointerdown[0]();
    assert.deepEqual(added.map((s) => s.src), ['/void-boot.js']);
    added[0].onload();
    assert.ok(added.map((s) => s.src).includes('/void-sky.js'), 'the tap brings the sky after the engine has run');
  } finally {
    if (prev === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = prev;
  }
});
