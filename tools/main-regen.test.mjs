// tools/main-regen.mjs: a skill with no family is filed by its name words; the families line gains it once. node --test tools/main-regen.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familyFor, fileInto, unfiled } from './main-regen.mjs';

const FAM = [{ id: 'games', skills: ['chess', 'go'] }, { id: 'self', skills: ['client-status-pack', 'delivery-board', 'automation-status'] }];

test('familyFor: the family whose skills share the most name words, else self', () => {
  assert.equal(familyFor('automation-status-pack', FAM), 'self');
  assert.equal(familyFor('chess-clock', FAM), 'games');
  assert.equal(familyFor('zzz', FAM), 'self');
});

test('fileInto: appends once to the right family line, leaves others alone', () => {
  const src = "x\n  { id: 'games', name: 'Games', skills: ['chess', 'go'] },\n  { id: 'self', name: 'S', skills: ['a'] },\n];";
  const out = fileInto(src, 'self', 'b');
  assert.ok(out.includes("{ id: 'self', name: 'S', skills: ['a', 'b'] },"));
  assert.ok(out.includes("skills: ['chess', 'go'] },"));
  assert.equal(fileInto(out, 'self', 'b'), out, 'never twice');
  assert.equal(fileInto(src, 'nope', 'b'), src);
});

test('unfiled: reads the names families.mjs prints', () => {
  assert.deepEqual(unfiled('all ...\nskills with no family (add them to FAMILIES in tools/families.mjs): a-b, c\n'), ['a-b', 'c']);
  assert.deepEqual(unfiled('all fine'), []);
});
