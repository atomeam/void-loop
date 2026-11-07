// action.yml at the repo root (the one GitHub Marketplace can list) is review/action.yml with its tools at ./tools, not ../tools:
// the same inputs, the same steps, the same pinned payer, so the Marketplace Action and atomeam/void-loop/review@main do the same review.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const strip = (s) => s.split('\n').filter((l) => !/^#/.test(l)).join('\n').trim();
const nested = readFileSync(new URL('review/action.yml', root), 'utf8');
const top = readFileSync(new URL('action.yml', root), 'utf8');
assert.ok(nested.includes('{{ github.action_path }}/../tools'), 'review/action.yml finds its tools one folder up');
assert.equal(strip(top), strip(nested.replaceAll('{{ github.action_path }}/../tools', '{{ github.action_path }}/tools')), 'the root action.yml is review/action.yml with ./tools');
for (const m of top.matchAll(/\$TOOLS\/([a-z0-9-]+\.mjs)/g)) assert.ok(existsSync(new URL('tools/' + m[1], root)), m[1] + ' is in tools/');
assert.ok(!existsSync(new URL('action.yaml', root)), 'one metadata file at the root (Marketplace lists only one)');
console.log('action root: ok');
