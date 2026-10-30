// The handoff scan (tools/handoff-scan.mjs; owner, 2026-10-28): declarations parse strictly, every page has its types (new pages in their
// own tag), the legacy list only shrinks, and the connections built are seen as built.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TYPES, parseDecl, declOf, inferTypes, usefulness, scan, legacy, pages, report } from './handoff-scan.mjs';

const site = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
/** the number of pages in tools/handoff-types.json when the rule started (2026-10-28): it may fall, never rise */
const LEGACY_AT_START = 85;

test('a declaration parses strictly: known types only, in and out, none allowed', () => {
  assert.deepEqual(parseDecl('in: names, number; out: names'), { in: ['names', 'number'], out: ['names'] });
  assert.deepEqual(parseDecl('in: none; out: image'), { in: [], out: ['image'] });
  assert.deepEqual(parseDecl('out: event'), { in: [], out: ['event'] });
  for (const bad of ['', 'in: spaceship', 'takes: number', 'in number', null, 42, 'in: number; nonsense']) assert.equal(parseDecl(bad), null, String(bad));
  assert.equal(declOf('<meta name="verse-handoff" content="in: number; out: number">'), 'in: number; out: number');
  assert.equal(declOf('<meta name="description" content="x">'), null);
});

test('every page says what it takes and gives: its own tag, or the legacy list (new pages need the tag)', () => {
  const types = legacy(), missing = [], badTag = [];
  for (const r of pages()) {
    const html = fs.readFileSync(path.join(site, r, 'index.html'), 'utf8'), tag = declOf(html);
    if (tag != null && !parseDecl(tag)) badTag.push(r);
    if (tag == null && !parseDecl(types[r]) && !/^\/(?:obituaries|privacy|fix|podcast|cheat-codes|keep-it-running|first-automation-setup|full-stack-audit|one-time-fix|hosting|store|ledger|identity|conquered|claims|models|studies|og|g|tools|music|humans|remediation|review|cpan|code-review|data|compare)\b/.test(r)) missing.push(r);
  }
  assert.deepEqual(badTag, [], 'a verse-handoff tag that does not parse (types: ' + Object.keys(TYPES).join(', ') + ')');
  assert.deepEqual(missing, [], 'a new page ships with <meta name="verse-handoff" content="in: ...; out: ..."> (node tools/handoff-scan.mjs --hint /route/ suggests one)');
});

test('the legacy list only shrinks: no new entries, none for a page with its own tag or a page that is gone', () => {
  const types = legacy(), routes = new Set(pages());
  assert.ok(Object.keys(types).length <= LEGACY_AT_START, 'tools/handoff-types.json grew: a new page declares its types in its own tag');
  for (const [r, v] of Object.entries(types)) {
    assert.ok(parseDecl(v), r + ': ' + v);
    assert.ok(routes.has(r), r + ' is listed but has no page');
    assert.equal(declOf(fs.readFileSync(path.join(site, r, 'index.html'), 'utf8')), null, r + ' has its own tag now: take it off tools/handoff-types.json');
  }
});

test('usefulness: a shared type scores, a page that reads its link doubles it, nothing shared is zero', () => {
  const a = { out: ['number'], declared: true }, b = { in: ['number'], readsLink: true, declared: true }, c = { in: ['image'], readsLink: true };
  assert.equal(usefulness(a, b).score, TYPES.number * 2 + 1);
  assert.equal(usefulness(a, { ...b, readsLink: false, declared: false }).score, TYPES.number);
  assert.equal(usefulness(a, c).score, 0);
});

test('inferTypes reads a page\'s controls (a hint for a tag)', () => {
  assert.deepEqual(inferTypes('<input type="date"><output>'), { in: ['date'], out: ['date'] });
  assert.ok(inferTypes('<textarea placeholder="names, one per line"></textarea>').in.includes('names'));
});

test('the scan sees what is built: the BPM counter and the metronome hand each other the tempo; the ring is built', () => {
  const s = scan(), has = (a, b) => s.built.some((x) => x.from === a && x.to === b);
  assert.ok(has('/bpm/', '/metronome/') && has('/metronome/', '/bpm/'), 'bpm <-> metronome');
  assert.ok(has('/wheel/', '/tournaments/'), 'the verse_handoff ring');
  assert.ok(has('/flights/', '/time/') && has('/flights/', '/calendar/'), 'links built in a module the page loads by <script src> and imports further down');
  assert.ok(!has('/rap/', '/pdf/'), 'a shared library deep in another page\'s chain is not that page\'s own');
  assert.ok(!s.gaps.some((g) => g.from === '/bpm/' && g.to === '/metronome/'), 'a built connection is not a gap');
  assert.deepEqual(s.undeclared, []);
  assert.ok(s.gaps.length > 0 && s.gaps.every((g, i) => i === 0 || s.gaps[i - 1].score >= g.score), 'ranked, most useful first');
});

test('docs/HANDOFF-GAPS.md is current (node tools/handoff-scan.mjs --write)', () => {
  const doc = fs.readFileSync(path.join(site, '..', 'docs', 'HANDOFF-GAPS.md'), 'utf8');
  assert.equal(doc, report(scan()), 'stale: node tools/handoff-scan.mjs --write');
});
