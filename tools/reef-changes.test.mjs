// Frontier #8, the second card: the coral heat card notices when a reef's heat-stress alert changes (NOAA Coral Reef Watch,
// the 5 km regional virtual stations) and says so in the ledger as a `finding` (tools/reef-changes.mjs, daily by
// .github/workflows/reefwatch.yml). Run: node --test tools/reef-changes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseStation, alertName, reefChanges } from '../void-live-deploy/lib/reefwatch.js';
import { runOnce } from './reef-changes.mjs';

const file = (rows) => 'Name:\nFlorida Keys\nPolygon Middle Longitude:\n-81.0\n\nYYYY MM DD SST_MIN SST_MAX SST@90th_HS SSTA@90th_HS 90th_HS>0 DHW_from_90th_HS>1 BAA_7day_max\n'
  + rows.map((r) => ' ' + r.join(' ')).join('\n') + '\n';

test('reef watch: the station file is read by its header names, and the newest row is the reading', () => {
  const r = parseStation(file([[2026, 10, 9, 28.1, 29.4, 29.0, 0.8, 0.3, 2.1, 1], [2026, 10, 10, 28.3, 29.9, 29.5, 1.1, 0.6, 3.4, 2]]));
  assert.deepEqual(r, { date: '2026-10-10', sstMax: 29.9, dhw: 3.4, baa: 2 });
  assert.equal(parseStation('not a station file'), null);
  assert.equal(alertName(0), 'no stress'); assert.equal(alertName(1), 'Watch'); assert.equal(alertName(2), 'Warning'); assert.equal(alertName(4), 'Alert Level 2'); assert.equal(alertName(7), 'Alert Level 5');
});

test('reef watch: a change of alert level is news, said in words; the same level is not; a first reading is the baseline', () => {
  const prev = { florida_keys: { name: 'Florida Keys', date: '2026-10-09', baa: 1, dhw: 2.1 } };
  assert.deepEqual(reefChanges(prev, { florida_keys: { name: 'Florida Keys', date: '2026-10-10', baa: 1, dhw: 2.4 } }), []);
  const up = reefChanges(prev, { florida_keys: { name: 'Florida Keys', date: '2026-10-10', baa: 4, dhw: 8.2 } });
  assert.equal(up.length, 1); assert.match(up[0].text, /Watch → Alert Level 2/); assert.match(up[0].text, /8\.2 degree heating weeks/); assert.match(up[0].text, /2026-10-10/);
  assert.match(reefChanges({ florida_keys: { name: 'Florida Keys', baa: 4, dhw: 8 } }, { florida_keys: { name: 'Florida Keys', date: '2026-11-02', baa: 0, dhw: 0 } })[0].text, /Alert Level 2 → no stress/);
  assert.deepEqual(reefChanges({}, { florida_keys: { name: 'Florida Keys', baa: 3, dhw: 5 } }), []);
});

test('reef watch: one run reads the stations, writes a finding per change and keeps the snapshot; a station that does not answer writes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rw-')), snap = join(dir, 'snap.json'), ledger = join(dir, 'ledger.json');
  writeFileSync(ledger, '[\n  {"at": "2026-10-01T00:00:00Z", "by": "x", "kind": "grow", "what": "start"}\n]\n');
  const station = (baa) => async () => ({ ok: true, status: 200, text: async () => file([[2026, 10, 10, 28, 30, 29.5, 1, 1, baa * 2, baa]]) });
  const stations = [{ id: 'florida_keys', name: 'Florida Keys' }];
  assert.equal((await runOnce({ fetchFn: station(1), stations, snapPath: snap, ledgerPath: ledger, now: () => new Date('2026-10-10T07:00:00Z') })).findings.length, 0);
  const second = await runOnce({ fetchFn: station(4), stations, snapPath: snap, ledgerPath: ledger, now: () => new Date('2026-10-11T07:00:00Z') });
  assert.equal(second.findings.length, 1);
  const added = JSON.parse(readFileSync(ledger, 'utf8')).slice(1);
  assert.equal(added.length, 1); assert.equal(added[0].kind, 'finding'); assert.equal(added[0].by, 'reefwatch');
  assert.match(added[0].what, /^Coral heat: Florida Keys went from Watch to Alert Level 2/); assert.match(added[0].ref, /^https:\/\/coralreefwatch\.noaa\.gov\//);
  const down = await runOnce({ fetchFn: async () => ({ ok: false, status: 404, text: async () => '' }), stations, snapPath: snap, ledgerPath: ledger });
  assert.equal(down.findings.length, 0); assert.match(down.note, /no answer/);
});

// run 70: the heat card shows the live alert from the served reading (void-live-deploy/reefwatch.json)
import { liveLine } from '../void-live-deploy/lib/reefwatch.js';
import { heatHtml } from '../void-live-deploy/skills/coral.js';
test('reef watch: the heat card says the live level, the heat stress and the reading date, with what the numbers mean, from the served file', () => {
  const live = liveLine({ rows: { florida_keys: { name: 'Florida Keys', date: '2026-10-09', sstMax: 30.39, dhw: 17.4086, baa: 1 } } });
  assert.match(live.text, /^Florida Keys: Watch · 17\.4 degree heating weeks · water up to 30\.4 °C \(NOAA Coral Reef Watch, 2026-10-09\)/);
  assert.match(live.note, /4 or more.*8 or more/); assert.match(live.href, /^https:\/\/coralreefwatch\.noaa\.gov\//);
  assert.equal(liveLine(null), null); assert.equal(liveLine({ rows: {} }), null);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  assert.match(heatHtml(esc, live), /data-coral-live/); assert.match(heatHtml(esc, live), /Right now/);
  assert.doesNotMatch(heatHtml(esc, null), /data-coral-live/);
  const evil = liveLine({ rows: { florida_keys: { name: '<img src=x onerror=alert(1)>', date: '2026-10-09', dhw: 1, baa: 0 } } });
  assert.doesNotMatch(heatHtml(esc, evil), /<img/);
});
