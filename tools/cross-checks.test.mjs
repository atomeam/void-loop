// Independent-check bots (bots/cross-checks.js): each checks another bot by a road that skips it, agrees with the real bot, and catches
// a planted wrong answer; a broken bot, a missing road or two disagreeing APIs fail. Run: node --test tools/cross-checks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { families, check } from '../void-live-deploy/bots/families.js';
import { crossChecks } from '../void-live-deploy/bots/cross-checks.js';
import KEPT from '../void-live-deploy/bots/api-fixtures.js';
import { familyRows, fixJobs } from './bot-factory.mjs';

const F = families(), C = F.filter((b) => b.cat === 'checks'), get = (id) => F.find((b) => b.id === id);

test('one checker for every unit, base, cipher, format, date and phrasebook bot, plus six two-source API checks, all passing', () => {
  const targets = F.filter((b) => /^(units|number bases|ciphers|data formats|date formats|language pairs)/.test(b.family || ''));
  assert.equal(C.length, targets.length + 6);
  assert.equal(new Set(F.map((b) => b.id)).size, F.length, 'ids are unique across every family');
  for (const t of targets) assert.ok(get('check-' + t.id), t.id);
  assert.deepEqual(C.filter((b) => !check(b).ok).map((b) => b.id), []);
  const rows = familyRows(C);
  assert.deepEqual(rows.flatMap((r) => r.failed), []); assert.deepEqual(fixJobs([], rows), []);
  for (const b of C) assert.ok(!b.path.includes(b.id.slice(6)), b.id + ' must not check itself');
});

test('a checker says agrees or disagrees, with the road it took', () => {
  assert.equal(get('check-mi-to-km').run('1'), 'agrees (via mi-to-m then m-to-km: 1.609344 km)');
  assert.match(get('check-mi-to-km').run('1 => 1.7 km'), /^disagrees: mi-to-km answered 1\.7 km, but via mi-to-m then m-to-km: 1\.609344 km$/);
  assert.match(get('check-base16-to-base2').run('ff => 11111110'), /^disagrees: .* 11111111$/);
  assert.match(get('check-phrase-de-to-ja').run('Montag'), /^agrees \(via phrase-de-to-en then phrase-en-to-ja: 月曜日\)$/);
  assert.match(get('check-phrase-fi-to-de').run('Japani'), /^agrees/, 'a word with two meanings is carried through the pivot');
  assert.match(get('check-caesar-3-encode').run('abc => abd'), /^disagrees/);
});

test('a broken bot or a missing road fails its checker, and the factory lists the fix job', () => {
  const units = F.filter((b) => b.family === 'units/length').map((b) => (b.id === 'mi-to-km' ? { ...b, run: (s) => +(parseFloat(s) * 1.6).toPrecision(10) + ' km' } : b));
  const c = crossChecks(units).find((b) => b.id === 'check-mi-to-km');
  assert.deepEqual(check(c).fails, ['agrees with the bot on real inputs']);
  assert.match(fixJobs([], familyRows([c]))[0].ask, /check-mi-to-km: agrees with the bot/);
  const gap = crossChecks(F.filter((b) => b.family === 'units/length' && b.id !== 'mi-to-m' && b.id !== 'm-to-km'));
  assert.equal(check(gap.find((b) => b.id === 'check-mi-to-km')).ok, false);
});

test('two APIs that disagree fail the two-source check; Run asks both live', async () => {
  const keep = KEPT['ip-country'].body;
  try { KEPT['ip-country'].body = { ...keep, country: 'CA' }; assert.deepEqual(check(crossChecks([]).find((b) => b.id === 'check-ip-two-sources')).fails, ['both kept real calls agree']); } finally { KEPT['ip-country'].body = keep; }
  const fetchWas = globalThis.fetch, seen = [];
  try {
    globalThis.fetch = async (u) => { seen.push(u); const k = Object.values(KEPT).find((x) => x.url === u); return { ok: !!k, status: k ? 200 : 404, json: async () => k.body }; };
    assert.match(await get('check-fx-two-feeds').run('USD EUR'), /^agrees: Frankfurter 0\.\d+, ExchangeRate-API open access 0\.\d+$/);
    assert.equal(seen.length, 2);
    assert.match(await get('check-place-two-maps').run('Lakeland'), /^agrees: /);
  } finally { globalThis.fetch = fetchWas; }
});
