// The bot factory's gate (tools/bot-factory.mjs): only a bot whose probe passes on its real task and whose lineage is real is live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOTS, probe } from '../void-live-deploy/bots/kit.js';
import { gate, parseProposal, pin } from './bot-factory.mjs';

test('every kit bot passes its probe and is live, and the registry on disk matches the gate', () => {
  const rows = gate();
  assert.ok(rows.filter((r) => r.status === 'live').length >= 50);
  assert.deepEqual(rows.filter((r) => r.status !== 'live').map((r) => r.id), []);
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
