// lib/tower-topic.js: a Versus site is matched to the Verse page that already does its job (owner, 2026-11-03: "still says no vat page on the card")
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TOPICS, topicOf, topicPageOf } from '../void-live-deploy/lib/tower-topic.js';
import { tower, frontierPage, LANE_PAGES } from '../void-live-deploy/lib/tower.js';

test('ndscalc.ru, a Russian VAT calculator, is the calculator in VAT mode; plain words that are not the job match nothing', () => {
  assert.equal(topicPageOf('НДС калькулятор онлайн - как выделить НДС 22% и как начислить НДС', 'ndscalc.ru'), '/calculator/?mode=vat');
  assert.equal(topicPageOf('Online Calculator', 'online-calculator.com'), '/calculator/');
  assert.equal(topicPageOf('Unit Converter', 'convertlive.com'), '/convert/');
  assert.equal(topicOf('vTuner Internet Radio', 'vtuner.com'), null, 'a radio is not a tuner');
  assert.equal(topicOf('Password Recovery Software - Recover Lost Password', 'top-password.com'), null);
  assert.equal(topicOf('Dibujos Para Colorear Gratis En PDF E Imprimir', 'colorearm.com'), null, 'a colouring page in PDF is not a PDF tool');
});
test('every topic names a page that exists', () => {
  for (const [, , page] of TOPICS) { const dir = page.replace(/[?#].*$/, ''); assert.ok(existsSync(new URL('../void-live-deploy' + dir + 'index.html', import.meta.url)), page); }
});
test('the tower gives a frontier site its page by topic, and a host page first', () => {
  assert.equal(LANE_PAGES['ndscalc.ru'], '/calculator/?mode=vat');
  assert.deepEqual(frontierPage({ host: 'ndscalc.ru', title: 'НДС калькулятор' }), { page: '/calculator/?mode=vat', topic: 'vat' });
  assert.deepEqual(frontierPage({ host: 'onlineconverter.com', title: 'Unit converter' }), { page: '/converter/' });
  const t = tower([], {}, { sites: [{ site: 'ndscalc.ru', hardness: 1, title: 'НДС калькулятор онлайн' }] }, null, null, null, 'ndscalc.ru');
  const f = t.floors.find((x) => x.id === 'ndscalc.ru'); assert.equal(f.page, '/calculator/?mode=vat'); assert.equal(f.topic, 'vat');
});
