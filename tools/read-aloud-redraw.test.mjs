// Owner, 2026-11-04: a card's "read aloud" button must still say "Stop reading" after the card redraws itself, or a
// second tap restarts the reading instead of stopping it. keepRead used to build a fresh button (aria-pressed="false")
// on every redraw; the answer's product tail lands after the read starts, so under load the redraw landed between the
// two taps and the suite caught the button off (the paste/read-aloud flake, tools/flakes.json: a9b686d9, 16e592fd, …).
// Read the page's own source, so a later edit that drops the state carry is caught here, not in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(root, 'void-live-deploy/void.html'), 'utf8');
const grab = (name) => { const i = page.indexOf('    function ' + name + '('); assert.ok(i > 0, name); const j = page.indexOf('\n    }\n', i); return page.slice(i, j + 6); };

test('a redraw keeps the read button on when the card is still being read', () => {
  const k = grab('keepRead');
  assert.match(k, /readTimer !== 0 && readEl === el/, 'the button reads the reading state, not a fixed off');
  assert.match(k, /on \? 'Stop reading' : 'Read aloud'/, 'it keeps the words too');
  assert.doesNotMatch(k, /aria-pressed', 'false'\);\s*el\.insertBefore/, 'a redraw no longer forces the button off');
});

test('readCard marks the reading card and clears it on every stop', () => {
  const r = grab('readCard');
  assert.match(r, /readEl = el/, 'the reading card is remembered for the redraw to find');
  assert.match(r, /readTimer = 0; readEl = null/, 'stopping clears it, so a later redraw shows the button off');
  assert.match(page, /let readTimer = 0, readEl = null;/, 'the state lives beside the timer');
});

test('index.html and void.html stay the same page', () => {
  assert.equal(readFileSync(resolve(root, 'void-live-deploy/index.html'), 'utf8'), page);
});
