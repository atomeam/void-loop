// lib/fakeuser.js: the seed gives the same people, contact details are reserved where a range exists, the formats parse, and the asks
import test from 'node:test';
import assert from 'node:assert/strict';
import { people, only, format, askFake, NATS, FIELDS, uuid, rng, password, PW_SETS } from '../void-live-deploy/lib/fakeuser.js';

test('the same seed gives the same people; another seed gives others', () => {
  assert.deepEqual(people({ seed: 'x', n: 20, nats: ['us', 'de'] }), people({ seed: 'x', n: 20, nats: ['us', 'de'] }));
  assert.notDeepEqual(people({ seed: 'x', n: 5 }), people({ seed: 'y', n: 5 }));
  assert.equal(people({ n: 99999 }).length, 5000); assert.equal(people({ n: 0 }).length, 1);
});
test('every email is at example.com; US, UK and French phones are in the ranges reserved for fiction', () => {
  for (const p of people({ seed: 's', n: 600, nats: Object.keys(NATS) })) {
    assert.match(p.email, /^[a-z0-9.]+@example\.com$/, p.email);
    if (p.nat === 'US') assert.match(p.phone, /^\(\d{3}\) 555-01\d\d$/, p.phone);
    if (p.nat === 'GB') assert.match(p.phone, /^07700 900\d{3}$/, p.phone);
    if (p.nat === 'FR') assert.match(p.phone, /^01 99 00 \d\d \d\d$/, p.phone);
    if (p.nat === 'CA') assert.match(p.phone, /^\(\d{3}\) 555-01\d\d$/, p.phone);
    if (p.nat === 'AU') assert.match(p.phone, /^\(0[2378]\) 5550 \d{4}$/, p.phone);
    assert.equal(p.safePhone, ['US', 'GB', 'FR', 'CA', 'AU'].includes(p.nat), p.nat);
    assert.match(p.picture, /^data:image\/svg\+xml,/); assert.doesNotMatch(decodeURIComponent(p.picture), /<image|href=/, 'initials, never a photo or a fetch');
  }
});
test('a person holds together: age matches the birthday, gender matches the name list, the id is a version-4 UUID', () => {
  const today = new Date(Date.UTC(2026, 9, 24));
  for (const p of people({ seed: 'age', n: 300, nats: Object.keys(NATS) })) {
    const b = new Date(p.dob + 'T00:00:00Z'); let a = today.getUTCFullYear() - b.getUTCFullYear(); if (today < new Date(Date.UTC(today.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()))) a--;
    assert.equal(p.age, a, p.dob); assert.ok(p.age >= 18 && p.age <= 80, String(p.age));
    const N = NATS[p.nat.toLowerCase()]; assert.ok((p.gender === 'female' ? N.f : N.m).includes(p.first), p.first + ' ' + p.gender);
    assert.match(p.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
  assert.ok(people({ seed: 'g', n: 50, gender: 'female' }).every((p) => p.gender === 'female'));
});
test('chosen fields only, in order; every format parses back', () => {
  const rows = only(people({ seed: 'f', n: 3, nats: ['fr'] }), ['name', 'email', 'age']);
  assert.deepEqual(Object.keys(rows[0]), ['name', 'email', 'age']);
  assert.equal(JSON.parse(format(rows, 'json')).results.length, 3);
  const csv = format(rows, 'csv').trim().split('\n'); assert.equal(csv[0], 'name,email,age'); assert.equal(csv.length, 4);
  assert.match(format(rows, 'sql'), /^CREATE TABLE IF NOT EXISTS people \(name TEXT, email TEXT, age REAL\);\nINSERT INTO people \(name, email, age\) VALUES \('/);
  assert.match(format([{ name: "O'Brien" }], 'sql'), /VALUES \('O''Brien'\)/, 'quotes doubled');
  assert.match(format([{ name: 'A, "B"' }], 'csv'), /"A, ""B"""/); assert.match(format(rows, 'xml'), /^<\?xml[\s\S]*<person><name>/); assert.match(format(rows, 'yaml'), /^- name: "/);
  assert.ok(FIELDS.includes('safePhone'));
});
test('uuid and rng are deterministic', () => { assert.equal(uuid(rng('q')), uuid(rng('q'))); });
test('the asks', () => {
  assert.deepEqual(askFake('random user generator'), { n: 10, nats: ['us'], gender: '' });
  assert.deepEqual(askFake('generate 5 fake german women'), { n: 5, nats: ['de'], gender: 'female' });
  assert.deepEqual(askFake('fake name generator'), { n: 10, nats: ['us'], gender: '' }); assert.ok(askFake('20 random users from japan and brazil').nats.length === 2);
  for (const no of ['generate 5 rows of dummy data with name email city', 'random name picker wheel', 'pick a random name from alice, bob', 'who is a random user', 'random number', 'fake news', 'my users', 'name a random country', 'spin the wheel']) assert.equal(askFake(no), null, no);
  // a made-up thing's name is the generators' (skills/textgen.js), not a made-up person: "random band name" was answered with fake people
  for (const no of ['random band name', 'random fantasy name', 'random superhero name', 'give me a random pet name', 'random business names']) assert.equal(askFake(no), null, no);
  assert.ok(askFake('random name') && askFake('fake names'));
});

test('all 21 of randomuser.me\'s nationalities (and Japan); usernames are plain letters whatever the alphabet', () => {
  for (const k of ['au', 'br', 'ca', 'ch', 'de', 'dk', 'es', 'fi', 'fr', 'gb', 'ie', 'in', 'ir', 'mx', 'nl', 'no', 'nz', 'rs', 'tr', 'ua', 'us', 'jp']) assert.ok(NATS[k], k);
  for (const p of people({ seed: 'all', n: 400, nats: Object.keys(NATS) })) assert.match(p.username, /^[a-z]+\.[a-z]+\d\d$/, p.username);
  assert.deepEqual(askFake('5 fake people from new zealand and turkey').nats, ['nz', 'tr']);
});
test('pages: page 1 is the seed as ever, page 2 the next batch, both repeatable; the extra fields leave the rest unchanged', () => {
  const a = people({ seed: 'pg', n: 5 }), b = people({ seed: 'pg', n: 5, page: 2 });
  assert.deepEqual(a.map((p) => p.name), people({ seed: 'pg', n: 5, page: 1 }).map((p) => p.name)); assert.notDeepEqual(a.map((p) => p.email), b.map((p) => p.email));
  assert.deepEqual(b, people({ seed: 'pg', n: 5, page: 2 }));
  for (const p of a) { assert.ok(p.gender === 'male' ? p.title === 'Mr' : ['Ms', 'Mrs', 'Miss'].includes(p.title)); assert.ok(p.registered > p.dob && p.registeredAge >= 0 && p.registeredAge <= 20, p.registered); }
});
test('password options: the chosen sets, each at least once, inside the length range; the rest of the person stays the same', () => {
  let r = rng('pw'); for (let i = 0; i < 200; i++) { const pw = password(r, { sets: ['upper', 'number'], min: 6, max: 9 }); assert.ok(pw.length >= 6 && pw.length <= 9 && /^[A-Z0-9]+$/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw), pw); }
  r = rng('pw2'); const sp = password(r, { sets: ['special'], min: 4, max: 4 }); assert.equal(sp.length, 4); assert.ok([...sp].every((c) => PW_SETS.special.includes(c)));
  const plain = people({ seed: 'q', n: 3 }), opt = people({ seed: 'q', n: 3, pw: { sets: ['lower'], min: 12, max: 12 } });
  assert.deepEqual(opt.map((p) => p.name), plain.map((p) => p.name)); assert.ok(opt.every((p) => /^[a-z]{12}$/.test(p.password)));
});
