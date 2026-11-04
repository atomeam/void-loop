import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseVerdict, evaluate, summarize, docWith, shelfRows, targetOf } from './autosalvage/unify.mjs';

test('license: permissive ok, share-alike isolated, none skipped', () => {
  assert.equal(licenseVerdict('MIT').ok, true);
  assert.equal(licenseVerdict('AGPL-3.0').isolated, true);
  assert.equal(licenseVerdict('').ok, false);
  assert.equal(licenseVerdict('NOASSERTION').ok, false);
  assert.equal(licenseVerdict('WTFPL-ish').ok, false);
});

test('evaluate classifies unified, live, history, salvageable, skipped', () => {
  const pieces = [
    { id: 'a', kind: 'draft', name: 'oldthing', path: 'drafts/x.old.md', files: 1 },
    { id: 'b', kind: 'draft', name: 'liveone', path: 'drafts/liveone', files: 3 },
    { id: 'c', kind: 'archived repo', name: 'repo', path: 'archive/repos/repo', files: 9, code: 4, tests: 2 },
    { id: 'd', kind: 'outside', name: 'x/y', path: 'https://github.com/x/y', files: 1, license: '' },
    { id: 'e', kind: 'outside', name: 'x/z', path: 'https://github.com/x/z', files: 1, license: 'MIT', author: 'x' },
    { id: 'f', kind: 'draft', name: 'done', path: 'drafts/done', files: 1 },
  ];
  const rows = evaluate(pieces, { unified: { f: { target: 'bot', into: '/bots/', test: 't.mjs' } }, named: (n) => n === 'liveone' });
  assert.deepEqual(rows.map((r) => r.status), ['history', 'live', 'salvageable', 'skipped', 'salvageable', 'unified']);
  assert.equal(rows[2].target, 'skill');
  const s = summarize(rows, '2026-11-03');
  assert.equal(s.scanned, 6); assert.equal(s.remaining, 2);
  assert.deepEqual(s.credits.map((c) => c.license), ['MIT']);
  const md = docWith('# shelf\n', s);
  assert.match(md, /autosalvage:start[\s\S]*Scanned 6 pieces[\s\S]*autosalvage:end/);
  assert.equal(docWith(md, s), md, 'rewriting is stable');
});

test('shelf rows and targets', () => {
  assert.deepEqual(shelfRows('| `tools/x.mjs` | a | b | S |\n<!-- autosalvage:start -->\n| `no/y` | a | b | S |').map((r) => r.path), ['tools/x.mjs']);
  assert.equal(targetOf({ name: 'helper-bot', kind: 'draft', path: '' }), 'bot');
  assert.equal(targetOf({ name: 'x', kind: 'old workflow', path: '' }), 'tool');
});
