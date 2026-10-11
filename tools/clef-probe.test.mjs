// tools/clef-probe.mjs: the Clef metadata the site reports, printed for the job summary (frontier #9).
// Run: node --test tools/clef-probe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clefReport, probe } from './clef-probe.mjs';

test('clef-probe: prints each Clef model with its task, description and properties; says plainly when there is none', () => {
  const out = clefReport([{ id: '@cf/cloudflare/clef-flash', task: 'Text Classification', description: 'typed questions', properties: [{ property_id: 'schema', value: { input: 'x' } }] }]);
  assert.match(out, /\*\*@cf\/cloudflare\/clef-flash\*\* · Text Classification/); assert.match(out, /`schema`: \{"input":"x"\}/);
  assert.match(clefReport([]), /lists no Clef model/);
});

test('clef-probe: no key, a rejected key and an older deployment each say why; a good answer passes the list through', async () => {
  assert.match((await probe('https://x', '')).why, /READ_TOKEN is empty/);
  const res = (status, body) => async () => new Response(JSON.stringify(body), { status });
  assert.match((await probe('https://x', 'k', res(401, {}))).why, /rejected/);
  assert.match((await probe('https://x', 'k', res(200, { ok: true, asks: 3 }))).why, /does not report Clef yet/);
  assert.deepEqual((await probe('https://x', 'k', res(200, { ok: true, clef: [{ id: 'a' }] }))).clef, [{ id: 'a' }]);
});
