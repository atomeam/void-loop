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

test('a small page splits into a stylesheet, a boot script and deferred sections', () => {
  const html = '<html><head><title>Verse</title></head><body>\n  <style>\n    /* home polish: x */\n    body{margin:0}\n  </style>\n  <script>\n    // Private learning log\n    const LOOP_KEY = 1;\n  </script>\n  <script>\n  // ---- The sky: a\n  const sky = 1;\n  </script>\n  <script>\n  // ---- Presence: b\n  const presence = 1;\n  </script>\n  <script>\n  // ---- Synapses: c\n  const synapses = 1;\n  </script>\n</body></html>';
  const split = splitHome(html);
  assert.ok(split);
  assert.match(split.html, /href="\/void-home\.css"/);
  assert.match(split.html, /rel="preload" href="\/void-boot\.js"/);
  assert.match(split.html, /src="\/void-boot\.js" defer/);
  assert.match(split.html, /src="\/void-sky\.js" defer/);
  assert.match(split.html, /src="\/void-presence\.js" defer/);
  assert.match(split.html, /src="\/void-synapses\.js" defer/);
  assert.doesNotMatch(split.html, /<style>/);
  assert.equal(split.files['void-boot.js'].includes('LOOP_KEY'), true);
  assert.equal(split.files['void-home.css'].includes('home polish'), true);
  assert.equal(splitHome(split.html), null);
});

test('the real home page loses the main script and the style, and each script still parses', () => {
  const html = readFileSync(resolve(root, 'void.html'), 'utf8');
  const before = Buffer.byteLength(html);
  const split = splitHome(html);
  assert.ok(split);
  const after = Buffer.byteLength(split.html);
  assert.ok(after < before / 3, after + ' of ' + before);
  assert.match(split.html, /id="input"/);
  assert.match(split.html, /src="\/void-boot\.js" defer/);
  assert.equal(split.files['void-boot.js'].includes('const LOOP_KEY'), true);
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
