import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlistedSkills } from './skills-unlisted.mjs';

const skill = (name) => `export default { name: '${name}', match() { return false; }, run() {} };\n`;
function fixture(index, files) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-'));
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  return dir;
}

test('a skill file the index does not list is found', async () => {
  const dir = fixture(['clock'], { 'clock.js': skill('clock'), 'services.js': skill('services') });
  assert.deepEqual(await unlistedSkills(dir, []), ['services']);
});
test('listed skills and helper modules are not reported', async () => {
  const dir = fixture(['clock'], { 'clock.js': skill('clock'), 'rules.js': 'export const RULES = [1, 2];\n', 'lib3d.js': 'export default { scene: 1 };\n' });
  assert.deepEqual(await unlistedSkills(dir, []), []);
});
test('a file that cannot load here is skipped, and a retired skill is not reported', async () => {
  const dir = fixture([], { 'browser.js': "import 'https://cdn.example/three.js';\nexport default {};\n", 'map.js': skill('map') });
  assert.deepEqual(await unlistedSkills(dir, ['map']), []);
});
test('the real index lists every real skill', async () => {
  const dir = new URL('../void-live-deploy/skills/', import.meta.url).pathname;
  assert.deepEqual(await unlistedSkills(dir), []);
});
