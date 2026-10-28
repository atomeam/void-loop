// lib/handoff.js: the lists carried between /wheel/, /prizes/ and /tournaments/ (in the link, and one copy in localStorage on a click)
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, RING, GAME_NIGHT, wheelLink, prizesLink, tournamentsLink, rosterOf, labelsFrom, get, put, textOfHandoff } from '../void-live-deploy/lib/handoff.js';
import { open } from '../void-live-deploy/lib/wheel.js';
import { parseSlices, odds, labelsOf } from '../void-live-deploy/lib/prizes.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('wheel to prizes: plain names arrive as value 1, weight 1 (nothing NaN); wheel weights carry over', () => {
  const href = prizesLink('Ann\nBob *3'); assert.equal(href, '/prizes/?s=Ann%0ABob%20*3');
  const s = parseSlices(new URLSearchParams(href.split('?')[1]).get('s'));
  assert.deepEqual(s, [{ label: 'Ann', value: 1, weight: 1 }, { label: 'Bob', value: 1, weight: 3 }]);
  assert.ok(!JSON.stringify(odds(s)).includes('null')); assert.equal(prizesLink('  '), null);
});

test('prizes to wheel: the :value:weight comes off; the wheel opens with the bare names', () => {
  const labels = labelsOf(parseSlices('Grand prize:500:1\nTote bag:10:39'));
  const href = wheelLink(labels); assert.ok(href.startsWith('/wheel/#'));
  assert.deepEqual(open(href.slice('/wheel/#'.length)), [{ label: 'Grand prize', weight: 1 }, { label: 'Tote bag', weight: 1 }]);
  assert.deepEqual(labelsFrom('Grand prize:500:1\nAnn *2\nann'), ['Grand prize', 'Ann'], 'suffixes off, each name once');
  assert.equal(wheelLink([]), null);
});

test('to tournaments: the labels become a roster on 0 points under Game night', () => {
  const href = tournamentsLink(['Grand prize', 'Team: Red', 'team: red', 'Blue']);
  assert.match(href, /^\/tournaments\/\?roster=.*&preset=gamenight$/);
  const r = rosterOf(href.split('?')[1]);
  assert.deepEqual(r, [{ name: 'Grand prize', points: 0 }, { name: 'Team Red', points: 0 }, { name: 'Blue', points: 0 }]);
  assert.equal(GAME_NIGHT.name, 'Game night'); assert.ok(r.every((t) => t.points === 0));
  assert.deepEqual(rosterOf('?results=a:1:0'), []); assert.equal(tournamentsLink([]), null);
});

test('localStorage verse_handoff: written only by put, read back checked; junk and unknown pages ignored', () => {
  const s = mem(); assert.equal(get(s), null);
  assert.equal(KEY, 'verse_handoff'); assert.deepEqual(RING.map((r) => r[0]), ['/wheel/', '/prizes/', '/tournaments/', '/random/', '/generators/']);
  put('list', 'wheel entries', ['Ann', 'Bob'], '/wheel/', s);
  assert.deepEqual(JSON.parse(s.getItem(KEY)), { type: 'list', label: 'wheel entries', data: ['Ann', 'Bob'], fromPage: '/wheel/' });
  const h = get(s); assert.deepEqual(h, { type: 'list', label: 'wheel entries', data: ['Ann', 'Bob'], fromPage: '/wheel/' }); assert.equal(textOfHandoff(h), 'Ann\nBob');
  s.setItem(KEY, '{bad'); assert.equal(get(s), null);
  s.setItem(KEY, JSON.stringify({ type: 'list', label: 'x', data: ['a'], fromPage: 'https://evil.example/' })); assert.equal(get(s), null);
  s.setItem(KEY, JSON.stringify({ type: 'list', label: 'x', data: [], fromPage: '/wheel/' })); assert.equal(get(s), null);
});
