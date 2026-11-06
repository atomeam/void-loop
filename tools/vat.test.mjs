import test from 'node:test';
import vatSkill from '../void-live-deploy/skills/vat.js';
import assert from 'node:assert/strict';
import { compute, parseAmount, parseRate, round2, stateFromQuery, queryFromState, workingOf, moneyWords } from '../void-live-deploy/lib/vat.js';
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

test('the total is spelled in words on the device', () => {
  const r = compute({ amount: 1000, rate: 22, mode: 'extract' });
  assert.equal(moneyWords(r.gross), 'one thousand');
  assert.equal(moneyWords(r.net), 'eight hundred nineteen and 67/100');
  assert.equal(moneyWords(1200), 'one thousand two hundred');
  assert.equal(moneyWords(-1), '');
});

test("vat skill is registered and matches VAT asks", () => {
  assert.equal(vatSkill.name, "vat");
  assert.ok(vatSkill.match("remove vat from 100", "remove vat from 100"));
  assert.ok(vatSkill.examples.length > 0);
});
