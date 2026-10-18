// technical-context (lib/technical-context.js, skills/technical-context.js; asked by Verse). Run: node --test tools/technical-context.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMS, termOf } from '../void-live-deploy/lib/technical-context.js';
import { ruleReview } from '../void-live-deploy/lib/code-review.js';
import skill from '../void-live-deploy/skills/technical-context.js';

test('every term\'s risky line is flagged a risk by the code review under the rule it names, and its safer line is not', () => {
  for (const t of TERMS) {
    const bad = ruleReview(t.risky, { lang: t.lang }).findings, good = ruleReview(t.safer, { lang: t.lang }).findings;
    assert.ok(bad.some((f) => f.rule === t.rule && f.kind === 'risk'), t.id + ' risky line flagged: ' + JSON.stringify(bad.map((f) => f.rule)));
    assert.ok(!good.some((f) => f.rule === t.rule), t.id + ' safer line passes');
  }
});
test('the asks route, and look-alikes do not', () => {
  for (const [a, id] of [['why is rust unwrap a risk', 'unwrap'], ['Is unwrap() risky in Rust?', 'unwrap'], ['technical context for unwrap', 'unwrap'], ['is shell=True dangerous', 'shell-true'], ['why is strcpy unsafe', 'strcpy'], ['is a force unwrap safe', 'force-unwrap']]) assert.equal(termOf(a).id, id, a);
  for (const a of ['unwrap a present', 'is it risky to invest', 'what does context mean', 'is unwrap_or safe', 'is rust faster than go', 'why is the sky blue', '']) assert.equal(termOf(a), null, a);
  assert.ok(skill.match('why is rust unwrap a risk', 'why is rust unwrap a risk'));
});
test('the card draws the caution shape on the stage and names the safer line', () => {
  const things = {}, stage = { clientWidth: 800, clientHeight: 600 };
  let page = '', saved = 0;
  const api = { esc: (s) => String(s).replace(/</g, '&lt;'), showPage: (b) => { const el = { set innerHTML(v) { page = v; } }; b(el); }, stage: { stage, things: () => things, select() {}, save() { saved++; }, render() {} } };
  assert.equal(skill.run('why is rust unwrap a risk', api), 'technical-context');
  const shape = Object.values(things)[0];
  assert.equal(shape.kind, 'shape'); assert.equal(shape.shapeType, 'triangle'); assert.ok(saved);
  assert.match(page, /panics/); assert.match(page, /unwrap_or\(8080\)/);
});
