// Frontier #8, the first piece: the trial watch notices what changed in the registry since its last check and says so in the
// ledger as a `finding` (tools/trial-changes.mjs, run daily by .github/workflows/trialwatch.yml). Run: node --test tools/trial-changes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { changes, newerSnap } from '../void-live-deploy/skills/trialwatch.js';
import { runOnce } from './trial-changes.mjs';

const row = (o) => ({ id: 'NCT1', title: 'Senolytics in MASH', status: 'recruiting', enrollment: 40, primaryCompletion: '2027-06', results: false, href: 'https://clinicaltrials.gov/study/NCT1', ...o });

test('trial changes: status, posted results, enrollment and the completion date are each a change, said in words', () => {
  const prev = { NCT1: row() };
  assert.deepEqual(changes(prev, { NCT1: row() }), [], 'nothing changed, nothing said');
  const c = changes(prev, { NCT1: row({ status: 'active not recruiting', results: true, enrollment: 52, primaryCompletion: '2027-09' }) });
  assert.deepEqual(c.map((x) => x.kind), ['status', 'results', 'enrollment', 'completion']);
  assert.match(c[0].text, /recruiting → active not recruiting/); assert.match(c[1].text, /results posted/);
  assert.match(c[2].text, /40 → 52/); assert.match(c[3].text, /2027-06 → 2027-09/);
  for (const x of c) { assert.equal(x.id, 'NCT1'); assert.equal(x.href, 'https://clinicaltrials.gov/study/NCT1'); }
});

test('trial changes: a first sighting is the baseline, not news; a trial the registry did not answer is not a change; a field it stopped giving is not a change', () => {
  assert.deepEqual(changes({}, { NCT1: row() }), []);
  assert.deepEqual(changes({ NCT1: row() }, {}), []);
  assert.deepEqual(changes({ NCT1: row() }, { NCT1: row({ enrollment: null, status: null }) }), []);
});

test('trial changes: one run reads the registry, writes a finding per change to the ledger and keeps the new snapshot; no answer leaves both alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-')), snap = join(dir, 'snap.json'), ledger = join(dir, 'ledger.json');
  writeFileSync(ledger, '[\n  {"at": "2026-10-01T00:00:00Z", "by": "x", "kind": "grow", "what": "start"}\n]\n');
  const reg = (status) => async (url) => ({ ok: true, status: 200, json: async () => ({ hasResults: false, protocolSection: { identificationModule: { briefTitle: 'Trial ' + url.slice(-11) }, statusModule: { overallStatus: status } } }) });
  const first = await runOnce({ fetchFn: reg('RECRUITING'), snapPath: snap, ledgerPath: ledger, now: () => new Date('2026-10-11T06:00:00Z') });
  assert.equal(first.findings.length, 0, 'the first run is the baseline'); assert.ok(existsSync(snap));
  const second = await runOnce({ fetchFn: reg('COMPLETED'), snapPath: snap, ledgerPath: ledger, now: () => new Date('2026-10-12T06:00:00Z') });
  assert.ok(second.findings.length >= 1);
  const list = JSON.parse(readFileSync(ledger, 'utf8')), added = list.slice(1);
  assert.equal(added.length, second.findings.length);
  for (const e of added) { assert.equal(e.kind, 'finding'); assert.equal(e.by, 'trialwatch'); assert.match(e.what, /^Trial watch: .*recruiting → completed/); assert.match(e.ref, /^https:\/\/clinicaltrials\.gov\/study\/NCT/); }
  const down = await runOnce({ fetchFn: async () => { throw new Error('offline'); }, snapPath: snap, ledgerPath: ledger });
  assert.equal(down.findings.length, 0); assert.match(down.note, /no answer/);
  assert.equal(JSON.parse(readFileSync(ledger, 'utf8')).length, list.length, 'nothing written when the registry is down');
});

test('trial watch card: with the registry out of reach it shows the newer of this browser\'s last check and Verse\'s own daily one (served at /trialwatch.json)', () => {
  const a = { at: '2026-10-10T06:41:00Z', rows: { NCT1: row() } }, b = { at: '2026-10-12T06:41:00Z', rows: { NCT1: row() } };
  assert.equal(newerSnap(a, b), b); assert.equal(newerSnap(b, a), b);
  assert.equal(newerSnap(null, b), b); assert.equal(newerSnap(a, null), a); assert.equal(newerSnap(null, null), null);
  assert.equal(newerSnap(a, { at: 'x', rows: {} }), a, 'a served file with no rows or a bad date is not a check');
  const served = JSON.parse(readFileSync(new URL('../void-live-deploy/trialwatch.json', import.meta.url), 'utf8'));
  assert.ok(served.at && Object.keys(served.rows).length >= 1, 'the daily check is kept where the site serves it');
});
