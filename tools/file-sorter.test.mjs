// file sorter (skills/file-sorter.js, 2026-10-22, from the archived autosalvage classifier): file names to kinds, by name only
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { sortFile, filesOf, groupFiles } from '../void-live-deploy/skills/file-sorter.js';

test('each example is taken and each near miss is left alone', () => {
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
});
test('the autosalvage rules: licence first, then code, settings, documents, data, binaries, unknown', () => {
  assert.equal(sortFile('LICENSE').kind, 'Licence');
  assert.equal(sortFile('src/app.py').kind, 'Source code');
  assert.equal(sortFile('config.yaml').kind, 'Settings');
  assert.equal(sortFile('Dockerfile').kind, 'Settings');
  assert.equal(sortFile('README.md').kind, 'Documents');
  assert.equal(sortFile('data.csv').kind, 'Data');
  assert.equal(sortFile('logo.png').kind, 'Images and binaries');
  assert.equal(sortFile('mystery').kind, 'Unknown');
  assert.deepEqual(groupFiles(['a.js', 'b.js', 'c.png']).map((g) => g.files.length), [2, 1]);
  assert.equal(filesOf('sort these files: plain words here'), null, 'no file names, no card');
  assert.ok(skill.suite().ok);
});
