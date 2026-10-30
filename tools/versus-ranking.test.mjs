// tools/versus-ranking.mjs: a versus job names only a site of the smallest-first ranking, never a gambling or crypto site (#1470).
// Run: node --test tools/versus-ranking.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OFF_LIMITS, versusHost, rankingOf, offLimits, versusAllowed } from './versus-ranking.mjs';
import { pickCandidates } from './tower-self.mjs';
import { runJob } from './verse-job.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

const frontier = { sites: [
  { site: 'a.test', rank: 900000, hardness: 12, title: 'A unit converter' },
  { site: 'slots.test', rank: 800000, hardness: 11, title: 'Online Slots and Jackpot games' },
  { site: 'b.test', rank: 700000, hardness: 14, title: 'Hex color picker' },
  { site: 'swap.test', rank: 600000, hardness: 13, title: 'Buy and swap crypto' },
] };
const floors = [{ id: 'f1', site: 'floor.test', url: 'https://floor.test/', label: 'Timer', ask: 'online timer' }];
const real = () => rankingOf({ frontier: JSON.parse(fs.readFileSync('void-live-deploy/tower.frontier.json', 'utf8')), floors: FLOORS, state: JSON.parse(fs.readFileSync('domains/tower-self.json', 'utf8')) });

test('a versus job names a site of the ranking or it does not run', () => {
  const r = rankingOf({ frontier, floors });
  assert.equal(versusHost('versus:a.test:speed'), 'a.test'); assert.equal(versusHost('feature:dark mode'), null);
  assert.deepEqual(versusAllowed('versus:a.test', r), { ok: true });
  assert.deepEqual(versusAllowed('versus:floor.test:offline', r), { ok: true }, 'a floor is in the ranking');
  assert.match(versusAllowed('versus:elsewhere.test', r).why, /not in the smallest-first ranking/);
  assert.match(versusAllowed('versus:', r).why, /names no site/);
  assert.deepEqual(versusAllowed('feature:dark mode', r), { ok: true }, 'only versus jobs are held to the ranking');
});

test('a gambling or crypto site is off limits by its title, the scan\'s words about it or a floor\'s own words', () => {
  const r = rankingOf({ frontier, floors, state: { sites: { 'b.test': { why: 'a crypto rewards and gambling platform' }, 'elsewhere.test': { why: 'a casino' } } } });
  assert.equal(offLimits('slots.test', r), true); assert.equal(offLimits('swap.test', r), true);
  assert.equal(offLimits('b.test', r), true, 'the model\'s own words from the scan count');
  assert.equal(offLimits('a.test', r), false);
  assert.match(versusAllowed('versus:slots.test', r).why, /gambling or crypto/);
  assert.equal(r.hosts.has('elsewhere.test'), false, 'the scan state adds words, never a site');
  for (const word of ['cryptography tool', 'alphabet soup', 'pick a time slot', 'better diff', 'spinner wheel']) assert.doesNotMatch(word, OFF_LIMITS, word);
});

test('the pick reads only ranked sites and never a gambling or crypto one', () => {
  const picked = pickCandidates(frontier, {}, { at: Date.parse('2026-10-29T00:00:00Z'), floors, max: 10 }).map((x) => x.host);
  assert.deepEqual(picked, ['a.test', 'b.test']);
  const r = rankingOf({ frontier, floors });
  for (const h of picked) assert.ok(versusAllowed('versus:' + h, r).ok, h);
});

test('on the real tower: wheelofgold.com (#1470) is off limits, and every site the pick would read is a ranked site the guard lets through', () => {
  const r = real();
  assert.match(versusAllowed('versus:wheelofgold.com', r).why, /gambling or crypto/);
  assert.ok(versusAllowed('versus:wheelofnames.com', r).ok, 'a floor that only learned "with crypto" (the Web Crypto API) is not caught');
  const fr = JSON.parse(fs.readFileSync('void-live-deploy/tower.frontier.json', 'utf8'));
  const picked = pickCandidates(fr, { sites: {} }, { max: 1000 });
  assert.ok(picked.length > 0);
  for (const c of picked) assert.ok(versusAllowed('versus:' + c.host, r).ok, c.host + ' is picked but the guard refuses it');
});

test('the job runner sets aside a versus job outside the ranking before any lap runs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vr-')), stub = join(dir, 'lap.mjs'), ran = join(dir, 'ran'), patches = [];
  writeFileSync(stub, "import fs from 'node:fs'; fs.writeFileSync(" + JSON.stringify(ran) + ", 'x'); console.log(JSON.stringify({ outcome: 'shipped', task: { kind: 'next' } }));\n");
  let target = '';
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET') return res.end(JSON.stringify({ items: [{ id: 'j1', target, state: 'building', note: 'claimed by conductor', ask: 'Versus: build a page' }] }));
      patches.push(JSON.parse(body)); res.end('{}');
    });
  }).listen(0);
  try {
    const env = { ...process.env, VOID_OWNER_TOKEN: 'tkn', VOID_API: 'http://127.0.0.1:' + server.address().port + '/api/queue', VERSE_LOOP_BIN: stub };
    for (const t of ['versus:wheelofgold.com', 'versus:not-ranked.example']) {
      target = t;
      const r = await runJob('j1', { env });
      assert.equal(r.patch.state, 'set aside', t); assert.match(r.patch.note, /not run: /, t);
      assert.equal(fs.existsSync(ran), false, t + ': no lap ran');
    }
    assert.deepEqual(patches.map((p) => p.state), ['set aside', 'set aside']);
  } finally { server.close(); }
});
