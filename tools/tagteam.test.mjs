import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTagteam, buildSelf } from './self-context.mjs';
import { isSelfAsk, selfFacts, builderFacts } from '../void-live-deploy/lib/self-context.js';
import { entry, append, checkCites } from './ask-void.mjs';

const BOARD = '# x\n\n## Now\n\n- **Grok**: on it\n\n## Just finished\n\n- **Fix A**: solved by `measuring` first\n\n## Up for grabs\n\n- **Thing**: take it\n\n## Ladders\n\n- **Deploy**: run it from inside the folder\n\n## Lessons\n\n- **Wrangler**: copied folder dropped Functions\n';

test('the builders\' board: Just finished, Ladders and Lessons go into self.json; Now and Up for grabs stay out', () => {
  const b = readTagteam(BOARD);
  assert.deepEqual(b.finished, [{ name: 'Fix A', line: 'solved by measuring first' }]);
  assert.equal(b.ladders[0].name, 'Deploy');
  assert.equal(b.lessons[0].line, 'copied folder dropped Functions');
  assert.ok(!JSON.stringify(b).includes('take it') && !JSON.stringify(b).includes('on it'));
  assert.equal(readTagteam('# nothing'), null);
  const self = buildSelf('> A blank stage.', '', { builders: b });
  assert.equal(self.builders, b);
  assert.equal(buildSelf('> A blank stage.', '').builders, undefined);
});

test('the real board parses and stays trimmed', () => {
  const b = readTagteam(readFileSync(new URL('../domains/handoff.md', import.meta.url), 'utf8'));
  assert.ok(b.finished.length && b.ladders.length && b.lessons.length);
  assert.ok(b.lessons.length <= 6 && b.lessons.every((x) => x.line.length <= 240));
});

test('"what did your builders learn?" is a self ask, answered from the board', () => {
  for (const a of ['what did your builders learn?', 'How were you built lately?', 'who builds you?', 'what have Verse\'s builders been doing']) assert.ok(isSelfAsk(a), a);
  for (const a of ['who built the pyramids?', 'builders near me', 'who were the builders of Stonehenge?']) assert.ok(!isSelfAsk(a), a);
  const self = { about: 'A blank stage.', builders: readTagteam(BOARD) };
  assert.match(builderFacts(self), /What my builders learned.*Wrangler: copied folder dropped Functions/);
  assert.match(selfFacts({ self }), /What my builders just finished: Fix A/);
  assert.equal(builderFacts({}), '');
});

test('ask-void keeps Verse\'s answer word for word', () => {
  const b = entry('2026-10-15T05:00:00.000Z', 'Q?', 'line one\nline two');
  assert.match(b, /> line one\n> line two/);
  const t = append('', b);
  assert.ok(t.startsWith('# Verse on its builders') && t.endsWith(b));
  assert.equal(append(t, b), t + b);
});

test('Verse may only cite the board for its builders\' lessons', () => {
  const ex = (f) => f === 'void.assimilate.md';
  assert.deepEqual(checkCites('Codified in void.assimilate.md / void.plan2.md', ex), ['void.assimilate.md exists, but the builders\' lessons are kept only in domains/handoff.md', 'void.plan2.md does not exist']);
  assert.deepEqual(checkCites('They live in domains/handoff.md.', ex), []);
  assert.match(builderFacts({ builders: readTagteam(BOARD) }), /only in domains\/handoff\.md/);
});
