import test from 'node:test';
import vatSkill from '../void-live-deploy/skills/vat.js';
import assert from 'node:assert/strict';
import { compute, parseAmount, parseRate, round2, stateFromQuery, queryFromState, workingOf } from '../void-live-deploy/lib/vat.js';
import { vatAskOf, vatStateOf } from '../void-live-deploy/lib/vat-ask.js';

test('extract VAT correctly from a total', () => {
  const r = compute({ amount: 1000, rate: 22, mode: 'extract' });
  assert.ok(r);
  assert.equal(r.net, 819.67);
  assert.equal(r.vat, 180.33);
  assert.equal(round2(r.net + r.vat), r.gross);
});

test('add VAT correctly on top', () => {
  const r = compute({ amount: 1000, rate: 20, mode: 'add' });
  assert.ok(r);
  assert.equal(r.gross, 1200);
  assert.equal(r.vat, 200);
});

test('parsing is strict and valid', () => {
  assert.equal(parseAmount('1000'), 1000);
  assert.equal(parseAmount('1 000,50'), 1000.5);
  assert.equal(parseRate('22'), 22);
  assert.equal(parseRate('101'), null);
  assert.equal(parseAmount('-10'), null);
});

test('URL state round-trips', () => {
  const state = { amount: '1000', rate: 20, mode: 'extract', lang: 'ru' };
  const url = queryFromState(state);
  assert.equal(url, '?sum=1000&rate=20&lang=ru');
  const back = stateFromQuery(url);
  assert.equal(back.amount, '1000');
  assert.equal(back.rate, 20);
  assert.equal(back.mode, 'extract');
  assert.equal(back.lang, 'ru');
});

test('natural-language asks route correctly', () => {
  const extracted = vatAskOf('выделить ндс из 1000');
  assert.equal(extracted, '/vat/?sum=1000');
  const added = vatAskOf('начислить ндс 5000 20%');
  assert.equal(added, '/vat/?sum=5000&rate=20&mode=add');
  const english = vatAskOf('remove vat from 100');
  assert.equal(english, '/vat/?sum=100');
});

test('state extraction accepts localized input', () => {
  const s = vatStateOf('ндс 22% от 1000');
  assert.ok(s);
  assert.equal(s.amount, 1000);
  assert.equal(s.rate, 22);
  assert.equal(s.mode, 'extract');
});

test('working display is generated for both modes', () => {
  const extracted = compute({ amount: 1000, rate: 22, mode: 'extract' });
  const steps = workingOf(extracted, 'ru');
  assert.ok(Array.isArray(steps));
  assert.ok(steps.length >= 2);
  const added = compute({ amount: 1000, rate: 20, mode: 'add' });
  const steps2 = workingOf(added, 'en');
  assert.ok(steps2.length >= 2);
});

test("vat skill is registered and matches VAT asks", () => {
  assert.equal(vatSkill.name, "vat");
  assert.ok(vatSkill.match("remove vat from 100", "remove vat from 100"));
  assert.ok(vatSkill.examples.length > 0);
});

test('the rate said first in English is worked out on the card: "add 20% vat to 80", "remove 20% vat from 240", "total with 20% vat on 150"', () => {
  assert.deepEqual(vatStateOf('add 20% vat to 80'), { amount: 80, rate: 20, mode: 'add' });
  assert.deepEqual(vatStateOf('remove 20% vat from 240'), { amount: 240, rate: 20, mode: 'extract' });
  assert.deepEqual(vatStateOf('total with 20% vat on 150'), { amount: 150, rate: 20, mode: 'add' });
  assert.equal(compute(vatStateOf('remove 20% vat from 240')).net, 200);
  assert.equal(compute(vatStateOf('total with 20% vat on 150')).gross, 180);
  for (const a of ['add 20% vat to 80', 'remove 20% vat from 240', 'total with 20% vat on 150']) assert.equal(vatSkill.match(a, a), true, a);
  assert.equal(vatStateOf('22% of 1000'), null);
  assert.deepEqual(vatStateOf('remove vat from 100'), { amount: 100, rate: 22, mode: 'extract' }, 'the asks without a rate keep the default');
});
