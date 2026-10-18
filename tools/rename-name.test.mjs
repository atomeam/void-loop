// node --test tools/rename-name.test.mjs: the rename tool's one line (tools/rename-name.mjs renameLine): the visible name changes, the
// owner's quoted words, the card mark, the revert trailer and camel-case joins stay, and a matcher learns the new lower-case name.
// The inputs below spell the old names from pieces so the tool, run again, does not rewrite its own test (rename-name.test.mjs is in SKIP too).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renameLine, SKIP, KEEP } from './rename-name.mjs';

const OLD = 'V01' + 'D', OLDER = 'Vo' + 'id', NEW = 'Verse', ALT = [OLD.toLowerCase(), NEW.toLowerCase()];
const rn = (line) => renameLine(line, OLD, NEW, OLDER, ALT);

test('the visible name changes everywhere a person reads it; what tools parse or the owner said stays', () => {
  assert.deepEqual(rn(`<title>${OLD} · A-to-Mind</title> ${OLDER}'s review of it`), { line: "<title>Verse · A-to-Mind</title> Verse's review of it", n: 2, kept: [] });
  assert.equal(rn('the void is the empty stage; a2m.void.state.v1; VOID_OWNER_TOKEN; void_art').n, 0, 'lower-case void, keys, tables and secret names are not the name');
  const q = rn(`${OLD} card (owner, 2026-10-14: "make voids personality a void, that ${OLD} would care about names")`);
  assert.equal(q.line, `Verse card (owner, 2026-10-14: "make voids personality a void, that ${OLD} would care about names")`); assert.deepEqual(q.kept, ['owner quote']);
  const c = rn(`export const MARK = '${OLD}-CARD:'; // ${OLD}'s card`);
  assert.equal(c.line, `export const MARK = '${OLD}-CARD:'; // Verse's card`); assert.ok(c.kept.includes('card mark'));
  const r = rn(`git log --grep="^${OLDER}-auto-revert: $sha" (${OLDER} verify)`);
  assert.equal(r.line, `git log --grep="^${OLDER}-auto-revert: $sha" (Verse verify)`); assert.ok(r.kept.includes('revert trailer'));
  const j = rn(`title: '${OLDER}Quest', ask${OLDER}(x), ${OLDER} asked`);
  assert.equal(j.line, `title: '${OLDER}Quest', ask${OLDER}(x), Verse asked`); assert.ok(j.kept.some((k) => k.startsWith('join: ') && k.includes(OLDER + 'Quest')));
});

test('a matcher learns the new lower-case name beside the old one; paths, ids and prose do not', () => {
  const alt = ALT[0];
  assert.equal(rn(`const WHO = /\\b(?:void|${alt}|you)\\b/i;`).line, `const WHO = /\\b(?:void|${alt}|verse|you)\\b/i;`, 'inside an alternation');
  assert.equal(rn(`const ME = /\\b${alt}\\b/i; const OWN = /^${alt}'s\\s+/;`).line, `const ME = /\\b(?:${alt}|verse)\\b/i; const OWN = /^(?:${alt}|verse)'s\\s+/;`, 'standing alone in a matcher');
  assert.equal(rn(`import { fixes } from '../lib/${alt}-fixes.js'; // #${alt} is the id`).line, `import { fixes } from '../lib/${alt}-fixes.js'; // #${alt} is the id`, 'a path and an id stay');
  assert.equal(rn(`people typed ${alt} and meant the stage`).n, 0, 'prose with no matcher on the line is not touched');
  assert.equal(rn(`const WHO = /\\b(?:void|${alt}|verse)\\b/i;`).line, `const WHO = /\\b(?:void|${alt}|verse)\\b/i;`, 'run twice, same result');
});

test('a line marked rename-name: keep is left as written, old names and all', () => {
  const mark = 'rename-' + 'name: keep';
  const l = `const NAMES = ['${OLD}', '${OLDER}']; // ${mark} (both-name matcher)`;
  assert.deepEqual(rn(l), { line: l, n: 0, kept: ['keep mark'] });
  assert.ok(KEEP.test(l) && !KEEP.test('a plain line about ' + OLDER));
});

test('the skip list keeps the records and the generated files out', () => {
  for (const f of ['domains/void.agents.log.md', 'domains/void.voice.md', 'void-live-deploy/void.growth.json', 'GROWTH.md', 'tools/grown.json', 'void-live-deploy/incidents.json', 'void-live-deploy/skills/index.json', 'domains/inputs/x/batch.json', 'domains/void.decisions.json', 'void-live-deploy/self.json', 'tools/rename-name.test.mjs'])
    assert.ok(SKIP.some((re) => re.test(f)), f + ' is skipped');
  for (const f of ['void.html', 'void-live-deploy/skills/store.js', 'docs/MAP.md', 'tools/bench.json', '.github/workflows/verify.yml']) assert.ok(!SKIP.some((re) => re.test(f)), f + ' is renamed');
});
