import test from 'node:test';
import vatSkill from '../void-live-deploy/skills/vat.js';
import assert from 'node:assert/strict';
import { compute, parseAmount, parseRate, round2, stateFromQuery, queryFromState, workingOf, moneyWords, RU_RATES, rateNote, hashFromState, stateFromHash } from '../void-live-deploy/lib/vat.js';
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

// ndscalc.ru's tower (asked by Verse: "Implement the URL hash serialization logic for ndscalc.ru."): the whole state rides in the hash
test('every Russian rate adds and takes out VAT to the kopeck, net plus VAT is the total', () => {
  assert.deepEqual(RU_RATES.map((r) => r.rate), [22, 20, 10, 7, 5, 0]);
  for (const { rate } of RU_RATES) for (const amount of [1000, 0.01, 99999.99, 123456.78]) {
    const a = compute({ amount, rate, mode: 'add' }), x = compute({ amount, rate, mode: 'extract' });
    assert.equal(round2(a.net + a.vat), a.gross, 'add ' + amount + ' at ' + rate);
    assert.equal(round2(x.net + x.vat), x.gross, 'extract ' + amount + ' at ' + rate);
  }
  assert.deepEqual([compute({ amount: 1000, rate: 20, mode: 'add' }).vat, compute({ amount: 1000, rate: 20, mode: 'extract' }).vat], [200, 166.67]);
  assert.deepEqual([compute({ amount: 1000, rate: 10, mode: 'extract' }).vat, compute({ amount: 1000, rate: 7, mode: 'extract' }).vat, compute({ amount: 1000, rate: 5, mode: 'extract' }).vat], [90.91, 65.42, 47.62]);
  assert.equal(compute({ amount: 1000, rate: 0, mode: 'extract' }).vat, 0);
  assert.match(rateNote(22), /from 1 January 2026/); assert.equal(rateNote(18), '');
});
test('the VAT state survives a round trip through the hash, and a hash about something else is left alone', () => {
  for (const st of [{ amount: '1000', rate: 22, mode: 'extract' }, { amount: '1000,50', rate: 7, mode: 'add' }, { amount: '', rate: 0, mode: 'extract' }, { amount: '99999.99', rate: 10, mode: 'add' }]) {
    const h = hashFromState(st); assert.match(h, /^#vat=/); assert.deepEqual(stateFromHash(h), st, h);
    assert.deepEqual(compute(stateFromHash(h)), compute(st));
  }
  assert.equal(hashFromState({ amount: '1 000', rate: 20, mode: 'add' }), '#vat=add&sum=1000&rate=20');
  assert.deepEqual(stateFromHash('#vat=extract&sum=1000&rate=22'), { amount: '1000', rate: 22, mode: 'extract' });
  assert.deepEqual(stateFromHash('vat=weird&rate=250'), { amount: '', rate: 22, mode: 'extract' }, 'a bad rate and mode fall back');
  for (const h of ['', '#', '#vat', '#loan', '#sum=1000&vat=add']) assert.equal(stateFromHash(h), null, h);
  assert.ok(stateFromHash('#vat=add&sum=' + '9'.repeat(80)).amount.length <= 40);
});
test('the calculator page reads and writes the VAT hash, offers every Russian rate, and copies its link', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../void-live-deploy/calculator/index.html', import.meta.url), 'utf8');
  assert.match(html, /V\.stateFromHash\(location\.hash\)/); assert.match(html, /V\.hashFromState\(/); assert.match(html, /history\.replaceState\(null, '', location\.pathname \+ location\.search \+ h\)/);
  for (const r of RU_RATES) assert.ok(html.includes('data-rate="' + r.rate + '">' + r.rate + '%</button>'), r.rate + '% button');
  assert.match(html, /id="vcopy"/); assert.match(html, /\/\^#vat=\/\.test\(location\.hash\)/, 'a #vat= link opens the VAT panel');
});
