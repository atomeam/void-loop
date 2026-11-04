// Language-pair phrasebook bots (bots/lang-pairs.js): every pair passes real checks against CLDR and a hand-kept word list, a wrong
// word fails, and a bot that does not pass is listed as a fix job instead of shipping. Run: node --test tools/lang-pairs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { langPairs, translate, KNOWN, LANGS } from '../void-live-deploy/bots/lang-pairs.js';
import { check } from '../void-live-deploy/bots/families.js';
import { familyRows, fixJobs } from './bot-factory.mjs';

test('one phrasebook bot per ordered language pair, every one passing its checks', () => {
  const P = langPairs();
  assert.equal(P.length, LANGS.length * (LANGS.length - 1));
  assert.equal(new Set(P.map((b) => b.id)).size, P.length);
  assert.deepEqual(P.filter((b) => !check(b).ok).map((b) => b.id), []);
  assert.equal(P.find((b) => b.id === 'phrase-es-to-fr').run('lunes, mañana, Alemania, enero'), 'lundi, demain, Allemagne, janvier');
  assert.equal(P.find((b) => b.id === 'phrase-de-to-ja').run('Montag'), '月曜日');
});

test('a word with two meanings comes back with both; a word not in the phrasebook is marked, never guessed', () => {
  assert.equal(translate('hi', 'en', 'कल'), 'tomorrow / yesterday');
  assert.equal(translate('fi', 'en', 'saksa'), 'German / Germany');
  assert.equal(translate('en', 'es', 'banana'), '(not in the phrasebook: banana)');
});

test('a wrong known word fails the bot, and the factory lists it as a fix job instead of shipping it', () => {
  const keep = KNOWN.fr.monday;
  try {
    KNOWN.fr.monday = 'lunedi';
    const b = langPairs().find((x) => x.id === 'phrase-es-to-fr');
    assert.deepEqual(check(b).fails, ['known answer']);
    const fams = familyRows([b]), jobs = fixJobs([], fams);
    assert.equal(fams[0].live, 0);
    assert.equal(jobs[0].target, 'bot:phrase-es-to-fr'); assert.match(jobs[0].ask, /known answer/);
  } finally { KNOWN.fr.monday = keep; }
  const ghost = { ...langPairs()[0], from: ['bots/not-a-bot'] };
  assert.match(familyRows([ghost])[0].failed[0], /lineage not found: bots\/not-a-bot/);
});

test('the factory gate passes the whole family with no fix jobs, and the credit for CLDR is listed for /credits/', () => {
  const f = familyRows().find((x) => x.family === 'language pairs');
  assert.equal(f.live, f.total); assert.equal(f.total, LANGS.length * (LANGS.length - 1));
  assert.deepEqual(fixJobs([], [f]), []);
  const credits = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/credits.json', import.meta.url), 'utf8'));
  assert.ok(credits.some((c) => /CLDR/.test(c.name) && /Unicode License/.test(c.license)));
});
