// The builder calls a skill Verse already has when it makes a new one. node --test tools/skill-compose.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as calc from '../void-live-deploy/skills/calc.js';
import { searchSkills, compose, invokeModule, stampBuiltWith, examplesFrom, probeFor, builtWithOf } from '../void-live-deploy/lib/skill-compose.js';
import { render } from './new-skill.mjs';
import { lineageOf } from './skills-index.mjs';

const ASK = 'split a 90 mile drive costing 36 dollars between 3 people';
const catalog = [
  { name: 'calc', about: 'one calculator on the stage. sums and percents', examples: ['open a calculator'], tests: ['36 / 3'], tools: ['sum'] },
  { name: 'convert', about: 'a unit converter. miles and km', examples: ['give me a converter for 5 miles to km'], tests: ['5 miles in km'], tools: ['units'] },
  { name: 'joke', about: 'tells a joke', examples: ['tell me a joke'], tests: [], tools: [] },
];

test('search finds the calculator and the converter, and reuses their tests as examples', () => {
  const found = searchSkills(ASK, catalog);
  assert.deepEqual(found.map((s) => s.name).slice(0, 2).sort(), ['calc', 'convert']);
  assert.ok(examplesFrom(found.find((s) => s.name === 'calc')).includes('36 / 3'));
  assert.equal(probeFor(found.find((s) => s.name === 'calc'), ASK), '36 / 3');
  assert.equal(probeFor(found.find((s) => s.name === 'convert'), ASK), '90 miles in km');
});

test('building a skill invokes at least one existing skill', async () => {
  const calls = [];
  const made = await compose(ASK, {
    catalog,
    invoke: async (skill) => {
      calls.push(skill.name);
      if (skill.name === 'calc') return invokeModule(calc, probeFor(skill, ASK), { run: async () => { calls.push('runSkill'); return { ok: false, why: 'not-this-skill', text: '' }; } });
      return { ok: true, name: skill.name, via: 'skill', text: '144.841' };
    },
  });
  assert.ok(calls.includes('runSkill'), 'the builder goes through the skill, the same path MCP uses');
  assert.ok(calls.filter((c) => c !== 'runSkill').length >= 1);
  assert.ok(made.parts.includes('calc'));
  assert.equal(made.calls.find((c) => c.name === 'calc').text, '12');
});

test('invokeModule calls runSkill once, then the calculator when the card does not take the sum', async () => {
  let calls = 0;
  const r = await invokeModule(calc, '36 / 3', { run: async () => { calls += 1; return { ok: false, why: 'not-this-skill', text: '' }; } });
  assert.equal(calls, 1);
  assert.equal(r.ok, true);
  assert.equal(r.text, '12');
  assert.equal(r.via, 'evaluate');
});

test('the lineage is stamped into the scaffold without moving the lines the fill replaces, and the index records the count', () => {
  const src = render({ name: 'tide-tables', examples: ['when is high tide in lisbon'], near: [] });
  const stamped = stampBuiltWith(src, ['calc', 'convert']);
  assert.deepEqual(builtWithOf(stamped), ['calc', 'convert']);
  assert.ok(stamped.includes("const WHEN = "));
  assert.ok(stamped.includes("const ANSWER = "));
  assert.ok(stamped.includes('Source: say where the answer comes from'));
  assert.ok(stamped.indexOf('export const builtWith') < stamped.indexOf('export default {'));
  const d = mkdtempSync(join(tmpdir(), 'lineage-'));
  writeFileSync(join(d, 'drive-share.js'), stamped);
  writeFileSync(join(d, 'joke.js'), 'export default { name: "joke" }\n');
  const o = lineageOf(['joke', 'drive-share'], (n) => readFileSync(join(d, n + '.js'), 'utf8'));
  assert.equal(o.count, 1);
  assert.deepEqual(o.skills['drive-share'], ['calc', 'convert']);
});

test('composing the drive ask against the real catalog calls the calculator or the converter', async () => {
  const { composeAsk } = await import('./skill-compose.mjs');
  const calls = [];
  const made = await composeAsk(ASK, {
    invoke: async (skill, ask) => {
      calls.push(skill.name);
      if (skill.name !== 'calc' && skill.name !== 'convert') return { ok: false, name: skill.name, via: 'skip' };
      const mod = skill.name === 'calc' ? calc : await import('../void-live-deploy/skills/convert.js');
      return invokeModule(mod, probeFor(skill, ask), { run: async () => ({ ok: false, why: 'not-this-skill', text: '' }) });
    },
  });
  assert.ok(calls.length >= 1, 'the builder invoked nobody');
  assert.ok(made.parts.includes('calc') || made.parts.includes('convert'), calls.join(','));
});
