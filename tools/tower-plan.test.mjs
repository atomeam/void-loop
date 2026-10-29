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
test('the card names the easiest site left as its target, says why, and lists the next easiest, from the gate ; the hand plan no longer picks the target', () => {
  const plan = parsePlan(md), t = tower(); t.plan = plan;
  const cur = t.floors.find((f) => f.state === 'current'), html = towerHtml(t, esc, { now: 0 });
  assert.ok(html.includes('>' + t.beaten + ' surpassed · easiest site left: ' + esc(cur.site)));
  assert.match(html, /Why this one: /); assert.match(html, /class="tw-next"[^>]*><b[^>]*>Up next<\/b>/); assert.doesNotMatch(html, /tw-plan/);
  const f = FLOORS.find((x) => x.id === plan.next[0].id), t2 = tower([], { [f.id]: passingRows(f) });
  assert.equal(t2.floors.find((x) => x.id === f.id).state, 'beaten');
});
test('no plan file: the card still names the gate\'s current site in the score line', () => {
  const t = tower(), cur = t.floors.find((f) => f.state === 'current');
  assert.doesNotMatch(towerHtml(t, esc, { now: 0 }), /tw-plan/);
  assert.ok(towerHtml(t, esc, { now: 0 }).includes(t.beaten + ' surpassed · easiest site left: ' + cur.site));
});
