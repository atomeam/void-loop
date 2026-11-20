import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { echoVaultOf, isPlainTextTool } from '../void-live-deploy/lib/echo-vault.js';
import { advance } from './tower-target.mjs';

const page = readFileSync(new URL('../void-live-deploy/echo-vault/index.html', import.meta.url), 'utf8');
const redirects = readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8');
const app = readFileSync(new URL('../void-live-deploy/echo-vault/app.js', import.meta.url), 'utf8');

test('Echo Vault names the archive and keeps reading-only sites off the public floor', () => {
  assert.match(page, /<h1>Echo Vault: Internet History Archive<\/h1>/);
  assert.match(page, /only something to read/);
  assert.match(page, /id="paper-notes"/);
  assert.match(page, /id="hosting-brochure"/);
  assert.match(page, /id="light-page"/);
  assert.match(page, /id="album-list"/);
  assert.match(page, /5 April 2013/);
  assert.match(page, /13 November 2026/);
  assert.match(page, /22 November 2013/);
  assert.match(page, /9 November 2026/);
  assert.doesNotMatch(page, /the original/i);
  assert.doesNotMatch(page, /thunit\.com|randomarea\.com|nameunit\.com|tsundere\.pw|motherfuckingwebsite/i);
  assert.equal(FLOORS.some((f) => f.id === 'research' || f.page === '/research/'), false);
  assert.equal(FLOORS.some((f) => /tsundere|motherfuckingwebsite/i.test(f.site || '')), false);
  assert.match(redirects, /\/research\/? \/echo-vault\/\?entry=paper-notes 301/);
  assert.match(redirects, /\/internet-history\/? \/echo-vault\/ 301/);
  assert.match(app, /location\.hash/);
});

test('a site with no tool to rebuild goes to Echo Vault; a real tool does not', () => {
  assert.match(echoVaultOf({ kind: 'a short brochure', controls: 0, bytes: 800 }), /only something to read/);
  assert.match(echoVaultOf({ title: 'a silent album track list', controls: 0, bytes: 1200 }), /nothing a visitor can use|only something to read/);
  assert.match(echoVaultOf({ controls: 0, bytes: 1200 }), /nothing a visitor can use/);
  assert.match(echoVaultOf({ status: 'non-site', kind: 'an inert stub page' }), /non-site/);
  assert.equal(echoVaultOf({ controls: 12, bytes: 8000, forms: 2, kind: 'image board' }), '');
  assert.equal(echoVaultOf({ plain: true, controls: 0, bytes: 14, sample: '1.2.3.4' }), '');
  assert.ok(isPlainTextTool({ plain: true, bytes: 14, sample: '1.2.3.4' }));
  assert.equal(echoVaultOf({ controls: 4, bytes: 50000, forms: 1 }), '');
});

test('the climb sends a reading-only target to Echo Vault and takes the next real site', () => {
  const floors = [
    { id: 'stub-list', n: 0, m: 12, assim: 0, controls: 0, bytes: 1200, kind: 'a silent album track list', open: ['speed'] },
    { id: 'coin flip', n: 11, m: 12, assim: 80 },
  ];
  const { file, why } = advance({ id: 'stub-list', n: 0, assim: 0, since: '2026-11-09' }, floors, '2026-11-20');
  assert.match(why, /Echo Vault/);
  assert.equal(file.id, 'coin flip');
  assert.ok(file.settled.some((s) => s.id === 'stub-list' && s.as === 'echo-vault'));
  const kept = advance({ id: 'coin flip', n: 11, assim: 80, since: '2026-11-20' }, floors, '2026-11-20');
  assert.equal(kept.file.id, 'coin flip');
  assert.equal(kept.why, '');
});
