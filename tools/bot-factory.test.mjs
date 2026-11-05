// The bot factory's gate (tools/bot-factory.mjs): only a bot whose probe passes on its real task and whose lineage is real is live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOTS, probe } from '../void-live-deploy/bots/kit.js';
import { gate, parseProposal, pin, vet, familyRows } from './bot-factory.mjs';
import { families, check } from '../void-live-deploy/bots/families.js';

test('every kit bot passes its probe and is live, and the registry on disk matches the gate', () => {
  const rows = gate();
  assert.ok(rows.filter((r) => r.status === 'live').length >= 50);
  assert.deepEqual(rows.filter((r) => r.status === 'failed').map((r) => r.id), []);
  const reg = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/registry.json', import.meta.url), 'utf8'));
  assert.deepEqual(reg.bots.map((b) => b.id + ':' + b.status), rows.map((b) => b.id + ':' + b.status), 'run node tools/bot-factory.mjs');
});

test('a bot with a wrong answer or a made-up lineage fails the gate', () => {
  assert.equal(probe({ run: () => 'nope', probe: ['x', 'yes'] }).ok, false);
  assert.equal(probe({ run: () => { throw new Error('x'); }, probe: ['x', 'yes'] }).ok, false);
  const ids = new Set(BOTS.map((b) => b.id)), fake = gate([{ id: 'ghost', cat: 'fun', job: 'x', from: ['bots/not-a-bot'], pipe: ['reverse-bot', 'morse-bot'], probe: { in: 'sos', want: '... --- ...' } }]);
  assert.equal(fake.find((r) => r.id === 'ghost').status, 'failed');
  assert.ok(ids.size === BOTS.length, 'bot ids are unique');
});

test('an AI proposal is kept only when its pipe is made of live bots, and its probe is pinned to what it really answers', () => {
  const live = new Set(['reverse-bot', 'morse-bot']);
  const specs = parseProposal('sure: [{"id":"secret","job":"x","pipe":["reverse-bot","morse-bot"],"probe":{"in":"so"}},{"id":"bad","job":"x","pipe":["nope","morse-bot"],"probe":{"in":"a"}}]', live);
  assert.deepEqual(specs.map((s) => s.id), ['secret']);
  assert.equal(pin(specs[0]).probe.want, '--- ...');
});

test('family variants: thousands, every one passing independent checks, and a wrong factor or a wrong answer fails', () => {
  const F = families();
  assert.ok(F.length >= 2000); assert.equal(new Set(F.map((b) => b.id)).size, F.length, 'ids are unique');
  // the free API bots depend on outside services; tools/api-bots.test.mjs checks that exactly the blocked ones fail and become fix jobs.
  // two country bots stay failed on purpose and are fix jobs, not deletions: Wikidata has no truthy capital for Antigua and Barbuda,
  // and its truthy capital for Equatorial Guinea is Ciudad de la Paz, not Malabo. Any other failure still fails this test.
  const held = ['check-country-ag: agrees with the bot on real inputs', 'check-country-gq: agrees with the bot on real inputs', 'country-ag: has a capital, known capital', 'country-gq: known capital'];
  assert.deepEqual(familyRows().filter((f) => f.family !== 'free APIs').flatMap((f) => f.failed).sort(), held);
  const mi = F.find((b) => b.id === 'mi-to-km');
  assert.equal(mi.run('1'), '1.609344 km');
  const broken = { ...mi, checks: mi.checks.map(([n, fn]) => [n, n === 'known answer' ? () => Math.abs(1.6 - 1.609344) < 1e-9 : fn]) };
  assert.equal(check(broken).ok, false);
  assert.equal(F.find((b) => b.id === 'csv-to-json').run('a,b\n1,2'), '[{"a":"1","b":"2"}]');
  assert.equal(F.find((b) => b.id === 'temp-C-to-F').run('100'), '212 °F');
});

test('a grown bot needs varied answers on three inputs and a judge; a constant bot or no judge is not kept', async () => {
  const spec = { id: 'secret', job: 'reverse then morse', pipe: ['reverse-bot', 'morse-bot'], from: [], probe: { in: 'so' } };
  assert.equal(await vet(spec, ['so', 'sos', 'hi'], null), null, 'no judge: held');
  assert.equal(await vet(spec, ['so', 'sos', 'hi'], async () => false), null, 'judge says no');
  assert.equal((await vet(spec, ['so', 'sos', 'hi'], async () => true)).probe.want, '--- ...');
  assert.equal(await vet({ ...spec, pipe: ['emoji-mood', 'reverse-bot'] }, ['a', 'b', 'c'], async () => true), null, 'same answer for every input');
});
