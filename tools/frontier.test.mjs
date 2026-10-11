// tools/frontier.mjs: the one build order, read the same way everywhere. node --test tools/frontier.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { openItems, stepsLeft, addOpen, readFrontier } from './frontier.mjs';

const sample = `# The frontier

## Current priority, above everything in this file

1. **One front door.** text
   - **done** (claude): yes
2. **One "next" list.** text
3. **The salvage shelf.** text

---

**Folded in from the old lists (2026-10-11), still open, each with where it came from:**
- **Void as a tool inside other AIs:** a public MCP server (\`void.plan.md\` Next #11). Nothing serves MCP yet.
- **Paid Void** (\`void.plan.md\` Next #12): built on a helper branch.

**Checked and already live** (not part of the list)
`;

test('open items: title, why and where each came from; the list ends at the first blank line', () => {
  const o = openItems(sample);
  assert.equal(o.length, 2);
  assert.deepEqual(o[0], { title: 'Void as a tool inside other AIs', why: 'a public MCP server (void.plan.md Next #11). Nothing serves MCP yet.', from: 'void.plan.md Next #11' });
  assert.deepEqual(o[1], { title: 'Paid Void', why: 'built on a helper branch.', from: 'void.plan.md Next #12' });
  assert.deepEqual(openItems('# nothing here'), []);
});

test('steps left: a cleanup step counts as done only with a **done** line under it', () => {
  assert.deepEqual(stepsLeft(sample), [{ n: 2, title: 'One "next" list' }, { n: 3, title: 'The salvage shelf' }]);
  assert.deepEqual(stepsLeft('no priority block'), []);
});

test('adding an item puts it at the end of the open list, read back the same way; markdown in it cannot break the line', () => {
  const t = addOpen(sample, { title: 'a tide chart **for** any harbour', why: 'from the idea bank', from: 'grow-ideas' });
  const o = openItems(t);
  assert.equal(o.length, 3);
  assert.deepEqual(o[2], { title: 'a tide chart for any harbour', why: 'from the idea bank', from: 'grow-ideas' });
  assert.match(t, /idea bank\n\n\*\*Checked and already live/);
  assert.equal(addOpen('# no list', { title: 'x' }), '# no list');
});

test('the real frontier parses: open items each with a source, and the cleanup steps left are numbered', () => {
  const t = readFrontier();
  const o = openItems(t);
  assert.ok(o.length >= 1, 'the frontier has an open list');
  assert.ok(o.every((x) => x.title && x.from), JSON.stringify(o.filter((x) => !x.title || !x.from)));
  assert.ok(stepsLeft(t).every((s) => s.n >= 1 && s.title));
});
