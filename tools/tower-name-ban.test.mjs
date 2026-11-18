// The internet-history museum may name rival sites in plain text (no logos).
// Everywhere else on a family floor page, rival hostnames are banned.
// The Versus card and /rival/ pages stay under docs/TOWER-RULES.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS, hostOf } from '../void-live-deploy/lib/tower.js';
import { FAMILIES } from '../void-live-deploy/lib/tower-families.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIR = resolve(root, 'void-live-deploy');
const hosts = [...new Set(FLOORS.map((f) => (hostOf(f.url) || hostOf(f.site) || '').replace(/^www\./, '').toLowerCase()).filter((h) => h && h.includes('.') && h.length >= 5 && h !== 'github.com'))];

const strip = (html) => String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('no family floor page names a rival host in visible markup, except /internet-history/', () => {
  const hits = [];
  for (const f of FAMILIES) {
    const file = join(DIR, f.page.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
    if (!existsSync(file)) { hits.push(f.page + ' missing'); continue; }
    const text = strip(readFileSync(file, 'utf8')).toLowerCase();
    for (const h of hosts) if (text.includes(h)) { hits.push(f.page + ': ' + h); break; }
  }
  assert.deepEqual(hits, [], 'rival names on family pages:\n' + hits.join('\n'));
});

test('the name-ban allows only /internet-history/ to name studied sites', () => {
  assert.ok(FAMILIES.every((f) => f.page !== '/internet-history/'), 'the museum is not a family tool page');
});
