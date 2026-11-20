import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(readFileSync(join(here, 'capability-sweep', 'list.json'), 'utf8'));

test('the capability list has the common asks, each with an id and an ask', () => {
  const items = list.items || [];
  assert.ok(items.length >= 60, 'at least 60 common asks, got ' + items.length);
  const ids = new Set();
  for (const it of items) {
    assert.ok(it.id && it.ask, it.id || 'missing id/ask');
    assert.ok(!ids.has(it.id), 'duplicate ' + it.id);
    ids.add(it.id);
  }
  assert.ok(ids.has('charts') && ids.has('tts') && ids.has('make-image'));
});
