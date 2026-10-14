// Simple suite-style check for film-meta match (one suite check as required).
// Run with: node tools/film-meta.test.mjs
import { titleOf } from '../void-live-deploy/skills/film-meta.js';

const cases = [
  ['film metadata for Inception', 'Inception'],
  ['discover film The Matrix', 'The Matrix'],
  ['film json for Titanic', 'Titanic'],
  ['films', null],
  ['what is a film', null],
];

let ok = 0;
for (const [ask, expect] of cases) {
  const got = titleOf(ask);
  if (got === expect) ok++;
  else console.error('FAIL', ask, 'expected', expect, 'got', got);
}
console.log(ok + '/' + cases.length + ' passed');
process.exit(ok === cases.length ? 0 : 1);
