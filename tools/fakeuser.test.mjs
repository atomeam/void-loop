// lib/fakeuser.js: the seed gives the same people, contact details are reserved where a range exists, the formats parse, and the asks
import test from 'node:test';
import assert from 'node:assert/strict';
import { people, only, format, askFake, NATS, FIELDS, uuid, rng } from '../void-live-deploy/lib/fakeuser.js';

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
    assert.equal(p.safePhone, ['US', 'GB', 'FR'].includes(p.nat), p.nat);
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
});
