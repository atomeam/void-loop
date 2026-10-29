// The Versus card's plan comes from the tower-plan block in docs/NEXT.md (tools/tower-plan.mjs) and its numbers from the gate (lib/tower.js),
// never from the plan file: a plan can order floors, it cannot call one beaten.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePlan, problems, render, OUT } from './tower-plan.mjs';
import { tower, FLOORS, passingRows } from '../void-live-deploy/lib/tower.js';
import { towerHtml, planOf } from '../void-live-deploy/skills/tower.js';

const md = fs.readFileSync(new URL('../docs/NEXT.md', import.meta.url), 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('the block at the head of docs/NEXT.md parses, every id is a floor, and the committed JSON is what the block says', () => {
  const plan = parsePlan(md), ids = tower().floors.map((f) => f.id);
  assert.ok(plan.now.length >= 1 && plan.next.length >= 5 && plan.far.length >= 2);
  assert.deepEqual(problems(plan, ids), []);
  assert.equal(fs.readFileSync(OUT, 'utf8'), render(plan), 'run node tools/tower-plan.mjs');
  assert.ok(md.indexOf('<!-- tower-plan') < md.indexOf('0. **TOP'), 'the easiest-first queue is at the head of NEXT.md');
});
test('negative controls: no block, a line without an id, an unknown id and a repeated id all fail', () => {
  assert.throws(() => parsePlan('# nothing here'), /no <!-- tower-plan -->/);
  assert.throws(() => parsePlan('<!-- tower-plan -->\n- next: is it\n<!-- /tower-plan -->'), /without a `floor id`/);
  const p = parsePlan('<!-- tower-plan -->\n- now: `paint` — x\n- next: `no such floor` — y\n- next: `paint`\n<!-- /tower-plan -->');
  const bad = problems(p, ['paint']);
  assert.ok(bad.some((b) => /not a tower floor: no such floor/.test(b)) && bad.some((b) => /named twice: paint/.test(b)), bad.join('; '));
});
test('the card shows the honest count, the floor worked on now, the next easiest and the far-future floors as not beaten, from the gate', () => {
  const plan = parsePlan(md), t = tower(); t.plan = plan;
  const html = towerHtml(t, esc, { now: 0 });
  assert.match(html, new RegExp('>' + t.beaten + ' surpassed · working on: ' + t.floors.find((f) => f.id === plan.now[0].id).site.replace(/\./g, '\\.')));
  assert.match(html, /Working on now/); assert.match(html, /Next easiest \(\d+\)/); assert.match(html, /Far future, not beaten/);
  for (const { id } of [...plan.next.slice(0, 3), ...plan.far]) assert.ok(html.includes('data-id="' + esc(id) + '"'), id);
  const far = html.slice(html.indexOf('tw-plan-far'));
  assert.match(far, /Amazon/); assert.match(far, /YouTube/); assert.doesNotMatch(far.slice(0, far.indexOf('</ul>')), /surpassed/);
  // the plan cannot promote a floor: with no evidence nothing on it says surpassed; with every aspect passing, the gate's word appears
  assert.doesNotMatch(html.slice(html.indexOf('tw-plan'), html.indexOf('tw-plan-far')), />surpassed</);
  const f = FLOORS.find((x) => x.id === plan.next[0].id), t2 = tower([], { [f.id]: passingRows(f) }); t2.plan = plan;
  assert.equal(planOf(t2, plan).next[0].f.state, 'beaten');
  assert.match(towerHtml(t2, esc, { now: 0 }), /^[\s\S]*tw-plan-next[\s\S]*>surpassed</);
});
test('no plan file: the card is what it was (the gate\'s current site in the score line)', () => {
  const t = tower(), cur = t.floors.find((f) => f.state === 'current');
  assert.doesNotMatch(towerHtml(t, esc, { now: 0 }), /tw-plan/);
  assert.ok(towerHtml(t, esc, { now: 0 }).includes(t.beaten + ' surpassed · working on: ' + cur.site));
});
